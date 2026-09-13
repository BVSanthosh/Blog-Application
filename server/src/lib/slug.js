/**
 * Build a URL-safe slug. Post URLs are top-level (/:slug), so anything that is
 * not a letter, digit or hyphen has to go — the previous implementation only
 * replaced spaces, which let punctuation and slashes into the path.
 */
export function slugify(title) {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    // Strip the combining marks NFKD split off, so "é" becomes "e" not "-".
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");

  return slug || "post";
}

/**
 * Find a slug not already taken, appending -2, -3, ... to the *base* slug.
 * (Appending to the previous candidate produced "title-2-3-4" chains.)
 */
export async function uniqueSlug(posts, title) {
  const base = slugify(title);
  let candidate = base;

  for (let counter = 2; ; counter++) {
    const taken = await posts.findOne({ slug: candidate }, { projection: { _id: 1 } });
    if (!taken) return candidate;
    candidate = `${base}-${counter}`;
  }
}
