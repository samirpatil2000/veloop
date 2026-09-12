# Architecture

## Goals

Preserve the behavior of the original Python Video Pedal while moving the media
pipeline into browser-native primitives.

## Boundaries

### Core

Pure TypeScript. No Chrome APIs.

- state machine
- bounded loop buffer
- crossfade/compositing primitives
- settings/types

### Offscreen document

Owns DOM/media APIs unavailable to the MV3 service worker.

- canvas
- MediaStream
- render loop
- future MediaRecorder/WebCodecs work

Chrome's offscreen document is the intended long-lived media execution context.

### Content bridge

Runs in the isolated world and relays messages between the page and extension.

### Main-world bridge

Runs in the page's execution world for WebRTC instrumentation/interception.

It must remain extremely small and should never receive privileged extension capabilities.

### Site adapters

Encapsulate site-specific behavior. The generic adapter is the first target.

### Native companion

Future layer for a true OS-level virtual camera. Video frames must not be
pushed through Native Messaging; that channel is reserved for control/status.
