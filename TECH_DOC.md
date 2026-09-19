# Veloop — Technical Architecture & Implementation Documentation

## 1. Overview & Architecture

Veloop is an in-browser digital video loop pedal and soundboard designed for WebRTC video calling applications (Google Meet, Zoom Web, Microsoft Teams, Webex, Discord, Whereby). 

Unlike legacy virtual camera software (e.g., OBS Virtual Camera, Camo, ManyCam) which requires system-level kernel extensions, virtual video drivers, high CPU overhead, and leaves hardware webcam LEDs illuminated, Veloop operates entirely within Google Chrome using native Web APIs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WebRTC Application Page                           │
│                      (meet.google.com, zoom.us, etc.)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   navigator.mediaDevices.getUserMedia() [Intercepted in MAIN World]         │
│                                │                                            │
│                                ▼                                            │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      Veloop Page Bridge                             │   │
│   │                                                                     │   │
│   │   ┌──────────────────┐               ┌──────────────────────────┐   │   │
│   │   │  Hardware Camera │               │  Offscreen 2D Compositor │   │   │
│   │   │  MediaStream     │               │  Canvas (30 FPS)         │   │   │
│   │   └─────────┬────────┘               └────────────┬─────────────┘   │   │
│   │             │                                     │                 │   │
│   │             ▼                                     ▼                 │   │
│   │     [Frame Capture] ──► Loop Buffer ──► [Compositor Draw]           │   │
│   │             │                                     │                 │   │
│   │      releaseHardwareCamera()                      ▼                 │   │
│   │     (Turns webcam LED OFF)               canvas.captureStream()     │   │
│   │                                                   │                 │   │
│   └───────────────────────────────────────────────────┼─────────────────┘   │
│                                                       ▼                     │
│                                             Synthetic MediaStream           │
│                                          (Passed to WebRTC Call)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Subsystems

### 2.1 WebRTC `getUserMedia` Interception

Veloop injects `page-bridge.js` into the page's execution environment (`world: "MAIN"` at `document_start`). It proxies `navigator.mediaDevices.getUserMedia`:

1. **Synthetic Stream Handshake:** When the web application calls `getUserMedia({ video: true, ... })`, Veloop captures the caller's constraints.
2. **Hidden Video Sink:** The real hardware video stream is routed into a hidden `<video>` element (`liveVideo`) in DOM memory rather than directly to the web app.
3. **Canvas Capture Stream:** An offscreen HTML5 `<canvas>` element generates a synthetic `MediaStream` via `canvas.captureStream(30)`.
4. **Transparent Proxy:** The application receives the synthetic `MediaStreamTrack`. From Google Meet's perspective, this is a standard video track indistinguishable from a hardware camera.

### 2.2 Hardware Camera Power Management (LED Extinction)

A primary design requirement of Veloop is physical camera indicator light extinction:

* When a loop or preset starts playing, the user is no longer streaming live video.
* `releaseHardwareCamera()` iterates through all active physical `MediaStreamTrack` instances and calls `track.stop()`.
* **Hardware Result:** On macOS, Windows, and Linux, invoking `.stop()` on the underlying OS video track shuts off the camera sensor and immediately turns off the green hardware indicator LED.
* **Stream Persistence:** The synthetic canvas track remains active and continues piping frames to the WebRTC peer connection, preventing the call from dropping or displaying an "empty track" error.

### 2.3 Pedal State Machine & Buffering

The state machine transitions deterministically between five operational states:

```
                  ┌───────────────┐
                  │     LIVE      │ ◄──────────────────────┐
                  └───────┬───────┘                        │
                          │                                │
                 Pedal Down (Right Alt)           Right Cmd / 'L'
                          │                       (Alpha Dissolve)
                          ▼                                │
                  ┌───────────────┐                        │
                  │   RECORDING   │                        │
                  └───────┬───────┘                        │
                          │                                │
                 Pedal Up (Release)                        │
                          ▼                                │
                  ┌───────────────┐                        │
                  │    LOOPING    │ ───────────────────────┤
                  └───────┬───────┘                        │
                          │                                │
                 Trigger Preset (1-9)                      │
                          ▼                                │
                  ┌───────────────┐                        │
                  │   REPLAYING   │ ───────────────────────┘
                  └───────────────┘
```

* **Frame Buffer (`loop-buffer.ts`):** While recording, uncompressed `ImageBitmap` frames are captured into a bounded ring buffer in memory for instantaneous zero-latency looping.
* **WebM Encoding (`MediaRecorder`):** Concurrently, chunks are compressed into WebM format via browser-accelerated `MediaRecorder` for persistent preset storage.

### 2.4 Seamless Seam Dissolve (Alpha Blending)

To prevent visual jump cuts when returning from a loop to live video:

