import { Hono } from "hono";
import { withDb } from "../db.js";
import { currentUser, requireAdmin, requireAuth, withAuth } from "../lib/auth.js";
import { forbidden, notFound } from "../lib/errors.js";
import { getUploadAuthParams } from "../lib/imagekit.js";
import { uniqueSlug } from "../lib/slug.js";
import {
  category,
  escapeRegex,
  objectId,
  pagination,
  readJson,
  text,
} from "../lib/validate.js";

const posts = new Hono();

posts.use("*", withDb);
posts.use("*", withAuth);

/** Joins the author onto a post. Mongoose's .populate(), as an aggregation stage. */
const withAuthor = (fields = { username: 1 }) => [
  {
    $lookup: {
      from: "users",
      localField: "user",
      foreignField: "_id",
      as: "user",
      pipeline: [{ $project: fields }],
    },
  },
  { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
];

/**
 * Must be registered before GET /:slug, or "upload-auth" is read as a slug.
 * Requires a session: these credentials authorise uploads to our ImageKit account.
 */
posts.get("/upload-auth", requireAuth, async (c) => {
  return c.json(await getUploadAuthParams(c.env.IK_PRIVATE_KEY));
});

posts.get("/", async (c) => {
  const { posts: postsCol, users } = c.get("collections");
  const params = c.req.query();
  const { page, limit, skip } = pagination(params);

  const query = {};

  if (params.cat) query.category = params.cat;
  // Explicit, so `?featured=false` does not filter *for* featured posts.
  if (params.featured === "true" || params.featured === "1") query.isFeatured = true;

  if (params.author) {
    const author = await users.findOne({ username: params.author }, { projection: { _id: 1 } });
    // An unknown author matches nothing; that is an empty page, not an error.
    if (!author) return c.json({ posts: [], hasMore: false });
    query.user = author._id;
  }

  if (params.search) {
    // Capped as well as escaped: an enormous pattern is slow to match even
    // when every character in it is a literal.
    query.title = { $regex: escapeRegex(params.search.slice(0, 100)), $options: "i" };
  }

  let sort = { createdAt: -1 };
  switch (params.sort) {
    case "oldest":
      sort = { createdAt: 1 };
      break;
    case "popular":
      sort = { visits: -1 };
      break;
    case "trending":
      sort = { visits: -1 };
      query.createdAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
      break;
    default:
      break;
  }

  const [list, total] = await Promise.all([
    postsCol
      .aggregate([
        { $match: query },
        { $sort: sort },
        { $skip: skip },
        { $limit: limit },
        // `content` is the full article body and is never rendered in a list.
        { $project: { content: 0 } },
        ...withAuthor(),
      ])
      .toArray(),
    // Counting the *filtered* set — counting every post made hasMore wrong for
    // every category, author and search page.
    postsCol.countDocuments(query),
  ]);

  return c.json({ posts: list, hasMore: skip + list.length < total });
});

posts.get("/:slug", async (c) => {
  const { posts: postsCol, users } = c.get("collections");

  // Counting the visit and fetching the post in one atomic step, so a missing
  // slug is a clean 404 instead of a silent increment followed by `null`.
  const post = await postsCol.findOneAndUpdate(
    { slug: c.req.param("slug") },
    { $inc: { visits: 1 } },
    { returnDocument: "after" },
  );
  if (!post) throw notFound("Post not found");

  const author = await users.findOne(
    { _id: post.user },
    { projection: { username: 1, img: 1 } },
  );

  return c.json({ ...post, user: author ?? null });
});

posts.post("/", requireAuth, async (c) => {
  const { posts: postsCol } = c.get("collections");
  const user = await currentUser(c, { _id: 1 });
  const body = await readJson(c);

  // Whitelisted explicitly. Spreading the request body let a client set
  // `isFeatured`, `visits`, `user` or `_id` on its own posts.
  const title = text(body.title, "Title", { required: true, max: 200 });
  const post = {
    user: user._id,
    slug: await uniqueSlug(postsCol, title),
    title,
    img: text(body.img, "Image", { max: 500 }),
    desc: text(body.desc, "Description", { max: 1000 }),
    category: category(body.category),
    content: text(body.content, "Content", { required: true, max: 100_000 }),
    isFeatured: false,
    visits: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { insertedId } = await postsCol.insertOne(post);
  return c.json({ ...post, _id: insertedId }, 201);
});

posts.patch("/feature", requireAdmin, async (c) => {
  const { posts: postsCol } = c.get("collections");
  const body = await readJson(c);

  // Toggling server-side in a single update, so two admins clicking at once
  // cannot read the same value and both write the same result.
  const updated = await postsCol.findOneAndUpdate(
    { _id: objectId(body.postId, "postId") },
    [{ $set: { isFeatured: { $not: ["$isFeatured"] }, updatedAt: "$$NOW" } }],
    { returnDocument: "after" },
  );
  if (!updated) throw notFound("Post not found");

  return c.json(updated);
});

posts.delete("/:id", requireAuth, async (c) => {
  const { posts: postsCol, comments } = c.get("collections");
  const auth = c.get("auth");
  const _id = objectId(c.req.param("id"), "Post id");

  const filter = { _id };
  if (auth.role !== "admin") {
    const user = await currentUser(c, { _id: 1 });
    filter.user = user._id;
  }

  const deleted = await postsCol.findOneAndDelete(filter);
  if (!deleted) {
    // Distinguish "gone" from "not yours" so the client can say something useful.
    const exists = await postsCol.findOne({ _id }, { projection: { _id: 1 } });
    throw exists ? forbidden("You can only delete your own posts") : notFound("Post not found");
  }

  // Comments used to be left behind, orphaned against a post that no longer exists.
  await comments.deleteMany({ post: _id });

  return c.json({ message: "Post has been deleted" });
});

export default posts;
