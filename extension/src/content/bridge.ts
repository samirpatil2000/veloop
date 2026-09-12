// Relaying messages from page bridge (MAIN world) to extension background and popup
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== "video-pedal-page") return;

  try {
    if (!chrome?.runtime?.id) return;
    chrome.runtime.sendMessage({
      type: event.data.type,
      payload: event.data.payload,
    }).catch(() => {});
  } catch {
    // Safely ignore extension context invalidated errors during reloads
  }
});

// Relaying commands from extension background/popup to page bridge (MAIN world)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  window.postMessage(
    {
      source: "video-pedal-extension",
      type: message.type,
      payload: message.payload,
    },
    "*",
  );

  if (
    message.type === "PEDAL_GET_STATE" ||
    message.type === "PEDAL_TOGGLE_RECORD" ||
    message.type === "PEDAL_GO_LIVE" ||
    message.type === "PEDAL_START_RECORD" ||
    message.type === "PEDAL_STOP_RECORD"
  ) {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.source !== "video-pedal-page") return;
      if (event.data?.type === "PEDAL_STATE_CHANGED") {
        window.removeEventListener("message", handler);
        sendResponse({ state: event.data.payload?.state });
      }
    };
    window.addEventListener("message", handler);
    setTimeout(() => {
      window.removeEventListener("message", handler);
      sendResponse({ state: null });
    }, 3000);
    return true; // Keep channel open for async response
  }
});
