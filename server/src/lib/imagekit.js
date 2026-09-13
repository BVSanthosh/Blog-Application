/**
 * ImageKit client-side upload credentials.
 *
 * The official `imagekit` Node SDK is not used here: all this endpoint needs is
 * an HMAC-SHA1, and WebCrypto does it without pulling a Node-only dependency
 * into the Worker bundle.
 */

const encoder = new TextEncoder();

/** ImageKit rejects tokens valid for more than an hour. */
const MAX_EXPIRY_SECONDS = 60 * 60;
const DEFAULT_EXPIRY_SECONDS = 60 * 30;

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getUploadAuthParams(privateKey, { expirySeconds = DEFAULT_EXPIRY_SECONDS } = {}) {
  if (!privateKey) throw new Error("IK_PRIVATE_KEY is not configured");

  const token = crypto.randomUUID();
  const expire =
    Math.floor(Date.now() / 1000) + Math.min(expirySeconds, MAX_EXPIRY_SECONDS);

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(privateKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(token + expire));

  return { token, expire, signature: toHex(signature) };
}
