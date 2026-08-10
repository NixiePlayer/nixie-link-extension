const MESSAGES = {
  connected: { text: "Connected to Nixie." },
  "app-not-running": { text: "Open Nixie on this computer, then try again." },
  "signed-out": {
    text: "Sign in to YouTube Music in this browser first: ",
    link: "https://music.youtube.com",
  },
};

const message = document.getElementById("message");

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
  const stored = await chrome.storage.session.get("status");
  show(MESSAGES[stored.status] ?? MESSAGES["app-not-running"]);
}

document.getElementById("retry").addEventListener("click", async () => {
  message.textContent = "Checking...";
  try {
    await chrome.runtime.sendMessage({ type: "reconnect" });
  } catch {
    // The worker takes the message and answers nothing, which rejects here.
  }
  setTimeout(render, 400);
});

render();
