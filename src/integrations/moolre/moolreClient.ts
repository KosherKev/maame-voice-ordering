import { env } from '../../config/env.js';
import jwt from 'jsonwebtoken';
import { UpstreamProviderError } from '../../errors/index.js';

export interface InitiatePaymentParams {
  amountInPesewas: number;
  customerPhone: string;
  externalRef: string;
}

export interface InitiatePaymentResult {
  moolreTransactionId: string;
}

export class MoolreClient {
  private get baseUrl(): string {
    return env.NODE_ENV === 'production'
      ? 'https://api.moolre.com'
      : 'https://sandbox.moolre.com';
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-USER': env.MOOLRE_API_USER,
    };
    if (env.MOOLRE_API_KEY) {
      headers['X-API-KEY'] = env.MOOLRE_API_KEY;
    }
    return headers;
  }

  private getAccountNumber(): string {
    try {
      const decoded = jwt.decode(env.MOOLRE_PUBKEY) as { userid?: number | string } | null;
      if (decoded && decoded.userid) {
        return decoded.userid.toString();
      }
    } catch (err) {
      // Fall through to the error below
    }
    // A-2 fix: never silently fall back to a hardcoded sandbox ID in production
    throw new Error('Failed to decode MOOLRE_PUBKEY JWT to extract userid — check the env var value');
  }

  private getMoolreChannel(phoneNumber: string): string {
    // Normalize number to extract prefix
    let cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.startsWith('233')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    const prefix = cleaned.substring(0, 2);

    const mtnPrefixes = ['24', '54', '55', '59', '25', '53', '29', '59'];
    const telecelPrefixes = ['20', '50'];
    const atPrefixes = ['26', '56', '27', '57', '28', '58'];

    if (mtnPrefixes.includes(prefix)) {
      return '13'; // MTN
    }
    if (telecelPrefixes.includes(prefix)) {
      return '6'; // Telecel
    }
    if (atPrefixes.includes(prefix)) {
      return '7'; // AT
    }

    return '13'; // Default fallback
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const { amountInPesewas, customerPhone, externalRef } = params;

    // Convert amount in pesewas to decimal GHS string, e.g. "15.00"
    const amountStr = (amountInPesewas / 100).toFixed(2);
    const channel = this.getMoolreChannel(customerPhone);
    const accountNumber = this.getAccountNumber();

    const requestBody = {
      type: 1,
      channel,
      currency: 'GHS',
      payer: customerPhone,
      amount: amountStr,
      externalref: externalRef,
      accountnumber: accountNumber,
      reference: `Maame Order ${externalRef}`,
    };

    try {
      const response = await fetch(`${this.baseUrl}/open/transact/payment`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      interface MoolreInitiatePaymentResponse {
        status: number | string;
        message?: string;
        data?: string;
      }
      const responseBody = (await response.json()) as MoolreInitiatePaymentResponse;

      // In Moolre, status is 1 for success. It could be string "1" or number 1.
      const status = Number(responseBody.status);
      if (status !== 1) {
        throw new Error(responseBody.message || 'Moolre payment request was not successful');
      }

      // Successful initiation returns a transaction ID in data field
      const moolreTransactionId = responseBody.data;
      if (!moolreTransactionId) {
        throw new Error('Moolre response missing transaction ID in data');
      }

      return { moolreTransactionId };
    } catch (err) {
      console.error('Moolre initiatePayment error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new UpstreamProviderError(`Failed to initiate payment via Moolre: ${errMsg}`);
    }
  }

  async sendSms(recipient: string, message: string): Promise<void> {
    const url = `${this.baseUrl}/open/sms/send?type=1&senderid=Maame&recipient=${encodeURIComponent(recipient)}&message=${encodeURIComponent(message)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-VASKEY': env.MOOLRE_VASKEY,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      interface MoolreSmsResponse {
        status: number | string;
        message?: string;
      }
      const responseBody = (await response.json()) as MoolreSmsResponse;

      if (Number(responseBody.status) !== 1) {
        throw new Error(responseBody.message || 'Moolre SMS send request was not successful');
      }
    } catch (err) {
      console.error('Moolre sendSms error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new UpstreamProviderError(`Failed to send SMS via Moolre: ${errMsg}`);
    }
  }

  async initiateTransfer(params: {
    amountInPesewas: number;
    vendorPhone: string;
    momoChannel: 'mtn' | 'telecel' | 'at';
    externalRef: string;
  }): Promise<{ moolreTransactionId: string }> {
    const { amountInPesewas, vendorPhone, momoChannel, externalRef } = params;
    const amountStr = (amountInPesewas / 100).toFixed(2);

    let channel = '1'; // MTN
    if (momoChannel === 'telecel') {
      channel = '6';
    } else if (momoChannel === 'at') {
      channel = '7';
    }

    const accountNumber = this.getAccountNumber();

    const requestBody = {
      type: 1,
      channel,
      currency: 'GHS',
      receiver: vendorPhone,
      amount: amountStr,
      externalref: externalRef,
      accountnumber: accountNumber,
      reference: `Maame payout ${externalRef}`,
    };

    try {
      const response = await fetch(`${this.baseUrl}/open/transact/transfer`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      interface MoolreTransferResponse {
        status: number | string;
        message?: string;
        data?: string;
      }
      const responseBody = (await response.json()) as MoolreTransferResponse;

      if (Number(responseBody.status) !== 1) {
        throw new Error(responseBody.message || 'Moolre transfer request was not successful');
      }

      const moolreTransactionId = responseBody.data;
      if (!moolreTransactionId) {
        throw new Error('Moolre response missing transaction ID in data');
      }

      return { moolreTransactionId };
    } catch (err) {
      console.error('Moolre initiateTransfer error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new UpstreamProviderError(`Failed to initiate transfer via Moolre: ${errMsg}`);
    }
  }

  async getTransactionStatus(externalRef: string): Promise<{
    status: 'success' | 'failed' | 'pending';
    moolreTransactionId?: string;
    fee?: number;
  }> {
    const requestBody = {
      idtype: 1,
      id: externalRef,
    };

    interface MoolreStatusData {
      status?: string | number;
      transactionstatus?: string;
      transactionid?: string;
      transactionId?: string;
      fee?: string | number;
      networkfee?: string | number;
    }

    interface MoolreStatusResponseBody {
      status: number | string;
      code: string;
      message?: string;
      data?: MoolreStatusData;
      transactionid?: string;
    }

    try {
      const response = await fetch(`${this.baseUrl}/open/transact/status`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseBody = (await response.json()) as MoolreStatusResponseBody;
      // A-1: Only log full Moolre response in development mode (contract §10 — no raw upstream data in prod logs)
      if (env.NODE_ENV === 'development') {
        console.log(`Moolre status check response for ${externalRef}:`, JSON.stringify(responseBody));
      }

      const rootStatus = Number(responseBody.status);
      const code = responseBody.code;
      const data = responseBody.data;

      if (rootStatus === 1) {
        const isCompleted =
          code === 'P01' ||
          code === 'T01' ||
          code === 'SMS01' ||
          (data && (
            data.status === 'success' ||
            data.status === 'completed' ||
            data.status === 1 ||
            data.status === '1' ||
            data.transactionstatus === 'success' ||
            data.transactionstatus === 'completed'
          ));

        const isFailed =
          code === 'failed' ||
          code === 'P02' ||
          code === 'T02' ||
          (data && (
            data.status === 'failed' ||
            data.status === 0 ||
            data.status === '0' ||
            data.transactionstatus === 'failed'
          ));

        if (isCompleted) {
          const feeStr = data?.fee || data?.networkfee;
          const fee = feeStr ? Math.round(parseFloat(String(feeStr)) * 100) : undefined;
          return {
            status: 'success',
            moolreTransactionId: data?.transactionid || data?.transactionId || responseBody.transactionid,
            fee,
          };
        } else if (isFailed) {
          return { status: 'failed' };
        }
      }

      if (rootStatus === 0 || code === 'AIN01' || code === 'ERR01') {
        return { status: 'failed' };
      }

      return { status: 'pending' };
    } catch (err) {
      console.error('Moolre getTransactionStatus error:', err);
      throw err;
    }
  }
}
