# Veloop

Instant video soundboard & loop pedal for Chrome (Google Meet, Zoom, and WebRTC calls).

## Status

Phase 0/1 technical spike:
- Manifest V3 extension skeleton
- Service worker + offscreen media engine
- Typed core state machine
- Bounded loop buffer
- Canvas compositor
- Popup/settings UI
- Vitest unit tests
- No native virtual-camera dependency yet

## Important architecture

The extension separates:
1. **Core loop engine** — deterministic and browser-independent.
2. **Offscreen media engine** — owns canvas/media rendering.
3. **Page/content bridge** — site integration boundary.
4. **Site adapters** — future Google Meet/Zoom/Teams integrations.
5. **Native companion** — future system-wide virtual camera.

The first technical milestone is proving that a synthetic `MediaStream` generated from a canvas can be supplied to a controlled WebRTC page reliably.

## Development

Requires Node.js 20+.

```bash
npm install
npm test
npm run build
```

Load `dist/` in Chrome at `chrome://extensions` with Developer mode enabled.

This project intentionally does not claim that arbitrary websites or system-wide apps are supported yet.
