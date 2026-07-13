export interface PaymentClient {
  initiatePayment(params: {
    amountInPesewas: number;
    customerPhone: string;
    externalRef: string;
  }): Promise<{ moolreTransactionId: string }>;
}

export interface NotificationClient {
  sendSms(recipient: string, message: string): Promise<void>;
}

export interface TransferClient {
  initiateTransfer(params: {
    amountInPesewas: number;
    vendorPhone: string;
    momoChannel: 'mtn' | 'telecel' | 'at';
    externalRef: string;
  }): Promise<{ moolreTransactionId: string }>;

  getTransactionStatus(externalRef: string): Promise<{
    status: 'success' | 'failed' | 'pending';
    moolreTransactionId?: string;
    fee?: number;
  }>;
}
