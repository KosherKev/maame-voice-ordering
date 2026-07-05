import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { UnauthorizedError, ForbiddenError } from '../errors/index.js';

interface SupabaseJwtPayload {
  sub: string; // auth.users.id
  email?: string;
  role?: string;
  exp?: number;
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

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify Supabase-issued token using the shared JWT secret
    const decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET) as SupabaseJwtPayload;

    if (!decoded || !decoded.sub) {
      return next(new UnauthorizedError('Invalid token payload'));
    }

    // Query profiles table in public schema using raw query (profiles not in Prisma schema)
    const profiles = await prisma.$queryRaw<Array<{ id: string; role: string }>>`
      SELECT id, role FROM public.profiles WHERE id = ${decoded.sub}::uuid LIMIT 1
    `;

    if (!profiles || profiles.length === 0) {
      return next(new UnauthorizedError('User profile not found'));
    }

    const profile = profiles[0];

    // Populate user context
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
