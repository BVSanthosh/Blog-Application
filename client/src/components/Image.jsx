import { IKImage } from "imagekitio-react";

const urlEndpoint = import.meta.env.VITE_IK_URL_ENDPOINT;

/**
 * An ImageKit-hosted image, addressed by the `filePath` stored on the post or
 * user. Bundled assets in /public are plain <img> tags instead — routing those
 * through ImageKit produced URLs that do not exist.
 */
const Image = ({ src, className, alt = "", w, h }) => {
  if (!src) return null;

  // Without an endpoint configured, degrade to a plain <img> rather than
  // rendering a broken ImageKit URL.
  if (!urlEndpoint) {
    return <img src={src} className={className} alt={alt} width={w} height={h} loading="lazy" />;
  }

  return (
    <IKImage
      urlEndpoint={urlEndpoint}
      path={src}
      className={className}
      loading="lazy"
      lqip={{ active: true, quality: 20 }}
      alt={alt}
      width={w}
      height={h}
      transformation={[{ width: w, height: h }]}
    />
  );
};

export default Image;
