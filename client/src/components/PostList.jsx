import { useInfiniteQuery } from "@tanstack/react-query";
import InfiniteScroll from "react-infinite-scroll-component";
import { useSearchParams } from "react-router-dom";
import PostListItem from "./PostListItem";
import { api, errorMessage } from "../lib/api";

const PAGE_LIMIT = 10;

const fetchPosts = async (pageParam, searchParams) => {
  const res = await api.get("/posts", {
    params: {
      page: pageParam,
      limit: PAGE_LIMIT,
      ...Object.fromEntries(searchParams),
    },
  });
  return res.data;
};

const PostList = () => {
  const [searchParams] = useSearchParams();

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["posts", searchParams.toString()],
      queryFn: ({ pageParam }) => fetchPosts(pageParam, searchParams),
      // Required in react-query v5 — without it the query never runs.
      initialPageParam: 1,
      getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.length + 1 : undefined),
    });

  // Keyed off `status`, not `isFetching`. `isFetching` is true while loading
  // the *next* page too, so the whole list unmounted on every scroll and
  // infinite scrolling could never advance past page two.
  if (status === "pending") {
    return <p className="text-secondary-text-color">Loading posts...</p>;
  }

  if (status === "error") {
    return <p className="text-red-700">{errorMessage(error, "Could not load posts")}</p>;
  }

  const allPosts = data.pages.flatMap((page) => page.posts);

  if (allPosts.length === 0) {
    return (
      <p className="text-secondary-text-color">
        No posts found. Try a different category or search.
      </p>
    );
  }

  return (
    <InfiniteScroll
      dataLength={allPosts.length}
      next={fetchNextPage}
      hasMore={Boolean(hasNextPage)}
      loader={isFetchingNextPage ? <h4 className="mb-8">Loading more posts...</h4> : null}
      endMessage={
        <p className="text-secondary-text-color mb-8">
          <b>All posts loaded</b>
        </p>
      }
    >
      {allPosts.map((post) => (
        <PostListItem key={post._id} post={post} />
      ))}
    </InfiniteScroll>
  );
};

export default PostList;
