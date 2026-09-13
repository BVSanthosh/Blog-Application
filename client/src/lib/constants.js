/**
 * The category list lived in five places (nav, side menu, write form, post
 * page, list page heading), which is how "cloud-services" ended up with the
 * typo'd description "allow applications to scale" in only one of them.
 * The values must stay in sync with CATEGORIES in server/src/lib/validate.js.
 */
export const CATEGORIES = [
  { value: "", label: "All Posts" },
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "database", label: "Database" },
  { value: "cloud-services", label: "Cloud Services" },
  { value: "development-tools", label: "Development Tools" },
];

/** Categories a post can be filed under ("All Posts" is a filter, not a value). */
export const POST_CATEGORIES = [
  { value: "general", label: "General" },
  ...CATEGORIES.filter((category) => category.value),
];

export const CATEGORY_DETAILS = {
  "": { title: "Explore", description: "Choose from a wide range of topics to explore" },
  frontend: { title: "Frontend", description: "Explore the world of frontend technologies" },
  backend: { title: "Backend", description: "Explore the world of backend technologies" },
  database: { title: "Database", description: "Explore how data is managed in databases" },
  "cloud-services": {
    title: "Cloud Services",
    description: "Explore how cloud services allow applications to scale",
  },
  "development-tools": {
    title: "Development Tools",
    description: "Explore the latest and greatest development tools",
  },
  general: { title: "General", description: "Everything else worth reading" },
};

export const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Popular" },
  { value: "trending", label: "Trending" },
  { value: "oldest", label: "Oldest" },
];
