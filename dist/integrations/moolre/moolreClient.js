"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoolreClient = void 0;
const env_js_1 = require("../../config/env.js");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_js_1 = require("../../errors/index.js");
class MoolreClient {
    get baseUrl() {
        return env_js_1.env.NODE_ENV === 'production'
            ? 'https://api.moolre.com'
            : 'https://sandbox.moolre.com';
    }
    get headers() {
        const headers = {
            'Content-Type': 'application/json',
            'X-API-USER': env_js_1.env.MOOLRE_API_USER,
        };
        if (env_js_1.env.MOOLRE_API_KEY) {
            headers['X-API-KEY'] = env_js_1.env.MOOLRE_API_KEY;
        }
        return headers;
    }
    getAccountNumber() {
        try {
            const decoded = jsonwebtoken_1.default.decode(env_js_1.env.MOOLRE_PUBKEY);
            if (decoded && decoded.userid) {
                return decoded.userid.toString();
            }
        }
        catch (err) {
            console.warn('Failed to decode MOOLRE_PUBKEY JWT to extract userid:', err);
        }
        return '108590'; // Sandbox/fallback user ID
    }
    getMoolreChannel(phoneNumber) {
        // Normalize number to extract prefix
        let cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.startsWith('233')) {
            cleaned = cleaned.substring(3);
        }
        else if (cleaned.startsWith('0')) {
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
    async initiatePayment(params) {
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
            const responseBody = (await response.json());
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
        }
        catch (err) {
            console.error('Moolre initiatePayment error:', err);
            const errMsg = err instanceof Error ? err.message : String(err);
            throw new index_js_1.UpstreamProviderError(`Failed to initiate payment via Moolre: ${errMsg}`);
        }
    }
}
exports.MoolreClient = MoolreClient;
