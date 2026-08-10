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

## Layout

- `manifest.json`: MV3 manifest, with the pinned public key.
- `background.js`: the service worker, which opens the native port, sends one
  hello on connect, and answers the app's pulls with fresh cookies.
- `popup.html`, `popup.js`: a three-line status readout and a retry button.
- `icons/`: the toolbar and extension icons.

There is no build step and no dependency. It is plain JavaScript, loaded as it
sits.
