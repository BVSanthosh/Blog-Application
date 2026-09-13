/**
 * Svix webhook signature verification (used by Clerk).
 *
 * Implemented directly against WebCrypto rather than via the `svix` package,
 * which expects a Node runtime. The scheme is documented at
 * https://docs.svix.com/receiving/verifying-payloads/how-manual
 */

const encoder = new TextEncoder();

/** Reject replays of payloads older/newer than this. */
const TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(base64) {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Length-independent comparison, so a mismatch leaks no timing information. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class WebhookVerificationError extends Error {}

/**
 * @param {string} secret  The `whsec_...` signing secret.
 * @param {string} payload The raw request body, exactly as received.
 * @param {Headers} headers
 * @returns {Promise<object>} The parsed payload, once verified.
 */
export async function verifyWebhook(secret, payload, headers) {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");

  if (!id || !timestamp || !signatureHeader) {
    throw new WebhookVerificationError("Missing svix signature headers");
  }

  const sentAt = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(sentAt)) {
    throw new WebhookVerificationError("Invalid svix-timestamp");
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - sentAt) > TOLERANCE_SECONDS) {
    throw new WebhookVerificationError("Webhook timestamp outside tolerance");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secret.replace(/^whsec_/, "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = bytesToBase64(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${id}.${timestamp}.${payload}`)),
  );

  // The header holds a space-separated list of `version,signature` pairs so
  // that secrets can be rotated without downtime.
  const matched = signatureHeader
    .split(" ")
    .filter((part) => part.startsWith("v1,"))
    .some((part) => timingSafeEqual(part.slice(3), expected));

  if (!matched) throw new WebhookVerificationError("Signature mismatch");

  try {
    return JSON.parse(payload);
  } catch {
    throw new WebhookVerificationError("Payload is not valid JSON");
  }
}
