import axios from "axios";
import Comment from "./Comment";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/clerk-react";
import { toast } from "react-toastify"; 

const fetchComments = async (postId) => {
    const res = await axios.get(`${import.meta.env.VITE_API_URL}/comments/${postId}`);
    return res.data;
}

const Comments = ({ postId }) => {
    const {user} = useUser();
    const {getToken} = useAuth();

    const {isLoading, error, data} = useQuery({
        queryKey: ["comments", postId],
        queryFn: () => fetchComments(postId),
    });

    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async (newComment) => {
            const token = await getToken();
            return axios.post(`${import.meta.env.VITE_API_URL}/comments/${postId}`, newComment, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey:["comments", postId]});
        },
        onError: (err) => {
            toast.error(err.response.data);
        }
    });

    if (isLoading) {
        return "Loading...";
    }

    if (error) {
        return "An error has occured" + error.message;
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);

        const data = {
            desc: formData.get("desc"),
        };

        mutation.mutate(data);
    }

    return (
        <div className="flex flex-col w-3/4 gap-4">
            <h1 className="text-xl text-primary-text-color font-medium">Comments</h1>
            <form 
                onSubmit={handleSubmit}
                className="flex items-center justify-between gap-8 mb-4 w-full"
            >
                <textarea
                    name="desc"
                    placeholder="Write a comment..."
                    className="w-full p-4 rounded-xl"
                />
                <button className="bg-blue-800 hover:bg-blue-600 px-4 py-3 text-white font-medium rounded-xl">
                    Send
                </button>
            </form>
            {isLoading ? (
                "Loading..."
            ) : error ? (
                "Error loading comments"
            ) : (
                <>
                    {mutation.isLoading && (
                        <Comment
                            comment={{
                                desc: `${mutation.variables.desc} (Sending...)`,
                                createdAt: new Date(),
                                user: {
                                    img: user.imageUrl,
                                    username: user.username,
                                },
                            }}
                        />
                    )}

                    {data.map(comment => (
                        <Comment key={comment._id} comment={comment} postId={postId}/>
                    ))}
                </>
            )}
        </div>
    )
}

export default Comments;