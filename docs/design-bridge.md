# Nixie Link bridge design

Status: implemented. Last updated 2026-08-11.

## Purpose

Current Chromium browsers on Windows can protect cookies with App-Bound Encryption. Nixie does not
bypass that protection. Nixie Link asks the browser for the user's current YouTube cookies through the
extension cookies API, then transfers only the required cookie names to the local Nixie app.

## Components

1. The Manifest V3 worker reads `*://*.youtube.com/` cookies and filters a fixed allowlist. Both
   schemes are required because Chromium checks a cookie without the Secure flag against its http
   origin. The worker has no content script and makes no request to YouTube.
2. Chromium starts `com.theedoran.nixie` as a native messaging host for the fixed extension ID.
3. The small native host validates its launch origin and a per-run pipe token, then relays JSON to the
   running Nixie process.
4. Nixie's pipe server validates message size, connection count, origin, token, install ID, response
   socket, cookie names, cookie values, domains, paths, and flags.

The public manifest key keeps the unpacked extension ID stable. It is not a code signature or an
application trust anchor.

## Pairing and protected transfer

The extension creates a random 256-bit pairing code in extension-local storage. The user copies it
from the popup and pastes it into Nixie once. Nixie protects its stored copy with Electron
`safeStorage`. Linux pairing is refused when Electron reports the `basic_text` storage backend.

For each pull:

1. Nixie creates a fresh 128-bit nonce.
2. Nixie sends the request with an HMAC-SHA-256 proof over the request ID, nonce, and extension install
   ID. The HMAC key is derived from the pairing code.
3. The extension verifies the proof before reading cookies.
4. The extension reads and filters the current cookies.
5. The extension encrypts the JSON payload with AES-256-GCM. The authenticated data binds the response
   to the request ID, nonce, and extension install ID.
6. Nixie accepts the response only from the socket that received the request, verifies the GCM tag,
   parses the JSON, and validates the full cookie array.

The relay sees only an authenticated request and encrypted response. A native host replacement that
does not know the pairing code cannot request readable cookies. Replaying an old request can produce
only a new ciphertext that the replacement cannot decrypt.

## Session lifecycle

The extension never sends cookies in its hello. It sends only profile identity, browser brand, and a
signed-in Boolean. Cookie changes update that Boolean. Nixie pulls at most once a minute when it needs
a cookie header.

An empty authenticated payload means browser sign-out and is valid. Nixie replaces its auth cookies
exactly, so cookies absent from the new set are removed. A failed extension pull also clears the copied
extension session. This prevents a removed, reset, or replaced extension from leaving stale auth active.

## Deployment

Releases are source zips attached to GitHub releases. Each file is named explicitly and the workflow
checks the archive list. There is no Chrome Web Store, Edge Add-ons, or other marketplace deployment.
The stable extension ID is `pgknibkmcmahfafgbkndpkkcpciigleb`.

## Threat boundary

The protocol protects against accidental host mismatch, another extension ID, a simple native-host
registration replacement, message replay disclosure, malformed messages, and stale browser sign-out.

It does not protect against malware already running as the same operating-system user with access to
the browser profile, Nixie's process, or operating-system credential APIs. A marketplace signature and
application signing would improve code identity, but the project intentionally uses an unpacked
extension and Windows signing is deferred.
