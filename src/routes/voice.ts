import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { VoiceController } from '../controllers/voiceController.js';
import { env } from '../config/env.js';
import { WebhookSignatureInvalidError } from '../errors/index.js';
import { webhookRateLimiter } from '../middleware/rateLimiter.js';
import { atIpAllowlist } from '../middleware/ipAllowlist.js';

const router = Router();
const controller = new VoiceController();

/**
 * Middleware to verify Africa's Talking shared secret query parameter (§10, G-9).
 */
function verifyVoiceWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const { key } = req.query;

  if (!key || key !== env.AT_WEBHOOK_SECRET) {
    return next(new WebhookSignatureInvalidError('Unauthorized webhook access: invalid or missing secret key'));
  }
  next();
}

// Inbound calls from Africa's Talking are POST requests encoded as form-urlencoded.
// Security: rate limiter → IP allowlist → shared secret → handler (§10, G-9)
router.post(
  '/webhooks/voice/inbound',
  webhookRateLimiter,
  atIpAllowlist,
  express.urlencoded({ extended: true }),
  verifyVoiceWebhookSecret,
  controller.inboundVoiceWebhook
);

// TTS audio streaming endpoint (GET request from Africa's Talking XML player)
router.get(
  '/tts/play',
  webhookRateLimiter,
  controller.streamTtsAudio
);

export { router as voiceRouter };
export default router;
