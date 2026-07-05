"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = requestIdMiddleware;
const crypto_1 = require("crypto");
function requestIdMiddleware(req, res, next) {
    const incomingId = req.headers['x-request-id'];
    const id = typeof incomingId === 'string' && incomingId ? incomingId : (0, crypto_1.randomUUID)();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    next();
}
