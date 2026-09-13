import { Hono } from "hono";
import { withDb } from "../db.js";
import { currentUser, requireAuth, withAuth } from "../lib/auth.js";
import { objectId, readJson } from "../lib/validate.js";

const users = new Hono();

users.use("*", withDb);
users.use("*", withAuth);

users.get("/saved", requireAuth, async (c) => {
  const user = await currentUser(c, { savedPosts: 1 });
  return c.json(user.savedPosts ?? []);
});

users.patch("/save", requireAuth, async (c) => {
  const { users: usersCol } = c.get("collections");
  const user = await currentUser(c, { _id: 1, savedPosts: 1 });

  const body = await readJson(c);
  // Validated as an id, then stored as a string to match the existing
  // savedPosts documents.
  const postId = objectId(body.postId, "postId").toString();

  const isSaved = (user.savedPosts ?? []).includes(postId);

  await usersCol.updateOne({ _id: user._id }, {
    // $addToSet rather than $push: double-clicking Save no longer stores the
    // same id twice.
    ...(isSaved ? { $pull: { savedPosts: postId } } : { $addToSet: { savedPosts: postId } }),
    $set: { updatedAt: new Date() },
  });

  return c.json({ saved: !isSaved, message: isSaved ? "Post unsaved" : "Post saved" });
});

export default users;
