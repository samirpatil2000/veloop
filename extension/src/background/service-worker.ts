const OFFSCREEN_URL = "offscreen.html";

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
  });

  if (contexts.length) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [
      "USER_MEDIA" as chrome.offscreen.Reason,
      "WEB_RTC" as chrome.offscreen.Reason,
    ],
    justification: "Run the local video compositor and synthetic MediaStream.",
  });
}

/**
 * Finds the most relevant tab to send pedal commands to:
 * 1. Active tab in current window if it's a web page (e.g. Google Meet, Zoom)
 * 2. Or any Google Meet / video call tab open in any window
 */
async function getTargetTab(): Promise<chrome.tabs.Tab | null> {
  // First check current active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (
    activeTab?.id &&
    activeTab.url &&
    !activeTab.url.startsWith("chrome://") &&
    !activeTab.url.startsWith("chrome-extension://")
  ) {
    return activeTab;
  }

  // Look for any Google Meet / Teams tab
  const meetTabs = await chrome.tabs.query({ url: "*://meet.google.com/*" });
  if (meetTabs.length > 0 && meetTabs[0]?.id) {
    return meetTabs[0];
  }

  // Look for other active tabs across windows
  const allTabs = await chrome.tabs.query({ active: true });
  for (const tab of allTabs) {
    if (
      tab.id &&
      tab.url &&
      !tab.url.startsWith("chrome://") &&
      !tab.url.startsWith("chrome-extension://")
    ) {
      return tab;
    }
  }

  return null;
}

async function sendToTargetTab(message: { type: string; payload?: unknown }): Promise<unknown> {
  const targetTab = await getTargetTab();
  if (targetTab?.id) {
    try {
      return await chrome.tabs.sendMessage(targetTab.id, message);
    } catch {
      // Content script may not be loaded on this tab
    }
  }
  return null;
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    settings: {
      maxRecordingSeconds: 30,
      minRecordingSeconds: 0.8,
      crossfadeSeconds: 0.5,
      overlayOpacity: 0.5,
      fps: 30,
      mirrorPreview: true,
    },
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "video-pedal-record") {
    await sendToTargetTab({ type: "PEDAL_TOGGLE_RECORD" });
  } else if (command === "video-pedal-live") {
    await sendToTargetTab({ type: "PEDAL_GO_LIVE" });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message?.type === "PEDAL_TOGGLE_RECORD" ||
    message?.type === "PEDAL_START_RECORD" ||
    message?.type === "PEDAL_STOP_RECORD" ||
    message?.type === "PEDAL_GO_LIVE" ||
    message?.type === "PEDAL_GET_STATE"
  ) {
    sendToTargetTab(message).then((res) => sendResponse(res));
    return true;
  }

  if (message?.type === "PEDAL_STATE_CHANGED" && message.payload?.state) {
    const st = message.payload.state;
    if (st === "RECORDING") {
      chrome.action.setBadgeText({ text: "REC" });
      chrome.action.setBadgeBackgroundColor({ color: "#e53e3e" });
    } else if (st === "LOOPING") {
      chrome.action.setBadgeText({ text: "LOOP" });
      chrome.action.setBadgeBackgroundColor({ color: "#38a169" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  }
});
