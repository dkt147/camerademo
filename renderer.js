import {
  LEFT_EYEBROW, RIGHT_EYEBROW,
  LEFT_EYEBROW_UPPER, LEFT_EYEBROW_LOWER,
  RIGHT_EYEBROW_UPPER, RIGHT_EYEBROW_LOWER,
  FACE_OVAL
} from './detector.js';

/**
 * Port of Flutter EyebrowPainter — same rendering strategy:
 * shadow → gradient fill → border → hair strokes → top highlight
 */
export function drawDetections(ctx, faces, opts) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  for (const landmarks of faces) {
    if (opts.showLandmarks) {
      drawPolyline(ctx, landmarks, FACE_OVAL, w, h, 'rgba(255,255,255,0.25)', 1, true);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (const pt of landmarks) {
        ctx.beginPath();
        ctx.arc(pt.x * w, pt.y * h, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const topL = LEFT_EYEBROW_UPPER.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
    const botL = LEFT_EYEBROW_LOWER.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
    const topR = RIGHT_EYEBROW_UPPER.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));
    const botR = RIGHT_EYEBROW_LOWER.map(i => ({ x: landmarks[i].x * w, y: landmarks[i].y * h }));

    paintBrow(ctx, topL, botL, opts);
    paintBrow(ctx, topR, botR, opts);
  }
}

function paintBrow(ctx, topPts, botPts, opts) {
  if (topPts.length < 2 || botPts.length < 2) return;

  const dy = opts.offsetY || 0;
  const sTop = topPts.map(p => ({ x: p.x, y: p.y + dy }));
  const sBot = botPts.map(p => ({ x: p.x, y: p.y + dy }));

  const shape = opts.shapeType || 'natural';
  const sticker = opts.stickerType;

  switch (shape) {
    case 'natural':
      drawShaped(ctx, sTop, sBot, opts, 0, 1.0);
      break;
    case 'arch':
      drawShaped(ctx, sTop, sBot, opts, 14 + (opts.archHeight || 0), 1.0);
      break;
    case 'straight':
      drawStraight(ctx, sTop, sBot, opts);
      break;
    case 'rounded':
      drawShaped(ctx, sTop, sBot, opts, 7 + (opts.archHeight || 0), 1.3);
      break;
    case 'sharp':
      drawSharp(ctx, sTop, sBot, opts);
      break;
    case 'sticker':
      drawSticker(ctx, sTop, sBot, opts, sticker);
      break;
    default:
      drawShaped(ctx, sTop, sBot, opts, 0, 1.0);
  }
}

// ── SHAPED (natural / arch / rounded) ──
function drawShaped(ctx, topPts, botPts, opts, archExtra, thickMult) {
  const thick = (opts.thickness || 10) * thickMult;
  const expandedBot = expandBottom(botPts, thick);
  const archedTop = applyArch(topPts, archExtra + (opts.archHeight || 0));
  const path = buildPath(archedTop, expandedBot);
  renderPath(ctx, path, archedTop, expandedBot, opts);
}

// ── STRAIGHT ──
function drawStraight(ctx, topPts, botPts, opts) {
  const avgTopY = topPts.reduce((s, p) => s + p.y, 0) / topPts.length;
  const avgBotY = botPts.reduce((s, p) => s + p.y, 0) / botPts.length;
  const ex = ((opts.thickness || 10) - 5) * 0.8;
  const flatTop = topPts.map(p => ({ x: p.x, y: avgTopY - ex }));
  const flatBot = botPts.map(p => ({ x: p.x, y: avgBotY + ex }));
  const path = buildPath(flatTop, flatBot);
  renderPath(ctx, path, flatTop, flatBot, opts);
}

// ── SHARP ──
function drawSharp(ctx, topPts, botPts, opts) {
  const peakIdx = Math.round(topPts.length * 0.6);
  const peakLift = 12 + (opts.archHeight || 0);
  const ex = ((opts.thickness || 10) - 5) * 0.8;

  const sharpTop = topPts.map((p, i) => {
    const lift = i <= peakIdx
      ? (i / peakIdx) * peakLift
      : ((topPts.length - 1 - i) / (topPts.length - 1 - peakIdx)) * peakLift;
    return { x: p.x, y: p.y - lift };
  });
  const expandedBot = botPts.map(p => ({ x: p.x, y: p.y + ex }));
  const path = buildPath(sharpTop, expandedBot);
  renderPath(ctx, path, sharpTop, expandedBot, opts);
}

