import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { UnauthorizedError, ForbiddenError } from '../errors/index.js';

interface SupabaseJwtPayload extends JWTPayload {
  sub: string;
  email?: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role: string;
      };
    }
  }
}

// JWKS set is created once and caches public keys with automatic refresh.
// Handles ES256 and RS256 (Supabase's new JWT Signing Keys).
const JWKS = createRemoteJWKSet(
  new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];

  let decoded: SupabaseJwtPayload;

  try {
    // 1. Try JWKS verification first (ES256 / RS256 — Supabase new JWT Signing Keys)
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    });
    decoded = payload as SupabaseJwtPayload;
  } catch (jwksErr) {
    // 2. Fall back to legacy HS256 symmetric secret verification
    try {
      const secretBuffer = Buffer.from(env.SUPABASE_JWT_SECRET, 'base64');
      decoded = jwt.verify(token, secretBuffer) as SupabaseJwtPayload;
    } catch (hs256Err) {
      return next(new UnauthorizedError('Invalid or expired token'));
    }
  }

  if (!decoded || !decoded.sub) {
    return next(new UnauthorizedError('Invalid token payload'));
  }

  try {
    // Look up profile in public schema for role information
    const profiles = await prisma.$queryRaw<Array<{ id: string; role: string }>>`
      SELECT id, role FROM public.profiles WHERE id = ${decoded.sub}::uuid LIMIT 1
    `;

    if (!profiles || profiles.length === 0) {
      return next(new UnauthorizedError('User profile not found'));
    }

    const profile = profiles[0];

    req.user = {
      id: profile.id,
      role: profile.role,
      email: decoded.email,
    };

    next();
  } catch (err) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }
}

/**
 * Optional helper middleware to enforce specific roles.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}
