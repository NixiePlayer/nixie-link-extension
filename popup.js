const MESSAGES = {
  connected: { text: "Connected to Nixie." },
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

async function render() {
  const [stored, response] = await Promise.all([
    chrome.storage.session.get("status"),
    chrome.runtime.sendMessage({ type: "pairing-secret" }),
  ]);
  show(MESSAGES[stored.status] ?? MESSAGES["app-not-running"]);
  pairing.textContent = response?.secret ?? "Unavailable";
}

document.getElementById("copy").addEventListener("click", async () => {
  if (pairing.textContent && pairing.textContent !== "Unavailable") {
    await navigator.clipboard.writeText(pairing.textContent);
  }
});

document.getElementById("reset").addEventListener("click", async () => {
  if (!confirm("Reset the pairing code? Nixie will need the new code.")) return;
  const response = await chrome.runtime.sendMessage({ type: "reset-pairing-secret" });
  pairing.textContent = response?.secret ?? "Unavailable";
});

document.getElementById("retry").addEventListener("click", async () => {
  message.textContent = "Checking...";
  await chrome.runtime.sendMessage({ type: "reconnect" }).catch(() => {});
  setTimeout(render, 400);
});

render();
