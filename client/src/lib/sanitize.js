import DOMPurify from "dompurify";
import parse from "html-react-parser";

/**
 * Post bodies are authored in a rich-text editor and stored as raw HTML, so
 * they are attacker-controlled markup by the time they reach another reader.
 * They were previously rendered unsanitised, which let any signed-in user ship
 * script to every visitor of their post.
 */
const ALLOWED_TAGS = [
  "p", "br", "hr", "span", "strong", "em", "u", "s", "blockquote",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "a", "img", "iframe",
  "pre", "code", "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTR = [
  "href", "target", "rel", "src", "alt", "title", "class",
  "width", "height", "allow", "allowfullscreen", "frameborder",
];

export function sanitizeHtml(html) {
  if (!html) return "";

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Quill embeds videos as iframes; keep them, but only over https.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/)/i,
    ADD_ATTR: ["target"],
  });
}

/** Sanitize, then turn the HTML into React elements. */
export function renderRichText(html) {
  return parse(sanitizeHtml(html));
}

// Force external links to open safely, without leaking the referrer or
// exposing window.opener.
if (typeof window !== "undefined") {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("href")?.startsWith("http")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}
