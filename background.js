// Nixie Link service worker.
//
// Reads the YouTube session cookies of this browser profile and sends them only
// after an authenticated request from the paired Nixie desktop app. Cookie
// payloads are encrypted before they enter the native-messaging channel.

import { encryptCookies, fromBase64Url, toBase64Url, validPull } from "./protocol.js";

const HOST = "com.theedoran.nixie";
const RECONNECT_ALARM = "reconnect";
const SECRET_KEY = "pairingSecret";
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

const AUTH_NAMES = new Set(["SAPISID", "__Secure-3PAPISID"]);
const BRANDS = ["Microsoft Edge", "Brave", "Vivaldi", "Opera", "Google Chrome", "Chromium"];
const INSTALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let port = null;
let pairingSecretPromise;
let installIdPromise;

async function readPairingSecret() {
  const stored = await chrome.storage.local.get(SECRET_KEY);
  const bytes = fromBase64Url(stored[SECRET_KEY]);
  if (bytes?.length === 32 && toBase64Url(bytes) === stored[SECRET_KEY]) {
    return stored[SECRET_KEY];
  }
  const secret = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  await chrome.storage.local.set({ [SECRET_KEY]: secret });
  return secret;
}

// A rejected storage read must not be cached for the worker's life, so the memo clears on failure.
function pairingSecret() {
  return (pairingSecretPromise ??= readPairingSecret().catch((error) => {
    pairingSecretPromise = undefined;
    throw error;
  }));
}

function resetPairingSecret() {
  return (pairingSecretPromise = pairingSecret()
    .catch(() => undefined)
    .then(async () => {
      await chrome.storage.local.remove(SECRET_KEY);
      return readPairingSecret();
    })
    .catch((error) => {
      pairingSecretPromise = undefined;
      throw error;
    }));
}

async function readInstallId() {
  const stored = await chrome.storage.local.get("installId");
  if (typeof stored.installId === "string" && INSTALL_ID.test(stored.installId)) return stored.installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

function installId() {
  return (installIdPromise ??= readInstallId().catch((error) => {
    installIdPromise = undefined;
    throw error;
  }));
}

function brand() {
  const brands = navigator.userAgentData?.brands ?? [];
  for (const known of BRANDS) {
    if (brands.some((entry) => entry.brand === known)) return known;
  }
  return "Chromium";
}

async function collect() {
  const all = await chrome.cookies.getAll({ domain: "youtube.com" });
  const cookies = all
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
  // Signed out means an empty set, as the privacy notice promises. Visitor and consent cookies that
  // survive sign-out stay in the browser.
  return signedIn(cookies) ? cookies : [];
}

function signedIn(cookies) {
  return cookies.some((cookie) => AUTH_NAMES.has(cookie.name));
}

function setStatus(status) {
  chrome.storage.session.set({ status }).catch(() => {});
}

async function announceStatus(opened) {
  const active = signedIn(await collect());
  if (port === opened) {
    opened.postMessage({ type: "status", installId: await installId(), signedIn: active });
    setStatus(active ? "connected" : "signed-out");
  }
}

async function answerPull(opened, message) {
  const [secret, id] = await Promise.all([pairingSecret(), installId()]);
  if (!(await validPull(message, secret, id))) return;
  const cookies = await collect();
  const encrypted = await encryptCookies(cookies, message, secret, id);
  if (port === opened) {
    opened.postMessage({ type: "cookies", id: message.id, nonce: message.nonce, ...encrypted });
    setStatus(signedIn(cookies) ? "connected" : "signed-out");
  }
}

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
    // Reading lastError marks a missing or crashed host as handled and keeps the console quiet.
    void chrome.runtime.lastError;
    if (port === opened) port = null;
    setStatus("app-not-running");
  });

  opened.onMessage.addListener((message) => {
    if (!message || message.type === "ping") return;
    if (message.type === "pull") answerPull(opened, message).catch(() => {});
  });

  try {
    const cookies = await collect();
    const active = signedIn(cookies);
    opened.postMessage({
      type: "hello",
      installId: await installId(),
      browser: brand(),
      signedIn: active,
    });
    setStatus(active ? "connected" : "signed-out");
  } catch {
    if (port === opened) port = null;
    opened.disconnect();
    setStatus("app-not-running");
  }
}

// Alarms are not guaranteed to survive a browser restart, so the alarm is asserted on every worker
// start. Create only when absent: a same-name create replaces the alarm and moves its next fire a
// minute forward, and frequent cookie events could restart the worker often enough to starve it.
chrome.alarms.get(RECONNECT_ALARM).then((alarm) => {
  if (!alarm) chrome.alarms.create(RECONNECT_ALARM, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONNECT_ALARM) connect();
});

// Only the auth cookies decide the signed-in Boolean; host_permissions already limits delivery to
// youtube.com.
chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (port && AUTH_NAMES.has(cookie.name)) announceStatus(port).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === "reconnect") {
    connect();
    sendResponse({ ok: true });
  } else if (message?.type === "pairing-secret") {
    pairingSecret().then(
      (secret) => sendResponse({ secret }),
      () => sendResponse({}),
    );
    return true;
  } else if (message?.type === "reset-pairing-secret") {
    resetPairingSecret().then(
      (secret) => sendResponse({ secret }),
      () => sendResponse({}),
    );
    return true;
  }
});
