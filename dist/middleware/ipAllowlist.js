"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.atIpAllowlist = atIpAllowlist;
exports.moolreIpAllowlist = moolreIpAllowlist;
const env_js_1 = require("../config/env.js");
const index_js_1 = require("../errors/index.js");
/**
 * Parses a comma-separated CIDR/IP list from an env var into an array of strings.
 * Returns empty array if the env var is empty (allowlist disabled — dev mode).
 */
function parseIpList(raw) {
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
/**
 * Checks whether `ip` falls within any of the allowed entries.
 * Supports exact IP match and simple /24, /16, /8 CIDR blocks.
 * For more complex CIDR matching, use a library like `ip-range-check`.
 */
function isIpAllowed(ip, allowedList) {
    if (allowedList.length === 0) {
        // Empty allowlist = disabled (development mode — shared secret is the only guard)
        return true;
    }
    // Normalize IPv6-mapped IPv4 (e.g. ::ffff:1.2.3.4 → 1.2.3.4)
    const normalizedIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    for (const entry of allowedList) {
        if (entry.includes('/')) {
            // Simple CIDR matching
            if (matchCidr(normalizedIp, entry))
                return true;
        }
        else {
            // Exact match
            const normalizedEntry = entry.startsWith('::ffff:') ? entry.slice(7) : entry;
            if (normalizedIp === normalizedEntry)
                return true;
        }
    }
    return false;
}
/**
 * Basic CIDR match for IPv4 addresses.
 */
function matchCidr(ip, cidr) {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    if (isNaN(bits) || bits < 0 || bits > 32)
        return false;
    const ipNum = ipToNum(ip);
    const rangeNum = ipToNum(range);
    if (ipNum === null || rangeNum === null)
        return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipNum & mask) === (rangeNum & mask);
}
function ipToNum(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4)
        return null;
    let num = 0;
    for (const part of parts) {
        const n = parseInt(part, 10);
        if (isNaN(n) || n < 0 || n > 255)
            return null;
        num = (num << 8) | n;
    }
    return num >>> 0;
}
// Pre-parse allowlists at module load time (not per-request)
const atAllowlist = parseIpList(env_js_1.env.AT_IP_ALLOWLIST);
const moolreAllowlist = parseIpList(env_js_1.env.MOOLRE_IP_ALLOWLIST);
/**
 * IP allowlist middleware for Africa's Talking webhook endpoints (§10, G-9).
 * When AT_IP_ALLOWLIST is empty (dev mode), this is a pass-through.
 * In production, set AT_IP_ALLOWLIST to Africa's Talking published outbound IPs.
 */
function atIpAllowlist(req, res, next) {
    const clientIp = req.ip || req.socket.remoteAddress || '';
    if (!isIpAllowed(clientIp, atAllowlist)) {
        console.warn(`[Security] Rejected AT webhook from IP ${clientIp} — not in allowlist`);
        return next(new index_js_1.WebhookSignatureInvalidError('Source IP not allowed'));
    }
    next();
}
/**
 * IP allowlist middleware for Moolre webhook endpoints (§10, G-9).
 * When MOOLRE_IP_ALLOWLIST is empty (dev mode), this is a pass-through.
 * In production, set MOOLRE_IP_ALLOWLIST to Moolre's published outbound IPs.
 */
function moolreIpAllowlist(req, res, next) {
    const clientIp = req.ip || req.socket.remoteAddress || '';
    if (!isIpAllowed(clientIp, moolreAllowlist)) {
        console.warn(`[Security] Rejected Moolre webhook from IP ${clientIp} — not in allowlist`);
        return next(new index_js_1.WebhookSignatureInvalidError('Source IP not allowed'));
    }
    next();
}
