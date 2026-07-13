import { Router } from 'express';
import { sessionsController } from '../controllers/sessionsController.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Call-session read endpoints (§5.7) — admin auth + rate-limited
router.get('/call-sessions', authMiddleware, adminRateLimiter, sessionsController.getCallSessions);
router.get('/call-sessions/:callSessionId', authMiddleware, adminRateLimiter, sessionsController.getCallSession);
// USSD session routes live in routes/ussd.ts — not duplicated here.

export const sessionsRouter = router;
export default sessionsRouter;
