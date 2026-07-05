"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconciliationController = exports.ReconciliationController = void 0;
const reconciliationService_js_1 = require("../services/reconciliationService.js");
const schemas_js_1 = require("../utils/schemas.js");
class ReconciliationController {
    async getSummary(req, res, next) {
        try {
            const filters = schemas_js_1.getReconciliationSummaryQuerySchema.parse(req.query);
            const summary = await reconciliationService_js_1.reconciliationService.getSummary(filters.startDate, filters.endDate);
            res.status(200).json(summary);
        }
        catch (err) {
            next(err);
        }
    }
    async getTransactions(req, res, next) {
        try {
            const filters = schemas_js_1.getReconciliationTransactionsQuerySchema.parse(req.query);
            const result = await reconciliationService_js_1.reconciliationService.getTransactions(filters);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ReconciliationController = ReconciliationController;
exports.reconciliationController = new ReconciliationController();
exports.default = exports.reconciliationController;
