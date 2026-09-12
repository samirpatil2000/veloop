import { MediaEngine } from "./media-engine";

const engine = new MediaEngine();

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "GET_OUTPUT_STREAM") {
    // MediaStream objects cannot be serialized through runtime messaging.
    // This endpoint is intentionally a control-plane placeholder.
    // The next spike will establish the page-side media bridge.
    void engine;
  }
});
