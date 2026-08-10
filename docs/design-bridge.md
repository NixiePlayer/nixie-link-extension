# Nixie: browser extension to app cookie bridge

Design notes for a cross platform sign in path. Written 2026-08-10.

Status: proposal, nothing built yet. This documents why the path exists, how it
works, and what it must refuse.

## The problem this solves

Nixie signs in by reusing a YouTube session that a real browser already holds.
It reads the YouTube cookies out of a signed in browser profile and writes them
into the app's auth partition. That is the only way in, because Google refuses
an embedded sign in window and refuses an OAuth device flow, and because the
YouTube Music API is signed with the web session cookies (`SAPISID` and
friends), not an OAuth bearer.

The native reader works today on macOS. It does not work everywhere:

- **macOS Chromium forks**: the cookie store is encrypted, and the key is in the
  Keychain. Nixie reads it with one permission prompt. Fine.
- **Firefox, any OS**: cookies are stored in the clear. Portable, works once the
  platform gate is opened.
- **Windows Chromium (Chrome 127+, Edge)**: broken. Google shipped
  **App-Bound Encryption (ABE)** in July 2024, Chrome 127. Cookie blobs are now
  prefixed `v20` and the key is wrapped by a COM "elevation service" that runs
  as SYSTEM and unwraps the key with SYSTEM-DPAPI then User-DPAPI. A normal
  privilege app cannot get the key the clean way. The only known bypasses need
  Administrator or SYSTEM, or they impersonate the elevation service. That is
  exactly what infostealer malware does. Nixie will not ship it.
- **Linux Chromium**: key is in the Secret Service, or a hardcoded `peanuts`
  fallback. Doable but its own key source.

So Windows Chromium is the hole. The extension closes it, and it happens to
improve every other platform too.

## Why an extension is the right tool

A browser extension with the `cookies` permission and a host permission for
YouTube reads cookies straight from the browser, in plaintext, **including
httpOnly cookies**. This is confirmed by the official Chrome docs: `getAll()`
returns `Cookie` objects whose `value` is the plaintext string, and the API
exposes httpOnly cookies that page scripts can never see.

What that means concretely:

1. **No decryption, ever.** Keychain, DPAPI, ABE, Secret Service: all
   irrelevant. The browser hands over the decrypted values. App-Bound
   Encryption on Windows, the thing with no clean native workaround, simply does
   not apply, because we are asking the browser, not reading its database.
2. **Same trusted session.** The cookies come from the real, already recognized
   browser session. This is why the old OAuth attempts returned "unrecognized
   device": OAuth is a fresh credential Google half trusts for the music API.
   Reusing the live session has nothing to re-recognize.
3. **Better rotation than the file poll.** `__Secure-1PSIDTS` rotates every few
   minutes. The native reader re-reads the profile at most once a minute to
   catch it. An extension listens to `chrome.cookies.onChanged` and pushes the
   new value the instant it rotates. A live feed, strictly better than polling a
   file.

### This is not the cookie paste we deleted

Nixie once had a manual "paste your Cookie header" import and removed it on
purpose, for two reasons. The extension repairs both:

- The paste could not refresh, so `__Secure-1PSIDTS` retired within minutes and
  every stream came back 403 while browsing still answered. The extension
  refreshes automatically.
- The paste taught a phishing shaped habit: open devtools, copy a credential.
  The extension teaches nothing of the sort: install a normal add on.

## How the link works

Two pieces plus a transport.

### 1. The extension (Manifest V3)

`manifest.json` declares:

- `"permissions": ["cookies", "nativeMessaging"]`
- `"host_permissions": ["*://*.youtube.com/"]` (the cookies API only returns
  cookies for domains the extension holds a host permission for)

It reads YouTube cookies with `chrome.cookies.getAll({ domain: "youtube.com" })`,
watches `chrome.cookies.onChanged` for rotation, and pushes the current set to
Nixie.

### 2. Transport: native messaging, not a localhost port

Use **native messaging**, the designed channel for extension to desktop app. It
opens no network socket, which a localhost HTTP server would, and that avoids a
whole class of "any page on your machine can hit the port" problems.

How it works, per the official docs:

- The browser starts the native host as a **separate process** and talks to it
  over **stdin/stdout**. Messages are JSON, UTF-8, each preceded by a 32-bit
  length in native byte order. Max 1 MB from host to browser, 64 MiB the other
  way. Cookie payloads are tiny, so size is a non issue.
- The extension uses `runtime.connectNative(hostName)` (long lived port) or
  `runtime.sendNativeMessage`.
- A **native host manifest** installed on disk points at the Nixie executable
  (or a small bridge binary) and declares which extensions may connect.

