import { Request, Response, NextFunction } from 'express';
import { sessionsService } from '../services/sessionsService.js';
import {
  getCallSessionsQuerySchema,
  getCallSessionParamsSchema,
  getUssdSessionParamsSchema,
} from '../utils/schemas.js';

export class SessionsController {
  async getCallSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = getCallSessionsQuerySchema.parse(req.query);
      const result = await sessionsService.getCallSessions(filters as any);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getCallSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = getCallSessionParamsSchema.parse(req.params);
      const session = await sessionsService.getCallSession(params.callSessionId);

      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  }

  async getUssdSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = getUssdSessionParamsSchema.parse(req.params);
      const session = await sessionsService.getUssdSession(params.ussdSessionId);

      // Sanitize: Exclude sessionIdMoolre (internal-only field)
      const responseData = { ...session };
      delete (responseData as any).sessionIdMoolre;

      res.status(200).json(responseData);
    } catch (err) {
      next(err);
    }
  }
}

export const sessionsController = new SessionsController();
export default sessionsController;
