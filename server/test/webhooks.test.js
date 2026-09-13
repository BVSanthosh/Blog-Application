import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Webhook } from "svix";
import { makeFetch, seedPost, seedUser, startDatabase } from "./helpers.js";

/**
 * The Svix verification in lib/svix.js is hand-written against WebCrypto, so
 * the fixtures here are signed by the reference `svix` library. If the two ever
 * disagree, these fail.
 */
const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

let database;
let app;
let env;
let request;
let signer;

before(async () => {
  database = await startDatabase();
  env = {
    MONGO_URI: database.uri,
    MONGO_DB_NAME: "btechlogs-test",
    CLERK_SECRET_KEY: "sk_test",
    CLERK_WEBHOOK_SECRET: SECRET,
  };
  app = (await import("../src/index.js")).default;
  request = makeFetch(app, env);
  signer = new Webhook(SECRET);
});

after(async () => {
  await database?.stop();
});

beforeEach(async () => {
  await database.reset();
});

function signed(event, { timestamp = new Date(), id = "msg_test_1" } = {}) {
  const payload = JSON.stringify(event);
  const signature = signer.sign(id, timestamp, payload);

  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature,
    },
    body: payload,
  };
}

const userCreated = (overrides = {}) => ({
  type: "user.created",
  data: {
    id: "clerk_1",
    username: "ada",
    primary_email_address_id: "idn_1",
    email_addresses: [{ id: "idn_1", email_address: "ada@example.com" }],
    image_url: "https://img.clerk.com/ada.png",
    ...overrides,
  },
});

describe("POST /api/webhooks/clerk", () => {
  it("accepts a correctly signed payload", async () => {
    const res = await request("/api/webhooks/clerk", signed(userCreated()));
    assert.equal(res.status, 200);

    const user = await database.db.collection("users").findOne({ clerkUserId: "clerk_1" });
    assert.equal(user.username, "ada");
    assert.equal(user.email, "ada@example.com");
    // Was read from `profile_img_url`, a field Clerk does not send, so every
    // avatar was stored as undefined.
    assert.equal(user.img, "https://img.clerk.com/ada.png");
    assert.deepEqual(user.savedPosts, []);
  });

  it("rejects an unsigned request", async () => {
    const res = await request("/api/webhooks/clerk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(userCreated()),
    });
    assert.equal(res.status, 400);
    assert.equal(await database.db.collection("users").countDocuments(), 0);
  });

  it("rejects a tampered payload", async () => {
    const init = signed(userCreated());
    init.body = JSON.stringify(userCreated({ username: "attacker" }));

    const res = await request("/api/webhooks/clerk", init);
    assert.equal(res.status, 400);
    assert.equal(await database.db.collection("users").countDocuments(), 0);
  });

  it("rejects a signature made with a different secret", async () => {
    const other = new Webhook("whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    const payload = JSON.stringify(userCreated());
    const res = await request("/api/webhooks/clerk", {
      method: "POST",
      headers: {
        "svix-id": "msg_x",
        "svix-timestamp": String(Math.floor(Date.now() / 1000)),
        "svix-signature": other.sign("msg_x", new Date(), payload),
      },
      body: payload,
    });
    assert.equal(res.status, 400);
  });

  it("rejects a replayed payload outside the timestamp tolerance", async () => {
    const old = new Date(Date.now() - 10 * 60 * 1000);
    const res = await request("/api/webhooks/clerk", signed(userCreated(), { timestamp: old }));
    assert.equal(res.status, 400);
  });

  it("is idempotent when the same event is redelivered", async () => {
    await request("/api/webhooks/clerk", signed(userCreated()));
    const res = await request("/api/webhooks/clerk", signed(userCreated()));

    assert.equal(res.status, 200);
    assert.equal(await database.db.collection("users").countDocuments(), 1);
  });

  it("updates an existing user on user.updated", async () => {
    await request("/api/webhooks/clerk", signed(userCreated()));
    await request(
      "/api/webhooks/clerk",
      signed({ ...userCreated({ username: "ada-lovelace" }), type: "user.updated" }),
    );

    const user = await database.db.collection("users").findOne({ clerkUserId: "clerk_1" });
    assert.equal(user.username, "ada-lovelace");
    assert.equal(await database.db.collection("users").countDocuments(), 1);
  });

  it("falls back to the email when no username is set", async () => {
    await request("/api/webhooks/clerk", signed(userCreated({ username: null })));
    const user = await database.db.collection("users").findOne({ clerkUserId: "clerk_1" });
    assert.equal(user.username, "ada@example.com");
  });

  it("removes the user's posts and comments on user.deleted", async () => {
    const userId = await seedUser(database.db, { clerkUserId: "clerk_1", username: "ada" });
    const post = await seedPost(database.db, userId);
    await database.db
      .collection("comments")
      .insertOne({ post: post._id, user: userId, desc: "hi", createdAt: new Date() });

    const res = await request(
      "/api/webhooks/clerk",
      signed({ type: "user.deleted", data: { id: "clerk_1" } }),
    );

    assert.equal(res.status, 200);
    assert.equal(await database.db.collection("users").countDocuments(), 0);
    assert.equal(await database.db.collection("posts").countDocuments(), 0);
    assert.equal(await database.db.collection("comments").countDocuments(), 0);
  });

  it("acknowledges event types it does not handle", async () => {
    // A non-2xx here would make Svix retry a delivery forever.
    const res = await request(
      "/api/webhooks/clerk",
      signed({ type: "session.created", data: { id: "sess_1" } }),
    );
    assert.equal(res.status, 200);
  });
});
