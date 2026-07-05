import { Router } from 'express';
import { sessionsController } from '../controllers/sessionsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.get('/call-sessions', authMiddleware, sessionsController.getCallSessions);
router.get('/call-sessions/:callSessionId', authMiddleware, sessionsController.getCallSession);
router.get('/ussd-sessions/:ussdSessionId', authMiddleware, sessionsController.getUssdSession);

export const sessionsRouter = router;
export default sessionsRouter;
