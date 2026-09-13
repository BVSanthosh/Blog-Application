import { after, before, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import {
  TEST_AUTH_HEADER,
  authHeaders,
  makeFetch,
  seedPost,
  seedUser,
  startDatabase,
} from "./helpers.js";

/**
 * Clerk is stubbed at its own boundary — `createClerkClient` — so withAuth,
 * requireAuth, requireAdmin and currentUser all run as written. The stub reads
 * the caller out of a test header.
 */
mock.module("@clerk/backend", {
  namedExports: {
    createClerkClient: () => ({
      authenticateRequest: async (request) => {
        const header = request.headers.get(TEST_AUTH_HEADER);
        const caller = header ? JSON.parse(header) : null;
        return {
          toAuth: () =>
            caller
              ? { userId: caller.userId, sessionClaims: { metadata: { role: caller.role } } }
              : { userId: null, sessionClaims: null },
        };
      },
    }),
  },
});

let database;
let app;
let env;
let request;

before(async () => {
  database = await startDatabase();
  env = {
    MONGO_URI: database.uri,
    MONGO_DB_NAME: "btechlogs-test",
    CLERK_SECRET_KEY: "sk_test",
    CLERK_PUBLISHABLE_KEY: "pk_test",
    IK_PRIVATE_KEY: "private_test",
  };
  app = (await import("../src/index.js")).default;
  request = makeFetch(app, env);
});

after(async () => {
  await database?.stop();
});

beforeEach(async () => {
  await database.reset();
});

const json = async (res) => ({ status: res.status, body: await res.json() });

describe("routing and errors", () => {
  it("answers health without touching the database", async () => {
    assert.deepEqual(await json(await request("/api/health")), {
      status: 200,
      body: { status: "ok" },
    });
  });

  it("404s unknown api routes as JSON", async () => {
    const { status, body } = await json(await request("/api/nope"));
    assert.equal(status, 404);
    assert.equal(body.message, "Not found");
  });

  it("never returns a stack trace", async () => {
    const res = await request("/api/comments/not-a-valid-id");
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.stack, undefined);
  });
});

describe("GET /api/posts", () => {
  it("paginates with hasMore based on the filtered count, not the total", async () => {
    const author = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    for (let i = 0; i < 12; i++) {
      await seedPost(database.db, author, { slug: `p${i}`, category: i < 3 ? "backend" : "general" });
    }

    // 3 backend posts, limit 10 -> there is no second page. The old code
    // compared against countDocuments() over every post and said there was.
    const { body } = await json(await request("/api/posts?cat=backend"));
    assert.equal(body.posts.length, 3);
    assert.equal(body.hasMore, false);

    const all = await json(await request("/api/posts"));
    assert.equal(all.body.posts.length, 10);
    assert.equal(all.body.hasMore, true);
  });

  it("embeds the author and omits the post body", async () => {
    const author = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    await seedPost(database.db, author, { slug: "hello", content: "<p>huge</p>" });

    const { body } = await json(await request("/api/posts"));
    assert.equal(body.posts[0].user.username, "ada");
    assert.equal(body.posts[0].content, undefined);
  });

  it("treats a search term as literal text", async () => {
    const author = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    await seedPost(database.db, author, { title: "C++ tips", slug: "cpp" });
    await seedPost(database.db, author, { title: "Rust tips", slug: "rust" });

    // An unescaped "+" is a quantifier and made this query throw.
    const { status, body } = await json(await request("/api/posts?search=C%2B%2B"));
    assert.equal(status, 200);
    assert.equal(body.posts.length, 1);
    assert.equal(body.posts[0].title, "C++ tips");
  });

  it("clamps the page size", async () => {
    const author = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    for (let i = 0; i < 60; i++) await seedPost(database.db, author, { slug: `p${i}` });

    const { body } = await json(await request("/api/posts?limit=1000"));
    assert.equal(body.posts.length, 50);
  });

  it("returns an empty page for an unknown author", async () => {
    const { status, body } = await json(await request("/api/posts?author=nobody"));
    assert.equal(status, 200);
    assert.deepEqual(body, { posts: [], hasMore: false });
  });
});

describe("GET /api/posts/:slug", () => {
  it("increments visits and embeds the author", async () => {
    const author = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    await seedPost(database.db, author, { slug: "hello", visits: 4 });

    const { status, body } = await json(await request("/api/posts/hello"));
    assert.equal(status, 200);
    assert.equal(body.visits, 5);
    assert.equal(body.user.username, "ada");
  });

  it("404s an unknown slug instead of returning null", async () => {
    const { status, body } = await json(await request("/api/posts/missing"));
    assert.equal(status, 404);
    assert.equal(body.message, "Post not found");
  });
});

