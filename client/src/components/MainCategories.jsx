import { Link, useSearchParams } from "react-router-dom";
import Search from "./Search";
import { CATEGORIES } from "../lib/constants";

const MainCategories = () => {
  const [searchParams] = useSearchParams();
  const active = searchParams.get("cat") ?? "";

  return (
    <div className="bg-white rounded-3xl md:flex xl:rounded-full shadow-lg items-center p-4 gap-8">
      <div className="flex-1 flex items-center justify-center flex-wrap gap-1">
        {CATEGORIES.map(({ value, label }) => (
          <Link
            key={value || "all"}
            to={value ? `/posts?cat=${value}` : "/posts"}
            className={`rounded-full px-4 py-2 whitespace-nowrap ${
              active === value ? "bg-blue-800 text-white" : "hover:bg-blue-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <span className="hidden md:inline text-xl font-medium text-divider-color">|</span>
      <div className="mt-4 md:mt-0">
        <Search />
      </div>
    </div>
  );
};

export default MainCategories;
