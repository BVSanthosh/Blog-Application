import axios from "axios";
import { useAuth, useUser } from "@clerk/clerk-react";
import Image from "./Image";
import { format } from "timeago.js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

const Comment = ({ comment, postId }) => {
    const {user} = useUser();
    const {getToken} = useAuth();

    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async () => {
            const token = await getToken();
            
            return axios.delete(`${import.meta.env.VITE_API_URL}/comments/${comment._id}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey:["comments", postId]});
            toast.success("Comment deleted successfully");
        },
        onError: (err) => {
            toast.error(err.response.data);
        }
    });

    const role = user?.publicMetadata?.role;

    return (
        <div className="p-4 bg-slate-50 rounded-xl mb-2"> 
            <div className="flex items-center gap-4">
                {comment.user.img && <Image 
                    src={comment.user.img}
                    className="w-10 h-10 rounded-full object-cover"
                    w="40"
                />}
                <span className="font-medium">{comment.user.username}</span>
                <span className="text-sm text-gray-500">{format(comment.createdAt)}</span>
                {user && (comment.user.username == user.username || role === "admin") && (
                    <span 
                        className="text-xs text-red-300 hover: text-red-500 cursor-pointer"
                        onClick={() => mutation.mutate()}
                    >
                        delete
                        {mutation.isLoading && <span>(in progress)</span>}
                    </span>
                )}
            </div>
            <div className="mt-4">
                <p>{comment.desc}</p>
            </div>
        </div>
    )
}

export default Comment;