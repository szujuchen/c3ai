export class NotFoundError extends Error {
  constructor(message) { super(message); this.name = 'NotFoundError'; this.status = 404; this.code = 'not_found'; }
}

export class ValidationError extends Error {
  constructor(message) { super(message); this.name = 'ValidationError'; this.status = 400; this.code = 'invalid_request'; }
}

export class ForbiddenError extends Error {
  constructor(message) { super(message); this.name = 'ForbiddenError'; this.status = 403; this.code = 'forbidden'; }
}

export class ConflictError extends Error {
  constructor(message) { super(message); this.name = 'ConflictError'; this.status = 409; this.code = 'conflict'; }
}

export class UnauthorizedError extends Error {
  constructor(message) { super(message); this.name = 'UnauthorizedError'; this.status = 401; this.code = 'unauthorized'; }
}

// A service we depend on (Canvas) failed or could not be reached.
export class UpstreamError extends Error {
  constructor(message) { super(message); this.name = 'UpstreamError'; this.status = 502; this.code = 'upstream_error'; }
}
