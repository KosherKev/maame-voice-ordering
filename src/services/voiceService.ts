import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { asrClient, ttsClient, llmClient } from '../integrations/index.js';
import { NotFoundError, InvalidStateTransitionError, UpstreamProviderError } from '../errors/index.js';

export interface InboundCallParams {
  sessionId: string;
  callerNumber: string;
  isActive: string;
  recordingUrl?: string;
  action?: string;
}

export class VoiceService {
  /**
   * Main entry point to process voice channel conversational state turns.
   * Produces XML response instructions for Africa's Talking.
   */
  async handleInboundCall(params: InboundCallParams): Promise<string> {
    const { sessionId, callerNumber, isActive, recordingUrl, action } = params;

    // Check for call hangup
    if (isActive === '0') {
      await this.handleCallEnd(sessionId);
      return this.generateHangupXml('Call ended.');
    }

    // 1. Initialize session if it is a new call
    if (!action) {
      return this.handleCallStart(sessionId, callerNumber);
    }

    // 2. Process customer speech response
    if (action === 'process_speech') {
      if (!recordingUrl) {
        return this.generateRecordXml('I did not catch that. Please say what you would like to order.', sessionId);
      }
      return this.processSpeechTurn(sessionId, callerNumber, recordingUrl);
    }

    return this.generateHangupXml('Invalid action.');
  }

  /**
   * Handles the call start event. Creates session and welcomes customer.
   */
  private async handleCallStart(sessionId: string, callerNumber: string): Promise<string> {
    // Check if session already exists (re-entrant call start)
    let session = await prisma.callSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      session = await prisma.callSession.create({
        data: {
          id: sessionId,
          customerPhone: callerNumber,
          status: 'active',
          transcript: [],
        },
      });
    }

    const welcomeText = 'Ɛte sɛn! Welcome to Maame. What food would you like to order today?';
    
    // Append initial greeting from Maame to the transcript
    await this.appendTranscript(sessionId, 'maame', welcomeText);

