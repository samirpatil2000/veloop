const SCRIPT_ID = "video-pedal-page-bridge";

function injectMainWorldBridge(): void {
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = chrome.runtime.getURL("page-bridge.js");
  script.onload = () => script.remove();

  (document.head || document.documentElement).appendChild(script);
}

injectMainWorldBridge();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== "video-pedal-page") return;

  chrome.runtime.sendMessage({
    type: event.data.type,
    payload: event.data.payload,
  });
});
