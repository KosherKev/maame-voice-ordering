import { Router } from 'express';
import { sessionsController } from '../controllers/sessionsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Call-session read endpoints (§5.7)
router.get('/call-sessions', authMiddleware, sessionsController.getCallSessions);
router.get('/call-sessions/:callSessionId', authMiddleware, sessionsController.getCallSession);
// USSD session routes live in routes/ussd.ts — not duplicated here.

export const sessionsRouter = router;
export default sessionsRouter;
