import { ObjectId } from "mongodb";
import { badRequest } from "./errors.js";

/** The category slugs the client offers. "general" is the implicit default. */
export const CATEGORIES = [
  "general",
  "frontend",
  "backend",
  "database",
  "cloud-services",
  "development-tools",
];

/**
 * Validate a string field, returning it trimmed.
 * Returns "" for absent optional fields so callers can store a consistent shape.
 */
export function text(value, field, { required = false, max = 5000 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw badRequest(`${field} is required`);
    return "";
  }
  if (typeof value !== "string") throw badRequest(`${field} must be text`);

  const trimmed = value.trim();
  if (required && !trimmed) throw badRequest(`${field} is required`);
  if (trimmed.length > max) {
    throw badRequest(`${field} must be at most ${max} characters`);
  }
  return trimmed;
}

/**
 * Read a JSON body, answering 400 rather than 500 when it is absent or
 * malformed. c.req.json() throws a SyntaxError that would otherwise surface as
 * "Something went wrong".
 */
export async function readJson(c) {
  try {
    const body = await c.req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // fall through
  }
  throw badRequest("Expected a JSON object");
}

/** Parse a hex string into an ObjectId, rejecting malformed ids with a 400. */
export function objectId(value, field = "id") {
  if (typeof value !== "string" || !ObjectId.isValid(value)) {
    throw badRequest(`${field} is not a valid id`);
  }
  return new ObjectId(value);
}

export function category(value) {
  const slug = text(value, "category") || "general";
  if (!CATEGORIES.includes(slug)) throw badRequest("Unknown category");
  return slug;
}

/** Clamp pagination so a client cannot ask for the whole collection at once. */
export function pagination(query, { defaultLimit = 10, maxLimit = 50 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, requested));
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Escape a user-supplied search term before using it in $regex.
 * Without this, input like "(((" is a malformed pattern and ".*.*.*" is a
 * denial-of-service vector.
 */
export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
