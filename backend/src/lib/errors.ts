export class HttpError extends Error {
  status: number;
  code: string;
  extra?: unknown;

  constructor(status: number, code: string, message: string, extra?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function conflict(message: string, extra?: unknown): HttpError {
  return new HttpError(409, "DUPLICATE", message, extra);
}

export function unauthorized(message = "Please log in again."): HttpError {
  return new HttpError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "You cannot do this."): HttpError {
  return new HttpError(403, "FORBIDDEN", message);
}

export function notFound(message = "Not found."): HttpError {
  return new HttpError(404, "NOT_FOUND", message);
}

export function badRequest(message: string, code = "BAD_REQUEST", extra?: unknown): HttpError {
  return new HttpError(400, code, message, extra);
}
