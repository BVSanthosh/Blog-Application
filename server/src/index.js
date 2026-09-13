import { Hono } from "hono";
import { ApiError } from "./lib/errors.js";
import comments from "./routes/comments.js";
import posts from "./routes/posts.js";
import users from "./routes/users.js";
import webhooks from "./routes/webhooks.js";

// Only /api/* reaches this Worker; everything else is served from the static
// assets bundle (see `run_worker_first` in wrangler.jsonc). Because the SPA and
// the API share an origin, no CORS handling is needed.
const app = new Hono().basePath("/api");

// Answers even when Mongo is unreachable, which is exactly when a health check
// matters. Each router attaches the database itself (see withDb).
app.get("/health", (c) => c.json({ status: "ok" }));

// Webhooks authenticate with a Svix signature, not a Clerk session, so they are
// mounted outside the session middleware.
app.route("/webhooks", webhooks);

app.route("/posts", posts);
app.route("/comments", comments);
app.route("/users", users);

app.notFound((c) => c.json({ message: "Not found" }, 404));

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ message: err.message }, err.status);
  }

  // Anything else is a bug or an outage. Log it in full, but tell the client
  // nothing — the previous handler returned the stack trace in the response.
  console.error("Unhandled error", err);
  return c.json({ message: "Something went wrong" }, 500);
});

export default app;
