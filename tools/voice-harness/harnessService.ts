import { prisma } from '../../src/db/prisma.js';
import { asrClient, llmClient, ttsClient } from '../../src/integrations/index.js';
import { getSessionStorage, saveSessionStorage, HarnessSessionData } from './storage.js';
import { NotFoundError } from '../../src/errors/index.js';
import { MockPaymentClient } from './mocks/mockPaymentClient.js';

export class HarnessService {
  private mockPaymentClient = new MockPaymentClient();

  /**
   * Process a conversational turn with an audio payload.
   */
  async processTurn(sessionId: string, audioFilePath: string): Promise<any> {
    const session = await getSessionStorage(sessionId);
    if (!session) {
      throw new NotFoundError(`Session not found: ${sessionId}`);
    }

    const mockedActions: string[] = [];

    // 1. Transcribe the audio
    const transcription = await asrClient.transcribe(audioFilePath, session.language);
    
    // 2. Fetch Active Catalog (read-only from production db)
    const catalog = await this.fetchActiveCatalog();
    
    // 3. Prepare the history (last 5 turns for context)
    const history = session.turns.flatMap(turn => [
      { speaker: 'customer' as const, text: turn.transcript, timestamp: new Date() },
      { speaker: 'maame' as const, text: turn.llmDecision.orderSummaryText || '', timestamp: new Date() }
    ]).slice(-10);

    // 4. Process Speech with LLM
    const decision = await llmClient.processSpeech(catalog, session.basket, history, transcription);
    
    // 5. Update In-Memory Order State
    const turnNumber = session.turns.length + 1;
    let assistantAudioText = decision.orderSummaryText || 'I am sorry, I did not understand that.';
    
    switch (decision.intent) {
      case 'cancel':
        session.orderState = 'abandoned';
        assistantAudioText = 'Your order has been cancelled. Goodbye.';
        break;
      
      case 'ask_clarification':
        assistantAudioText = decision.clarifyingQuestion || 'Could you please repeat that?';
        break;
      
      case 'add_item':
      case 'remove_item': {
        const result = this.applyBasketMutations(session, decision, catalog);
        assistantAudioText = result.assistantAudioText;
        break;
      }
      
      case 'confirm_order': {
        if (session.basket.length === 0) {
          assistantAudioText = 'Your basket is empty. Please order something first.';
        } else if (session.orderState === 'confirming_order') {
          // Double confirmation triggers mock payment
          session.orderState = 'awaiting_payment';
          assistantAudioText = 'Thank you! A Mobile Money payment prompt has been sent to your phone.';
          
          // Trigger MockPaymentClient asynchronously
          this.mockPaymentClient.initiatePayment({
            amountInPesewas: session.basket.reduce((sum, item) => sum + (item.quantity * item.unitPriceInPesewas), 0),
            customerPhone: '+233123456789',
            externalRef: `mock-order-${sessionId}`,
          }).catch(err => console.error('Mock payment error', err));
          
          mockedActions.push('payment_auto_completed');
        } else {
          session.orderState = 'confirming_order';
          const totalInPesewas = session.basket.reduce((sum, item) => sum + (item.quantity * item.unitPriceInPesewas), 0) + 800;
          assistantAudioText = decision.orderSummaryText || `Your order total is ${totalInPesewas / 100} Cedis including service fee. Please say Yes to confirm.`;
        }
        break;
      }
    }

    // 6. Synthesize audio
    const audioBuffer = await ttsClient.synthesize(assistantAudioText, session.language);
    const assistantAudioBase64 = audioBuffer.toString('base64');

    // 7. Save turn to session
    const turn = {
      turnNumber,
      transcript: transcription,
      llmDecision: decision,
      orderState: session.orderState,
      assistantAudioBase64,
      mockedActions
    };

    session.turns.push(turn);
    await saveSessionStorage(sessionId, session);

    return turn;
  }

  private applyBasketMutations(session: HarnessSessionData, decision: any, catalog: any[]) {
    const matchedItems = decision.matchedItems || [];
    let assistantAudioText = decision.orderSummaryText || 'I have updated your basket.';

    if (matchedItems.length === 0) {
      assistantAudioText = decision.clarifyingQuestion || 'I could not find that item in the catalog. What else would you like?';
      return { assistantAudioText };
    }

    for (const item of matchedItems) {
      const product = catalog.find((p: any) => p.id === item.productId);
      if (!product) continue;

      // Check single-vendor constraint
      if (session.lockedVendorId && product.vendorId !== session.lockedVendorId) {
        const currentVendorName = catalog.find((p: any) => p.vendorId === session.lockedVendorId)?.vendorName || 'the selected joint';
        assistantAudioText = `You can only order from one joint per call. Your basket is currently locked to ${currentVendorName}.`;
        return { assistantAudioText };
      }

      if (!session.lockedVendorId) {
        session.lockedVendorId = product.vendorId;
      }

      const existingItem = session.basket.find(i => i.productId === item.productId);

      if (decision.intent === 'add_item') {
        if (existingItem) {
          existingItem.quantity += item.quantity;
        } else {
          session.basket.push({
            productId: product.id,
            quantity: item.quantity,
            unitPriceInPesewas: product.priceInPesewas,
            vendorId: product.vendorId
          });
        }
      } else if (decision.intent === 'remove_item') {
        if (existingItem) {
          existingItem.quantity -= item.quantity;
          if (existingItem.quantity <= 0) {
            session.basket = session.basket.filter(i => i.productId !== item.productId);
          }
        }
      }
    }
    
    // Clear lock if basket is empty
    if (session.basket.length === 0) {
      session.lockedVendorId = null;
    }

    return { assistantAudioText };
  }

  private async fetchActiveCatalog(): Promise<any[]> {
    return prisma.$queryRaw<any[]>`
      SELECT p.id, p.name, p."priceInPesewas", p."vendorId", v.name as "vendorName"
      FROM public.products p
      JOIN public.vendors v ON p."vendorId" = v.id
      WHERE p."inStock" = true AND v.active = true
    `;
  }
}

export const harnessService = new HarnessService();
