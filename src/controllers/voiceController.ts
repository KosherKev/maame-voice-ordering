import { Request, Response, NextFunction } from 'express';
import { VoiceService } from '../services/voiceService.js';
import { ttsClient } from '../integrations/index.js';
import { ValidationError } from '../errors/index.js';

const voiceService = new VoiceService();

export class VoiceController {
  /**
   * Receives Africa's Talking inbound call events and posts,
   * executes voice dialog steps, and responds with XML.
   */
  async inboundVoiceWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Parse parameters from POST form body
      const { sessionId, callerNumber, isActive, recordingUrl } = req.body;
      const { action } = req.query;

      if (!sessionId || !callerNumber || !isActive) {
        throw new ValidationError('Missing required Africa\'s Talking session fields (sessionId, callerNumber, isActive)');
      }

      // Execute state machine turn in voice service
      const rawXml = await voiceService.handleInboundCall({
        sessionId,
        callerNumber,
        isActive,
        recordingUrl: recordingUrl as string,
        action: action as string,
      });

      // Construct absolute host URL dynamically
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const hostUrl = `${protocol}://${req.get('host')}`;

      // Replace placeholder with absolute Host URL
      const finalXml = rawXml.replace(/__HOST__/g, hostUrl);

      res.set('Content-Type', 'text/xml');
      res.status(200).send(finalXml);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Statelessly synthesizes text using TTS and streams the audio binary back
   */
  async streamTtsAudio(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { text, lang } = req.query;

      if (!text || typeof text !== 'string') {
        throw new ValidationError('Query parameter "text" is required for TTS streaming');
      }

      const languageCode = (lang as string) || 'tw';

      // Call TTS API to synthesize text into audio buffer
      const audioBuffer = await ttsClient.synthesize(text, languageCode);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
        'Cache-Control': 'public, max-age=86400', // Cache for 24h
      });

      res.status(200).send(audioBuffer);
    } catch (error) {
      next(error);
    }
  }
}
export default VoiceController;
