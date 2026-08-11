import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/*
 * The manifest's whole trust story in one check, run on every push and again before a release.
 *
 * Two things about this extension are load-bearing and both are easy to break by accident:
 *
 * 1. The extension id. The desktop app allows exactly one id in its native messaging manifest, so an
 *    extension that resolves to another one is refused by the browser before a single byte moves. The
 *    id is derived from the public `key` in the manifest, so editing or dropping that field silently
 *    breaks every install rather than failing loudly.
 * 2. The permission set. This extension asks for the cookies of one host and nothing else, which is
 *    what makes its capability describable in one sentence. A widened permission is a different
 *    extension wearing the same name, and a reviewer would be right to say so.
 *
 * Both are asserted here rather than trusted to review. Pass a version to also require the manifest to
 * state it, which is what keeps a tag and the zip it publishes from disagreeing.
 */

/** The id the desktop app pins. It appears in the app's `native-host-register.ts` and nowhere else. */
const EXPECTED_ID = "pgknibkmcmahfafgbkndpkkcpciigleb";
const EXPECTED_PERMISSIONS = ["alarms", "cookies", "nativeMessaging", "storage"];
const EXPECTED_HOSTS = ["https://*.youtube.com/"];

const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const failures = [];

/**
 * Chromium derives the id from the SHA-256 of the DER public key: the first 16 bytes, in hex, with
 * `0-9a-f` mapped onto `a-p`. It is the same value `chrome://extensions` shows for an unpacked load.
 */
function extensionId(key) {
	const digest = createHash("sha256").update(Buffer.from(key, "base64")).digest();
	return [...digest.subarray(0, 16)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("")
		.replace(/[0-9a-f]/g, (character) => "abcdefghijklmnop"[Number.parseInt(character, 16)]);
}

if (manifest.manifest_version !== 3) failures.push(`manifest_version is ${manifest.manifest_version}, expected 3`);

if (typeof manifest.key !== "string" || !manifest.key) {
	failures.push("manifest states no key, so an unpacked load would resolve to a different id on every machine");
} else {
	const id = extensionId(manifest.key);
	if (id !== EXPECTED_ID) failures.push(`key derives ${id}, but the app allows ${EXPECTED_ID}`);
}

const permissions = [...(manifest.permissions ?? [])].sort();
if (permissions.join(",") !== EXPECTED_PERMISSIONS.join(",")) {
	failures.push(`permissions are [${permissions}], expected [${EXPECTED_PERMISSIONS}]`);
}

const hosts = [...(manifest.host_permissions ?? [])].sort();
if (hosts.join(",") !== EXPECTED_HOSTS.join(",")) {
	failures.push(`host_permissions are [${hosts}], expected [${EXPECTED_HOSTS}]`);
}

// A content script would let this read and change the pages it runs on, which is the one capability the
// README promises it does not have.
if (manifest.content_scripts) failures.push("manifest declares content_scripts, which this extension must not have");
if (manifest.externally_connectable) {
  failures.push("manifest declares externally_connectable, which would expose private runtime messages");
}
if (manifest.web_accessible_resources) {
  failures.push("manifest declares web_accessible_resources, which this extension does not need");
}

if (typeof manifest.description !== "string" || manifest.description.length > 132) {
	failures.push(`description is ${manifest.description?.length ?? "missing"} characters, expected at most 132`);
}

if (manifest.background?.service_worker !== "background.js" || manifest.background?.type !== "module") {
	failures.push("background must use background.js as a module service worker");
}

const expectedVersion = process.argv[2];
if (expectedVersion && manifest.version !== expectedVersion) {
	failures.push(`manifest version is ${manifest.version}, but the tag says ${expectedVersion}`);
}

if (failures.length) {
	console.error("Manifest verification failed:");
	for (const failure of failures) console.error(`  - ${failure}`);
	process.exit(1);
}

console.log(`Manifest verified: ${manifest.name} ${manifest.version}, id ${EXPECTED_ID}.`);
