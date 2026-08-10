// Nixie Link service worker.
//
// Reads the YouTube session cookies of the browser profile this extension is
// installed in and hands them to the Nixie desktop app over native messaging.
// The app is the only thing it ever speaks to.

const HOST = "com.theedoran.nixie";
const RECONNECT_ALARM = "reconnect";

// The session cookies the app needs. Everything else on youtube.com is dropped
// before it ever leaves the worker.
const COOKIE_NAMES = new Set([
  "SID",
  "HSID",
  "SSID",
  "APISID",
  "SAPISID",
  "__Secure-1PSID",
  "__Secure-3PSID",
  "__Secure-1PSIDTS",
  "__Secure-3PSIDTS",
  "__Secure-1PAPISID",
  "__Secure-3PAPISID",
  "__Secure-1PSIDCC",
  "__Secure-3PSIDCC",
  "SIDCC",
  "LOGIN_INFO",
  "PREF",
  "VISITOR_INFO1_LIVE",
  "VISITOR_PRIVACY_METADATA",
  "YSC",
  "SOCS",
  "CONSENT",
  "__Secure-ROLLOUT_TOKEN",
]);

// A signed-in profile always carries one of these.
const AUTH_NAMES = ["SAPISID", "__Secure-3PAPISID"];

const BRANDS = [
  "Microsoft Edge",
  "Brave",
  "Vivaldi",
  "Opera",
  "Google Chrome",
  "Chromium",
];

let port = null;

/**
 * The only thing that tells two profiles of the same browser apart. Minted once
 * and kept for the life of the profile.
 */
async function installId() {
  const stored = await chrome.storage.local.get("installId");
  if (stored.installId) return stored.installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

/** A display name for the browser this profile belongs to. */
function brand() {
  const brands = navigator.userAgentData?.brands ?? [];
  for (const known of BRANDS) {
    if (brands.some((entry) => entry.brand === known)) return known;
  }
  return "Chromium";
}

/** The filtered session cookies, shaped the way the app reads them. */
async function collect() {
  const all = await chrome.cookies.getAll({ domain: "youtube.com" });
  return all
    .filter((cookie) => COOKIE_NAMES.has(cookie.name) && cookie.value !== "")
    .map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      expirationDate: cookie.session ? undefined : cookie.expirationDate,
    }));
}

function setStatus(status) {
  chrome.storage.session.set({ status }).catch(() => {});
}

/**
 * Opens the port to the native host and introduces this profile. The port is
 * held for as long as the app keeps it open: the host's own ping is what holds
 * the worker awake, and the reconnect alarm is the only retry.
 */
async function connect() {
  if (port) return;

  let opened;
  try {
    opened = chrome.runtime.connectNative(HOST);
  } catch {
    setStatus("app-not-running");
    return;
  }
  port = opened;

  opened.onDisconnect.addListener(() => {
    if (port === opened) port = null;
    setStatus("app-not-running");
  });

  opened.onMessage.addListener((message) => {
    // A ping is the host's keepalive. Receiving it is the whole point: it
    // resets the worker's idle timer, so there is nothing to answer.
    if (!message || message.type === "ping") return;
    if (message.type === "pull") {
      collect().then(
        (cookies) => {
          if (port === opened) {
            opened.postMessage({ type: "cookies", id: message.id, cookies });
          }
        },
        () => {},
      );
    }
  });

  try {
    const cookies = await collect();
    const signedIn = cookies.some((cookie) => AUTH_NAMES.includes(cookie.name));
    opened.postMessage({
      type: "hello",
      installId: await installId(),
      browser: brand(),
      signedIn,
      cookies,
    });
    setStatus(signedIn ? "connected" : "signed-out");
  } catch {
    if (port === opened) port = null;
    setStatus("app-not-running");
  }
}

chrome.runtime.onStartup.addListener(() => {
  connect();
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(RECONNECT_ALARM, { periodInMinutes: 1 });
  connect();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONNECT_ALARM) connect();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "reconnect") connect();
});
