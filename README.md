# Nixie Link

A Chromium browser extension that hands the YouTube session cookies of the
browser profile it is installed in to the [Nixie](https://github.com/NixiePlayer/NixieDesktop)
desktop app running on the same computer.

Nixie is an unofficial, independent music client. It is not affiliated with,
endorsed by, or connected to YouTube, YouTube Music or Google. "YouTube" is a
trademark of Google LLC, named here only to identify the service being connected
to.

## Why it exists

Nixie signs in by reading the YouTube cookies of a browser you are already
signed into. On Windows, Chrome 127 and later encrypt the cookie database with
app-bound encryption, which cannot be read from disk without impersonating the
browser process. Nixie refuses to do that.

An extension does not have to. It runs inside the browser, so `chrome.cookies`
is the browser's own supported interface and no circumvention is involved.

## What it can and cannot do

It reads the YouTube session cookies of this profile and passes them, over
Chrome native messaging, to the Nixie app on this computer. That is the whole of
it.

- It requests one host, `https://*.youtube.com/`, and no other.
- It filters to the session cookie names Nixie needs and drops everything else
  before anything leaves the worker.
- It speaks to exactly one native messaging host, `com.theedoran.nixie`, which
  is the local Nixie app. It makes no network requests of its own, contacts no
  server, and reads no page.
- It has no content script, so it cannot see or change anything on any page.

## Installing it unpacked

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`, and
   so on).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick this folder.
4. Check the ID reads `pgknibkmcmahfafgbkndpkkcpciigleb`. The app allows that ID
   and no other, so a different one will not connect.

The Nixie app must be running, and its native messaging host must be registered.
The app registers it on first run, so start Nixie once before loading the
extension.

## The private key

`nixie-extension.pem` is the private key the extension ID is derived from. It is
what pins the ID to `pgknibkmcmahfafgbkndpkkcpciigleb`, which is the only ID the
desktop app accepts. Keep it secret, keep it out of the repository (`.gitignore`
names it), and do not share it: anyone holding it can publish an extension the
app will trust.

`manifest.json` carries only the matching public key, in its `key` field, which
is what makes an unpacked load resolve to the same ID.

## When something goes wrong

The browser's own native messaging errors, in the extension's service worker
console, each name a different missing piece:

| Message | What it means |
| --- | --- |
| "Specified native messaging host not found" | The registry key (Windows) or the host manifest (macOS, Linux) is missing. Start Nixie once, which writes both, then reload the extension. |
| "Access to the specified native messaging host is forbidden" | This extension's id is not the one the host manifest allows. It was built or repacked with a different key. |
| "Native host has exited" | Nixie is not running, or the token check failed against a stale config. Quit Nixie, start it again, and reload the extension. |

The popup says which of the three states it is in, so start there. If it says
nothing at all, open it once: until it has run, it has not connected.

## Layout

- `manifest.json`: MV3 manifest, with the pinned public key.
- `background.js`: the service worker, which opens the native port, sends one
  hello on connect, and answers the app's pulls with fresh cookies.
- `popup.html`, `popup.js`: a three-line status readout and a retry button.
- `icons/`: the toolbar and extension icons.
- `scripts/verify.mjs`: asserts the manifest still derives the pinned id and
  still asks for nothing beyond the cookies of one host. CI runs it on every
  push, and the release runs it again against the tag.

There is no build step and no dependency. It is plain JavaScript, loaded as it
sits.

## Releasing

A release is a tag, exactly as in the desktop app:

1. Bump `version` in `manifest.json` and commit it.
2. `git tag v<version> && git push --follow-tags`.

`.github/workflows/release.yml` takes it from there: it refuses the tag if the
manifest states a different version, builds `nixie-link-<version>.zip` from an
explicit list of runtime files, and publishes the release with that zip
attached. The archive carries the manifest, the worker, the popup and the icons,
and nothing else: no notes, no workflows, and never the private key, which is
excluded by naming every file rather than sweeping the directory.

Publishing to the Chrome Web Store or Edge Add-ons is a separate step and is not
automated. Read the `key` caveat first: the store assigns an id of its own, so a
store build is not automatically the id the desktop app allows. Whichever id the
listing ends up with has to be the one the app pins, or store installs will
connect to nothing.

## Licence and privacy

MIT, in [LICENSE](LICENSE). What the extension reads and where it goes is in
[PRIVACY.md](PRIVACY.md), and the desktop side of the same path is documented in
[Nixie's docs/extension.md](https://github.com/NixiePlayer/NixieDesktop/blob/main/docs/extension.md).
The original design note for this bridge, written before any of it existed, is
kept in [docs/design-bridge.md](docs/design-bridge.md).
