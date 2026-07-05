import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { VoiceController } from '../controllers/voiceController.js';
import { env } from '../config/env.js';
import { WebhookSignatureInvalidError } from '../errors/index.js';

const router = Router();
const controller = new VoiceController();

/**
 * Middleware to verify Moolre / Africa's Talking shared secret query parameter
 */
function verifyWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const { key } = req.query;

  if (!key || key !== env.WEBHOOK_SHARED_SECRET) {
    return next(new WebhookSignatureInvalidError('Unauthorized webhook access: invalid or missing secret key'));
  }
  next();
}

// Inbound calls from Africa's Talking are POST requests encoded as form-urlencoded.
// We apply URL-encoded parser and shared secret verification middleware.
router.post(
  '/webhooks/voice/inbound',
  express.urlencoded({ extended: true }),
  verifyWebhookSecret,
  controller.inboundVoiceWebhook
);

// TTS audio streaming endpoint (GET request from Africa's Talking XML player)
router.get(
  '/tts/play',
  controller.streamTtsAudio
);

export { router as voiceRouter };
export default router;
