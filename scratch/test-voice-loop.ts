import { app } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { env } from '../src/config/env.js';
import { sweepAbandonedSessions } from '../src/jobs/sessionSweep.js';
import { Server } from 'http';

// Helper to convert form body to urlencoded string
function toFormBody(obj: any): string {
  return Object.keys(obj)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]))
    .join('&');
}

async function runTests() {
  let server: Server;
  const PORT = 3001;
  const testSessionId = 'test-voice-session-uuid-12345';
  const customerNumber = '+233240000000';
  
  // Start server
  await new Promise<void>(resolve => {
    server = app.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
      resolve();
    });
  });

  try {
    // 0. Seed mock data if missing (usually pre-seeded, but let's make sure test-ready products are there)
    // We already have vendors and products seeded, so we'll use existing IDs.
    const waakyeProduct = await prisma.$queryRaw<any[]>`SELECT id, "vendorId" FROM public.products WHERE name = 'Waakye (Single Portion)' LIMIT 1`;
    const fufuProduct = await prisma.$queryRaw<any[]>`SELECT id, "vendorId" FROM public.products WHERE name = 'Fufu with Light Soup (Chicken)' LIMIT 1`;
    
    if (waakyeProduct.length === 0 || fufuProduct.length === 0) {
      throw new Error('Pre-seeded Waakye and Fufu products not found in the database. Run seed first.');
    }

    const waakyeProductId = waakyeProduct[0].id;
    const fufuProductId = fufuProduct[0].id;

    // Define mock fetch variables
    let mockAsrText = 'I want Waakye';
    let mockLlmDecision = {
      intent: 'add_item',
      matchedItems: [{ productId: waakyeProductId, quantity: 1, confidence: 0.95 }],
      clarifyingQuestion: null,
      orderSummaryText: null
    };

    // 1. Mock global fetch
    const originalFetch = global.fetch;
    global.fetch = async (url: any, options: any) => {
      const urlStr = url.toString();
      
      if (urlStr.includes('recording.mp3')) {
        return new Response(Buffer.from('mock-audio-bytes'), { status: 200 });
      }

      if (urlStr.includes('/v1/asr')) {
        return new Response(JSON.stringify({ text: mockAsrText }), { status: 200 });
      }
      
      if (urlStr.includes('/v1/tts/synthesize')) {
        return new Response(Buffer.from('mock-audio-bytes'), { status: 200 });
      }
      
      if (urlStr.includes('generativelanguage.googleapis.com') || urlStr.includes('api.anthropic.com')) {
        // Return structured text depending on mockLlmDecision
        const parts = [{ text: JSON.stringify(mockLlmDecision) }];
        
        // Mock Gemini response structure
        if (urlStr.includes('generativelanguage.googleapis.com')) {
          return new Response(JSON.stringify({
            candidates: [{ content: { parts } }]
          }), { status: 200 });
        }
        
        // Mock Claude response structure
        return new Response(JSON.stringify({
          content: [{
            type: 'tool_use',
            input: mockLlmDecision
          }]
        }), { status: 200 });
      }

      return originalFetch(url, options);
    };

    console.log('--- TEST 1: Webhook Shared Secret Authentication ---');
    const authRes = await fetch(`http://localhost:${PORT}/v1/webhooks/voice/inbound?key=wrongkey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toFormBody({
        sessionId: testSessionId,
        callerNumber: customerNumber,
        isActive: '1'
      })
    });
    
    console.log('Response Status:', authRes.status);
    const authJson = await authRes.json() as any;
    console.log('Response Body:', authJson);
    if (authRes.status !== 401 || authJson.type !== 'https://api.maame.app/problems/webhook-signature-invalid') {
      throw new Error('TEST 1 FAILED: Authentication check did not reject with correct RFC 9457 error.');
    }
    console.log('✅ TEST 1 PASSED');

    console.log('\n--- TEST 2: Call Initialization (Welcome Prompt) ---');
    const initRes = await fetch(`http://localhost:${PORT}/v1/webhooks/voice/inbound?key=${env.WEBHOOK_SHARED_SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toFormBody({
        sessionId: testSessionId,
        callerNumber: customerNumber,
        isActive: '1'
      })
    });

    console.log('Response Status:', initRes.status);
    const initXml = await initRes.text();
    console.log('Response XML:\n', initXml);
    
    if (initRes.status !== 200 || !initXml.includes('<Play') || !initXml.includes('<Record')) {
      throw new Error('TEST 2 FAILED: Initial call welcome response did not return correct XML instructions.');
    }

    // Verify session in DB
    const session = await prisma.callSession.findUnique({ where: { id: testSessionId } });
    if (!session || session.status !== 'active') {
      throw new Error('TEST 2 FAILED: CallSession was not created in active state in DB.');
    }
    console.log('✅ TEST 2 PASSED');

    console.log('\n--- TEST 3: Speech Processing & Basket Mutation (Add Waakye) ---');
    mockAsrText = 'Give me Waakye single portion';
    mockLlmDecision = {
      intent: 'add_item',
      matchedItems: [{ productId: waakyeProductId, quantity: 1, confidence: 0.98 }],
      clarifyingQuestion: null,
      orderSummaryText: null
    };

    const addRes = await fetch(`http://localhost:${PORT}/v1/webhooks/voice/inbound?key=${env.WEBHOOK_SHARED_SECRET}&action=process_speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toFormBody({
        sessionId: testSessionId,
        callerNumber: customerNumber,
        isActive: '1',
        recordingUrl: 'http://example.com/recording.mp3'
      })
    });

    console.log('Response Status:', addRes.status);
    const addXml = await addRes.text();
    console.log('Response XML:\n', addXml);

    if (addRes.status !== 200 || !decodeURIComponent(addXml).includes('Added items')) {
      throw new Error('TEST 3 FAILED: Basket update failed.');
    }

    // Verify order created
    const order = await prisma.order.findUnique({
      where: { callSessionId: testSessionId },
      include: { orderItems: true }
    });
    
    if (!order || order.status !== 'collecting_items' || order.orderItems.length !== 1 || order.totalInPesewas !== 2300) { // 1500 + 800 = 2300
      throw new Error(`TEST 3 FAILED: Order not correctly initialized in DB. Order: ${JSON.stringify(order)}`);
    }
    console.log('✅ TEST 3 PASSED');

    console.log('\n--- TEST 4: Single-Vendor Constraint Validation (Add Fufu) ---');
    mockAsrText = 'I also want fufu with chicken';
    mockLlmDecision = {
      intent: 'add_item',
      matchedItems: [{ productId: fufuProductId, quantity: 1, confidence: 0.95 }],
      clarifyingQuestion: null,
      orderSummaryText: null
    };

    const conflictRes = await fetch(`http://localhost:${PORT}/v1/webhooks/voice/inbound?key=${env.WEBHOOK_SHARED_SECRET}&action=process_speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toFormBody({
        sessionId: testSessionId,
        callerNumber: customerNumber,
        isActive: '1',
        recordingUrl: 'http://example.com/recording.mp3'
      })
    });

    const conflictXml = await conflictRes.text();
    console.log('Response XML:\n', conflictXml);

    if (!decodeURIComponent(conflictXml).includes('You can only order from one joint per call')) {
      throw new Error('TEST 4 FAILED: Single-vendor constraint was not enforced in basket updater.');
    }

    // Verify order still has only 1 item (Waakye)
    const orderAfterConflict = await prisma.order.findUnique({
      where: { callSessionId: testSessionId },
      include: { orderItems: true }
    });
    if (orderAfterConflict?.orderItems.length !== 1) {
      throw new Error('TEST 4 FAILED: Order item count changed despite vendor conflict.');
    }
    console.log('✅ TEST 4 PASSED');

    console.log('\n--- TEST 5: State Transition to Confirming ---');
    mockAsrText = 'I am ready to confirm';
    mockLlmDecision = {
      intent: 'confirm_order',
      matchedItems: [],
      clarifyingQuestion: null,
      orderSummaryText: 'Confirming waakye order...'
    };

    const confirmRes = await fetch(`http://localhost:${PORT}/v1/webhooks/voice/inbound?key=${env.WEBHOOK_SHARED_SECRET}&action=process_speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toFormBody({
        sessionId: testSessionId,
        callerNumber: customerNumber,
        isActive: '1',
        recordingUrl: 'http://example.com/recording.mp3'
      })
    });

    const confirmXml = await confirmRes.text();
    console.log('Response XML:\n', confirmXml);

    const orderConfirmed = await prisma.order.findUnique({
      where: { callSessionId: testSessionId }
    });
    if (orderConfirmed?.status !== 'confirming_order') {
      throw new Error('TEST 5 FAILED: Order state did not transition to confirming_order.');
    }
    console.log('✅ TEST 5 PASSED');

    console.log('\n--- TEST 6: Session Idle Timeout Sweep Job ---');
    // Set createdAt and transcript timestamps back 10 minutes to simulate idle session
    const currentSession = await prisma.callSession.findUnique({ where: { id: testSessionId } });
    const oldTranscript = (currentSession?.transcript as any[]) || [];
    const backdatedTranscript = oldTranscript.map(item => ({
      ...item,
      timestamp: new Date(Date.now() - 10 * 60000).toISOString()
    }));

    await prisma.callSession.update({
      where: { id: testSessionId },
      data: { 
        createdAt: new Date(Date.now() - 10 * 60000),
        transcript: backdatedTranscript
      }
    });

    const swept = await sweepAbandonedSessions(90);
    console.log('Swept sessions count:', swept);
    if (swept !== 1) {
      throw new Error('TEST 6 FAILED: Idle session was not swept.');
    }

    const sweptSession = await prisma.callSession.findUnique({ where: { id: testSessionId } });
    const sweptOrder = await prisma.order.findUnique({ where: { callSessionId: testSessionId } });

    console.log('Swept Session Status:', sweptSession?.status);
    console.log('Swept Order Status:', sweptOrder?.status);

    if (sweptSession?.status !== 'abandoned' || sweptOrder?.status !== 'abandoned') {
      throw new Error('TEST 6 FAILED: Session or Order status was not marked abandoned after sweep.');
    }
    console.log('✅ TEST 6 PASSED');

    // Restore fetch
    global.fetch = originalFetch;

  } finally {
    // Cleanup test data
    await prisma.orderItem.deleteMany({
      where: { order: { callSessionId: testSessionId } }
    });
    await prisma.order.deleteMany({
      where: { callSessionId: testSessionId }
    });
    await prisma.callSession.deleteMany({
      where: { id: testSessionId }
    });

    // Close server
    await new Promise<void>(resolve => {
      server.close(() => {
        console.log('Test server closed');
        resolve();
      });
    });
  }
}

runTests()
  .then(() => console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!'))
  .catch(err => {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  });
