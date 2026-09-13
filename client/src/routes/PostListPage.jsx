import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import PostList from "../components/PostList";
import SideMenu from "../components/SideMenu";
import MainCategories from "../components/MainCategories";
import { CATEGORY_DETAILS } from "../lib/constants";

const PostListPage = () => {
  // Was useState() — the button read "Filter or Search" but `open` was
  // undefined rather than false.
  const [open, setOpen] = useState(false);
  const [searchParams] = useSearchParams();

  const { title, description } =
    CATEGORY_DETAILS[searchParams.get("cat") ?? ""] ?? CATEGORY_DETAILS[""];

  return (
    <div className="flex flex-col gap-2 mt-8">
      <div>
        <h1 className="text-gray-800 text-xl md:text-3xl lg:text-4xl font-bold">{title}</h1>
        <p className="text-secondary-text-color font-medium text-md md:text-xl mt-4 mb-4">
          {description}
        </p>
      </div>

      <MainCategories />

      <button
        type="button"
        className="bg-blue-800 text-white text-sm px-4 py-2 rounded-2xl my-4 w-max md:hidden"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "Close" : "Filter or Search"}
      </button>

      <div className="flex flex-col-reverse gap-8 mt-8 md:flex-row w-full">
        {/* w-3/4 and w-1/4 were unconditional, so on phones the list was
            squeezed into three quarters of an already narrow screen. */}
        <div className="w-full md:w-3/4">
          <PostList />
        </div>
        <div className={`${open ? "block" : "hidden"} md:block w-full md:w-1/4`}>
          <SideMenu />
        </div>
      </div>
    </div>
  );
};

export default PostListPage;
