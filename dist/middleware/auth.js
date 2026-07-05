"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_js_1 = require("../config/env.js");
const prisma_js_1 = require("../db/prisma.js");
const index_js_1 = require("../errors/index.js");
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new index_js_1.UnauthorizedError('Missing or malformed Authorization header'));
    }
    const token = authHeader.split(' ')[1];
    try {
        // Verify Supabase-issued token using the shared JWT secret
        const decoded = jsonwebtoken_1.default.verify(token, env_js_1.env.SUPABASE_JWT_SECRET);
        if (!decoded || !decoded.sub) {
            return next(new index_js_1.UnauthorizedError('Invalid token payload'));
        }
        // Query profiles table in public schema using raw query (profiles not in Prisma schema)
        const profiles = await prisma_js_1.prisma.$queryRaw `
      SELECT id, role FROM public.profiles WHERE id = ${decoded.sub}::uuid LIMIT 1
    `;
        if (!profiles || profiles.length === 0) {
            return next(new index_js_1.UnauthorizedError('User profile not found'));
        }
        const profile = profiles[0];
        // Populate user context
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
