"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionsRouter = void 0;
const express_1 = require("express");
const sessionsController_js_1 = require("../controllers/sessionsController.js");
const auth_js_1 = require("../middleware/auth.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const router = (0, express_1.Router)();
// Call-session read endpoints (§5.7) — admin auth + rate-limited
router.get('/call-sessions', auth_js_1.authMiddleware, rateLimiter_js_1.adminRateLimiter, sessionsController_js_1.sessionsController.getCallSessions);
router.get('/call-sessions/:callSessionId', auth_js_1.authMiddleware, rateLimiter_js_1.adminRateLimiter, sessionsController_js_1.sessionsController.getCallSession);
// USSD session routes live in routes/ussd.ts — not duplicated here.
exports.sessionsRouter = router;
exports.default = exports.sessionsRouter;
