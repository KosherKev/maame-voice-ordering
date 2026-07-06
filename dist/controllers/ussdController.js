"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ussdController = exports.UssdController = void 0;
const ussdService_js_1 = require("../services/ussdService.js");
const schemas_js_1 = require("../utils/schemas.js");
const webhookLogger_js_1 = require("../utils/webhookLogger.js");
/**
 * Thin HTTP adapter for the USSD channel.
 * Moolre's confirmed response format (G-7 resolved): JSON { message: string, reply: boolean }.
 * reply=true keeps the session open; reply=false terminates it.
 */
class UssdController {
    /**
     * POST /v1/webhooks/ussd/inbound
     * Receives one USSD dialog turn from Moolre, processes it through the ordering
     * engine, and returns { message, reply } JSON per Moolre's confirmed spec (§5.8).
     */
    async inboundUssdWebhook(req, res, next) {
        try {
            // 1. Log inbound webhook event (with automatic redaction)
            await (0, webhookLogger_js_1.logWebhookEvent)('moolre', req.body);
            // 2. Validate request body against the confirmed schema
            const payload = schemas_js_1.moolreUssdInboundSchema.parse(req.body);
            // 3. Delegate to service layer
            const result = await ussdService_js_1.ussdService.handleInboundSession(payload);
            // 4. Return Moolre's confirmed JSON shape: { message, reply }.
            // The service prefixes responseText with CON\n / END\n internally; strip it here
            // since Moolre uses reply:bool rather than text prefixes.
            const prefix = result.isEnd ? 'END\n' : 'CON\n';
            const message = result.responseText.startsWith(prefix)
                ? result.responseText.slice(prefix.length)
                : result.responseText;
            res.status(200).json({ message, reply: !result.isEnd });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /v1/ussd-sessions
     * Lists USSD sessions with cursor pagination (§5.7).
     */
    async getUssdSessions(req, res, next) {
        try {
            const filters = schemas_js_1.getUssdSessionsQuerySchema.parse(req.query);
            const result = await ussdService_js_1.ussdService.getUssdSessions(filters);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /v1/ussd-sessions/:ussdSessionId
     * Returns a single USSD session including menu-state history (§5.7).
     * sessionIdMoolre is excluded (internal-only field per §9).
     */
    async getUssdSession(req, res, next) {
        try {
            const { ussdSessionId } = schemas_js_1.getUssdSessionParamsSchema.parse(req.params);
            const session = await ussdService_js_1.ussdService.getUssdSession(ussdSessionId);
            res.status(200).json(session);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.UssdController = UssdController;
exports.ussdController = new UssdController();
exports.default = exports.ussdController;
