import { getAllClips } from "../core/clip-store";

const ids = [
  "maxRecordingSeconds",
  "minRecordingSeconds",
  "crossfadeSeconds",
  "overlayOpacity",
] as const;

function bindRangeAndNumber(id: string) {
  const numInput = document.getElementById(id) as HTMLInputElement | null;
  const rangeInput = document.getElementById(`${id}_range`) as HTMLInputElement | null;

  if (numInput && rangeInput) {
    rangeInput.addEventListener("input", () => {
      numInput.value = rangeInput.value;
    });
    numInput.addEventListener("input", () => {
      rangeInput.value = numInput.value;
    });
  }
}

async function load(): Promise<void> {
  // Bind synchronized controls
  for (const id of ids) {
    bindRangeAndNumber(id);
  }

  // Load settings from storage
  const result = await chrome.storage.local.get("settings");
  const settings = result.settings ?? {};

  for (const id of ids) {
    const numInput = document.getElementById(id) as HTMLInputElement | null;
    const rangeInput = document.getElementById(`${id}_range`) as HTMLInputElement | null;
    const val = settings[id] ?? (id === "maxRecordingSeconds" ? 30 : id === "minRecordingSeconds" ? 0.8 : id === "crossfadeSeconds" ? 0.5 : 0.5);

    if (numInput) numInput.value = String(val);
    if (rangeInput) rangeInput.value = String(val);
  }

  // Load preset count
  try {
    const clips = await getAllClips();
    const countEl = document.getElementById("presetsCount");
    if (countEl) countEl.textContent = String(clips.length);
  } catch {
    // Non-critical if IndexedDB fails in options context
  }
}

async function save(): Promise<void> {
  const current = (await chrome.storage.local.get("settings")).settings ?? {};
  const next = { ...current };

  for (const id of ids) {
    const el = document.getElementById(id) as HTMLInputElement;
    if (el) {
      next[id] = Number(el.value);
    }
  }

  await chrome.storage.local.set({ settings: next });

  // Broadcast settings update
  try {
    await chrome.runtime.sendMessage({
      type: "PEDAL_UPDATE_SETTINGS",
      payload: next,
    });
  } catch {
    // Background might not have active tab
  }

  const savedEl = document.getElementById("saved");
  if (savedEl) {
    savedEl.classList.add("visible");
    setTimeout(() => {
      savedEl.classList.remove("visible");
    }, 1800);
  }
}

document.getElementById("save")?.addEventListener("click", save);
void load();
