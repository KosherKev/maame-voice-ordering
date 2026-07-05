import { Request, Response, NextFunction } from 'express';
import { ussdService } from '../services/ussdService.js';
import { moolreUssdInboundSchema, getUssdSessionsQuerySchema, getUssdSessionParamsSchema } from '../utils/schemas.js';
import { logWebhookEvent } from '../utils/webhookLogger.js';

/**
 * Thin HTTP adapter for the USSD channel.
 *
 * G-7 FLAG: The exact Moolre USSD request shape (field names, encoding) must be
 * confirmed against the live Moolre sandbox. This controller validates against
 * the schema in utils/schemas.ts (moolreUssdInboundSchema), which is derived
 * from common USSD conventions. Update both schema and controller if the live
 * shape differs.
 */
export class UssdController {
  /**
   * POST /v1/webhooks/ussd/inbound
   * Receives one USSD dialog turn from Moolre, processes it through the ordering
   * engine, and returns a CON/END response text.
   *
   * Response format: plain text, either "CON <message>" (continue) or "END <message>" (terminate).
   * G-7 FLAG: confirm with Moolre whether they expect plain text or a JSON wrapper.
   */
  async inboundUssdWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 1. Log inbound webhook event (with automatic redaction)
      await logWebhookEvent('moolre', req.body);

      // 2. Validate request body against the G-7 schema
      const payload = moolreUssdInboundSchema.parse(req.body);

      // 3. Delegate to service layer
      const result = await ussdService.handleInboundSession(payload);

      // 4. Return plain text USSD response (CON or END prefixed)
      // G-7 FLAG: if Moolre expects JSON, wrap responseText in { message: result.responseText }
      res.set('Content-Type', 'text/plain');
      res.status(200).send(result.responseText);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/ussd-sessions
   * Lists USSD sessions with cursor pagination (§5.7).
   */
  async getUssdSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = getUssdSessionsQuerySchema.parse(req.query);
      const result = await ussdService.getUssdSessions(filters as any);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/ussd-sessions/:ussdSessionId
   * Returns a single USSD session including menu-state history (§5.7).
   * sessionIdMoolre is excluded (internal-only field per §9).
   */
  async getUssdSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ussdSessionId } = getUssdSessionParamsSchema.parse(req.params);
      const session = await ussdService.getUssdSession(ussdSessionId);
      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  }
}

export const ussdController = new UssdController();
export default ussdController;
