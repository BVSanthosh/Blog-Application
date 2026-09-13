import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useCallback } from "react";

/**
 * The SPA and the API are served by the same Worker, so the default base is a
 * relative path and no CORS configuration is involved. VITE_API_URL is only
 * needed if the API is ever split onto its own origin.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

/**
 * Pull a displayable message out of an axios error. The API answers with
 * `{ message }`; network failures have no response at all, and reading
 * `err.response.data` on those threw inside the error handler itself.
 */
export function errorMessage(error, fallback = "Something went wrong") {
  const data = error?.response?.data;
  if (typeof data === "string" && data) return data;
  return data?.message || error?.message || fallback;
}

/**
 * Returns a request function that attaches the current Clerk session token.
 * Replaces the getToken/headers block that was repeated in every mutation.
 */
export function useAuthedRequest() {
  const { getToken } = useAuth();

  return useCallback(
    async (config) => {
      const token = await getToken();
      return api({
        ...config,
        headers: { ...config.headers, Authorization: `Bearer ${token}` },
      });
    },
    [getToken],
  );
}
