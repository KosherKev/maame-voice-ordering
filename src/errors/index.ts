export class DomainError extends Error {
  constructor(
    public readonly typeSuffix: string,
    public readonly title: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly errors?: { detail: string; pointer: string }[],
  ) {
    super('validation-error', 'Validation error', 400, message);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Missing, malformed, or expired JWT') {
    super('unauthorized', 'Unauthorized', 401, message);
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor(message: string = 'Login with wrong username/password') {
    super('invalid-credentials', 'Invalid credentials', 401, message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = 'Valid token, insufficient role/permission') {
    super('forbidden', 'Forbidden', 403, message);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string = 'Resource not found') {
    super('not-found', 'Not found', 404, message);
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor(message: string = 'Same Idempotency-Key reused with a different request body') {
    super('idempotency-conflict', 'Idempotency key conflict', 409, message);
  }
}

export class FulfillmentAlreadyDeliveredError extends DomainError {
  constructor(message: string = 'mark-delivered called twice for the same fulfillment') {
    super('fulfillment-already-delivered', 'Fulfillment already delivered', 409, message);
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(message: string) {
    super('invalid-state-transition', 'Invalid state transition', 422, message);
  }
}

export class WebhookSignatureInvalidError extends DomainError {
  constructor(message: string = 'Webhook verification failed') {
    super('webhook-signature-invalid', 'Webhook verification failed', 401, message);
  }
}

export class RateLimitedError extends DomainError {
  constructor(message: string = 'Too many requests') {
    super('rate-limited', 'Too many requests', 429, message);
  }
}

export class UpstreamProviderError extends DomainError {
  constructor(message: string) {
    super('upstream-provider-error', 'Upstream provider error', 502, message);
  }
}
