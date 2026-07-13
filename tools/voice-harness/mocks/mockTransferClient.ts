import { TransferClient } from '../../../src/integrations/index.js';

export class MockTransferClient implements TransferClient {
  public mockActions: any[] = [];

  async initiateTransfer(params: {
    amountInPesewas: number;
    vendorPhone: string;
    momoChannel: 'mtn' | 'telecel' | 'at';
    externalRef: string;
  }): Promise<{ moolreTransactionId: string }> {
    const action = { type: 'transfer_initiated', params };
    console.log('[MockTransferClient]', action);
    this.mockActions.push(action);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return { moolreTransactionId: `mock_transfer_${Date.now()}` };
  }

  async getTransactionStatus(externalRef: string): Promise<{
    status: 'success' | 'failed' | 'pending';
    moolreTransactionId?: string;
    fee?: number;
  }> {
    const action = { type: 'transfer_status_checked', externalRef };
    console.log('[MockTransferClient]', action);
    this.mockActions.push(action);

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      status: 'success',
      moolreTransactionId: `mock_transfer_${Date.now()}`,
      fee: 0,
    };
  }
}
