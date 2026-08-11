import { createDecipheriv, createHash, createHmac } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { encryptCookies, validPull } from "../protocol.js";

const AUTH_CONTEXT = "nixie-link pull authentication v1\0";
const ENCRYPTION_CONTEXT = "nixie-link cookie encryption v1\0";
const INSTALL_ID = "12345678-1234-4123-8123-1234567890ab";
const secretBytes = Buffer.alloc(32, 7);
const secret = secretBytes.toString("base64url");

function derivedKey(context) {
  return createHash("sha256").update(context).update(secretBytes).digest();
}

test("authenticates a desktop pull and encrypts cookies for that request", async () => {
  const message = { type: "pull", id: 42, nonce: Buffer.alloc(16, 3).toString("base64url") };
  message.proof = createHmac("sha256", derivedKey(AUTH_CONTEXT))
    .update(`pull\0${message.id}\0${message.nonce}\0${INSTALL_ID}`)
    .digest("base64url");
  assert.equal(await validPull(message, secret, INSTALL_ID), true);
  assert.equal(await validPull({ ...message, id: 43 }, secret, INSTALL_ID), false);

  const cookies = [{ name: "SAPISID", value: "secret" }];
  const encrypted = await encryptCookies(cookies, message, secret, INSTALL_ID);
  const iv = Buffer.from(encrypted.iv, "base64url");
  const payload = Buffer.from(encrypted.ciphertext, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", derivedKey(ENCRYPTION_CONTEXT), iv);
  decipher.setAAD(Buffer.from(`cookies\0${message.id}\0${message.nonce}\0${INSTALL_ID}`));
  decipher.setAuthTag(payload.subarray(-16));
  const plain = Buffer.concat([decipher.update(payload.subarray(0, -16)), decipher.final()]);
  assert.deepEqual(JSON.parse(plain.toString("utf8")), cookies);
});
