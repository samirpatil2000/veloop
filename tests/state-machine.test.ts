import { describe, expect, it } from "vitest";
import { PedalStateMachine } from "../extension/src/core/state-machine";
import { DEFAULT_SETTINGS } from "../extension/src/core/types";

describe("PedalStateMachine", () => {
  it("transitions LIVE -> REC -> LOOP", () => {
    const pedal = new PedalStateMachine({
      ...DEFAULT_SETTINGS,
      minRecordingSeconds: 0.1,
      fps: 10,
    });

    pedal.pedalDown();
    expect(pedal.getState()).toBe("RECORDING");

    for (let i = 0; i < 2; i++) pedal.record(i);
    pedal.pedalUp();

    expect(pedal.getState()).toBe("LOOPING");
    expect(pedal.nextLoopFrame()).toBe(0);
    expect(pedal.nextLoopFrame()).toBe(1);
    expect(pedal.nextLoopFrame()).toBe(0);
  });

  it("ignores recordings shorter than the minimum", () => {
    const pedal = new PedalStateMachine({
      ...DEFAULT_SETTINGS,
      minRecordingSeconds: 1,
      fps: 10,
    });

    pedal.pedalDown();
    pedal.record(1);
    pedal.pedalUp();

    expect(pedal.getState()).toBe("LIVE");
  });

  it("can return to live", () => {
    const pedal = new PedalStateMachine({
      ...DEFAULT_SETTINGS,
      minRecordingSeconds: 0.1,
      crossfadeSeconds: 0,
      fps: 10,
    });

    pedal.pedalDown();
    pedal.record(1);
    pedal.pedalUp();
    pedal.goLive();

    expect(pedal.getState()).toBe("LIVE");
  });
});
