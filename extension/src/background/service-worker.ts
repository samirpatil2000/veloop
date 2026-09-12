const OFFSCREEN_URL = "offscreen.html";

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });

  if (contexts.length) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["USER_MEDIA", "WEB_RTC"],
    justification: "Run the local video compositor and synthetic MediaStream.",
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    settings: {
      maxRecordingSeconds: 30,
      minRecordingSeconds: 1,
      crossfadeSeconds: 0.5,
      overlayOpacity: 0.5,
      fps: 30,
      mirrorPreview: true,
    },
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  await ensureOffscreen();

  if (command === "video-pedal-record") {
    await chrome.runtime.sendMessage({ type: "PEDAL_TOGGLE_RECORD" });
  } else if (command === "video-pedal-live") {
    await chrome.runtime.sendMessage({ type: "PEDAL_GO_LIVE" });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ENSURE_OFFSCREEN") {
    ensureOffscreen()
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({ ok: false, error: String(error) }),
      );
    return true;
  }

  void sender;
});
