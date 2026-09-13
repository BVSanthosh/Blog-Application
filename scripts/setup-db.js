/**
 * Create the indexes the API relies on.
 *
 * Mongoose used to declare these implicitly via `unique: true` and build them
 * on connect; with the native driver they have to be created deliberately.
 * Safe to re-run — createIndexes is idempotent.
 *
 *   npm run db:setup                 (reads .dev.vars)
 *   MONGO_URI=... node scripts/setup-db.js
 */
import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("MONGO_URI is not set. Copy .dev.vars.example to .dev.vars first.");
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(process.env.MONGO_DB_NAME || undefined);
  console.log(`Connected to "${db.databaseName}"`);

  await db.collection("users").createIndexes([
    { key: { clerkUserId: 1 }, name: "clerkUserId_unique", unique: true },
    { key: { username: 1 }, name: "username_unique", unique: true },
    // Sparse: Clerk instances without email enabled store null, and a plain
    // unique index would reject the second such user.
    { key: { email: 1 }, name: "email_unique", unique: true, sparse: true },
  ]);

  await db.collection("posts").createIndexes([
    { key: { slug: 1 }, name: "slug_unique", unique: true },
    { key: { createdAt: -1 }, name: "createdAt_desc" },
    { key: { visits: -1 }, name: "visits_desc" },
    { key: { category: 1, createdAt: -1 }, name: "category_createdAt" },
    { key: { user: 1, createdAt: -1 }, name: "user_createdAt" },
    // Partial: only a handful of posts are featured, so the index stays tiny.
    {
      key: { isFeatured: 1, createdAt: -1 },
      name: "featured_createdAt",
      partialFilterExpression: { isFeatured: true },
    },
  ]);

  await db.collection("comments").createIndexes([
    { key: { post: 1, createdAt: -1 }, name: "post_createdAt" },
    { key: { user: 1 }, name: "user" },
  ]);

  for (const name of ["users", "posts", "comments"]) {
    const indexes = await db.collection(name).indexes();
    console.log(`  ${name}: ${indexes.map((i) => i.name).join(", ")}`);
  }
  console.log("Indexes are up to date.");
} catch (err) {
  console.error("Failed to create indexes:", err.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