    return this.generateRecordXml(welcomeText, sessionId);
  }

  /**
   * Processes the recorded user statement. Transcribes, gets LLM decision,
   * mutates order basket, and returns play/record XML prompts.
   */
  private async processSpeechTurn(sessionId: string, callerNumber: string, recordingUrl: string): Promise<string> {
    // Load session
    const session = await prisma.callSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundError(`Call session not found: ${sessionId}`);
    }

    // 1. Transcribe speech using ASR (Twi/English)
    const transcription = await asrClient.transcribe(recordingUrl, 'tw');
    
    if (!transcription.trim()) {
      return this.generateRecordXml('I did not hear anything. Please speak clearly.', sessionId);
    }

    // Append customer turn to transcript
    const updatedTranscript = await this.appendTranscript(sessionId, 'customer', transcription);

    // 2. Fetch catalog and current basket
    const catalog = await this.fetchActiveCatalog();
    
    const currentOrder = await prisma.order.findUnique({
      where: { callSessionId: sessionId },
      include: { orderItems: true },
    });

    const basket = currentOrder 
      ? currentOrder.orderItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPriceInPesewas: item.unitPriceInPesewas,
          vendorId: item.vendorId,
        }))
      : [];

    // 3. Process transcription via LLM matching
    const decision = await llmClient.processSpeech(catalog, basket, updatedTranscript as any, transcription);

    // Record the LLM provider used in order if order exists
    if (currentOrder && !currentOrder.llmProviderUsed) {
      await prisma.order.update({
        where: { id: currentOrder.id },
        data: { llmProviderUsed: env.LLM_PROVIDER },
      });
    }

    // 4. Handle LLM Intents
    switch (decision.intent) {
      case 'cancel':
        return this.handleOrderCancel(sessionId, currentOrder?.id);

      case 'ask_clarification':
        const clarQuestion = decision.clarifyingQuestion || 'Could you please repeat that?';
        await this.appendTranscript(sessionId, 'maame', clarQuestion);
        return this.generateRecordXml(clarQuestion, sessionId);

      case 'add_item':
      case 'remove_item':
        return this.handleBasketUpdate(sessionId, callerNumber, currentOrder, decision, catalog);

      case 'confirm_order':
        return this.handleOrderConfirm(sessionId, currentOrder, decision);

      default:
        return this.generateRecordXml('Sorry, I am not sure how to process that. What would you like to do?', sessionId);
    }
  }

  /**
   * Handles adding/removing items in the database, verifying single-vendor constraint.
   */
  private async handleBasketUpdate(
    sessionId: string,
    callerNumber: string,
    currentOrder: any,
    decision: any,
    catalog: any[],
  ): Promise<string> {
    const matchedItems = decision.matchedItems || [];

    if (matchedItems.length === 0) {
      const fallbackText = decision.clarifyingQuestion || 'I could not find that item in the catalog. What else would you like?';
      await this.appendTranscript(sessionId, 'maame', fallbackText);
      return this.generateRecordXml(fallbackText, sessionId);
    }

    // Determine current locked vendor ID
    let lockedVendorId = currentOrder && currentOrder.orderItems.length > 0 
      ? currentOrder.orderItems[0].vendorId 
      : null;

    // Check for single-vendor constraint violation
    for (const item of matchedItems) {
      const product = catalog.find(p => p.id === item.productId);
      if (!product) continue;

      if (lockedVendorId && product.vendorId !== lockedVendorId) {
        const currentVendorName = catalog.find(p => p.vendorId === lockedVendorId)?.vendorName || 'the selected joint';
        const failText = `You can only order from one joint per call. Your basket is currently locked to ${currentVendorName}. Would you like to check out now, or cancel and order from a different joint?`;
        await this.appendTranscript(sessionId, 'maame', failText);
        return this.generateRecordXml(failText, sessionId);
      }

      // Lock vendor to the first item
      if (!lockedVendorId) {
        lockedVendorId = product.vendorId;
      }
    }

    // Create order if it doesn't exist
    let order = currentOrder;
    if (!order) {
      order = await prisma.order.create({
        data: {
          customerPhone: callerNumber,
          channel: 'voice',
          status: 'collecting_items',
          totalInPesewas: 0,
          serviceFeeInPesewas: 800, // GHS 8.00 standard delivery/service fee
          callSessionId: sessionId,
          llmProviderUsed: env.LLM_PROVIDER,
        },
      });

      // Update CallSession link
      await prisma.callSession.update({
        where: { id: sessionId },
        data: { orderId: order.id },
      });
    }

    // Process mutations
    for (const item of matchedItems) {
      const product = catalog.find(p => p.id === item.productId);
      if (!product) continue;

      const existingItem = order.orderItems?.find((oi: any) => oi.productId === item.productId)
        || await prisma.orderItem.findFirst({
             where: { orderId: order.id, productId: item.productId },
           });

      if (decision.intent === 'add_item') {
        if (existingItem) {
          await prisma.orderItem.update({
            where: { id: existingItem.id },
            data: { quantity: existingItem.quantity + item.quantity },
          });
        } else {
          await prisma.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              vendorId: product.vendorId,
              quantity: item.quantity,
              unitPriceInPesewas: product.priceInPesewas,
            },
          });
        }
      } else if (decision.intent === 'remove_item') {
        if (existingItem) {
          const newQty = existingItem.quantity - item.quantity;
          if (newQty <= 0) {
            await prisma.orderItem.delete({
              where: { id: existingItem.id },
            });
          } else {
            await prisma.orderItem.update({
              where: { id: existingItem.id },
              data: { quantity: newQty },
            });
          }
        }
      }
    }

    // Recalculate total
    const allItems = await prisma.orderItem.findMany({
      where: { orderId: order.id },
    });

    const itemsSubtotal = allItems.reduce((sum, item) => sum + (item.quantity * item.unitPriceInPesewas), 0);
    const newTotal = itemsSubtotal + order.serviceFeeInPesewas;

    await prisma.order.update({
      where: { id: order.id },
      data: { totalInPesewas: newTotal },
    });

    // Speak update
    let speakPrompt = decision.orderSummaryText;
    if (!speakPrompt) {
      const vendorName = catalog.find(p => p.vendorId === lockedVendorId)?.vendorName || 'the selected joint';
      speakPrompt = `Got it. Added items from ${vendorName}. Your subtotal is ${itemsSubtotal / 100} Cedis. What else would you like to add, or are you ready to confirm?`;
    }

    await this.appendTranscript(sessionId, 'maame', speakPrompt);
    return this.generateRecordXml(speakPrompt, sessionId);
  }

  /**
   * Prompts the user to confirm the order before payment.
   */
  private async handleOrderConfirm(sessionId: string, currentOrder: any, decision: any): Promise<string> {
    if (!currentOrder) {
      const failText = 'Your basket is empty. Please state what food you would like to order.';
      await this.appendTranscript(sessionId, 'maame', failText);
      return this.generateRecordXml(failText, sessionId);
    }

    const allItems = await prisma.orderItem.findMany({
      where: { orderId: currentOrder.id },
    });

    if (allItems.length === 0) {
      const failText = 'Your basket is empty. Please state what food you would like to order.';
      await this.appendTranscript(sessionId, 'maame', failText);
      return this.generateRecordXml(failText, sessionId);
    }

    // Transition state to confirming_order
    await prisma.order.update({
      where: { id: currentOrder.id },
      data: { status: 'confirming_order' },
    });

    const confirmText = decision.orderSummaryText 
      || `Excellent. Your order total is ${currentOrder.totalInPesewas / 100} Cedis, including service fee. Please say Yes to confirm and pay, or say Cancel to start over.`;

    await this.appendTranscript(sessionId, 'maame', confirmText);
    return this.generateRecordXml(confirmText, sessionId);
  }

  /**
   * Handles user explicitly requesting to cancel the order.
   */
  private async handleOrderCancel(sessionId: string, orderId?: string): Promise<string> {
    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });
    }

    await prisma.callSession.update({
      where: { id: sessionId },
      data: { 
        status: 'completed',
        endedAt: new Date(),
      },
    });

    const goodbyeText = 'Your order has been cancelled. Thank you for calling Maame. Goodbye!';
    await this.appendTranscript(sessionId, 'maame', goodbyeText);
    return this.generateHangupXml(goodbyeText);
  }

  /**
   * Moves call session state to completed/ended.
   */
  private async handleCallEnd(sessionId: string): Promise<void> {
    const session = await prisma.callSession.findUnique({
      where: { id: sessionId },
    });

    if (session && session.status === 'active') {
      await prisma.callSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          endedAt: new Date(),
        },
      });

      // If order is still in collecting/confirming state, mark it cancelled/abandoned
      if (session.orderId) {
        const order = await prisma.order.findUnique({
          where: { id: session.orderId },
        });

        if (order && (order.status === 'collecting_items' || order.status === 'confirming_order')) {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'abandoned' },
          });
        }
      }
    }
  }

  /**
   * Helper to append speech records to the CallSession transcript field
   */
  private async appendTranscript(
    sessionId: string,
    speaker: 'customer' | 'maame',
    text: string,
  ): Promise<any[]> {
    const session = await prisma.callSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) return [];

    const rawTranscript = (session.transcript as any) || [];
    const updated = [
      ...rawTranscript,
      { speaker, text, timestamp: new Date().toISOString() },
    ];

    await prisma.callSession.update({
      where: { id: sessionId },
      data: { transcript: updated },
    });

    return updated;
  }

  /**
   * Fetches full active product catalog joined with vendor active status
   */
  private async fetchActiveCatalog(): Promise<any[]> {
    return prisma.$queryRaw<any[]>`
      SELECT p.id, p.name, p."priceInPesewas", p."vendorId", v.name as "vendorName"
      FROM public.products p
      JOIN public.vendors v ON p."vendorId" = v.id
      WHERE p."inStock" = true AND v.active = true
    `;
  }

  /**
   * Helper to generate Africa's Talking `<Record>` response XML
   */
  private generateRecordXml(text: string, sessionId: string): string {
    const encodedText = encodeURIComponent(text);
    const playUrl = `https://qsxgkxtoustcfeotekng.supabase.co/rest/v1/v1/tts/play?text=${encodedText}`; 
    // Wait, the API endpoint is configured on the backend, let's use the relative path if AT supports it or absolute.
    // In our controller, we will construct the correct absolute URL using the incoming Host header!
    // For now, we will return a placeholder URL pattern that the controller replaces with the real request host.
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play url="__HOST__/v1/tts/play?text=${encodedText}"/>
  <Record maxLength="10" timeout="3" trimSilence="true" playBeep="true" callbackUrl="__HOST__/v1/webhooks/voice/inbound?key=${env.WEBHOOK_SHARED_SECRET}&amp;action=process_speech"/>
</Response>`;
  }

  /**
   * Helper to generate Africa's Talking `<Hangup>` response XML
   */
  private generateHangupXml(text: string): string {
    const encodedText = encodeURIComponent(text);
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play url="__HOST__/v1/tts/play?text=${encodedText}"/>
  <Hangup/>
</Response>`;
  }
}
export default VoiceService;
