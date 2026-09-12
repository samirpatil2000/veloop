import { describe, expect, it, beforeEach } from "vitest";
import { saveClip, getAllClips, getClip, deleteClip } from "../extension/src/core/clip-store";
import type { SavedVideoClip } from "../extension/src/core/types";

// Simple in-memory mock of IDBDatabase for headless node test environment
class MockIDBDatabase {
  private data = new Map<string, SavedVideoClip>();

  transaction(_store: string, mode: "readonly" | "readwrite") {
    const self = this;
    const listeners: Record<string, (() => void)[]> = {};

    const tx = {
      oncomplete: null as null | (() => void),
      objectStore(_name: string) {
        return {
          put(item: SavedVideoClip) {
            self.data.set(item.id, item);
            const req = { onsuccess: null as any, onerror: null as any };
            setTimeout(() => {
              if (req.onsuccess) req.onsuccess();
              if (tx.oncomplete) tx.oncomplete();
            }, 0);
            return req;
          },
          getAll() {
            const result = Array.from(self.data.values());
            const req = { result, onsuccess: null as any, onerror: null as any };
            setTimeout(() => {
              if (req.onsuccess) req.onsuccess();
              if (tx.oncomplete) tx.oncomplete();
            }, 0);
            return req;
          },
          get(id: string) {
            const result = self.data.get(id);
            const req = { result, onsuccess: null as any, onerror: null as any };
            setTimeout(() => {
              if (req.onsuccess) req.onsuccess();
              if (tx.oncomplete) tx.oncomplete();
            }, 0);
            return req;
          },
          delete(id: string) {
            self.data.delete(id);
            const req = { onsuccess: null as any, onerror: null as any };
            setTimeout(() => {
              if (req.onsuccess) req.onsuccess();
              if (tx.oncomplete) tx.oncomplete();
            }, 0);
            return req;
          },
        };
      },
    };
    return tx;
  }

  close() {}
}

describe("clip-store", () => {
  let mockDB: MockIDBDatabase;

  beforeEach(() => {
    mockDB = new MockIDBDatabase();
    (globalThis as any).indexedDB = {
      open: () => {
        const req: any = {
          result: mockDB,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      },
    };
  });

  it("saves and retrieves video clips ordered by createdAt", async () => {
    const clip1: SavedVideoClip = {
      id: "clip-1",
      title: "Attentive Nodding",
      videoDataUrl: "data:video/webm;base64,AAA=",
      durationSeconds: 3.2,
      thumbnailDataUrl: "data:image/jpeg;base64,BBB=",
      createdAt: 1000,
    };

    const clip2: SavedVideoClip = {
      id: "clip-2",
      title: "Sipping Coffee",
      videoDataUrl: "data:video/webm;base64,CCC=",
      durationSeconds: 5.0,
      thumbnailDataUrl: "data:image/jpeg;base64,DDD=",
      createdAt: 2000,
    };

    await saveClip(clip1);
    await saveClip(clip2);

    const clips = await getAllClips();
    expect(clips.length).toBe(2);
    // Newest first
    expect(clips[0].id).toBe("clip-2");
    expect(clips[1].id).toBe("clip-1");

    const single = await getClip("clip-1");
    expect(single?.title).toBe("Attentive Nodding");
  });

  it("deletes clips properly", async () => {
    const clip: SavedVideoClip = {
      id: "clip-to-delete",
      title: "Scratching chin",
      videoDataUrl: "data:video/webm;base64,EEE=",
      durationSeconds: 2.1,
      thumbnailDataUrl: "data:image/jpeg;base64,FFF=",
      createdAt: 3000,
    };

    await saveClip(clip);
    let clips = await getAllClips();
    expect(clips.length).toBe(1);

    await deleteClip("clip-to-delete");
    clips = await getAllClips();
    expect(clips.length).toBe(0);
  });
});
