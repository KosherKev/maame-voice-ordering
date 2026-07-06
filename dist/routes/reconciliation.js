"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconciliationRouter = void 0;
const express_1 = require("express");
const reconciliationController_js_1 = require("../controllers/reconciliationController.js");
const auth_js_1 = require("../middleware/auth.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const router = (0, express_1.Router)();
// Reconciliation endpoints (§5.6) — admin auth + rate-limited
router.get('/reconciliation/summary', auth_js_1.authMiddleware, rateLimiter_js_1.adminRateLimiter, reconciliationController_js_1.reconciliationController.getSummary);
router.get('/reconciliation/transactions', auth_js_1.authMiddleware, rateLimiter_js_1.adminRateLimiter, reconciliationController_js_1.reconciliationController.getTransactions);
exports.reconciliationRouter = router;
exports.default = exports.reconciliationRouter;
