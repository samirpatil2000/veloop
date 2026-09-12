const state = document.getElementById("state")!;
const record = document.getElementById("record")!;
const live = document.getElementById("live")!;
const settings = document.getElementById("settings")!;

record.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "ENSURE_OFFSCREEN" });
  await chrome.runtime.sendMessage({ type: "PEDAL_TOGGLE_RECORD" });
  state.textContent = "REC";
});

live.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "PEDAL_GO_LIVE" });
  state.textContent = "LIVE";
});

settings.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});
