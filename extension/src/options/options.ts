const ids = [
  "maxRecordingSeconds",
  "minRecordingSeconds",
  "crossfadeSeconds",
  "overlayOpacity",
] as const;

async function load(): Promise<void> {
  const result = await chrome.storage.local.get("settings");
  const settings = result.settings ?? {};

  for (const id of ids) {
    const input = document.getElementById(id) as HTMLInputElement;
    input.value = String(settings[id] ?? "");
  }
}

async function save(): Promise<void> {
  const current = (await chrome.storage.local.get("settings")).settings ?? {};
  const next = { ...current };

  for (const id of ids) {
    next[id] = Number((document.getElementById(id) as HTMLInputElement).value);
  }

  await chrome.storage.local.set({ settings: next });
  document.getElementById("saved")!.textContent = " Saved";
  setTimeout(() => (document.getElementById("saved")!.textContent = ""), 1200);
}

document.getElementById("save")!.addEventListener("click", save);
void load();
