import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { errorMessage, useAuthedRequest } from "../lib/api";

const PostMenuActions = ({ post }) => {
  const { user, isSignedIn } = useUser();
  const request = useAuthedRequest();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { isPending, error, data: savedPosts } = useQuery({
    queryKey: ["savedPosts"],
    queryFn: async () => (await request({ method: "get", url: "/users/saved" })).data,
    // Signed-out visitors were firing this anyway, getting a 401, and being
    // shown "Failed to fetch saved posts" on every post page.
    enabled: Boolean(isSignedIn),
  });

  const isAdmin = user?.publicMetadata?.role === "admin";
  const isSaved = Array.isArray(savedPosts) && savedPosts.includes(post._id);

  const saveMutation = useMutation({
    mutationFn: () =>
      request({ method: "patch", url: "/users/save", data: { postId: post._id } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["savedPosts"] });
      toast.success(res.data?.message ?? "Saved");
    },
    // These three handlers all called toast.success on failure, so errors were
    // reported to the reader as successes.
    onError: (err) => toast.error(errorMessage(err, "Could not save post")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => request({ method: "delete", url: `/posts/${post._id}` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post deleted");
      navigate("/");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not delete post")),
  });

  const featureMutation = useMutation({
    mutationFn: () =>
      request({ method: "patch", url: "/posts/feature", data: { postId: post._id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post", post.slug] });
      queryClient.invalidateQueries({ queryKey: ["featuredPosts"] });
    },
    onError: (err) => toast.error(errorMessage(err, "Could not feature post")),
  });

  const handleSave = () => {
    if (!isSignedIn) return navigate("/login");
    saveMutation.mutate();
  };

  const handleDelete = () => {
    // Deleting a post is irreversible and was a single unguarded click.
    if (window.confirm("Delete this post? This cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  const canDelete =
    Boolean(user?.username) && (post.user?.username === user.username || isAdmin);

  return (
    <div>
      <h2 className="mt-8 mb-4 text-sm font-medium">Actions</h2>

      {isSignedIn && isPending ? (
        <span className="text-sm text-secondary-text-color">Loading...</span>
      ) : error ? (
        <span className="text-sm text-red-700">Could not load saved posts</span>
      ) : (
        <button
          type="button"
          className="flex items-center gap-2 py-2 text-sm cursor-pointer disabled:opacity-60"
          disabled={saveMutation.isPending}
          onClick={handleSave}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
            <path
              d="M12 4C10.3 4 9 5.3 9 7v34l15-9 15 9V7c0-1.7-1.3-3-3-3H12z"
              stroke="black"
              strokeWidth="2"
              // The old expression could evaluate to the string "loading",
              // which is not a valid fill and rendered as black.
              fill={isSaved ? "black" : "none"}
            />
          </svg>
          <span className="text-primary-text-color">{isSaved ? "Unsave post" : "Save post"}</span>
          {saveMutation.isPending && <span className="text-xs">(in progress)</span>}
        </button>
      )}

      {isAdmin && (
        <button
          type="button"
          className="flex items-center gap-2 py-2 text-sm cursor-pointer disabled:opacity-60"
          disabled={featureMutation.isPending}
          onClick={() => featureMutation.mutate()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
            <path
              d="M24 2L29.39 16.26L44 18.18L33 29.24L35.82 44L24 37L12.18 44L15 29.24L4 18.18L18.61 16.26L24 2Z"
              stroke="black"
              strokeWidth="2"
              fill={post.isFeatured ? "black" : "none"}
            />
          </svg>
          <span className="text-primary-text-color">
            {post.isFeatured ? "Unfeature post" : "Feature post"}
          </span>
          {featureMutation.isPending && (
            <span className="text-xs text-secondary-text-color">(in progress)</span>
          )}
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          className="flex items-center gap-2 py-2 text-sm cursor-pointer disabled:opacity-60"
          disabled={deleteMutation.isPending}
          onClick={handleDelete}
        >
          {/* xmlns was "htp://..." on both of these icons. */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="red"
            strokeWidth="2"
            strokeLinecap="round"
            width="20"
            height="20"
          >
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6M10 11v6M14 11v6" />
          </svg>
          <span className="text-primary-text-color">Delete post</span>
          {deleteMutation.isPending && <span className="text-xs">(in progress)</span>}
        </button>
      )}
    </div>
  );
};

export default PostMenuActions;
