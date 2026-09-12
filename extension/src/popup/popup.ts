import { getAllClips, saveClip, deleteClip } from "../core/clip-store";
import type { SavedVideoClip } from "../core/types";

const state = document.getElementById("state")!;
const hint = document.getElementById("hint")!;
const record = document.getElementById("record")!;
const live = document.getElementById("live")!;
const settings = document.getElementById("settings")!;
const statusEl = document.getElementById("status");

const saveSection = document.getElementById("saveSection")!;
const presetTitleInput = document.getElementById("presetTitleInput") as HTMLInputElement;
const savePresetBtn = document.getElementById("savePresetBtn") as HTMLButtonElement;

const presetsList = document.getElementById("presetsList")!;
const noPresetsMsg = document.getElementById("noPresetsMsg")!;
const presetsCount = document.getElementById("presetsCount")!;

let currentState: string | null = "LIVE";
let activePresetId: string | null = null;
let activePresetTitle: string | null = null;

function updateUI(st: string | null, payload?: { activePresetTitle?: string; activePresetId?: string; hasSavedLoopAvailable?: boolean }) {
  currentState = st;
  if (payload?.activePresetId !== undefined) activePresetId = payload.activePresetId;
  if (payload?.activePresetTitle !== undefined) activePresetTitle = payload.activePresetTitle;

  if (st === "RECORDING") {
    state.textContent = "REC";
    (state as HTMLElement).style.color = "#ff5555";
    record.textContent = "Stop & Loop";
    if (statusEl) statusEl.textContent = "Recording...";
    hint.textContent = "Release pedal or key to loop";
    saveSection.classList.add("hidden");
  } else if (st === "LOOPING") {
    state.textContent = "LOOP";
    (state as HTMLElement).style.color = "#55ff55";
    record.textContent = "Record New Loop";
    if (statusEl) statusEl.textContent = "Looping (Camera Off)";
    hint.textContent = "Press Right Cmd or 'l' to go live";
    saveSection.classList.remove("hidden");
  } else if (st === "REPLAYING") {
    state.textContent = "PLAY";
    (state as HTMLElement).style.color = "#63b3ed";
    record.textContent = "Record New Loop";
    if (statusEl) {
      statusEl.textContent = activePresetTitle ? `Preset: ${activePresetTitle}` : "Replaying (Camera Off)";
    }
    hint.textContent = "Replaying preset (Camera Off)";
    saveSection.classList.add("hidden");
  } else {
    state.textContent = "LIVE";
    (state as HTMLElement).style.color = "";
    record.textContent = "Start recording";
    if (statusEl) statusEl.textContent = "Ready";
    hint.textContent = "Hold Right Alt to record";
    saveSection.classList.add("hidden");
    activePresetId = null;
    activePresetTitle = null;
  }

  // Update visual selection on cards
  const cards = presetsList.querySelectorAll(".preset-card");
  cards.forEach((card) => {
    const cardId = card.getAttribute("data-id");
    if (cardId && cardId === activePresetId && currentState === "REPLAYING") {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });
}

async function renderPresets() {
  try {
    const clips = await getAllClips();
    presetsCount.textContent = String(clips.length);

    if (clips.length === 0) {
      presetsList.innerHTML = "";
      noPresetsMsg.classList.remove("hidden");
      return;
    }

    noPresetsMsg.classList.add("hidden");
    presetsList.innerHTML = "";

    for (const clip of clips) {
      const card = document.createElement("div");
      card.className = `preset-card${clip.id === activePresetId && currentState === "REPLAYING" ? " active" : ""}`;
      card.setAttribute("data-id", clip.id);

      const thumbWrap = document.createElement("div");
      thumbWrap.className = "preset-thumb-wrap";
      const thumb = document.createElement("img");
      thumb.className = "preset-thumb";
      thumb.src = clip.thumbnailDataUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90' fill='%23222'%3E%3Crect width='160' height='90'/%3E%3C/svg%3E";
      thumb.alt = clip.title;
      const playIcon = document.createElement("div");
      playIcon.className = "preset-play-icon";
      playIcon.textContent = "▶";
      thumbWrap.appendChild(thumb);
      thumbWrap.appendChild(playIcon);

      const info = document.createElement("div");
      info.className = "preset-info";
      const name = document.createElement("div");
      name.className = "preset-name";
      name.textContent = clip.title;
      const meta = document.createElement("div");
      meta.className = "preset-meta";
      meta.textContent = `${clip.durationSeconds}s loop`;
      info.appendChild(name);
      info.appendChild(meta);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "preset-delete";
      deleteBtn.innerHTML = "&times;";
      deleteBtn.title = "Delete preset";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteClip(clip.id);
        await renderPresets();
      });

      card.appendChild(thumbWrap);
      card.appendChild(info);
      card.appendChild(deleteBtn);

      card.addEventListener("click", async () => {
        await playPreset(clip);
      });

      presetsList.appendChild(card);
    }
  } catch (err) {
    console.error("Failed to render presets:", err);
  }
}

async function playPreset(clip: SavedVideoClip) {
  try {
    activePresetId = clip.id;
    activePresetTitle = clip.title;
    const res = await chrome.runtime.sendMessage({
      type: "PEDAL_PLAY_SAVED_CLIP",
      payload: {
        id: clip.id,
        title: clip.title,
        videoDataUrl: clip.videoDataUrl,
        durationSeconds: clip.durationSeconds,
      },
    });
    if (res?.state) {
      updateUI(res.state, res);
    } else {
      updateUI("REPLAYING", { activePresetId: clip.id, activePresetTitle: clip.title });
    }
  } catch (err) {
    console.warn("Could not play preset on target tab:", err);
  }
}

async function sendCommand(type: string) {
  try {
    const res = await chrome.runtime.sendMessage({ type });
    if (res?.state) {
      updateUI(res.state, res);
    }
  } catch {
    // Tab might not be loaded
  }
}

// Event Listeners
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

async function handleSavePreset() {
  const title = presetTitleInput.value.trim();
  savePresetBtn.disabled = true;
  savePresetBtn.textContent = "Saving...";

  try {
    const res = await chrome.runtime.sendMessage({
      type: "PEDAL_EXPORT_CURRENT_LOOP",
    });

    if (res && res.videoDataUrl) {
      const clip: SavedVideoClip = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        title: title || `Loop ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        videoDataUrl: res.videoDataUrl,
        durationSeconds: res.durationSeconds || 3,
        thumbnailDataUrl: res.thumbnailDataUrl || "",
        createdAt: Date.now(),
      };

      await saveClip(clip);
      presetTitleInput.value = "";
      saveSection.classList.add("hidden");
      await renderPresets();
    } else {
      alert("No loop data available yet to save. Please finish recording first.");
    }
  } catch (err) {
    console.error("Failed to export loop:", err);
    alert("Could not retrieve loop data from meeting tab.");
  } finally {
    savePresetBtn.disabled = false;
    savePresetBtn.textContent = "Save";
  }
}

savePresetBtn.addEventListener("click", handleSavePreset);
presetTitleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    void handleSavePreset();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "PEDAL_STATE_CHANGED" && message.payload?.state) {
    updateUI(message.payload.state, message.payload);
  } else if (message?.type === "PEDAL_LOOP_READY_TO_SAVE") {
    saveSection.classList.remove("hidden");
  }
});

// Initial load
void renderPresets();
void sendCommand("PEDAL_GET_STATE");
