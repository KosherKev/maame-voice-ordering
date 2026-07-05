"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpstreamProviderError = exports.RateLimitedError = exports.WebhookSignatureInvalidError = exports.InvalidStateTransitionError = exports.FulfillmentAlreadyDeliveredError = exports.IdempotencyConflictError = exports.NotFoundError = exports.ForbiddenError = exports.InvalidCredentialsError = exports.UnauthorizedError = exports.ValidationError = exports.DomainError = void 0;
class DomainError extends Error {
    typeSuffix;
    title;
    status;
    constructor(typeSuffix, title, status, message) {
        super(message);
        this.typeSuffix = typeSuffix;
        this.title = title;
        this.status = status;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.DomainError = DomainError;
class ValidationError extends DomainError {
    errors;
    constructor(message, errors) {
        super('validation-error', 'Validation error', 400, message);
        this.errors = errors;
    }
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends DomainError {
    constructor(message = 'Missing, malformed, or expired JWT') {
        super('unauthorized', 'Unauthorized', 401, message);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class InvalidCredentialsError extends DomainError {
    constructor(message = 'Login with wrong username/password') {
        super('invalid-credentials', 'Invalid credentials', 401, message);
    }
}
exports.InvalidCredentialsError = InvalidCredentialsError;
class ForbiddenError extends DomainError {
    constructor(message = 'Valid token, insufficient role/permission') {
        super('forbidden', 'Forbidden', 403, message);
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends DomainError {
    constructor(message = 'Resource not found') {
        super('not-found', 'Not found', 404, message);
    }
}
exports.NotFoundError = NotFoundError;
class IdempotencyConflictError extends DomainError {
    constructor(message = 'Same Idempotency-Key reused with a different request body') {
        super('idempotency-conflict', 'Idempotency key conflict', 409, message);
    }
}
exports.IdempotencyConflictError = IdempotencyConflictError;
class FulfillmentAlreadyDeliveredError extends DomainError {
    constructor(message = 'mark-delivered called twice for the same fulfillment') {
        super('fulfillment-already-delivered', 'Fulfillment already delivered', 409, message);
    }
}
exports.FulfillmentAlreadyDeliveredError = FulfillmentAlreadyDeliveredError;
class InvalidStateTransitionError extends DomainError {
    constructor(message) {
        super('invalid-state-transition', 'Invalid state transition', 422, message);
    }
}
exports.InvalidStateTransitionError = InvalidStateTransitionError;
class WebhookSignatureInvalidError extends DomainError {
    constructor(message = 'Webhook verification failed') {
        super('webhook-signature-invalid', 'Webhook verification failed', 401, message);
    }
}
exports.WebhookSignatureInvalidError = WebhookSignatureInvalidError;
class RateLimitedError extends DomainError {
    constructor(message = 'Too many requests') {
        super('rate-limited', 'Too many requests', 429, message);
    }
}
exports.RateLimitedError = RateLimitedError;
class UpstreamProviderError extends DomainError {
    constructor(message) {
        super('upstream-provider-error', 'Upstream provider error', 502, message);
    }
}
exports.UpstreamProviderError = UpstreamProviderError;
