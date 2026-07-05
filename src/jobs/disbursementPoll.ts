import { fulfillmentService } from '../services/fulfillmentService.js';

/**
 * Background runner checking transaction status of pending vendor payouts.
 */
export async function runDisbursementPoll(): Promise<void> {
  try {
    await fulfillmentService.pollPendingDisbursements();
  } catch (error) {
    console.error('❌ Error running disbursement status check job:', error);
  }
}
