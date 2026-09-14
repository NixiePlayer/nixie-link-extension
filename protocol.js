const AUTH_CONTEXT = "nixie-link pull authentication v1\0";
const ENCRYPTION_CONTEXT = "nixie-link cookie encryption v1\0";
const encoder = new TextEncoder();

export function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function fromBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return;
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  } catch {
    return;
  }
}

function joined(context, secret) {
  const prefix = encoder.encode(context);
  const bytes = new Uint8Array(prefix.length + secret.length);
  bytes.set(prefix);
  bytes.set(secret, prefix.length);
  return bytes;
}

async function derivedKey(context, secret) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", joined(context, secret)));
}

export async function validPull(message, secret, id) {
  if (
    !Number.isSafeInteger(message.id) ||
    message.id < 1 ||
    typeof message.nonce !== "string" ||
    fromBase64Url(message.nonce)?.length !== 16 ||
    typeof message.proof !== "string" ||
    fromBase64Url(message.proof)?.length !== 32
  ) {
    return false;
  }
  const rawSecret = fromBase64Url(secret);
  const signature = fromBase64Url(message.proof);
  if (!rawSecret || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    await derivedKey(AUTH_CONTEXT, rawSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(`pull\0${message.id}\0${message.nonce}\0${id}`),
  );
}

export async function encryptCookies(cookies, message, secret, id) {
  const rawSecret = fromBase64Url(secret);
  if (!rawSecret) throw new Error("Invalid pairing secret");
  const key = await crypto.subtle.importKey(
    "raw",
    await derivedKey(ENCRYPTION_CONTEXT, rawSecret),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: encoder.encode(`cookies\0${message.id}\0${message.nonce}\0${id}`),
    },
    key,
    encoder.encode(JSON.stringify(cookies)),
  );
  return { iv: toBase64Url(iv), ciphertext: toBase64Url(new Uint8Array(ciphertext)) };
}