describe("POST /api/posts", () => {
  it("rejects anonymous callers", async () => {
    const res = await request("/api/posts", {
      method: "POST",
      body: JSON.stringify({ title: "x", content: "y" }),
    });
    assert.equal(res.status, 401);
  });

  it("ignores client-supplied privileged fields", async () => {
    await seedUser(database.db, { clerkUserId: "u1", username: "ada" });

    const { status, body } = await json(
      await request("/api/posts", {
        method: "POST",
        headers: { ...authHeaders("u1"), "content-type": "application/json" },
        body: JSON.stringify({
          title: "My Post",
          content: "<p>hi</p>",
          // All of these used to be spread straight onto the document.
          isFeatured: true,
          visits: 9999,
          user: new ObjectId().toString(),
        }),
      }),
    );

    assert.equal(status, 201);
    assert.equal(body.isFeatured, false);
    assert.equal(body.visits, 0);

    const stored = await database.db.collection("posts").findOne({ slug: body.slug });
    assert.equal(stored.isFeatured, false);
    const author = await database.db.collection("users").findOne({ clerkUserId: "u1" });
    assert.equal(stored.user.toString(), author._id.toString());
  });

  it("builds url-safe slugs and disambiguates collisions against the base", async () => {
    await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const post = async (title) =>
      (
        await json(
          await request("/api/posts", {
            method: "POST",
            headers: { ...authHeaders("u1"), "content-type": "application/json" },
            body: JSON.stringify({ title, content: "<p>hi</p>" }),
          }),
        )
      ).body.slug;

    assert.equal(await post("Hello, World! / Part 1"), "hello-world-part-1");
    assert.equal(await post("Hello, World! / Part 1"), "hello-world-part-1-2");
    // Was "hello-world-part-1-2-3": the counter was appended to the previous
    // candidate rather than to the base slug.
    assert.equal(await post("Hello, World! / Part 1"), "hello-world-part-1-3");
  });

  it("requires a title and content", async () => {
    await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const { status, body } = await json(
      await request("/api/posts", {
        method: "POST",
        headers: { ...authHeaders("u1"), "content-type": "application/json" },
        body: JSON.stringify({ title: "   ", content: "x" }),
      }),
    );
    assert.equal(status, 400);
    assert.match(body.message, /Title is required/);
  });

  it("rejects an unknown category", async () => {
    await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const res = await request("/api/posts", {
      method: "POST",
      headers: { ...authHeaders("u1"), "content-type": "application/json" },
      body: JSON.stringify({ title: "t", content: "c", category: "nonsense" }),
    });
    assert.equal(res.status, 400);
  });
});

describe("DELETE /api/posts/:id", () => {
  it("refuses another user's post with 403 and keeps it", async () => {
    const owner = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    await seedUser(database.db, { clerkUserId: "u2", username: "bob" });
    const post = await seedPost(database.db, owner);

    const { status, body } = await json(
      await request(`/api/posts/${post._id}`, { method: "DELETE", headers: authHeaders("u2") }),
    );
    assert.equal(status, 403);
    assert.match(body.message, /your own/);
    assert.ok(await database.db.collection("posts").findOne({ _id: post._id }));
  });

  it("lets an admin delete any post and cleans up its comments", async () => {
    const owner = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    await seedUser(database.db, { clerkUserId: "admin", username: "root" });
    const post = await seedPost(database.db, owner);
    await database.db
      .collection("comments")
      .insertOne({ post: post._id, user: owner, desc: "hi", createdAt: new Date() });

    const res = await request(`/api/posts/${post._id}`, {
      method: "DELETE",
      headers: authHeaders("admin", "admin"),
    });
    assert.equal(res.status, 200);

    // Comments used to survive the post they belonged to.
    assert.equal(await database.db.collection("comments").countDocuments({ post: post._id }), 0);
  });

  it("404s a post that does not exist", async () => {
    await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const res = await request(`/api/posts/${new ObjectId()}`, {
      method: "DELETE",
      headers: authHeaders("u1"),
    });
    assert.equal(res.status, 404);
  });
});

describe("PATCH /api/posts/feature", () => {
  it("forbids non-admins with 403", async () => {
    const owner = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const post = await seedPost(database.db, owner);

    // Used to answer 200 with the text "You cannot feature posts", so the
    // client treated the refusal as a success.
    const res = await request("/api/posts/feature", {
      method: "PATCH",
      headers: { ...authHeaders("u1"), "content-type": "application/json" },
      body: JSON.stringify({ postId: post._id.toString() }),
    });
    assert.equal(res.status, 403);
  });

  it("toggles for an admin", async () => {
    const owner = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    await seedUser(database.db, { clerkUserId: "admin", username: "root" });
    const post = await seedPost(database.db, owner, { isFeatured: false });

    const toggle = async () =>
      (
        await json(
          await request("/api/posts/feature", {
            method: "PATCH",
            headers: { ...authHeaders("admin", "admin"), "content-type": "application/json" },
            body: JSON.stringify({ postId: post._id.toString() }),
          }),
        )
      ).body.isFeatured;

    assert.equal(await toggle(), true);
    assert.equal(await toggle(), false);
  });
});

