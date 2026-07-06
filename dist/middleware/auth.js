"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requireRole = requireRole;
const jose_1 = require("jose");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_js_1 = require("../config/env.js");
const prisma_js_1 = require("../db/prisma.js");
const index_js_1 = require("../errors/index.js");
// JWKS set is created once and caches public keys with automatic refresh.
// Handles ES256 and RS256 (Supabase's new JWT Signing Keys).
const JWKS = (0, jose_1.createRemoteJWKSet)(new URL(`${env_js_1.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new index_js_1.UnauthorizedError('Missing or malformed Authorization header'));
    }
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
        // 1. Try JWKS verification first (ES256 / RS256 — Supabase new JWT Signing Keys)
        const { payload } = await (0, jose_1.jwtVerify)(token, JWKS, {
            issuer: `${env_js_1.env.SUPABASE_URL}/auth/v1`,
            audience: 'authenticated',
        });
        decoded = payload;
    }
    catch (jwksErr) {
        // 2. Fall back to legacy HS256 symmetric secret verification
        try {
            const secretBuffer = Buffer.from(env_js_1.env.SUPABASE_JWT_SECRET, 'base64');
            decoded = jsonwebtoken_1.default.verify(token, secretBuffer);
        }
        catch (hs256Err) {
            return next(new index_js_1.UnauthorizedError('Invalid or expired token'));
        }
    }
    if (!decoded || !decoded.sub) {
        return next(new index_js_1.UnauthorizedError('Invalid token payload'));
    }
    try {
        // Look up profile in public schema for role information
        const profiles = await prisma_js_1.prisma.$queryRaw `
      SELECT id, role FROM public.profiles WHERE id = ${decoded.sub}::uuid LIMIT 1
    `;
        if (!profiles || profiles.length === 0) {
            return next(new index_js_1.UnauthorizedError('User profile not found'));
        }
        const profile = profiles[0];
        req.user = {
            id: profile.id,
            role: profile.role,
            email: decoded.email,
        };
        next();
    }
    catch (err) {
        return next(new index_js_1.UnauthorizedError('Invalid or expired token'));
    }
}
/**
 * Optional helper middleware to enforce specific roles.
 */
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return next(new index_js_1.UnauthorizedError());
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new index_js_1.ForbiddenError('Insufficient permissions'));
        }
        next();
    };
}
