export type PedalState =
  | "LIVE"
  | "RECORDING"
  | "LOOPING"
  | "DISSOLVING_TO_LIVE";

export interface PedalSettings {
  maxRecordingSeconds: number;
  minRecordingSeconds: number;
  crossfadeSeconds: number;
  overlayOpacity: number;
  fps: number;
  mirrorPreview: boolean;
}

export const DEFAULT_SETTINGS: PedalSettings = {
  maxRecordingSeconds: 30,
  minRecordingSeconds: 1,
  crossfadeSeconds: 0.5,
  overlayOpacity: 0.5,
  fps: 30,
  mirrorPreview: true,
};

export interface PedalSnapshot {
  state: PedalState;
  recordedSeconds: number;
  loopSeconds: number;
  progress: number | null;
}
