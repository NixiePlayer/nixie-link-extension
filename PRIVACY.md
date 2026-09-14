# Privacy

Nixie Link reads selected YouTube session cookies from the browser profile where it is installed. It
sends them only to the Nixie desktop app on the same computer after that app proves it knows the
profile's pairing code.

## Data it reads

The extension has host access only to `*://*.youtube.com/`, which is `youtube.com` and its subdomains
over http and https. Both schemes are required because Chromium checks a cookie without the Secure
flag against its http origin, and some YouTube session cookies have no Secure flag. The extension
makes no http request of its own. Before data leaves the worker, a fixed
allowlist removes each cookie name that Nixie does not need. The extension does not read another site.
It has no content script and makes no request to YouTube. The `cookies` permission is used only to
read.

## Data transfer

The extension makes no network request. It uses Chromium native messaging to reach the local host
`com.theedoran.nixie`. It sends profile status without cookies. It sends cookies only after an
authenticated pull from Nixie, and encrypts each payload with AES-256-GCM before it enters the native
messaging channel.

It collects no analytics or telemetry. It keeps no cookie history or cookie copy. Each accepted pull
reads the browser's current cookie store.

## Data it stores

The browser's extension-local storage contains:

- a random profile identifier
- a random 256-bit pairing code

Neither value names a person or a YouTube account. The pairing code is a secret. Do not share it with
another application. Resetting it in the popup revokes the current desktop pairing on the next pull.

Nixie stores its paired copy through the operating system facility exposed by Electron `safeStorage`.
See [Nixie's privacy notice](https://github.com/NixiePlayer/NixieDesktop/blob/main/PRIVACY.md) for the
desktop side.

## Retention and removal

Removing the extension removes its local extension data. Signing out of YouTube sends an empty session
on the next authenticated pull. Nixie clears its copied extension session when a pull reports sign-out
or fails. Signing out inside Nixie also removes its linked-account record and auth partition.

## Security limit

The pairing protocol blocks a replacement native host that does not know the pairing code. It does not
claim to resist malware that already runs as the same operating-system user and can read or alter the
browser profile. This extension is loaded unpacked and the Windows desktop app is currently unsigned.

## Questions

Open an issue at
[NixiePlayer/nixie-link-extension](https://github.com/NixiePlayer/nixie-link-extension/issues).
