import { useSearchParams } from "react-router-dom";
import Search from "./Search";
import { CATEGORIES, SORTS } from "../lib/constants";

const SideMenu = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeSort = searchParams.get("sort") ?? "newest";
  const activeCategory = searchParams.get("cat") ?? "";

  const update = (key, value) => {
    const next = Object.fromEntries(searchParams);
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    setSearchParams(next);
  };

  return (
    <aside className="rounded-2xl bg-white shadow-lg p-4 h-max sticky top-8">
      <h2 className="mb-4 text-sm font-medium text-primary-text-color">Search</h2>
      <Search />

      <h2 className="mt-8 mb-4 text-sm font-medium text-primary-text-color">Filters</h2>
      <div className="flex flex-col gap-2 text-sm">
        {SORTS.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="sort"
              value={value}
              // These were uncontrolled, so the selected radio reset every time
              // the component re-rendered and never reflected the active sort.
              checked={activeSort === value}
              onChange={() => update("sort", value)}
              className="appearance-none w-4 h-4 border-[1.5px] border-blue-800 cursor-pointer rounded-sm bg-white checked:bg-blue-800"
            />
            {label}
          </label>
        ))}
      </div>

      <h2 className="mt-8 mb-4 text-sm font-medium text-primary-text-color">Categories</h2>
      <div className="flex flex-col items-start gap-2 text-sm">
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value || "all"}
            type="button"
            onClick={() => update("cat", value)}
            // Were <Link>s with no `to`, which render an anchor with no href:
            // not focusable and invisible to keyboard users.
            className={`underline cursor-pointer hover:text-blue-600 ${
              activeCategory === value ? "text-blue-600 font-medium" : "text-blue-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </aside>
  );
};

export default SideMenu;
