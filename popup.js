const MESSAGES = {
  connected: { text: "Connected to Nixie. Cookies are sent only to a paired Nixie." },
  "app-not-running": { text: "Open Nixie on this computer, then try again." },
  "signed-out": {
    text: "Sign in to YouTube Music in this browser first: ",
    link: "https://music.youtube.com",
  },
};

const message = document.getElementById("message");
const pairing = document.getElementById("pairing");

function show(state) {
  message.textContent = state.text;
  if (!state.link) return;
  const anchor = document.createElement("a");
  anchor.href = state.link;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.textContent = "music.youtube.com";
  message.append(anchor);
}

let statusSeen = false;

function showStatus(status) {
  show(MESSAGES[status] ?? MESSAGES["app-not-running"]);
}

// A change event that arrives while the initial read is in flight is newer than the read, so the
// read result is shown only when no event has been rendered yet.
chrome.storage.session.onChanged.addListener((changes) => {
  if (!changes.status) return;
  statusSeen = true;
  showStatus(changes.status.newValue);
});

async function renderStatus() {
  const stored = await chrome.storage.session.get("status").catch(() => ({}));
  if (!statusSeen) showStatus(stored.status);
}

async function renderPairing() {
  const response = await chrome.runtime.sendMessage({ type: "pairing-secret" }).catch(() => undefined);
  pairing.textContent = response?.secret ?? "Unavailable";
}

document.getElementById("copy").addEventListener("click", async () => {
  if (pairing.textContent && pairing.textContent !== "Unavailable") {
    await navigator.clipboard.writeText(pairing.textContent);
  }
});

document.getElementById("reset").addEventListener("click", async () => {
  if (!confirm("Reset the pairing code? Nixie will need the new code.")) return;
  const response = await chrome.runtime.sendMessage({ type: "reset-pairing-secret" }).catch(() => undefined);
  pairing.textContent = response?.secret ?? "Unavailable";
});

// The worker reports the outcome of a reconnect through the session status, which the listener above
// renders as it changes.
document.getElementById("retry").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "reconnect" }).catch(() => {});
  renderStatus();
});

renderStatus();
renderPairing();
