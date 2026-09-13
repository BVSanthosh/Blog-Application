import { useUser } from "@clerk/clerk-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "timeago.js";
import { toast } from "react-toastify";
import Image from "./Image";
import { errorMessage, useAuthedRequest } from "../lib/api";

const Comment = ({ comment, postId }) => {
  const { user } = useUser();
  const request = useAuthedRequest();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => request({ method: "delete", url: `/comments/${comment._id}` }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      toast.success("Comment deleted");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not delete comment")),
  });

  const isAdmin = user?.publicMetadata?.role === "admin";
  const isAuthor = Boolean(user?.username) && comment.user?.username === user.username;
  // The optimistic placeholder has no real id yet, so it must not offer delete.
  const canDelete = comment._id !== "pending" && (isAuthor || isAdmin);

  return (
    <div className="p-4 bg-slate-50 rounded-xl mb-2">
      <div className="flex items-center gap-4">
        {comment.user?.img && (
          <Image
            src={comment.user.img}
            className="w-10 h-10 rounded-full object-cover"
            w="40"
            h="40"
            alt={comment.user.username}
          />
        )}
        <span className="font-medium">{comment.user?.username ?? "Deleted user"}</span>
        <span className="text-sm text-gray-500">{format(comment.createdAt)}</span>
        {canDelete && (
          <button
            type="button"
            disabled={mutation.isPending}
            // Was `hover: text-red-500` — the space made both the hover variant
            // and the colour invalid, so the class did nothing.
            className="text-xs text-red-400 hover:text-red-600 cursor-pointer disabled:opacity-50"
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "deleting..." : "delete"}
          </button>
        )}
      </div>
      <div className="mt-4">
        <p className="whitespace-pre-wrap">{comment.desc}</p>
      </div>
    </div>
  );
};

export default Comment;
