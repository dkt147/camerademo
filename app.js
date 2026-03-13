import { FaceMeshDetector } from './detector.js';
import { drawDetections } from './renderer.js';

// ── DOM refs ──
const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay');
const freehandCanvas = document.getElementById('freehandCanvas');
const ctx = canvas.getContext('2d');
const fctx = freehandCanvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const showLandmarks = document.getElementById('showLandmarks');
const statusBadge = document.getElementById('statusBadge');
const doneBtn = document.getElementById('doneBtn');

// Adjust controls
const thicknessEl = document.getElementById('thickness');
const archHeightEl = document.getElementById('archHeight');
const offsetYEl = document.getElementById('offsetY');
const opacityEl = document.getElementById('opacity');
const freehandSizeEl = document.getElementById('freehandSize');
const clearFreehandBtn = document.getElementById('clearFreehand');

let detector = null;
let stream = null;
let animFrameId = null;
let hasFace = false;

// ── State (mirrors Flutter BrowState) ──
const state = {
  shapeType: 'natural',
  stickerType: null,
  browColor: '#1A1A1A',
  opacity: 75,
  thickness: 10,
  archHeight: 0,
  offsetY: 0,
};

// ── Tab switching ──
let activeTab = 'shape';
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const id = tab.dataset.tab;
    activeTab = id;
    document.getElementById(`tab-${id}`).classList.add('active');

    // Enable freehand canvas only on draw tab
    if (id === 'draw') {
      freehandCanvas.classList.add('drawing');
    } else {
      freehandCanvas.classList.remove('drawing');
    }
  });
});

// ── Shape buttons ──
document.querySelectorAll('.shape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.shapeType = btn.dataset.shape;
    // Deactivate sticker buttons
    document.querySelectorAll('.sticker-btn').forEach(b => b.classList.remove('active'));
    state.stickerType = null;
  });
});

// ── Sticker buttons ──
document.querySelectorAll('.sticker-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sticker-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.shapeType = 'sticker';
    state.stickerType = btn.dataset.sticker;
  });
});

// ── Color palette ──
document.querySelectorAll('.color-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    state.browColor = dot.dataset.color;
  });
});

// ── Freehand drawing ──
let isDrawing = false;
freehandCanvas.addEventListener('mousedown', (e) => {
  if (activeTab !== 'draw') return;
  isDrawing = true;
  fctx.strokeStyle = state.browColor;
  fctx.lineWidth = parseInt(freehandSizeEl.value);
  fctx.lineCap = 'round';
  fctx.lineJoin = 'round';
  fctx.globalAlpha = state.opacity / 100;
  fctx.beginPath();
  fctx.moveTo(e.offsetX * (freehandCanvas.width / freehandCanvas.clientWidth),
              e.offsetY * (freehandCanvas.height / freehandCanvas.clientHeight));
});

freehandCanvas.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  const sx = e.offsetX * (freehandCanvas.width / freehandCanvas.clientWidth);
  const sy = e.offsetY * (freehandCanvas.height / freehandCanvas.clientHeight);
  fctx.lineTo(sx, sy);
  fctx.stroke();
});

freehandCanvas.addEventListener('mouseup', () => { isDrawing = false; });
freehandCanvas.addEventListener('mouseleave', () => { isDrawing = false; });

// Touch support for freehand
freehandCanvas.addEventListener('touchstart', (e) => {
  if (activeTab !== 'draw') return;
  e.preventDefault();
  isDrawing = true;
  const rect = freehandCanvas.getBoundingClientRect();
  const touch = e.touches[0];
  fctx.strokeStyle = state.browColor;
  fctx.lineWidth = parseInt(freehandSizeEl.value);
  fctx.lineCap = 'round';
  fctx.lineJoin = 'round';
  fctx.globalAlpha = state.opacity / 100;
  fctx.beginPath();
  fctx.moveTo((touch.clientX - rect.left) * (freehandCanvas.width / rect.width),
              (touch.clientY - rect.top) * (freehandCanvas.height / rect.height));
}, { passive: false });

freehandCanvas.addEventListener('touchmove', (e) => {
  if (!isDrawing) return;
  e.preventDefault();
  const rect = freehandCanvas.getBoundingClientRect();
  const touch = e.touches[0];
  fctx.lineTo((touch.clientX - rect.left) * (freehandCanvas.width / rect.width),
              (touch.clientY - rect.top) * (freehandCanvas.height / rect.height));
  fctx.stroke();
}, { passive: false });

freehandCanvas.addEventListener('touchend', () => { isDrawing = false; });

clearFreehandBtn.addEventListener('click', () => {
  fctx.clearRect(0, 0, freehandCanvas.width, freehandCanvas.height);
});

// ── Camera ──
async function startCamera() {
  statusBadge.textContent = 'Starting camera...';
  statusBadge.classList.remove('detected');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' }
    });
    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    freehandCanvas.width = video.videoWidth;
    freehandCanvas.height = video.videoHeight;

    startBtn.disabled = true;
    stopBtn.disabled = false;

    statusBadge.textContent = 'Loading face detection model...';
    detector = new FaceMeshDetector();
    await detector.init();

    statusBadge.textContent = 'Scanning for face...';
    detectLoop();
  } catch (err) {
    statusBadge.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

function stopCamera() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  video.srcObject = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  doneBtn.classList.add('hidden');
  hasFace = false;
  statusBadge.textContent = 'Camera stopped';
  statusBadge.classList.remove('detected');
}

async function detectLoop() {
  if (!stream) return;

  const faces = await detector.detect(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Read current slider values
  state.thickness = parseFloat(thicknessEl.value);
  state.archHeight = parseFloat(archHeightEl.value);
  state.offsetY = parseFloat(offsetYEl.value);
  state.opacity = parseInt(opacityEl.value);

  if (faces.length > 0) {
    hasFace = true;
    drawDetections(ctx, faces, {
      showLandmarks: showLandmarks.checked,
      ...state,
    });
    statusBadge.textContent = `Face detected · ${state.shapeType} brow`;
    statusBadge.classList.add('detected');
    doneBtn.classList.remove('hidden');
  } else {
    hasFace = false;
    statusBadge.textContent = 'Scanning for face...';
    statusBadge.classList.remove('detected');
    doneBtn.classList.add('hidden');
  }

  animFrameId = requestAnimationFrame(detectLoop);
}

// ── Done → Reveal ──
doneBtn.addEventListener('click', () => {
  // Capture composite image
  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = canvas.width;
  captureCanvas.height = canvas.height;
  const cctx = captureCanvas.getContext('2d');
  cctx.drawImage(video, 0, 0);
  cctx.drawImage(canvas, 0, 0);
  cctx.drawImage(freehandCanvas, 0, 0);

  const dataUrl = captureCanvas.toDataURL('image/png');
  showReveal(dataUrl);
});

function showReveal(dataUrl) {
  const overlay = document.createElement('div');
  overlay.className = 'reveal-overlay';
  overlay.innerHTML = `
    <div class="title">YOUR LOOK</div>
    <div class="subtitle">Brow Royale</div>
    <img src="${dataUrl}" alt="Your styled brows">
    <div class="reveal-actions">
      <button class="primary" id="revealSave">Save Image</button>
      <button class="secondary" id="revealBack">Try Again</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#revealSave').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `brow_royale_${Date.now()}.png`;
    a.click();
  });

  overlay.querySelector('#revealBack').addEventListener('click', () => {
    overlay.remove();
  });
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
