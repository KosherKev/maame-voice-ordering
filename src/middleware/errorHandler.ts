import { Request, Response, NextFunction } from 'express';
import { DomainError, ValidationError } from '../errors/index.js';

export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) {
  const isDomainError = err instanceof DomainError;

  if (isDomainError) {
    const status = err.status;
    res.setHeader('Content-Type', 'application/problem+json');
    
    const body: Record<string, unknown> = {
      type: `https://api.maame.app/problems/${err.typeSuffix}`,
      title: err.title,
      status,
      detail: err.message,
      instance: req.originalUrl,
    };

    if (err instanceof ValidationError && err.errors) {
      body.errors = err.errors;
    }

    return res.status(status).json(body);
  }

  // Handle standard express JSON parsing errors
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    res.setHeader('Content-Type', 'application/problem+json');
    return res.status(400).json({
      type: 'https://api.maame.app/problems/validation-error',
      title: 'Validation error',
      status: 400,
      detail: 'Invalid JSON payload',
      instance: req.originalUrl,
    });
  }

  // Unhandled error -> 500 Internal Server Error
  // Log server-side with request ID
  console.error(`[Error] Request ID: ${req.requestId} | Error:`, err);

  res.setHeader('Content-Type', 'application/problem+json');
  return res.status(500).json({
    type: 'https://api.maame.app/problems/internal-error',
    title: 'Internal error',
    status: 500,
    detail: 'An internal server error occurred.',
    instance: req.requestId, // "instance set to a request id the engineer can grep for" per contract §10
  });
}
