/*
 * MAIN-world experiment.
 *
 * This deliberately does not replace getUserMedia yet.
 * The first implementation milestone is instrumentation and capability
 * detection, followed by a controlled synthetic-stream replacement.
 */

(() => {
  if ((window as unknown as { __videoPedalInstalled?: boolean }).__videoPedalInstalled) {
    return;
  }

  (window as unknown as { __videoPedalInstalled: boolean }).__videoPedalInstalled = true;

  const originalGetUserMedia =
    navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);

  if (!originalGetUserMedia) return;

  navigator.mediaDevices.getUserMedia = async function (
    constraints: MediaStreamConstraints,
  ): Promise<MediaStream> {
    window.postMessage(
      {
        source: "video-pedal-page",
        type: "GUM_REQUEST",
        payload: {
          video: Boolean(constraints.video),
          audio: Boolean(constraints.audio),
        },
      },
      "*",
    );

    return originalGetUserMedia(constraints);
  };
})();