describe("GET /api/posts/upload-auth", () => {
  it("requires a session", async () => {
    // Was unauthenticated, handing ImageKit upload credentials to anyone.
    const res = await request("/api/posts/upload-auth");
    assert.equal(res.status, 401);
  });

  it("returns a signature, token and expiry within an hour", async () => {
    await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const { status, body } = await json(
      await request("/api/posts/upload-auth", { headers: authHeaders("u1") }),
    );
    assert.equal(status, 200);
    assert.match(body.signature, /^[0-9a-f]{40}$/);
    assert.ok(body.token);
    const secondsOut = body.expire - Math.floor(Date.now() / 1000);
    assert.ok(secondsOut > 0 && secondsOut <= 3600, `expiry out of range: ${secondsOut}`);
  });

  it("is not shadowed by the slug route", async () => {
    await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    await seedPost(database.db, await seedUser(database.db, {
      clerkUserId: "u2",
      username: "bob",
    }), { slug: "upload-auth" });

    const { body } = await json(
      await request("/api/posts/upload-auth", { headers: authHeaders("u1") }),
    );
    assert.ok(body.signature);
  });
});

describe("comments", () => {
  it("lists newest first with the author embedded", async () => {
    const author = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const post = await seedPost(database.db, author);
    await database.db.collection("comments").insertMany([
      { post: post._id, user: author, desc: "older", createdAt: new Date("2024-01-01") },
      { post: post._id, user: author, desc: "newer", createdAt: new Date("2025-01-01") },
    ]);

    const { body } = await json(await request(`/api/comments/${post._id}`));
    assert.deepEqual(body.map((c) => c.desc), ["newer", "older"]);
    assert.equal(body[0].user.username, "ada");
  });

  it("rejects a comment on a post that does not exist", async () => {
    await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const res = await request(`/api/comments/${new ObjectId()}`, {
      method: "POST",
      headers: { ...authHeaders("u1"), "content-type": "application/json" },
      body: JSON.stringify({ desc: "hi" }),
    });
    assert.equal(res.status, 404);
  });

  it("returns the new comment with its author attached", async () => {
    const author = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const post = await seedPost(database.db, author);

    const { status, body } = await json(
      await request(`/api/comments/${post._id}`, {
        method: "POST",
        headers: { ...authHeaders("u1"), "content-type": "application/json" },
        body: JSON.stringify({ desc: "nice post" }),
      }),
    );
    assert.equal(status, 201);
    assert.equal(body.desc, "nice post");
    assert.equal(body.user.username, "ada");
  });

  it("only lets the author or an admin delete", async () => {
    const author = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    await seedUser(database.db, { clerkUserId: "u2", username: "bob" });
    const post = await seedPost(database.db, author);
    const { insertedId } = await database.db
      .collection("comments")
      .insertOne({ post: post._id, user: author, desc: "hi", createdAt: new Date() });

    const denied = await request(`/api/comments/${insertedId}`, {
      method: "DELETE",
      headers: authHeaders("u2"),
    });
    assert.equal(denied.status, 403);

    const allowed = await request(`/api/comments/${insertedId}`, {
      method: "DELETE",
      headers: authHeaders("u1"),
    });
    assert.equal(allowed.status, 200);
  });
});

describe("saved posts", () => {
  it("toggles and never stores a duplicate", async () => {
    const author = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const post = await seedPost(database.db, author);
    const id = post._id.toString();

    const save = () =>
      request("/api/users/save", {
        method: "PATCH",
        headers: { ...authHeaders("u1"), "content-type": "application/json" },
        body: JSON.stringify({ postId: id }),
      });

    await save();
    let saved = await json(await request("/api/users/saved", { headers: authHeaders("u1") }));
    assert.deepEqual(saved.body, [id]);

    await save();
    saved = await json(await request("/api/users/saved", { headers: authHeaders("u1") }));
    assert.deepEqual(saved.body, []);
  });

  it("401s anonymous callers rather than crashing on a missing user", async () => {
    // getUserSavedPosts read user.savedPosts off a null user and threw a 500.
    const res = await request("/api/users/saved");
    assert.equal(res.status, 401);
  });

  it("rejects a malformed post id", async () => {
    await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const res = await request("/api/users/save", {
      method: "PATCH",
      headers: { ...authHeaders("u1"), "content-type": "application/json" },
      body: JSON.stringify({ postId: "nope" }),
    });
    assert.equal(res.status, 400);
  });
});

describe("malformed request bodies", () => {
  it("400s an unparseable JSON body instead of 500ing", async () => {
    await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const res = await request("/api/posts", {
      method: "POST",
      headers: { ...authHeaders("u1"), "content-type": "application/json" },
      body: "{not json",
    });
    assert.equal(res.status, 400);
  });

  it("400s a missing body on save", async () => {
    await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    const res = await request("/api/users/save", {
      method: "PATCH",
      headers: authHeaders("u1"),
    });
    assert.equal(res.status, 400);
  });

  it("does not treat featured=false as a filter", async () => {
    const author = await seedUser(database.db, { clerkUserId: "u1", username: "ada" });
    await seedPost(database.db, author, { slug: "a", isFeatured: false });
    await seedPost(database.db, author, { slug: "b", isFeatured: true });

    const { body } = await json(await request("/api/posts?featured=false"));
    assert.equal(body.posts.length, 2);
  });
});
