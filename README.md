<p align="center">
  <a href="https://github.com/NixiePlayer/nixie-connector-extension/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/NixiePlayer/nixie-connector-extension?style=flat-square&color=ff0033&label=release"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-blue?style=flat-square"></a>
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-lightgrey?style=flat-square">
  <img alt="Browsers" src="https://img.shields.io/badge/Chrome%20%7C%20Edge%20%7C%20Brave%20%7C%20Vivaldi-lightgrey?style=flat-square">
</p>

Nixie Link hands the YouTube session of the browser profile it is installed in to the
[Nixie](https://github.com/NixiePlayer/NixieDesktop) desktop app running on the same
computer. That is the whole of it: it reads the cookies of one site, passes them to one
local program, and does nothing else.

It exists for Windows, where Chrome and usually Edge, Brave, Vivaldi and Chromium encrypt
their cookie store in a way nothing outside the browser can read. Everywhere else Nixie
reads the profile from disk and this extension is optional.

> [!IMPORTANT]
> **Nixie is an independent, unofficial project and is not affiliated with, endorsed by, or
> sponsored by Google or YouTube.** YouTube and YouTube Music are trademarks of Google LLC,
> named here only to say which service is being connected to.

> [!IMPORTANT]
> **This extension does nothing on its own.** It is one half of a pair: the Nixie desktop
> app has to be installed and running, and it is the app that registers the messaging host
> the browser launches. Install the app first.

## Install

It is not on the Chrome Web Store or Edge Add-ons, so it is loaded unpacked. Take the zip
from the [releases page](https://github.com/NixiePlayer/nixie-connector-extension/releases/latest),
or clone this repository and point the browser at the folder.

1. Unzip it somewhere you are happy to leave it. The browser reads the folder every time it
   starts, so deleting it uninstalls the extension.
2. Open `chrome://extensions`, or `edge://extensions`, `brave://extensions`, and so on.
3. Turn on **Developer mode**.
4. **Load unpacked**, and pick the folder holding `manifest.json`.
5. Check the id on the card reads `pgknibkmcmahfafgbkndpkkcpciigleb`.

That id is not cosmetic. The desktop app allows exactly one extension to speak to it, and a
build that resolves to any other id is refused by the browser before a byte moves. The id
comes from the public key in the manifest, so a copy that still carries it resolves the
same way on every machine.

Then start Nixie, sign in to YouTube Music in that browser if you have not, and open the
extension once from the toolbar. The profile appears on Nixie's sign-in screen on its own,
with no refresh. A profile that holds no YouTube session is listed too, dimmed, saying so,
rather than quietly not appearing.

Chrome shows a "disable developer mode extensions" prompt on every start while an unpacked
extension is loaded, and some managed machines block them outright. That is the cost of
loading unpacked, and it is the only install path this project offers today.

## What it can and cannot do

- It asks for the cookies of `https://*.youtube.com/`, one host and no other. The browser
  enforces that: the cookies of any other site are not readable by this extension at all.
- It filters to the session cookie names the app needs before anything leaves the worker,
  so the rest of that cookie store never travels.
- It speaks to exactly one native messaging host, `com.theedoran.nixie`, which is the local
  Nixie app. It makes no network request of its own, contacts no server, and has no
  analytics or telemetry.
- It has no content script, so it cannot read or change any page you visit.
- It keeps no copy of anything. The one value it stores is a random identifier, which is
  how the app tells two browser profiles apart.

[PRIVACY.md](PRIVACY.md) states the same thing in full.

## How the link works

Chrome native messaging is a pipe between an extension and a locally installed program. The
browser starts the program itself and hands it a channel on standard input and output. It
is not a network connection, there is no port and no server, and nothing reaches it from
outside the machine.

Both ends are pinned. The browser only starts the host for an extension the host's own
manifest names, so no other extension can offer cookies to Nixie. The extension names the
host and the operating system resolves it through that manifest, so it cannot be pointed at
another program. The app then only accepts a connection carrying a token it wrote into a
file readable by the current user.

Cookies travel one way, browser to app. The app asks for the current cookies when it needs
them, at most once a minute, because Google expires the session every few minutes and only
the browser holds the current value. Nothing is pushed and nothing is cached.

Signing out inside Nixie ends the link. Removing the extension ends it, and so does signing
out of YouTube in this browser.

## When something goes wrong

The popup says which of three states it is in, so start there. If it says nothing at all,
open it once: until it has run, it has not connected. Beyond that, the browser's own
messaging errors each name a different missing piece, and they appear in the extension's
service worker console:

| Message | What it means |
| --- | --- |
| Specified native messaging host not found | The registry key (Windows) or the host manifest (macOS, Linux) is missing. Start Nixie once, which writes both, then reload the extension. |
| Access to the specified native messaging host is forbidden | This build's id is not the one the host manifest allows. It was built or repacked with a different key. |
| Native host has exited | Nixie is not running, or the token check failed against a stale config. Quit Nixie, start it again, then reload the extension. |

One thing that looks like a fault and is not: on Windows a profile can be missing from
Nixie's own disk-read list while that browser is open, because a running Chromium holds its
cookie file locked. The extension has no such problem, which is part of why it exists.

## Development

There is no build step and no dependency. It is plain JavaScript, loaded as it sits.

| Path | What lives there |
| --- | --- |
| `manifest.json` | MV3 manifest, carrying the public key that pins the id |
| `background.js` | The service worker: opens the native port, sends one hello, answers the app's pulls with fresh cookies |
| `popup.html`, `popup.js` | A three-line status readout and a retry button |
| `icons/` | Toolbar and extension icons |
| `scripts/verify.mjs` | The manifest gate, described below |
| `docs/design-bridge.md` | The original design note for this bridge, written before any of it existed |

```sh
node scripts/verify.mjs
```

That is the whole gate, and CI runs it on every push and pull request. It asserts the two
things that are load-bearing here and break silently rather than loudly: that the manifest
key still derives `pgknibkmcmahfafgbkndpkkcpciigleb`, since an edited or missing key leaves
every install unable to connect with nothing on screen to say why, and that the permissions
are still the cookies of one host and nothing more, since an extension that asks for more
is a different extension wearing the same name.

### The private key

`nixie-extension.pem` is the private key the id is derived from, and it is what makes the
desktop app trust this extension and no other. It is gitignored and it must stay out of the
repository and out of any archive: anyone holding it can build an extension Nixie will
accept. Keep it wherever the project's other credentials live. `manifest.json` carries only
the matching public key.

### Releasing

A release is a tag, the same as in the desktop app:

```sh
# bump "version" in manifest.json, commit it, then
git tag v0.1.0 && git push --follow-tags
```

The workflow refuses a tag whose version the manifest does not state, builds
`nixie-link-<version>.zip`, and publishes the release with it attached. Every file in that
archive is named rather than swept from the directory, so the private key cannot reach a
published zip even if its ignore rule is ever lost, and `manifest.json` sits at the archive
root, where the browser expects it.

## Licence and legal

MIT, in [LICENSE](LICENSE). See also [PRIVACY.md](PRIVACY.md), and
[docs/extension.md](https://github.com/NixiePlayer/NixieDesktop/blob/main/docs/extension.md)
in the desktop repository for the same path described from the app's side.

This extension is part of an independent, unofficial project and is not affiliated with,
endorsed by, or sponsored by YouTube, Google, or any browser vendor. YouTube and YouTube
Music are trademarks of Google LLC, used here only to say what is being connected to. You
need your own YouTube Music account, and your use of that account remains subject to
YouTube's terms.
