import { Hono } from "hono";
import { withDb } from "../db.js";
import { verifyWebhook, WebhookVerificationError } from "../lib/svix.js";

const webhooks = new Hono();

webhooks.use("*", withDb);

/** Clerk's user payloads carry a list of addresses; the primary one is ours. */
function primaryEmail(data) {
  const addresses = data.email_addresses ?? [];
  const primary =
    addresses.find((address) => address.id === data.primary_email_address_id) ?? addresses[0];
  return primary?.email_address ?? null;
}

function profileFrom(data) {
  return {
    // Falling back to the email keeps the unique index on username satisfied
    // for instances where usernames are not enabled.
    username: data.username || primaryEmail(data) || data.id,
    email: primaryEmail(data),
    // Clerk sends `image_url`; the old code read `profile_img_url`, which is
    // not a field Clerk has ever sent, so every avatar was undefined.
    img: data.image_url ?? data.profile_image_url ?? null,
    updatedAt: new Date(),
  };
}

webhooks.post("/clerk", async (c) => {
  const secret = c.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SECRET is not configured");
    return c.json({ message: "Webhook not configured" }, 500);
  }

  let event;
  try {
    // Verified against the raw body: re-serialising parsed JSON would change
    // the bytes and invalidate the signature.
    event = await verifyWebhook(secret, await c.req.text(), c.req.raw.headers);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return c.json({ message: "Webhook verification failed" }, 400);
    }
    throw err;
  }

  const { users, posts, comments } = c.get("collections");
  const data = event.data ?? {};

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      // Upserting handles both cases and makes redelivery of the same event
      // harmless, which Svix explicitly asks receivers to tolerate.
      await users.updateOne(
        { clerkUserId: data.id },
        {
          $set: profileFrom(data),
          $setOnInsert: { clerkUserId: data.id, savedPosts: [], createdAt: new Date() },
        },
        { upsert: true },
      );
      break;
    }

    case "user.deleted": {
      const deleted = await users.findOneAndDelete({ clerkUserId: data.id });
      if (deleted) {
        await Promise.all([
          posts.deleteMany({ user: deleted._id }),
          comments.deleteMany({ user: deleted._id }),
        ]);
      }
      break;
    }

    default:
      break;
  }

  // Always 200 for a verified event, including unhandled types — a non-2xx
  // makes Svix retry a delivery there is nothing to do about.
  return c.json({ message: "Webhook received" });
});

export default webhooks;
