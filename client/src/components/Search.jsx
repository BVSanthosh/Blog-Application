import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

const Search = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const submit = (raw) => {
    const query = raw.trim();
    const next = Object.fromEntries(searchParams);

    // An empty box now clears the filter instead of searching for "".
    if (query) {
      next.search = query;
    } else {
      delete next.search;
    }

    if (location.pathname === "/posts") {
      setSearchParams(next);
    } else {
      // Was building the URL by hand, so a search for "c++" or "a&b" produced
      // a broken query string.
      navigate(`/posts?${new URLSearchParams(next)}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit(e.target.value);
    }
  };

  return (
    <div className="bg-gray-100 p-2 rounded-full flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="gray"
        strokeWidth="2"
      >
        <circle cx="10.5" cy="10.5" r="7.5" />
        <line x1="16.5" y1="16.5" x2="22" y2="22" />
      </svg>
      <input
        type="search"
        aria-label="Search posts"
        placeholder="search a post"
        className="bg-transparent outline-none w-full min-w-0"
        // Keyed so the box reflects the active search after navigation.
        key={searchParams.get("search") ?? ""}
        defaultValue={searchParams.get("search") ?? ""}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};

export default Search;