### 3. Who may talk to whom (this is the security)

The trust runs both directions and both directions are pinned:

- **App trusts only our extension.** The native host manifest lists the allowed
  extension. On Chrome/Edge that is `allowed_origins`
  (`chrome-extension://<id>/`, no wildcards permitted). On Firefox it is
  `allowed_extensions` (the add on ID). So a random extension cannot feed
  cookies to Nixie: the browser will not even launch the host for an unlisted
  origin.
- **Extension trusts only our app.** The manifest `path` points at the Nixie
  binary. The extension connects by host name, and the OS resolves it through
  that manifest, so the extension cannot be pointed at some other executable.

Manifest install locations (the app's installer writes these):

- **macOS / Linux**: a fixed filesystem path per browser.
- **Windows**: a registry key whose default value is the path to the manifest
  file (`HKCU\Software\Google\Chrome\NativeMessagingHosts\...`, and the Mozilla
  equivalent for Firefox).

### The seam with existing code

The extension emits the **same `ImportedCookie[]` shape** that
`readYouTubeCookies` already produces in `electron/browser-cookies.ts`. Nixie's
ingestion side, which writes cookies into the auth partition, does not change.
Only the **source** changes. That is the clean boundary: swap where the cookies
come from, keep everything downstream.

## The plan: keep the shortcut, add the floor

Do not replace the native reader. It is a great zero install experience where
the OS allows it. The extension is the universal floor underneath it.

| Platform / browser | Primary path | Notes |
|---|---|---|
| macOS Chromium forks | Native reader | Keychain, one prompt. Unchanged. |
| Firefox, any OS | Native reader | Cookies in the clear. Open the platform gate. |
| Windows Chromium, pre-ABE | Native reader via DPAPI | Best effort, no prompt. Older Chrome/Edge and laggard forks. Try, fall back on failure. |
| **Windows Chromium, ABE (current Chrome/Edge)** | **Extension** | The only clean path. |
| Any browser, any OS | **Extension** | Universal fallback and better rotation. |

So the extension is not a last resort. It is the guaranteed path on every OS and
every browser at once. The native reader is the frictionless shortcut where the
platform still allows it.

## What we refuse

Do **not** ship the ABE bypass (impersonating the elevation COM service, or
running elevated to unwrap the SYSTEM/User-DPAPI key). It is byte for byte what
infostealer malware does, antivirus will flag a signed consumer app for it, and
it breaks every few Chrome versions. For a project this careful about not
looking like malware, this is a straight no. The extension exists precisely so
we never need it.

## Honest costs

- Second codebase, second review cycle. Three store submissions: Chrome Web
  Store, Edge Add-ons, Firefox AMO. Manifest V3.
- Longer onboarding: install the app **and** the extension, link once.
- The `cookies` + YouTube host permission is a scary looking install prompt, and
  store reviewers may ask why an extension exports YouTube cookies to a local
  app. The answer is legitimate (the user's own session, to the user's own app,
  over a channel pinned to both ends), but expect the question.
- A real dependency to keep alive as Chrome and the stores change.

None of these outweigh the fact that the extension is the only thing that makes
Windows Chromium work at all without malware behavior, and it improves rotation
everywhere.

## Open design questions (next brainstorm)

- **Pairing / first link.** How does a fresh install prove the extension and the
  app belong to the same user, beyond the manifest allow list? Is the allow list
  enough, or do we want a one time code shown in the app and typed into the
  extension?
- **Which side installs the native host manifest?** The app installer is the
  natural owner (it knows the binary path). Confirm per platform, especially the
  Windows registry write and per user vs per machine.
- **Sign in screen states.** What does the sign in view show when the extension
  is the chosen path: "install the Nixie extension", detect it, show linked
  status.
- **Bridge binary vs Nixie itself as the host.** A tiny separate host process
  the browser launches, versus pointing the manifest at the main app. The
  browser launches the host on demand, so a separate short lived bridge that
  hands cookies to a running Nixie (or wakes it) is likely cleaner than making
  the main Electron process the stdio host.

## Sources

- [chrome.cookies API, Chrome for Developers](https://developer.chrome.com/docs/extensions/reference/api/cookies)
- [Native messaging, Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Native manifests, MDN (Firefox allowed_extensions and manifest locations)](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests)
- [Native messaging, MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging)
- [Breaking down Chrome App-Bound Encryption, somesota](https://somesota.blog/app-bound-encryption/breakdown-app-bound-encryption/)
- [New tool bypasses Chrome cookie encryption, BleepingComputer](https://www.bleepingcomputer.com/news/security/new-tool-bypasses-google-chromes-new-cookie-encryption-system/)