1. When the user hits <kbd>Right Command</kbd> or <kbd>L</kbd>, Veloop re-acquires the physical camera via `navigator.mediaDevices.getUserMedia(savedConstraints)` in the background.
2. The compositor initiates an alpha-blended crossfade over a configurable window (default `0.5s`, up to `3.0s`).
3. Frame rendering blends:
   $$\text{Frame}_{\text{out}} = (\alpha \times \text{LiveFrame}) + ((1 - \alpha) \times \text{LoopFrame})$$
4. Once $\alpha = 1.0$, the compositor switches fully to the live camera and releases the loop buffer.

### 2.5 Soundboard Presets & Local Storage

* **IndexedDB Clip Store (`clip-store.ts`):** Loops can be named and saved as soundboard cards.
* **Storage Format:** Presets are stored locally as Base64/DataURL WebM video blobs accompanied by canvas-generated thumbnail data URLs.
* **Privacy Guarantee:** 100% client-side storage. No video data, metadata, or telemetry is ever transmitted to remote servers.

---

## 3. Video Durations & Timing Specifications

| Parameter | Default | Configurable Range | Description |
|---|---|---|---|
| **Maximum Loop Duration** | `30s` | `1s` – `120s` (2 min) | Upper limit on recorded loop length. Automatically begins looping if exceeded. |
| **Minimum Recording Threshold** | `1.0s` | `0.1s` – `5.0s` | Discards accidental pedal taps shorter than this threshold. |
| **Crossfade Dissolve Time** | `0.5s` | `0.0s` – `3.0s` | Duration of the alpha-blended crossfade when returning to live camera. |
| **Compositor Frame Rate** | `30 FPS` | Fixed (30 FPS) | Target output rate of the synthetic canvas stream. |
| **Preview Overlay Opacity** | `50%` | `0%` – `100%` | Semi-transparent alignment ghosting used in options/preview. |

---

## 4. Hardware & Keyboard Controls

| Control | Target Key | Action |
|---|---|---|
| **Pedal Down / Up** | <kbd>Right Option / Alt</kbd> (Hold & Release) | Hold to buffer frames, release to immediately start looping. |
| **Go Live** | <kbd>Right Command</kbd> or <kbd>L</kbd> | Triggers background camera re-acquisition and alpha crossfade to live. |
| **Toggle Record** | <kbd>R</kbd> | Alternate toggle for start/stop recording without holding. |
| **Trigger Preset** | <kbd>1</kbd> – <kbd>9</kbd> (Popup) | Instant replay of saved soundboard preset cards. |

*Compatible with standard USB foot switches that send keyboard keystrokes.*

---

## 5. Project Structure

```
veloop/
├── manifest.json              # Chrome Manifest V3 configuration & permissions
├── package.json               # Project dependencies & build scripts
├── extension/
│   ├── icons/                 # Official extension branding (16, 32, 48, 128px PNG)
│   └── src/
│       ├── background/
│       │   └── service-worker.ts  # Extension lifecycle & tab message routing
│       ├── content/
│       │   └── bridge.ts          # Isolated world <-> Main world communication relay
│       ├── page/
│       │   └── page-bridge.ts     # WebRTC getUserMedia interceptor & canvas compositor
│       ├── core/
│       │   ├── clip-store.ts      # IndexedDB storage manager for saved video presets
│       │   ├── loop-buffer.ts     # Bounded in-memory frame buffer
│       │   ├── state-machine.ts   # Deterministic pedal state machine
│       │   └── types.ts           # Shared TypeScript interfaces & types
│       ├── popup/
│       │   ├── popup.html         # Soundboard preset board UI
│       │   ├── popup.css          # Sleek obsidian tactile styles
│       │   └── popup.ts           # Preset playback & save controller
│       └── options/
│           ├── options.html       # Studio dark-mode settings panel
│           ├── options.css        # Studio preferences styling & dual sliders
│           └── options.ts         # Settings sync & persistence
├── store-assets/              # Chrome Web Store promotional images (1280x800, 440x280)
├── scripts/
│   ├── build.mjs              # Esbuild bundler & zip packager
│   └── generate-assets.py     # Python vector asset & promo image generator
└── tests/                     # Vitest unit tests (state-machine, buffer, clip-store)
```

---

## 6. Security & Privacy Guarantees

1. **Zero External Network Calls:** The extension manifest requests no external connect permissions (`connect-src` restricted). No telemetry, analytics, or media packets ever leave the browser.
2. **Local Sandboxing:** All video clips exist solely within the user's local browser `IndexedDB`.
3. **Scoped Content Script Execution:** Injection is restricted strictly to verified WebRTC meeting domains (`meet.google.com`, `zoom.us`, `teams.microsoft.com`, `teams.live.com`, `webex.com`, `discord.com`, `whereby.com`).
