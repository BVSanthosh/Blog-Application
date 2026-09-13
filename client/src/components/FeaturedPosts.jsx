import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "timeago.js";
import CoverImage from "./CoverImage";
import { api, errorMessage } from "../lib/api";

const fetchFeatured = async () => {
  const res = await api.get("/posts", { params: { featured: true, limit: 4, sort: "newest" } });
  return res.data;
};

const Meta = ({ post, index }) => (
  <div className="flex items-center gap-4 text-sm lg:text-base">
    <span className="font-semibold">{String(index).padStart(2, "0")}.</span>
    <Link to={`/posts?cat=${encodeURIComponent(post.category)}`} className="text-blue-800">
      {post.category}
    </Link>
    <span className="text-secondary-text-color">{format(post.createdAt)}</span>
  </div>
);

const FeaturedPosts = () => {
  const { isPending, error, data } = useQuery({
    queryKey: ["featuredPosts"],
    queryFn: fetchFeatured,
  });

  if (isPending) return <p className="text-secondary-text-color">Loading...</p>;
  if (error) {
    return <p className="text-red-700">{errorMessage(error, "Could not load featured posts")}</p>;
  }

  const posts = data.posts ?? [];
  if (posts.length === 0) {
    return <p className="text-secondary-text-color">No featured posts yet.</p>;
  }

  const [lead, ...rest] = posts;

  return (
    <div className="rounded-2xl bg-white p-6 md:p-8 flex flex-col lg:flex-row gap-8 shadow-xl">
      <div className="w-full lg:w-1/2 flex flex-col gap-4">
        <CoverImage
          src={lead.img}
          className="rounded-3xl object-cover w-full"
          w="795"
          h="500"
          alt={lead.title}
        />
        <Meta post={lead} index={1} />
        <Link to={`/${lead.slug}`} className="text-xl lg:text-3xl font-semibold lg:font-bold">
          {lead.title}
        </Link>
      </div>

      {/* The three secondary slots were copy-pasted three times, each with
          slightly different widths and a hard-coded index. */}
      <div className="w-full lg:w-1/2 flex flex-col gap-4">
        {rest.map((post, i) => (
          <div key={post._id} className="flex justify-between gap-4">
            <div className="w-1/3">
              <CoverImage
                src={post.img}
                className="rounded-3xl object-cover w-full h-full"
                w="298"
                h="200"
                alt={post.title}
              />
            </div>
            <div className="w-2/3 flex flex-col gap-1">
              <Meta post={post} index={i + 2} />
              <Link
                to={`/${post.slug}`}
                className="text-base sm:text-lg md:text-2xl lg:text-xl xl:text-2xl font-medium"
              >
                {post.title}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeaturedPosts;
