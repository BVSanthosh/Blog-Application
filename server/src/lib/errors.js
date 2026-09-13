/**
 * An error that is safe to surface to the client, carrying an HTTP status.
 * Anything thrown that is *not* an ApiError is treated as a 500 and its
 * message is withheld from the response.
 */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const badRequest = (message) => new ApiError(400, message);
export const unauthorized = (message = "Not authenticated") => new ApiError(401, message);
export const forbidden = (message = "Not allowed") => new ApiError(403, message);
export const notFound = (message = "Not found") => new ApiError(404, message);
