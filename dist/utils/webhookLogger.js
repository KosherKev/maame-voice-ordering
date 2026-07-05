"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactPayload = redactPayload;
exports.logWebhookEvent = logWebhookEvent;
const prisma_js_1 = require("../db/prisma.js");
/**
 * Deeply traverses an object to redact sensitive keys like tokens, secrets, and api keys.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function redactPayload(data) {
    if (data === null || data === undefined) {
        return data;
    }
    if (typeof data !== 'object') {
        return data;
    }
    if (Array.isArray(data)) {
        return data.map(redactPayload);
    }
    const redacted = {};
    const sensitiveKeys = [
        'token',
        'key',
        'secret',
        'password',
        'auth',
        'credential',
        'vaskey',
        'pubkey',
        'apikey',
        'api_key',
        'api-key',
    ];
    for (const [key, value] of Object.entries(data)) {
        const isSensitive = sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive));
        if (isSensitive) {
            redacted[key] = '[REDACTED]';
        }
        else if (typeof value === 'object') {
            redacted[key] = redactPayload(value);
        }
        else {
            redacted[key] = value;
        }
    }
    return redacted;
}
/**
 * Logs an inbound webhook event to the database, redacting sensitive fields beforehand.
 */
async function logWebhookEvent(source, rawPayload) {
    let payloadObj;
    if (typeof rawPayload === 'string') {
        try {
            payloadObj = JSON.parse(rawPayload);
        }
        catch {
            // If it's not JSON, treat it as a raw string (e.g. form urlencoded) and try to parse it
            // or store it as is if it cannot be parsed.
            payloadObj = { raw: rawPayload };
        }
    }
    else {
        payloadObj = rawPayload;
    }
    const redacted = redactPayload(payloadObj);
    const rawPayloadString = JSON.stringify(redacted);
    return prisma_js_1.prisma.webhookEvent.create({
        data: {
            source,
            rawPayload: rawPayloadString,
        },
    });
}
