
## Features

- Real-time face & eyebrow detection via webcam
- **5 Shape types**: Natural, Arch, Straight, Rounded, Sharp
- **5 Sticker types**: Bold, Feather, Tapered, Micro, Brushed
- Freehand drawing on eyebrows
- Adjustable: thickness, arch height, Y position, opacity
- 8-color palette
- Done → Reveal screen with Save Image
- Touch support (mobile browsers)

## Quick Start

```bash
npx serve .
# Open http://localhost:3000
```

## Deploy to Vercel

```bash
npx vercel
```

## Embed via iframe

```html
<iframe
  src="https://-vercel-url.vercel.app"
  width="660"
  height="700"
  allow="camera"
></iframe>
```

> `allow="camera"` is required for webcam access inside iframe.

## Future Integration (Direct)

If you want to integrate eyebrow detection directly into your webapp instead of iframe:

### 1. Install MediaPipe (already loaded via CDN, no install needed)

### 2. Copy these files into your project:
- `detector.js` — Face mesh detector + eyebrow landmark indices
- `renderer.js` — All drawing logic (shapes, stickers, hair strokes, highlights)

### 3. Import and use:

```js
import { FaceMeshDetector } from './detector.js';
import { drawDetections } from './renderer.js';

// Initialize
const detector = new FaceMeshDetector();
await detector.init();

// In your render loop
const faces = await detector.detect(videoElement);
drawDetections(canvasCtx, faces, {
  showLandmarks: false,
  shapeType: 'natural',    // natural | arch | straight | rounded | sharp | sticker
  stickerType: null,        // bold | feather | tapered | micro | brushed
  browColor: '#4A2C0A',
  opacity: 75,              // 0-100
  thickness: 10,            // 3-25
  archHeight: 0,            // -10 to 20
  offsetY: 0,               // -30 to 30
});
```

### 4. Combine with your filters

Render on the same canvas in order:
1. Video frame → `ctx.drawImage(video, 0, 0)`
2. Your filters (skin smooth, lipstick, etc.)
3. Eyebrow overlay → `drawDetections(ctx, faces, opts)`

### Communication via postMessage (if using iframe)

```js
// Parent app → iframe
iframe.contentWindow.postMessage({ shapeType: 'arch', browColor: '#8B5E3C' }, '*');

// Inside Brow Royale (add listener in app.js)
window.addEventListener('message', (e) => {
  if (e.data.shapeType) state.shapeType = e.data.shapeType;
  if (e.data.browColor) state.browColor = e.data.browColor;
});
```

## Tech Stack

- MediaPipe Face Mesh (468 landmarks, runs on GPU via WebAssembly)
- Vanilla JS (no framework)
- Canvas 2D API

