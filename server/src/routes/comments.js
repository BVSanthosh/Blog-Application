import { Hono } from "hono";
import { withDb } from "../db.js";
import { currentUser, requireAuth, withAuth } from "../lib/auth.js";
import { forbidden, notFound } from "../lib/errors.js";
import { objectId, pagination, readJson, text } from "../lib/validate.js";

const comments = new Hono();

comments.use("*", withDb);
comments.use("*", withAuth);

comments.get("/:postId", async (c) => {
  const { comments: commentsCol } = c.get("collections");
  const post = objectId(c.req.param("postId"), "Post id");
  const { limit, skip } = pagination(c.req.query(), { defaultLimit: 50, maxLimit: 100 });

  const list = await commentsCol
    .aggregate([
      { $match: { post } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { username: 1, img: 1 } }],
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    ])
    .toArray();

  return c.json(list);
});

comments.post("/:postId", requireAuth, async (c) => {
  const { comments: commentsCol, posts } = c.get("collections");
  const postId = objectId(c.req.param("postId"), "Post id");

  // Refuse comments on posts that do not exist, rather than writing a row
  // that no page will ever display.
  const post = await posts.findOne({ _id: postId }, { projection: { _id: 1 } });
  if (!post) throw notFound("Post not found");

  const user = await currentUser(c, { _id: 1, username: 1, img: 1 });
  const body = await readJson(c);

  const comment = {
    user: user._id,
    post: postId,
    desc: text(body.desc, "Comment", { required: true, max: 2000 }),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { insertedId } = await commentsCol.insertOne(comment);

  // Returned with the author embedded, matching the shape GET returns, so the
  // client can drop it straight into the list.
  return c.json(
    { ...comment, _id: insertedId, user: { _id: user._id, username: user.username, img: user.img } },
    201,
  );
});

comments.delete("/:id", requireAuth, async (c) => {
  const { comments: commentsCol } = c.get("collections");
  const auth = c.get("auth");
  const _id = objectId(c.req.param("id"), "Comment id");

  const filter = { _id };
  if (auth.role !== "admin") {
    const user = await currentUser(c, { _id: 1 });
    filter.user = user._id;
  }

  const deleted = await commentsCol.findOneAndDelete(filter);
  if (!deleted) {
    const exists = await commentsCol.findOne({ _id }, { projection: { _id: 1 } });
    throw exists
      ? forbidden("You can only delete your own comments")
      : notFound("Comment not found");
  }

  return c.json({ message: "Comment has been deleted" });
});

export default comments;
