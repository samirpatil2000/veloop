const state = document.getElementById("state")!;
const record = document.getElementById("record")!;
const live = document.getElementById("live")!;
const settings = document.getElementById("settings")!;
const statusEl = document.getElementById("status");

function updateUI(st: string | null) {
  if (st === "RECORDING") {
    state.textContent = "REC";
    (state as HTMLElement).style.color = "#ff5555";
    record.textContent = "Stop & Loop";
    if (statusEl) statusEl.textContent = "Recording...";
  } else if (st === "LOOPING") {
    state.textContent = "LOOP";
    (state as HTMLElement).style.color = "#55ff55";
    record.textContent = "Record New Loop";
    if (statusEl) statusEl.textContent = "Looping";
  } else {
    state.textContent = "LIVE";
    (state as HTMLElement).style.color = "";
    record.textContent = "Start recording";
    if (statusEl) statusEl.textContent = "Ready";
  }
}

async function sendCommand(type: string) {
  try {
    const res = await chrome.runtime.sendMessage({ type });
    if (res?.state) {
      updateUI(res.state);
    }
  } catch {
    // Tab might not be loaded
  }
}

record.addEventListener("click", async () => {
  await sendCommand("PEDAL_TOGGLE_RECORD");
});

live.addEventListener("click", async () => {
  await sendCommand("PEDAL_GO_LIVE");
});

settings.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "PEDAL_STATE_CHANGED" && message.payload?.state) {
    updateUI(message.payload.state);
  }
});

// Refresh state from active tab
void sendCommand("PEDAL_GET_STATE");
