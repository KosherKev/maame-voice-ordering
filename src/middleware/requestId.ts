import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingId = req.headers['x-request-id'];
  const id = typeof incomingId === 'string' && incomingId ? incomingId : randomUUID();
  
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
