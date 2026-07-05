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
      console.warn('Failed to decode MOOLRE_PUBKEY JWT to extract userid:', err);
    }
    return '108590'; // Sandbox/fallback user ID
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
}
