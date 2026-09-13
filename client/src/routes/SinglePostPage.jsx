import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "timeago.js";
import Image from "../components/Image";
import CoverImage from "../components/CoverImage";
import PostMenuActions from "../components/PostMenuActions";
import Search from "../components/Search";
import Comments from "../components/Comments";
import { api, errorMessage } from "../lib/api";
import { renderRichText } from "../lib/sanitize";
import { CATEGORIES } from "../lib/constants";

const SinglePostPage = () => {
  const { slug } = useParams();

  const { isPending, error, data } = useQuery({
    queryKey: ["post", slug],
    queryFn: async () => (await api.get(`/posts/${slug}`)).data,
    retry: (failureCount, err) => err?.response?.status !== 404 && failureCount < 2,
  });

  if (isPending) return <p className="mt-8 text-secondary-text-color">Loading...</p>;

  if (error) {
    // The API now answers 404 for an unknown slug instead of 200 with `null`,
    // so a mistyped URL reads as "not found" rather than a blank page.
    const notFound = error?.response?.status === 404;
    return (
      <div className="mt-8 flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-primary-text-color">
          {notFound ? "Post not found" : "Something went wrong"}
        </h1>
        <p className="text-secondary-text-color">
          {notFound ? "This post may have been deleted." : errorMessage(error)}
        </p>
        <Link to="/posts" className="text-blue-800 underline w-max">
          Browse all posts
        </Link>
      </div>
    );
  }

  const author = data.user;

  return (
    <div className="mt-8 flex flex-col gap-8">
      <div className="rounded-2xl bg-white shadow-lg flex p-6 gap-8">
        <div className="lg:w-3/5 flex flex-col gap-8">
          <h1 className="text-primary-text-color text-xl md:text-3xl xl:text-4xl 2xl:text-5xl font-bold">
            {data.title}
          </h1>
          <div className="flex items-center flex-wrap gap-2 text-secondary-text-color text-sm">
            {/* Every one of these was a <Link> with no `to`. */}
            {author?.username && (
              <>
                <span>Written by</span>
                <Link
                  to={`/posts?author=${encodeURIComponent(author.username)}`}
                  className="text-blue-800"
                >
                  {author.username}
                </Link>
                <span>on</span>
              </>
            )}
            <Link
              to={`/posts?cat=${encodeURIComponent(data.category)}`}
              className="text-blue-800"
            >
              {data.category}
            </Link>
            <span>{format(data.createdAt)}</span>
          </div>
          {data.desc && <p className="text-primary-text-color font-medium">{data.desc}</p>}
        </div>
        <div className="hidden lg:block w-2/5">
          <CoverImage
            src={data.img}
            className="rounded-2xl w-full"
            w="600"
            h="400"
            alt={data.title}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-12 w-full">
        {/* Sanitised before rendering — post bodies are user-authored HTML. */}
        <div className="prose-content rounded-2xl bg-white shadow-lg p-6 lg:text-lg flex flex-col gap-6 text-justify text-primary-text-color w-full md:w-3/4 overflow-hidden">
          {renderRichText(data.content)}
        </div>

        <aside className="rounded-2xl bg-white shadow-lg p-4 h-max md:sticky md:top-8 w-full md:w-1/4">
          <h2 className="mb-4 text-sm font-medium text-primary-text-color">Author</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {/* Read `data.user.image`, a field the API never returned, so the
                  avatar never rendered for anyone. */}
              {author?.img && (
                <Image
                  src={author.img}
                  className="w-12 h-12 rounded-full object-cover"
                  w="48"
                  h="48"
                  alt={author.username}
                />
              )}
              {author?.username && (
                <Link
                  to={`/posts?author=${encodeURIComponent(author.username)}`}
                  className="text-blue-800"
                >
                  {author.username}
                </Link>
              )}
            </div>
          </div>

          <PostMenuActions post={data} />

          <h2 className="mt-8 mb-4 text-sm font-medium text-primary-text-color">Categories</h2>
          <div className="flex flex-col gap-2 text-sm">
            {CATEGORIES.map(({ value, label }) => (
              <Link
                key={value || "all"}
                to={value ? `/posts?cat=${value}` : "/posts"}
                className="underline cursor-pointer text-blue-800 hover:text-blue-600"
              >
                {label}
              </Link>
            ))}
          </div>

          <h2 className="mt-8 mb-4 text-sm font-medium text-primary-text-color">Search</h2>
          <Search />
        </aside>
      </div>

      <Comments postId={data._id} />
    </div>
  );
};

export default SinglePostPage;
