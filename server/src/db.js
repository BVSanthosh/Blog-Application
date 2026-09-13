import { MongoClient } from "mongodb";
import { ApiError } from "./lib/errors.js";

/**
 * Connection handling on Workers.
 *
 * A socket opened while handling one request cannot be used while handling
 * another — the runtime ties I/O objects to the request context that created
 * them. Caching a MongoClient in module scope therefore looks like it works
 * (the first request succeeds) and then hangs every request after it, which
 * the runtime eventually cancels with "your Worker's code had hung".
 *
 * So the client is per-request. The cost is a connection handshake on each
 * request; the queries within a request still share that one connection.
 */
function createClient(env) {
  if (!env.MONGO_URI) throw new Error("MONGO_URI is not configured");

  return new MongoClient(env.MONGO_URI, {
    // One request is served at a time, so a single connection is all a pool
    // could ever hand out.
    maxPoolSize: 1,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 5000,
  });
}

/** Collection names match what Mongoose pluralised them to, so data carries over. */
export function collections(db) {
  return {
    users: db.collection("users"),
    posts: db.collection("posts"),
    comments: db.collection("comments"),
  };
}

/** Hono exposes no ExecutionContext outside the Workers runtime (e.g. in tests). */
function executionContext(c) {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}

/**
 * Opens a connection for this request, exposes the collections on the context,
 * and closes it once the response is ready. Mounted per-router so an unknown
 * path 404s without dialling the database at all.
 */
export async function withDb(c, next) {
  let client;

  try {
    client = await createClient(c.env).connect();
  } catch (err) {
    console.error("Database connection failed", err);
    throw new ApiError(503, "Service temporarily unavailable");
  }

  c.set("collections", collections(client.db(c.env.MONGO_DB_NAME || undefined)));

  try {
    // Deliberately outside the catch above: an error raised by the route must
    // keep its own status rather than being reported as an outage.
    await next();
  } finally {
    const closing = client
      .close()
      .catch((err) => console.error("Failed to close the database connection", err));

    // Closing need not delay the response, but it must still be awaited
    // somewhere or the runtime may cancel it mid-flight.
    const ctx = executionContext(c);
    if (ctx) ctx.waitUntil(closing);
    else await closing;
  }
}
