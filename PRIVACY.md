# Privacy

Nixie Link reads the YouTube session cookies of the browser profile it is installed in and hands them
to the Nixie desktop app running on the same computer. That is the only thing it does, and this page
is the whole of what it touches.

## What it reads

The cookies of `https://*.youtube.com/`, and no other host. It asks for one host permission and the
browser enforces it: cookies belonging to any other site are not readable by this extension at all.

Before anything leaves the service worker it is filtered down to the session cookie names the desktop
app needs to build a YouTube Music session. Everything else in that cookie store, including anything
YouTube keeps for its own purposes, is dropped.

## Where it goes

To one place: the native messaging host `com.theedoran.nixie`, which is the Nixie desktop app on the
same computer. Chrome native messaging is a pipe between the browser and a locally installed program;
it is not a network connection and it does not leave the machine.

The browser only starts that host for an extension the host's own manifest names, and the app only
accepts a connection carrying a token it wrote into a file readable by the current user. Cookies
travel in one direction, browser to app. The app sends requests for the current cookies and never
sends a cookie back.

## What it does not do

- It makes no network requests of its own. It contacts no server, ours or anyone else's.
- It collects no analytics and reports no telemetry. There is nothing to opt out of.
- It has no content script, so it cannot read or change any page you visit.
- It keeps no history and no copy of the cookies. Each request is answered from the browser's own
  cookie store at that moment.

## What it stores

One value, in the browser's own extension storage: a random identifier generated on first run. It is
how the desktop app tells two browser profiles apart in its sign-in list. It names no account, no
person and no session, and it is meaningless outside this pair of programs.

## Ending it

Removing the extension ends it. Signing out inside the Nixie app ends the link, and signing out of
YouTube in this browser ends the session the link was built on. None of them leave anything behind
here.

## Questions

Open an issue at
[NixiePlayer/nixie-connector-extension](https://github.com/NixiePlayer/nixie-connector-extension/issues).
The desktop side is described in
[Nixie's own privacy notice](https://github.com/NixiePlayer/NixieDesktop/blob/main/PRIVACY.md).
