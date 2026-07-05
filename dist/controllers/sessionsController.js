"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionsController = exports.SessionsController = void 0;
const sessionsService_js_1 = require("../services/sessionsService.js");
const schemas_js_1 = require("../utils/schemas.js");
class SessionsController {
    async getCallSessions(req, res, next) {
        try {
            const filters = schemas_js_1.getCallSessionsQuerySchema.parse(req.query);
            const result = await sessionsService_js_1.sessionsService.getCallSessions(filters);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    async getCallSession(req, res, next) {
        try {
            const params = schemas_js_1.getCallSessionParamsSchema.parse(req.params);
            const session = await sessionsService_js_1.sessionsService.getCallSession(params.callSessionId);
            res.status(200).json(session);
        }
        catch (err) {
            next(err);
        }
    }
    async getUssdSession(req, res, next) {
        try {
            const params = schemas_js_1.getUssdSessionParamsSchema.parse(req.params);
            const session = await sessionsService_js_1.sessionsService.getUssdSession(params.ussdSessionId);
            // Sanitize: Exclude sessionIdMoolre (internal-only field)
            const responseData = { ...session };
            delete responseData.sessionIdMoolre;
            res.status(200).json(responseData);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.SessionsController = SessionsController;
exports.sessionsController = new SessionsController();
exports.default = exports.sessionsController;
