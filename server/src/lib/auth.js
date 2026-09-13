import { createClerkClient } from "@clerk/backend";
import { forbidden, unauthorized } from "./errors.js";

let clerk;

function getClerk(env) {
  if (!clerk) {
    if (!env.CLERK_SECRET_KEY) throw new Error("CLERK_SECRET_KEY is not configured");
    clerk = createClerkClient({
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
    });
  }
  return clerk;
}

/**
 * Read the role from the session token. Clerk only includes custom claims that
 * the JWT template exposes, so both the shorthand and the raw claim name are
 * checked. See README for the template this expects.
 */
function roleFrom(claims) {
  return claims?.metadata?.role ?? claims?.public_metadata?.role ?? "user";
}

/**
 * Resolve the caller once per request. Anonymous requests are allowed through
 * with `auth` set to null; routes opt into requiring a session themselves.
 */
export async function withAuth(c, next) {
  const authorizedParties = c.env.CLERK_AUTHORIZED_PARTIES?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  let auth = null;
  try {
    const state = await getClerk(c.env).authenticateRequest(c.req.raw, {
      ...(authorizedParties?.length ? { authorizedParties } : {}),
    });
    auth = state.toAuth();
  } catch (err) {
    // Treat a failure to verify as "not signed in" rather than a 500. A Clerk
    // outage or a misconfigured key then degrades to a read-only site instead
    // of taking every public page down with it; routes behind requireAuth
    // still answer 401, and the cause is in the logs.
    console.error("Clerk authentication failed", err);
  }

  c.set(
    "auth",
    auth?.userId ? { userId: auth.userId, role: roleFrom(auth.sessionClaims) } : null,
  );

  await next();
}

export async function requireAuth(c, next) {
  if (!c.get("auth")) throw unauthorized();
  await next();
}

export async function requireAdmin(c, next) {
  const auth = c.get("auth");
  if (!auth) throw unauthorized();
  if (auth.role !== "admin") throw forbidden("Admins only");
  await next();
}

/**
 * Look up the local user document for the signed-in Clerk user.
 * The document is created by the Clerk webhook, so a missing one means the
 * webhook never fired rather than a bad request.
 */
export async function currentUser(c, { projection } = {}) {
  const { userId } = c.get("auth");
  const { users } = c.get("collections");

  const user = await users.findOne({ clerkUserId: userId }, projection ? { projection } : {});
  if (!user) throw unauthorized("User record not found");
  return user;
}
