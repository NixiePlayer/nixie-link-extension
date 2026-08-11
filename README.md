<p align="center">
  <a href="https://github.com/NixiePlayer/nixie-link-extension/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/NixiePlayer/nixie-link-extension?style=flat-square&color=ff0033&label=release"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-blue?style=flat-square"></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-lightgrey?style=flat-square">
</p>

# Nixie Link

Nixie Link connects the YouTube session in one Chromium browser profile to the
[Nixie](https://github.com/NixiePlayer/NixieDesktop) desktop app on the same computer.
It exists mainly for Windows, where current Chromium browsers use App-Bound Encryption and a normal
desktop app cannot read their cookie database.

> [!IMPORTANT]
> Nixie is independent and unofficial. It is not affiliated with, endorsed by, or sponsored by
> Google or YouTube. YouTube and YouTube Music are trademarks of Google LLC.

## Install

This extension is not published to the Chrome Web Store, Edge Add-ons, or another browser
marketplace. The only release channel is this repository.

1. Install and start the Nixie desktop app.
2. Download `nixie-link-<version>.zip` from the
   [latest GitHub release](https://github.com/NixiePlayer/nixie-link-extension/releases/latest).
3. Unzip it to a folder that you will keep.
4. Open `chrome://extensions`, `edge://extensions`, `brave://extensions`, or the equivalent page.
5. Turn on **Developer mode** and select **Load unpacked**.
6. Select the folder that contains `manifest.json`.
7. Confirm that the extension ID is `pgknibkmcmahfafgbkndpkkcpciigleb`.
8. Open the Nixie Link popup and copy its pairing code.
9. Paste the code into the connected browser row on Nixie's sign-in screen.

The public key in `manifest.json` gives unpacked installs a stable ID. It is not proof that the code
is genuine because another unpacked extension can copy that public key. The private pairing code is
the application-level trust check. Download releases only from this repository and inspect the
source when the session matters to you.

Chrome can show a warning for developer-mode extensions at startup. Some managed computers block
unpacked extensions. This project does not offer a marketplace installation as a fallback.

## Permissions and data flow

- `cookies` and `https://*.youtube.com/` let the worker read YouTube cookies only.
- A fixed allowlist removes all cookie names that Nixie does not need.
- `nativeMessaging` connects to the local host named `com.theedoran.nixie`.
- `storage` keeps a random profile ID and a random 256-bit pairing code in this browser profile.
- `alarms` reconnects the worker when the desktop app starts later.
- There are no content scripts, network requests, analytics, or telemetry.

The extension sends a hello with only its random ID, browser name, and signed-in state. It never
pushes cookies. Nixie requests cookies when it needs a fresh session. Each request has a fresh nonce
and an HMAC made with the pairing code. The extension ignores a request that does not authenticate.
It encrypts each accepted cookie payload with AES-256-GCM before native messaging carries it. The
native relay and a replacement host that does not know the pairing code cannot read the payload.

Nixie protects its stored copy of the pairing code with Electron `safeStorage`. On Linux, pairing is
refused when only the insecure `basic_text` backend is available. The normal local-user security
boundary still applies: malware running as the same operating-system user can read or control browser
profile data. An unpacked extension and an unsigned Windows app cannot provide a stronger identity
boundary against that malware.

Signing out of YouTube produces an authenticated empty cookie set. Nixie then clears its copied
session. Resetting the pairing code or removing the extension makes the next refresh fail, and Nixie
clears its copied extension session instead of retaining stale cookies.

See [PRIVACY.md](PRIVACY.md) and [docs/design-bridge.md](docs/design-bridge.md).

## Development

There is no build step and no third-party dependency.

```sh
node --check background.js
node --check popup.js
node --check protocol.js
node --test scripts/protocol.test.mjs
node scripts/verify.mjs
```

CI runs the same checks. The manifest check pins the ID, exact permission set, host permission,
module worker, private runtime surface, description limit, and optional tag version.

| Path | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 permissions, stable public key, and entry points |
| `background.js` | Cookie allowlist, native connection, status, and pull handling |
| `protocol.js` | Pairing proof and cookie encryption |
| `popup.html`, `popup.js` | Connection state and pairing-code controls |
| `scripts/verify.mjs` | Release and manifest policy check |
| `scripts/protocol.test.mjs` | Desktop-to-extension protocol compatibility check |

## Release

Set `manifest.json` to the release version, commit it, and push a matching tag:

```sh
git tag v0.1.0
git push --follow-tags
```

The workflow verifies the code and tag, creates an allowlisted zip, checks its exact contents, and
publishes it as a GitHub release. It does not submit or deploy the extension to a browser marketplace.

## Licence

MIT, in [LICENSE](LICENSE).
