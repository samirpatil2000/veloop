(() => {
  if ((window as unknown as { __videoPedalInstalled?: boolean }).__videoPedalInstalled) {
    return;
  }
  (window as unknown as { __videoPedalInstalled: boolean }).__videoPedalInstalled = true;

  type PedalState = "LIVE" | "RECORDING" | "LOOPING";

  let currentState: PedalState = "LIVE";
  let maxRecordingSeconds = 30;
  let minRecordingSeconds = 0.3;
  let crossfadeSeconds = 0.5;
  let fps = 30;

  // Active loop frames
  let recordedBitmaps: ImageBitmap[] = [];
  let recordBuffer: ImageBitmap[] = [];
  let loopPlaybackIndex = 0;
  let isRecording = false;

  // Dissolve state (when returning to LIVE from LOOPING)
  let dissolveFramesRemaining = 0;
  let totalDissolveFrames = 0;

  // Active video & canvas pipeline
  let liveVideo: HTMLVideoElement | null = null;
  let compositorCanvas: HTMLCanvasElement | null = null;
  let compositorCtx: CanvasRenderingContext2D | null = null;
  let animFrameId: number | null = null;
  let lastFrameTime = 0;

  // Hardware camera management
  const allActiveVideoTracks = new Set<MediaStreamTrack>();
  let savedConstraints: MediaStreamConstraints | undefined = undefined;
  let currentRawStream: MediaStream | null = null;
  let currentRawVideoTrack: MediaStreamTrack | null = null;
  let syntheticVideoTrack: MediaStreamTrack | null = null;
  let isIntentionalCameraStandby = false;
  let isAcquiringCamera = false;

  function broadcastState(state: PedalState) {
    currentState = state;
    window.postMessage(
      {
        source: "video-pedal-page",
        type: "PEDAL_STATE_CHANGED",
        payload: {
          state,
          framesCount: recordedBitmaps.length,
        },
      },
      "*",
    );
  }

  function releaseHardwareCamera(): void {
    isIntentionalCameraStandby = true;

    for (const track of allActiveVideoTracks) {
      try {
        track.stop();
        track.enabled = false;
      } catch {
        // ignore
      }
    }
    allActiveVideoTracks.clear();

    if (currentRawVideoTrack) {
      try {
        currentRawVideoTrack.stop();
        currentRawVideoTrack.enabled = false;
      } catch {
        // ignore
      }
      currentRawVideoTrack = null;
    }

    if (currentRawStream) {
      for (const t of currentRawStream.getVideoTracks()) {
        try {
          t.stop();
          t.enabled = false;
        } catch {
          // ignore
        }
      }
      currentRawStream = null;
    }

    if (liveVideo) {
      liveVideo.pause();
      liveVideo.srcObject = null;
      liveVideo.removeAttribute("src");
      liveVideo.load();
      if (liveVideo.parentNode) {
        liveVideo.parentNode.removeChild(liveVideo);
      }
      liveVideo = null;
    }

    console.log("[Video Pedal] Hardware camera completely released and detached (LED should be OFF)");
  }

  async function acquireHardwareCamera(): Promise<boolean> {
    if (isAcquiringCamera) return false;
    if (
      currentRawVideoTrack &&
      currentRawVideoTrack.readyState === "live" &&
      liveVideo &&
      liveVideo.readyState >= 2
    ) {
      return true;
    }

    if (!originalGetUserMedia) return false;

    isAcquiringCamera = true;
    try {
      const videoConstraints = savedConstraints?.video ?? true;
      const stream = await originalGetUserMedia({
        video: videoConstraints,
        audio: false,
      });

      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length === 0) {
        return false;
      }

      currentRawStream = stream;
      currentRawVideoTrack = videoTracks[0];
      for (const t of videoTracks) {
        allActiveVideoTracks.add(t);
      }
      isIntentionalCameraStandby = false;

      currentRawVideoTrack.addEventListener("ended", () => {
        if (isIntentionalCameraStandby) return;
        syntheticVideoTrack?.stop();
        if (animFrameId) cancelAnimationFrame(animFrameId);
      });

      if (!liveVideo) {
        liveVideo = document.createElement("video");
        liveVideo.muted = true;
        liveVideo.playsInline = true;
        liveVideo.autoplay = true;
        liveVideo.style.display = "none";
        (document.body || document.documentElement).appendChild(liveVideo);
      }

      liveVideo.srcObject = stream;

      await new Promise<void>((resolve) => {
        if (!liveVideo) return resolve();
        if (liveVideo.readyState >= 2) return resolve();
        liveVideo.onloadeddata = () => resolve();
        setTimeout(resolve, 1500);
      });

      try {
        await liveVideo.play();
      } catch {
        // ignore
      }

      console.log("[Video Pedal] Hardware camera re-acquired (LED on)");
      return true;
    } catch (err) {
      console.error("[Video Pedal] Failed to re-acquire camera:", err);
      return false;
    } finally {
      isAcquiringCamera = false;
    }
  }

  async function ensureCameraAcquired(): Promise<boolean> {
    if (
      currentRawVideoTrack &&
      currentRawVideoTrack.readyState === "live" &&
      liveVideo &&
      liveVideo.readyState >= 2
    ) {
      return true;
    }
    return await acquireHardwareCamera();
  }

  async function startRecording(): Promise<void> {
    // Clear dissolve if any
    dissolveFramesRemaining = 0;

    if (!currentRawVideoTrack || currentRawVideoTrack.readyState !== "live") {
      const ok = await ensureCameraAcquired();
      if (!ok) {
        console.warn("[Video Pedal] Cannot record: Camera hardware unavailable");
        return;
      }
    }

    // Clear previous recordings
    for (const b of recordedBitmaps) b.close();
    for (const b of recordBuffer) b.close();
    recordedBitmaps = [];
    recordBuffer = [];
    loopPlaybackIndex = 0;
    isRecording = true;
    broadcastState("RECORDING");
    console.log("[Video Pedal] REC: Recording camera frames");
  }

  function stopRecordingAndLoop(): void {
    if (!isRecording) return;
    isRecording = false;

    const minFrames = Math.max(1, Math.floor(minRecordingSeconds * fps));
    if (recordBuffer.length >= minFrames) {
      recordedBitmaps = recordBuffer;
      recordBuffer = [];

      // Replicate haxybaxy/video-pedal loop start:
      // Start playback near the end so the first seam dissolve flows naturally from live
      const seamFrames = Math.floor(crossfadeSeconds * fps);
      const k = Math.min(seamFrames, Math.floor(recordedBitmaps.length / 2));
      loopPlaybackIndex = k > 0 ? recordedBitmaps.length - k - 1 : 0;

      broadcastState("LOOPING");
      console.log(
        `[Video Pedal] LOOP: Playing ${recordedBitmaps.length} frames (${(recordedBitmaps.length / fps).toFixed(1)}s loop) with seamless crossfade`,
      );

      // Release hardware camera to turn off camera LED and conserve resources
      releaseHardwareCamera();
    } else {
      for (const b of recordBuffer) b.close();
      recordBuffer = [];
      broadcastState("LIVE");
      console.log("[Video Pedal] Hold too short, discarded loop");
    }
  }

  async function goLive(): Promise<void> {
    if (currentState === "LIVE") return;

    if (currentState === "RECORDING") {
      isRecording = false;
      for (const b of recordBuffer) b.close();
      recordBuffer = [];
      broadcastState("LIVE");
      console.log("[Video Pedal] LIVE: Recording canceled");
      return;
    }

    if (currentState === "LOOPING") {
      if (isAcquiringCamera) return;

      // Re-acquire camera hardware while loop continues running seamlessly
      const ok = await acquireHardwareCamera();
      if (!ok) {
        console.error("[Video Pedal] Could not re-acquire camera to return live");
        return;
      }

      if (crossfadeSeconds > 0 && recordedBitmaps.length > 0) {
        // Start dissolve transition over crossfade duration
        totalDissolveFrames = Math.max(1, Math.floor(crossfadeSeconds * fps));
        dissolveFramesRemaining = totalDissolveFrames;
        console.log(
          `[Video Pedal] Dissolving loop into live feed over ${crossfadeSeconds}s (${totalDissolveFrames} frames)`,
        );
        return;
      }

      // Direct cut to LIVE
      finishGoLive();
    }
  }

  function finishGoLive(): void {
    dissolveFramesRemaining = 0;
    for (const b of recordedBitmaps) b.close();
    for (const b of recordBuffer) b.close();
    recordedBitmaps = [];
    recordBuffer = [];
    loopPlaybackIndex = 0;
    broadcastState("LIVE");
    console.log("[Video Pedal] LIVE: Stream is live");
  }

  function toggleRecord(): void {
    if (currentState === "LIVE") {
      void startRecording();
    } else if (currentState === "RECORDING") {
      stopRecordingAndLoop();
    } else if (currentState === "LOOPING") {
      void startRecording();
    }
  }

  // Exact haxybaxy/video-pedal keyboard bindings:
  // - Hold Right Alt (or Option) to record, release to loop
  // - Press Right Command to go live
  // - Or 'r' to toggle record, 'l' to go live
  let altRightPressed = false;

  window.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }

    if ((e.code === "AltRight" || e.key === "AltGraph") && !altRightPressed) {
      altRightPressed = true;
      e.preventDefault();
      void startRecording();
    } else if (e.code === "MetaRight" || e.code === "OSRight") {
      e.preventDefault();
      void goLive();
    } else if (e.key === "r" || e.key === "R") {
      toggleRecord();
    } else if (e.key === "l" || e.key === "L") {
      void goLive();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "AltRight" || e.key === "AltGraph") {
      if (altRightPressed) {
        altRightPressed = false;
        e.preventDefault();
        stopRecordingAndLoop();
      }
    }
  });

  // Listen for commands from extension content script
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "video-pedal-extension") return;

    const { type, payload } = event.data;
    if (type === "PEDAL_TOGGLE_RECORD") {
      toggleRecord();
    } else if (type === "PEDAL_START_RECORD") {
      void startRecording();
    } else if (type === "PEDAL_STOP_RECORD") {
      stopRecordingAndLoop();
    } else if (type === "PEDAL_GO_LIVE") {
      void goLive();
    } else if (type === "PEDAL_GET_STATE") {
      broadcastState(currentState);
    } else if (type === "PEDAL_UPDATE_SETTINGS" && payload) {
      if (payload.maxRecordingSeconds) maxRecordingSeconds = payload.maxRecordingSeconds;
      if (payload.minRecordingSeconds) minRecordingSeconds = payload.minRecordingSeconds;
      if (payload.crossfadeSeconds) crossfadeSeconds = payload.crossfadeSeconds;
    }
  });

  const originalGetUserMedia =
    navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);

  if (!originalGetUserMedia) return;

  navigator.mediaDevices.getUserMedia = async function (
    constraints?: MediaStreamConstraints,
  ): Promise<MediaStream> {
    const rawStream = await originalGetUserMedia(constraints);

    // If no video requested, return unmodified stream
    if (!constraints || !constraints.video) {
      return rawStream;
    }

    const rawVideoTracks = rawStream.getVideoTracks();
    if (rawVideoTracks.length === 0) {
      return rawStream;
    }

    // Stop any existing active raw tracks before starting new stream
    for (const t of allActiveVideoTracks) {
      try {
        t.stop();
        t.enabled = false;
      } catch {}
    }
    allActiveVideoTracks.clear();

    savedConstraints = constraints;
    currentRawStream = rawStream;
    currentRawVideoTrack = rawVideoTracks[0];
    for (const t of rawVideoTracks) {
      allActiveVideoTracks.add(t);
    }
    isIntentionalCameraStandby = false;

    const rawVideoTrack = rawVideoTracks[0];
    const trackSettings = rawVideoTrack.getSettings();
    const width = trackSettings.width || 1280;
    const height = trackSettings.height || 720;
    const trackFps = trackSettings.frameRate || 30;
    fps = trackFps;

    // Create offscreen video element for real camera stream
    if (liveVideo) {
      liveVideo.pause();
      liveVideo.srcObject = null;
      liveVideo.removeAttribute("src");
      liveVideo.load();
      if (liveVideo.parentNode) liveVideo.parentNode.removeChild(liveVideo);
      liveVideo = null;
    }

    liveVideo = document.createElement("video");
    liveVideo.muted = true;
    liveVideo.playsInline = true;
    liveVideo.autoplay = true;
    liveVideo.srcObject = rawStream;
    liveVideo.style.display = "none";
    (document.body || document.documentElement).appendChild(liveVideo);

    await new Promise<void>((resolve) => {
      if (!liveVideo) return resolve();
      if (liveVideo.readyState >= 2) return resolve();
      liveVideo.onloadedmetadata = () => resolve();
      setTimeout(resolve, 500);
    });

    try {
      await liveVideo.play();
    } catch {
      // ignore
    }

    // Create compositor canvas
    if (compositorCanvas) compositorCanvas.remove();
    compositorCanvas = document.createElement("canvas");
    compositorCanvas.width = width;
    compositorCanvas.height = height;
    compositorCanvas.style.display = "none";
    (document.body || document.documentElement).appendChild(compositorCanvas);

    compositorCtx = compositorCanvas.getContext("2d", { alpha: false, desynchronized: true });

    // Obtain synthetic MediaStream from the canvas
    const canvasStream = compositorCanvas.captureStream(fps);
    syntheticVideoTrack = canvasStream.getVideoTracks()[0];

    // Delegate track enable/disable and constraints to raw track safely
    syntheticVideoTrack.applyConstraints = async (c) => {
      savedConstraints = { ...savedConstraints, ...c };
      if (currentRawVideoTrack && currentRawVideoTrack.readyState === "live") {
        return currentRawVideoTrack.applyConstraints(c);
      }
      return Promise.resolve();
    };

    // Handle track lifecycle
    rawVideoTrack.addEventListener("ended", () => {
      if (isIntentionalCameraStandby) return;
      syntheticVideoTrack?.stop();
      if (animFrameId) cancelAnimationFrame(animFrameId);
    });

    syntheticVideoTrack.addEventListener("ended", () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      releaseHardwareCamera();
    });

    const maxFrames = Math.max(10, Math.floor(maxRecordingSeconds * fps));

    function renderLoop(timestamp: number) {
      animFrameId = requestAnimationFrame(renderLoop);

      if (!compositorCtx || !compositorCanvas) return;

      const delta = timestamp - lastFrameTime;
      const targetInterval = 1000 / fps;
      if (delta < targetInterval - 4) return;
      lastFrameTime = timestamp;

      const w = compositorCanvas.width;
      const h = compositorCanvas.height;

      // Check if we are dissolving back to LIVE
      if (dissolveFramesRemaining > 0 && recordedBitmaps.length > 0) {
        // Render loop frame
        const frame = recordedBitmaps[loopPlaybackIndex];
        if (frame) {
          compositorCtx.globalAlpha = 1.0;
          compositorCtx.drawImage(frame, 0, 0, w, h);
          loopPlaybackIndex = (loopPlaybackIndex + 1) % recordedBitmaps.length;
        }

        // Dissolve live frame on top
        if (liveVideo && liveVideo.readyState >= 2) {
          const liveAlpha = (totalDissolveFrames - dissolveFramesRemaining + 1) / (totalDissolveFrames + 1);
          compositorCtx.globalAlpha = Math.min(1, Math.max(0, liveAlpha));
          compositorCtx.drawImage(liveVideo, 0, 0, w, h);
          compositorCtx.globalAlpha = 1.0;
        }

        dissolveFramesRemaining--;
        if (dissolveFramesRemaining === 0) {
          finishGoLive();
        }
        return;
      }

      if (currentState === "LOOPING" && recordedBitmaps.length > 0) {
        const n = recordedBitmaps.length;
        const seamK = Math.min(Math.floor(crossfadeSeconds * fps), Math.floor(n / 2));

        // Seamless seam dissolve: if in the last seamK frames, dissolve into the first seamK frames
        if (seamK > 0 && loopPlaybackIndex >= n - seamK) {
          const seamIdx = loopPlaybackIndex - (n - seamK);
          const alphaHead = (seamIdx + 1) / (seamK + 1);
          const tailFrame = recordedBitmaps[loopPlaybackIndex];
          const headFrame = recordedBitmaps[seamIdx];

          compositorCtx.globalAlpha = 1.0;
          if (tailFrame) compositorCtx.drawImage(tailFrame, 0, 0, w, h);

          if (headFrame && alphaHead > 0) {
            compositorCtx.globalAlpha = Math.min(1, Math.max(0, alphaHead));
            compositorCtx.drawImage(headFrame, 0, 0, w, h);
            compositorCtx.globalAlpha = 1.0;
          }
        } else {
          const frame = recordedBitmaps[loopPlaybackIndex];
          if (frame) {
            compositorCtx.globalAlpha = 1.0;
            compositorCtx.drawImage(frame, 0, 0, w, h);
          }
        }

        loopPlaybackIndex = (loopPlaybackIndex + 1) % n;
      } else {
        // LIVE or RECORDING: render camera
        if (liveVideo && liveVideo.readyState >= 2) {
          compositorCtx.globalAlpha = 1.0;
          compositorCtx.drawImage(liveVideo, 0, 0, w, h);

          if (isRecording) {
            try {
              createImageBitmap(liveVideo).then((bitmap) => {
                if (!isRecording) {
                  bitmap.close();
                  return;
                }
                recordBuffer.push(bitmap);
                if (recordBuffer.length > maxFrames) {
                  const dropped = recordBuffer.shift();
                  if (dropped) dropped.close();
                }
              });
            } catch {
              // ignore
            }
          }
        }
      }
    }

    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(renderLoop);

    // Build synthetic MediaStream with our video track and original audio tracks
    const compositeStream = new MediaStream();
    compositeStream.addTrack(syntheticVideoTrack);
    for (const audioTrack of rawStream.getAudioTracks()) {
      compositeStream.addTrack(audioTrack);
    }

    console.log("[Video Pedal] Successfully replaced camera feed with video pedal compositor");
    broadcastState("LIVE");
    return compositeStream;
  };
})();
