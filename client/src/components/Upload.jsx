import { useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { IKContext, IKUpload } from "imagekitio-react";
import { errorMessage, useAuthedRequest } from "../lib/api";

const Upload = ({ children, type, setProgress, setData }) => {
  const ref = useRef(null);
  const request = useAuthedRequest();

  /**
   * These credentials authorise uploads into our ImageKit account, so the
   * endpoint now requires a session — the request has to carry the Clerk
   * token, which the previous bare fetch() did not.
   */
  const authenticator = useCallback(async () => {
    try {
      const { data } = await request({ method: "get", url: "/posts/upload-auth" });
      return { signature: data.signature, expire: data.expire, token: data.token };
    } catch (err) {
      throw new Error(errorMessage(err, "Could not authorise upload"));
    }
  }, [request]);

  const onError = (err) => {
    console.error("ImageKit upload failed", err);
    toast.error(`${type === "video" ? "Video" : "Image"} upload failed`);
    setProgress(0);
  };

  const onSuccess = (res) => {
    setData(res);
    // Left at 100, which kept the editor read-only and the submit button
    // disabled after a successful upload.
    setProgress(0);
  };

  const onUploadProgress = (progress) => {
    setProgress(Math.round((progress.loaded / progress.total) * 100));
  };

  return (
    <IKContext
      publicKey={import.meta.env.VITE_IK_PUBLIC_KEY}
      urlEndpoint={import.meta.env.VITE_IK_URL_ENDPOINT}
      authenticator={authenticator}
    >
      <IKUpload
        useUniqueFileName
        onError={onError}
        onSuccess={onSuccess}
        onUploadProgress={onUploadProgress}
        className="hidden"
        ref={ref}
        accept={`${type}/*`}
      />
      <button type="button" className="cursor-pointer text-left" onClick={() => ref.current?.click()}>
        {children}
      </button>
    </IKContext>
  );
};

export default Upload;
