import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "react-toastify";
import Upload from "../components/Upload";
import Image from "../components/Image";
import { errorMessage, useAuthedRequest } from "../lib/api";
import { POST_CATEGORIES } from "../lib/constants";

const WritePage = () => {
  const [cover, setCover] = useState(null);
  const [img, setImg] = useState(null);
  const [video, setVideo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [content, setContent] = useState("");

  const { isLoaded, isSignedIn } = useUser();
  const request = useAuthedRequest();
  const navigate = useNavigate();

  useEffect(() => {
    if (img) setContent((prev) => `${prev}<p><img src="${img.url}" /></p>`);
  }, [img]);

  useEffect(() => {
    // `className` is not an HTML attribute — this string goes into the editor
    // as markup, not JSX, so the class was silently dropped. The iframe also
    // needs an explicit close tag to nest correctly.
    if (video) {
      setContent((prev) => `${prev}<p><iframe class="ql-video" src="${video.url}"></iframe></p>`);
    }
  }, [video]);

  const mutation = useMutation({
    mutationFn: (newPost) => request({ method: "post", url: "/posts", data: newPost }),
    onSuccess: (res) => {
      toast.success("Post has been created");
      navigate(`/${res.data.slug}`);
    },
    onError: (err) => toast.error(errorMessage(err, "Could not create post")),
  });

  if (!isLoaded) return <div className="mt-8">Loading...</div>;
  if (!isSignedIn) return <div className="mt-8">You should sign in to write a post.</div>;

  const isUploading = progress > 0 && progress < 100;

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const title = formData.get("title")?.trim();

    // Both were required by the API but unchecked here, so an empty post was
    // submitted and came back as an unexplained 400.
    if (!title) return toast.error("A title is required");
    if (!content.trim() || content === "<p><br></p>") {
      return toast.error("The post needs some content");
    }

    mutation.mutate({
      img: cover?.filePath || "",
      title,
      category: formData.get("category"),
      desc: formData.get("desc"),
      content,
    });
  };

  return (
    <div className="mt-8 flex flex-col gap-6">
      <h1 className="text-xl font-medium text-primary-text-color">Create a New Post</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1 mb-6">
        <div className="flex items-center gap-4">
          <Upload type="image" setProgress={setProgress} setData={setCover}>
            <span className="inline-block w-max p-2 shadow-md rounded-xl text-sm text-primary-text-color bg-white">
              {cover ? "Change cover image" : "Add a cover image"}
            </span>
          </Upload>
          {/* There was no confirmation that the cover had uploaded. */}
          {cover && (
            <Image src={cover.filePath} className="h-12 rounded-md" w="80" h="48" alt="Cover" />
          )}
        </div>

        <input
          className="text-2xl md:text-4xl font-semibold bg-transparent outline-none text-primary-text-color"
          type="text"
          placeholder="My Awesome Story"
          name="title"
          maxLength={200}
          required
        />

        <div className="flex items-center gap-4">
          <label className="text-sm text-primary-text-color" htmlFor="category">
            Choose a category:
          </label>
          <select className="p-2 rounded-xl bg-white shadow-md" name="category" id="category">
            {/* The General option had value="" and relied on the server
                defaulting it. It is an explicit value now. */}
            {POST_CATEGORIES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <textarea
          className="p-4 rounded-xl bg-white shadow-md"
          name="desc"
          maxLength={1000}
          placeholder="A Short Description"
        />

        <div className="flex flex-1 gap-2">
          <div className="flex flex-col gap-2 text-sm">
            <Upload type="image" setProgress={setProgress} setData={setImg}>
              <span className="inline-block p-2 bg-white rounded-xl shadow-md">Add Image</span>
            </Upload>
            <Upload type="video" setProgress={setProgress} setData={setVideo}>
              <span className="inline-block p-2 bg-white rounded-xl shadow-md">Add Video</span>
            </Upload>
          </div>
          <ReactQuill
            theme="snow"
            className="flex-1 rounded-xl bg-white shadow-md min-h-64"
            value={content}
            onChange={setContent}
            readOnly={isUploading}
          />
        </div>

        <button
          type="submit"
          // `mutation.isLoading` is undefined in react-query v5, so the button
          // was never actually disabled and could be double-submitted.
          disabled={mutation.isPending || isUploading}
          className="bg-blue-800 text-white font-medium rounded-xl mt-4 p-2 w-36 disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {isUploading ? `Uploading ${progress}%` : mutation.isPending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
};

export default WritePage;
