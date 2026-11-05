export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const badRequest = (m = "Bad request") =>
  new AppError(400, "BAD_REQUEST", m);
export const unauthorized = (m = "Authentication required") =>
  new AppError(401, "UNAUTHORIZED", m);
export const forbidden = (m = "Forbidden") => new AppError(403, "FORBIDDEN", m);
export const notFound = (m = "Not found") => new AppError(404, "NOT_FOUND", m);
export const invalidPassword = (m = "Incorrect password.") =>
  new AppError(400, "INVALID_PASSWORD", m);
export const conflict = (m = "Conflict") => new AppError(409, "CONFLICT", m);
