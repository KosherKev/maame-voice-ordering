"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceRouter = void 0;
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const voiceController_js_1 = require("../controllers/voiceController.js");
const env_js_1 = require("../config/env.js");
const index_js_1 = require("../errors/index.js");
const router = (0, express_1.Router)();
exports.voiceRouter = router;
const controller = new voiceController_js_1.VoiceController();
/**
 * Middleware to verify Moolre / Africa's Talking shared secret query parameter
 */
function verifyWebhookSecret(req, res, next) {
    const { key } = req.query;
    if (!key || key !== env_js_1.env.WEBHOOK_SHARED_SECRET) {
        return next(new index_js_1.WebhookSignatureInvalidError('Unauthorized webhook access: invalid or missing secret key'));
    }
    next();
}
// Inbound calls from Africa's Talking are POST requests encoded as form-urlencoded.
// We apply URL-encoded parser and shared secret verification middleware.
router.post('/webhooks/voice/inbound', express_2.default.urlencoded({ extended: true }), verifyWebhookSecret, controller.inboundVoiceWebhook);
// TTS audio streaming endpoint (GET request from Africa's Talking XML player)
router.get('/tts/play', controller.streamTtsAudio);
exports.default = router;
