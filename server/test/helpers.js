import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";

/**
 * Boots a real MongoDB and points the Worker's db module at it, so the
 * aggregation pipelines and atomic updates are exercised for real rather than
 * against a stub.
 */
export async function startDatabase() {
  const server = await MongoMemoryServer.create();
  const uri = server.getUri();
  const client = await new MongoClient(uri).connect();
  const db = client.db("btechlogs-test");

  return {
    uri,
    db,
    async reset() {
      await Promise.all(
        ["users", "posts", "comments"].map((name) => db.collection(name).deleteMany({})),
      );
    },
    async stop() {
      await client.close();
      await server.stop();
    },
  };
}

/** A stand-in for Clerk: the Worker reads the caller from this header in tests. */
export const TEST_AUTH_HEADER = "x-test-auth";

export function authHeaders(userId, role = "user") {
  return { [TEST_AUTH_HEADER]: JSON.stringify({ userId, role }) };
}

export async function seedUser(db, { clerkUserId, username, email, savedPosts = [] }) {
  const { insertedId } = await db.collection("users").insertOne({
    clerkUserId,
    username,
    email: email ?? `${username}@example.com`,
    img: null,
    savedPosts,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return insertedId;
}

export async function seedPost(db, userId, overrides = {}) {
  const post = {
    user: userId,
    title: "A post",
    slug: `post-${new ObjectId().toString()}`,
    img: "",
    desc: "",
    category: "general",
    content: "<p>body</p>",
    isFeatured: false,
    visits: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  const { insertedId } = await db.collection("posts").insertOne(post);
  return { ...post, _id: insertedId };
}

/** Calls the Hono app the way the Workers runtime would. */
export function makeFetch(app, env) {
  return (path, init = {}) =>
    app.fetch(new Request(`https://test.local${path}`, init), env);
}
