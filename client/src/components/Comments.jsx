import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Comment from "./Comment";
import { api, errorMessage, useAuthedRequest } from "../lib/api";

const Comments = ({ postId }) => {
  const { user } = useUser();
  const request = useAuthedRequest();
  const queryClient = useQueryClient();
  const formRef = useRef(null);

  const { isPending, error, data } = useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => (await api.get(`/comments/${postId}`)).data,
  });

  const mutation = useMutation({
    mutationFn: (newComment) =>
      request({ method: "post", url: `/comments/${postId}`, data: newComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      // The textarea kept its text after a successful post, so the same
      // comment was easy to submit twice.
      formRef.current?.reset();
    },
    onError: (err) => toast.error(errorMessage(err, "Could not post comment")),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const desc = new FormData(e.target).get("desc")?.trim();
    if (!desc) return;
    mutation.mutate({ desc });
  };

  return (
    <div className="flex flex-col w-full md:w-3/4 gap-4">
      <h2 className="text-xl text-primary-text-color font-medium">Comments</h2>

      <SignedIn>
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex items-start justify-between gap-4 mb-4 w-full"
        >
          <textarea
            name="desc"
            placeholder="Write a comment..."
            required
            className="w-full p-4 rounded-xl"
          />
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-blue-800 hover:bg-blue-600 px-4 py-3 text-white font-medium rounded-xl disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Sending" : "Send"}
          </button>
        </form>
      </SignedIn>

      {/* Signed-out visitors used to see a comment box that failed with a 401
          only after they had written something. */}
      <SignedOut>
        <p className="text-secondary-text-color mb-4">
          <Link to="/login" className="text-blue-800 underline">
            Sign in
          </Link>{" "}
          to join the conversation.
        </p>
      </SignedOut>

      {isPending ? (
        <p className="text-secondary-text-color">Loading comments...</p>
      ) : error ? (
        <p className="text-red-700">{errorMessage(error, "Could not load comments")}</p>
      ) : (
        <>
          {mutation.isPending && (
            <Comment
              comment={{
                _id: "pending",
                desc: `${mutation.variables.desc} (Sending...)`,
                createdAt: new Date(),
                user: { img: user?.imageUrl, username: user?.username },
              }}
              postId={postId}
            />
          )}
          {data.length === 0 && !mutation.isPending && (
            <p className="text-secondary-text-color">No comments yet.</p>
          )}
          {data.map((comment) => (
            <Comment key={comment._id} comment={comment} postId={postId} />
          ))}
        </>
      )}
    </div>
  );
};

export default Comments;
