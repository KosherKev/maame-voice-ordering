import { prisma } from '../src/db/prisma.js';
import { fulfillmentService } from '../src/services/fulfillmentService.js';
import { moolreClient } from '../src/integrations/index.js';
import { randomUUID } from 'crypto';

// Mock Moolre client methods to prevent network requests and sandbox credential failures
moolreClient.sendSms = async (recipient: string, message: string): Promise<void> => {
  console.log(`[MOCK SMS] Recipient: ${recipient} | Message: ${message}`);
};

moolreClient.initiateTransfer = async (params: {
  amountInPesewas: number;
  vendorPhone: string;
  momoChannel: 'mtn' | 'telecel' | 'at';
  externalRef: string;
}): Promise<{ moolreTransactionId: string }> => {
  console.log(`[MOCK TRANSFER] Wallet: ${params.vendorPhone} | Channel: ${params.momoChannel} | Amount: GHS ${(params.amountInPesewas / 100).toFixed(2)} | Ref: ${params.externalRef}`);
  return { moolreTransactionId: 'mock-moolre-tx-disburse-999' };
};

moolreClient.getTransactionStatus = async (externalRef: string): Promise<{
  status: 'success' | 'failed' | 'pending';
  moolreTransactionId?: string;
  fee?: number;
}> => {
  console.log(`[MOCK STATUS CHECK] Ref: ${externalRef}`);
  return {
    status: 'success',
    moolreTransactionId: 'mock-moolre-tx-disburse-999',
    fee: 50, // 50 pesewas fee
  };
};

async function testFulfillmentFlow() {
  console.log('🏁 Starting end-to-end fulfillment flow verification with mocked integrations...');

  // 1. Create a dummy order and order item
  // Auntie Mary's Waakye Vendor ID: a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d
  const vendorId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

  // Find a product from this vendor in public.products
  const products = await prisma.$queryRaw<any[]>`
    SELECT id FROM public.products WHERE "vendorId" = ${vendorId}::uuid LIMIT 1
  `;
  const product = products[0];
  if (!product) {
    throw new Error('No product found for vendor');
  }

  const orderId = randomUUID();
  console.log(`Step 1: Creating Order ${orderId}`);

  await prisma.order.create({
    data: {
      id: orderId,
      customerPhone: '233241112222',
      channel: 'voice',
      status: 'awaiting_payment',
      totalInPesewas: 1800,
      serviceFeeInPesewas: 300,
      orderItems: {
        create: {
          productId: product.id,
          vendorId: vendorId,
          quantity: 1,
          unitPriceInPesewas: 1500,
        },
      },
    },
  });

  // Transition to paid first (mocking webhook update)
  console.log('Step 2: Transitioning order to paid status');
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'paid' },
  });

  // 2. Call processOrderPaid
  console.log('Step 3: Processing order paid state (creating VendorFulfillment + sending SMS)...');
  await fulfillmentService.processOrderPaid(orderId);

  // Check if fulfillment created
  const fulfillments = await prisma.vendorFulfillment.findMany({
    where: { orderId },
  });
  console.log('Fulfillments created in database:', fulfillments);
  if (fulfillments.length === 0) {
    throw new Error('Fulfillment was not created!');
  }

  const fulfillment = fulfillments[0];
  if (fulfillment.deliveryStatus !== 'pending' || fulfillment.disbursementStatus !== 'not_started') {
    throw new Error('Invalid initial fulfillment status values!');
  }

  // Check if order status updated to vendor_notified
  const updatedOrder = await prisma.order.findUnique({
    where: { id: orderId },
  });
  console.log('Updated order status:', updatedOrder?.status);
  if (updatedOrder?.status !== 'vendor_notified') {
    throw new Error('Order status was not updated to vendor_notified!');
  }

  // 3. Mark delivery
  console.log('Step 4: Marking fulfillment as delivered (initiates disbursement)...');
  const idempotencyKey = randomUUID();
  const adminId = 'd824d5ea-236b-4e0b-853b-e10c0bfd9921'; // mock admin user ID
  
  // Make sure that auth.users entry exists for this user ID, which triggers profiles creation
  await prisma.$executeRaw`
    INSERT INTO auth.users (id, email) 
    VALUES ('d824d5ea-236b-4e0b-853b-e10c0bfd9921'::uuid, 'admin@maame.app') 
    ON CONFLICT (id) DO NOTHING
  `;

  const updatedFulfillment = await fulfillmentService.markFulfillmentDelivered(
    fulfillment.id,
    idempotencyKey,
    adminId
  );
  console.log('Updated fulfillment after delivery:', updatedFulfillment);

  if (updatedFulfillment.deliveryStatus !== 'delivered' || updatedFulfillment.disbursementStatus !== 'processing') {
    throw new Error('Invalid fulfillment status values after marking delivered!');
  }

  // Check if Disbursement record created
  const disbursements = await prisma.disbursement.findMany({
    where: { vendorFulfillmentId: fulfillment.id },
  });
  console.log('Disbursements created:', disbursements);
  if (disbursements.length === 0) {
    throw new Error('Disbursement record was not created!');
  }

  const disbursement = disbursements[0];
  if (disbursement.status !== 'pending' || disbursement.externalref !== idempotencyKey) {
    throw new Error('Invalid disbursement status values!');
  }

  // Check if order status updated to delivered
  const deliveredOrder = await prisma.order.findUnique({
    where: { id: orderId },
  });
  console.log('Order status after delivery:', deliveredOrder?.status);
  if (deliveredOrder?.status !== 'delivered') {
    throw new Error('Order status was not updated to delivered!');
  }

  // Allow a tiny sleep for async payout initiation background promise to run and write transaction ID
  await new Promise(resolve => setTimeout(resolve, 500));

  // 4. Poll pending disbursements
  console.log('Step 5: Running pending disbursements polling sweep...');
  
  // Update nextPollAt of the disbursement to be in the past so it is selected
  await prisma.disbursement.update({
    where: { id: disbursement.id },
    data: { nextPollAt: new Date(Date.now() - 60000) },
  });

  await fulfillmentService.pollPendingDisbursements();

  // Check status after polling (should be success now since mocked status returns success)
  const finalDisbursement = await prisma.disbursement.findUnique({
    where: { id: disbursement.id },
  });
  console.log('Final Disbursement status after poll:', finalDisbursement?.status);
  console.log('Final Disbursement pollCount:', finalDisbursement?.pollCount);
  console.log('Final Disbursement nextPollAt:', finalDisbursement?.nextPollAt);

  if (finalDisbursement?.status !== 'success') {
    throw new Error('Disbursement status did not update to success after polling!');
  }

  // Check if order status transitioned to disbursed
  const finalOrder = await prisma.order.findUnique({
    where: { id: orderId },
  });
  console.log('Final Order status:', finalOrder?.status);
  if (finalOrder?.status !== 'disbursed') {
    throw new Error('Order status was not updated to disbursed!');
  }

  console.log('✅ End-to-end fulfillment flow verification passed successfully!');
}

testFulfillmentFlow()
  .catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
