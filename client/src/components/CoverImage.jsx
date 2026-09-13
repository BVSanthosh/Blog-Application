import Image from "./Image";

/**
 * A post's cover image, with a drawn fallback for posts that have none.
 * The previous fallback pointed at "/empty.jpg", which is not in /public, so
 * every image-less post rendered a broken image.
 */
const CoverImage = ({ src, className = "", w, h, alt = "" }) => {
  if (src) {
    return <Image src={src} className={className} w={w} h={h} alt={alt} />;
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-gradient-to-br from-primary-color to-dark-primary-color`}
      style={{ aspectRatio: w && h ? `${w} / ${h}` : "3 / 2" }}
      role="img"
      aria-label={alt || "No cover image"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="40"
        height="40"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-4.5-4.5L3 21" />
      </svg>
    </div>
  );
};

export default CoverImage;