// ── STICKER ──
function drawSticker(ctx, topPts, botPts, opts, type) {
  switch (type) {
    case 'bold': {
      const thick = opts.thickness || 10;
      const exp = botPts.map(p => ({ x: p.x, y: p.y + thick * 0.6 }));
      const arch = applyArch(topPts, 4);
      const path = buildPath(arch, exp);
      renderPath(ctx, path, arch, exp, opts);
      break;
    }
    case 'feather':
      drawFeather(ctx, topPts, botPts, opts);
      break;
    case 'tapered':
      drawTapered(ctx, topPts, botPts, opts);
      break;
    case 'micro':
      drawMicro(ctx, topPts, botPts, opts);
      break;
    case 'brushed':
      drawBrushed(ctx, topPts, botPts, opts);
      break;
    default:
      drawShaped(ctx, topPts, botPts, opts, 0, 1.0);
  }
}

function drawFeather(ctx, topPts, botPts, opts) {
  const color = opts.browColor || '#4A2C0A';
  const alpha = (opts.opacity || 75) / 100;
  ctx.strokeStyle = hexRgba(color, alpha * 0.6);
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  for (let i = 0; i < topPts.length; i++) {
    const t = i / (topPts.length - 1);
    const bIdx = Math.round(t * (botPts.length - 1));
    const bot = botPts[bIdx];
    const top = topPts[i];
    for (let f = 0; f <= 1.0; f += 0.25) {
      const sx = bot.x + (top.x - bot.x) * f;
      const sy = bot.y + (top.y - bot.y) * f;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(top.x + (i - topPts.length / 2) * 0.3, top.y - 5 * (opts.thickness || 10) / 10);
      ctx.stroke();
    }
  }
}

function drawTapered(ctx, topPts, botPts, opts) {
  const color = opts.browColor || '#4A2C0A';
  const alpha = (opts.opacity || 75) / 100;
  const thick = opts.thickness || 10;
  for (let i = 0; i < topPts.length - 1; i++) {
    const t = i / (topPts.length - 1);
    const bIdx = Math.round(t * (botPts.length - 1));
    ctx.strokeStyle = hexRgba(color, alpha);
    ctx.lineWidth = (1.0 - t * 0.75) * thick + 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(botPts[bIdx].x, botPts[bIdx].y);
    ctx.lineTo(topPts[i].x, topPts[i].y);
    ctx.stroke();
  }
}

function drawMicro(ctx, topPts, botPts, opts) {
  const color = opts.browColor || '#4A2C0A';
  const alpha = (opts.opacity || 75) / 100;
  ctx.strokeStyle = hexRgba(color, alpha * 0.85);
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  for (let i = 0; i < topPts.length; i++) {
    const t = i / (topPts.length - 1);
    const bIdx = Math.round(t * (botPts.length - 1));
    ctx.beginPath();
    ctx.moveTo(botPts[bIdx].x, botPts[bIdx].y);
    ctx.lineTo(topPts[i].x, topPts[i].y);
    ctx.stroke();
  }
}

function drawBrushed(ctx, topPts, botPts, opts) {
  const color = opts.browColor || '#4A2C0A';
  const alpha = (opts.opacity || 75) / 100;
  const thick = opts.thickness || 10;
  ctx.strokeStyle = hexRgba(color, alpha * 0.7);
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  for (let i = 0; i < topPts.length; i++) {
    const t = i / (topPts.length - 1);
    const bIdx = Math.round(t * (botPts.length - 1));
    const brushEnd = { x: topPts[i].x + (0.5 - t) * 6, y: topPts[i].y - 8 * thick / 10 };
    ctx.beginPath();
    ctx.moveTo(botPts[bIdx].x, botPts[bIdx].y);
    ctx.lineTo(brushEnd.x, brushEnd.y);
    ctx.stroke();
  }
  // soft fill
  const path = buildPath(topPts, botPts);
  ctx.save();
  ctx.filter = 'blur(2px)';
  ctx.fillStyle = hexRgba(color, alpha * 0.35);
  ctx.fill(path);
  ctx.restore();
}

