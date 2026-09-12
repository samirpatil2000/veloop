import {
  DEFAULT_SETTINGS,
  type PedalSettings,
  type PedalSnapshot,
  type PedalState,
} from "./types";
import { LoopBuffer } from "./loop-buffer";

export interface LoopPlayer {
  length: number;
  position: number;
  next(): unknown;
}

export class PedalStateMachine<T> {
  private state: PedalState = "LIVE";
  private readonly recorder: LoopBuffer<T>;
  private loop: T[] = [];
  private position = 0;
  private dissolveRemaining = 0;

  constructor(
    private settings: PedalSettings = DEFAULT_SETTINGS,
    private readonly onState?: (state: PedalState) => void,
  ) {
    this.recorder = new LoopBuffer(
      Math.max(1, Math.floor(settings.maxRecordingSeconds * settings.fps)),
    );
  }

  getState(): PedalState {
    return this.state;
  }

  pedalDown(): void {
    if (this.state === "RECORDING") return;
    this.recorder.clear();
    this.state = "RECORDING";
    this.emit();
  }

  record(frame: T): void {
    if (this.state === "RECORDING") this.recorder.push(frame);
  }

  pedalUp(): void {
    if (this.state !== "RECORDING") return;

    const frames = this.recorder.take();
    const minFrames = Math.max(
      1,
      Math.floor(this.settings.minRecordingSeconds * this.settings.fps),
    );

    if (frames.length < minFrames) {
      this.state = "LIVE";
      this.emit();
      return;
    }

    this.loop = frames;
    this.position = 0;
    this.state = "LOOPING";
    this.emit();
  }

  goLive(): void {
    if (this.state === "LIVE") return;

    if (
      this.state === "LOOPING" &&
      this.settings.crossfadeSeconds > 0
    ) {
      this.dissolveRemaining = Math.max(
        1,
        Math.floor(this.settings.crossfadeSeconds * this.settings.fps),
      );
      this.state = "DISSOLVING_TO_LIVE";
    } else {
      this.loop = [];
      this.position = 0;
      this.state = "LIVE";
    }
    this.emit();
  }

  nextLoopFrame(): T | undefined {
    if (
      this.state !== "LOOPING" &&
      this.state !== "DISSOLVING_TO_LIVE"
    ) {
      return undefined;
    }

    if (!this.loop.length) {
      this.state = "LIVE";
      this.emit();
      return undefined;
    }

    const frame = this.loop[this.position];
    this.position = (this.position + 1) % this.loop.length;

    if (this.state === "DISSOLVING_TO_LIVE") {
      this.dissolveRemaining -= 1;
      if (this.dissolveRemaining <= 0) {
        this.loop = [];
        this.position = 0;
        this.state = "LIVE";
        this.emit();
      }
    }

    return frame;
  }

  snapshot(): PedalSnapshot {
    if (this.state === "RECORDING") {
      const total = this.recorder.maxLength / this.settings.fps;
      return {
        state: this.state,
        recordedSeconds: this.recorder.length / this.settings.fps,
        loopSeconds: 0,
        progress: total ? this.recorder.length / this.recorder.maxLength : null,
      };
    }

    if (this.loop.length) {
      return {
        state: this.state,
        recordedSeconds: 0,
        loopSeconds: this.loop.length / this.settings.fps,
        progress: this.position / this.loop.length,
      };
    }

    return {
      state: "LIVE",
      recordedSeconds: 0,
      loopSeconds: 0,
      progress: null,
    };
  }

  private emit(): void {
    this.onState?.(this.state);
  }
}
