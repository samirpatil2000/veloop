import { describe, expect, it } from "vitest";
import { LoopBuffer } from "../extension/src/core/loop-buffer";

describe("LoopBuffer", () => {
  it("keeps the newest items when full", () => {
    const buffer = new LoopBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4);
    expect(buffer.values()).toEqual([2, 3, 4]);
  });

  it("takes and clears", () => {
    const buffer = new LoopBuffer<number>(2);
    buffer.push(1);
    buffer.push(2);
    expect(buffer.take()).toEqual([1, 2]);
    expect(buffer.length).toBe(0);
  });
});
