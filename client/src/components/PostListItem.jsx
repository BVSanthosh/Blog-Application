import { Link } from "react-router-dom";
import CoverImage from "./CoverImage";
import { format } from "timeago.js";

const PostListItem = ({ post }) => {
  const author = post.user?.username;

  return (
    <article className="rounded-2xl bg-white shadow-lg p-6 md:p-8 flex flex-col xl:flex-row gap-6 mb-12">
      <div className="xl:w-1/3">
        <CoverImage
          src={post.img}
          className="rounded-2xl object-cover w-full"
          w="735"
          h="500"
          alt={post.title}
        />
      </div>
      <div className="flex flex-col gap-4 xl:w-2/3">
        <Link to={`/${post.slug}`} className="text-2xl md:text-3xl xl:text-4xl font-semibold">
          {post.title}
        </Link>
        <div className="flex items-center flex-wrap gap-2 text-sm">
          {/* A post whose author was deleted still renders; reading
              post.user.username unconditionally crashed the whole list. */}
          {author && (
            <>
              <span className="text-secondary-text-color">Written by</span>
              <Link
                className="text-blue-800 hover:text-blue-600"
                to={`/posts?author=${encodeURIComponent(author)}`}
              >
                {author}
              </Link>
              <span className="text-secondary-text-color">on</span>
            </>
          )}
          <Link
            className="text-blue-800 hover:text-blue-600"
            to={`/posts?cat=${encodeURIComponent(post.category)}`}
          >
            {post.category}
          </Link>
          <span className="text-secondary-text-color">{format(post.createdAt)}</span>
        </div>
        {post.desc && <p className="text-primary-text-color">{post.desc}</p>}
        <Link to={`/${post.slug}`} className="underline text-blue-800 text-sm hover:text-blue-600">
          Read More
        </Link>
      </div>
    </article>
  );
};

export default PostListItem;