// ── SHARED RENDER (matches Flutter _renderPath + _drawHairStrokes + _drawTopHighlight) ──
function renderPath(ctx, path, topPts, botPts, opts) {
  const color = opts.browColor || '#4A2C0A';
  const alpha = (opts.opacity || 75) / 100;

  // 1. Shadow (blur)
  ctx.save();
  ctx.filter = 'blur(9px)';
  ctx.fillStyle = hexRgba(color, alpha * 0.35);
  ctx.fill(path);
  ctx.restore();

  // 2. Gradient fill (left to right like Flutter)
  const allPts = [...topPts, ...botPts];
  const minX = Math.min(...allPts.map(p => p.x));
  const maxX = Math.max(...allPts.map(p => p.x));
  const grad = ctx.createLinearGradient(minX, 0, maxX, 0);
  grad.addColorStop(0, hexRgba(color, alpha * 0.65));
  grad.addColorStop(0.45, hexRgba(color, alpha));
  grad.addColorStop(1, hexRgba(color, alpha * 0.75));
  ctx.fillStyle = grad;
  ctx.fill(path);

  // 3. Border
  ctx.strokeStyle = hexRgba(color, alpha * 0.55);
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(path);

  // 4. Hair strokes
  drawHairStrokes(ctx, topPts, botPts, color, alpha);

  // 5. Top highlight
  drawTopHighlight(ctx, topPts, botPts);
}

function drawHairStrokes(ctx, topPts, botPts, color, alpha) {
  ctx.strokeStyle = hexRgba(color, alpha * 0.28);
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  const n = topPts.length;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const bIdx = Math.min(Math.round(t * (botPts.length - 1)), botPts.length - 1);
    const angle = (i < n / 2) ? -1.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(topPts[i].x + angle, topPts[i].y);
    ctx.lineTo((topPts[i].x + botPts[bIdx].x) / 2, botPts[bIdx].y);
    ctx.stroke();
  }
}

function drawTopHighlight(ctx, topPts, botPts) {
  if (topPts.length < 2 || botPts.length < 2) return;
  const path = new Path2D();
  path.moveTo(topPts[0].x, topPts[0].y);
  addSmoothCurve(path, topPts);

  // Close with 25% lerp towards bottom
  for (let i = topPts.length - 1; i >= 0; i--) {
    const t = i / (topPts.length - 1);
    const bIdx = Math.min(Math.round(t * (botPts.length - 1)), botPts.length - 1);
    const lx = topPts[i].x + (botPts[bIdx].x - topPts[i].x) * 0.25;
    const ly = topPts[i].y + (botPts[bIdx].y - topPts[i].y) * 0.25;
    path.lineTo(lx, ly);
  }
  path.closePath();

  ctx.save();
  ctx.filter = 'blur(2.5px)';
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fill(path);
  ctx.restore();
}

// ── PATH BUILDING (matches Flutter _buildPath + _addSmoothCurve) ──
function buildPath(topPts, botPts) {
  const path = new Path2D();
  path.moveTo(topPts[0].x, topPts[0].y);
  addSmoothCurve(path, topPts);
  addSmoothCurve(path, [...botPts].reverse());
  path.closePath();
  return path;
}

function addSmoothCurve(path, pts) {
  if (pts.length < 2) {
    if (pts.length === 1) path.lineTo(pts[0].x, pts[0].y);
    return;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const cpX = (pts[i].x + pts[i + 1].x) / 2;
    const cpY = (pts[i].y + pts[i + 1].y) / 2;
    path.quadraticCurveTo(pts[i].x, pts[i].y, cpX, cpY);
  }
  path.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}

// ── HELPERS ──
function expandBottom(botPts, thick) {
  return botPts.map((p, i) => {
    const t = i / (botPts.length - 1);
    return { x: p.x, y: p.y + (thick - 5) * 0.6 * Math.sin(t * Math.PI) };
  });
}

function applyArch(pts, extra) {
  if (pts.length < 2) return pts;
  return pts.map((p, i) => ({
    x: p.x,
    y: p.y - Math.sin(i / (pts.length - 1) * Math.PI) * extra,
  }));
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function hexRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

function drawPolyline(ctx, landmarks, indices, w, h, color, lineWidth, closed) {
  if (indices.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  const start = landmarks[indices[0]];
  ctx.moveTo(start.x * w, start.y * h);
  for (let i = 1; i < indices.length; i++) {
    const pt = landmarks[indices[i]];
    ctx.lineTo(pt.x * w, pt.y * h);
  }
  if (closed) ctx.closePath();
  ctx.stroke();
}
