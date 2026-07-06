"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fulfillmentsRouter = void 0;
const express_1 = require("express");
const fulfillmentsController_js_1 = require("../controllers/fulfillmentsController.js");
const auth_js_1 = require("../middleware/auth.js");
const idempotency_js_1 = require("../middleware/idempotency.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const router = (0, express_1.Router)();
// Mutating endpoint to mark delivery - restricted to admin role, rate-limited, requires idempotency
router.post('/fulfillments/:fulfillmentId/mark-delivered', auth_js_1.authMiddleware, (0, auth_js_1.requireRole)(['admin']), rateLimiter_js_1.adminRateLimiter, idempotency_js_1.idempotencyMiddleware, fulfillmentsController_js_1.fulfillmentsController.markDelivered);
exports.fulfillmentsRouter = router;
exports.default = exports.fulfillmentsRouter;
