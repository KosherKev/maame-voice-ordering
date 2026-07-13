import { PaymentClient } from '../../../src/integrations/index.js';

export class MockPaymentClient implements PaymentClient {
  public mockActions: any[] = [];

  async initiatePayment(params: {
    amountInPesewas: number;
    customerPhone: string;
    externalRef: string;
  }): Promise<{ moolreTransactionId: string }> {
    const action = { type: 'payment_initiated', params };
    console.log('[MockPaymentClient]', action);
    this.mockActions.push(action);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return { moolreTransactionId: `mock_tx_${Date.now()}` };
  }
}
