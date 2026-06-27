// renderer.js — All canvas draw calls

import { DUCK_W, DUCK_H, DUCK_STATES } from './duck.js';

const CW = 640;
const CH = 480;

// ─── Screen flash state (1-frame NES zapper effect) ───────────────
let _flashTimer = 0;
export function triggerFlash() { _flashTimer = 1 / 55; }

// ─── Background ──────────────────────────────────────────────────
const GRASS_Y  = 360;
const GROUND_Y = 410;

// Pre-defined tree data so it's deterministic each frame
const TREE_DATA = [
  { x: 40,  h: 68, w: 44 }, { x: 100, h: 55, w: 36 }, { x: 155, h: 72, w: 48 },
  { x: 220, h: 60, w: 40 }, { x: 280, h: 75, w: 50 }, { x: 340, h: 58, w: 38 },
  { x: 405, h: 70, w: 46 }, { x: 465, h: 52, w: 34 }, { x: 520, h: 66, w: 44 },
  { x: 575, h: 60, w: 40 }, { x: 620, h: 50, w: 32 },
];

export function drawBackground(ctx) {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, GRASS_Y);
  sky.addColorStop(0,    '#1A2A5E');
  sky.addColorStop(0.35, '#2E5BA8');
  sky.addColorStop(1,    '#7EB8E0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, GRASS_Y);

  // Distant tree silhouettes (lighter, further back)
  ctx.fillStyle = '#4A7C2E';
  TREE_DATA.forEach(({ x, h, w }) => {
    const dh = h * 0.65;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.65, GRASS_Y);   // bottom-left
    ctx.lineTo(x,             GRASS_Y - dh); // apex (top)
    ctx.lineTo(x + w * 0.65, GRASS_Y);   // bottom-right
    ctx.closePath();
    ctx.fill();
  });

  // Near tree silhouettes
  ctx.fillStyle = '#2D5A1B';
  TREE_DATA.forEach(({ x, h, w }) => {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, GRASS_Y + 4);  // bottom-left
    ctx.lineTo(x,         GRASS_Y - h);  // apex (top)
    ctx.lineTo(x + w / 2, GRASS_Y + 4); // bottom-right
    ctx.closePath();
    ctx.fill();
  });

  // Grass strip
  ctx.fillStyle = '#3A7D44';
  ctx.fillRect(0, GRASS_Y, CW, CH - GRASS_Y);

  // Bright grass highlight line
  ctx.fillStyle = '#5ECF00';
  ctx.fillRect(0, GRASS_Y, CW, 7);

  // Ground/soil strip
  ctx.fillStyle = '#7A4E2A';
  ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y);

  // Grass tufts (pointing UP)
  ctx.fillStyle = '#78D840';
  for (let i = 0; i < 24; i++) {
    const gx = (i * 28 + 6) % CW;
    const gy = GRASS_Y + 2;
    ctx.beginPath();
    ctx.moveTo(gx - 5, gy + 10); // bottom-left
    ctx.lineTo(gx,     gy);      // apex (top)
    ctx.lineTo(gx + 5, gy + 10); // bottom-right
    ctx.closePath();
    ctx.fill();
  }
}

// ─── Duck rendering (canvas geometry, pixel-art style) ───────────
function _drawDuckLocal(ctx, frame, isDead) {
  // Duck facing RIGHT, origin at (0,0) of bounding box
  // All geometry fits within 64×48

  const wingY = isDead ? 22 : [26, 16, 10, 16][frame % 4];

  // Body
  ctx.fillStyle = isDead ? '#4B5563' : '#1D4ED8';
  ctx.beginPath();
  ctx.ellipse(27, 30, 20, 12, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Wing highlight
  ctx.fillStyle = isDead ? '#6B7280' : '#93C5FD';
  ctx.beginPath();
  ctx.ellipse(18, wingY, 13, 6, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // Wing base (darker)
  ctx.fillStyle = isDead ? '#374151' : '#1D4ED8';
  ctx.beginPath();
  ctx.ellipse(13, wingY + 2, 7, 4, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // Tail feathers
  ctx.fillStyle = isDead ? '#374151' : '#1E40AF';
  ctx.beginPath();
  ctx.moveTo(7, 30);
  ctx.lineTo(-3, 24);
  ctx.lineTo(-2, 34);
  ctx.closePath();
  ctx.fill();

  // Neck / Head
  ctx.fillStyle = isDead ? '#374151' : '#1E3A8A';
  ctx.beginPath();
  ctx.arc(40, 17, 13, 0, Math.PI * 2);
  ctx.fill();

  // White collar ring
  ctx.strokeStyle = isDead ? '#6B7280' : '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(40, 26, 7, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  // Beak
  ctx.fillStyle = isDead ? '#6B7280' : '#F97316';
  ctx.beginPath();
  ctx.moveTo(52, 17);
  ctx.lineTo(62, 21);
  ctx.lineTo(52, 25);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = '#0F0F1A';
  ctx.beginPath();
  ctx.arc(44, 13, 3, 0, Math.PI * 2);
  ctx.fill();

  if (isDead) {
    // X eyes
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth   = 2.5;
    const ex = 44, ey = 13;
    ctx.beginPath();
    ctx.moveTo(ex - 4, ey - 4); ctx.lineTo(ex + 4, ey + 4);
    ctx.moveTo(ex + 4, ey - 4); ctx.lineTo(ex - 4, ey + 4);
    ctx.stroke();
  } else {
    // Eye shine
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(45, 11, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawDuck(ctx, duck) {
  ctx.save();

  const cx = duck.x + 32;
  const cy = duck.y + 24;

  ctx.translate(cx, cy);

  // Mirror for left-facing duck
  if (duck.direction === 'LEFT') ctx.scale(-1, 1);

  // Spin when falling
  if (duck.state === DUCK_STATES.FALLING) {
    ctx.rotate(duck.fallAngle);
  }

  ctx.translate(-32, -24);

  const isDead = duck.state === DUCK_STATES.HIT || duck.state === DUCK_STATES.FALLING;
  _drawDuckLocal(ctx, duck.animFrame, isDead);

  ctx.restore();
}

// ─── Crosshair ───────────────────────────────────────────────────
const CROSSHAIR_COLORS = {
  ACTIVE:    { ring: '#00FF41', inner: 'rgba(0,255,65,0.12)',   glow: '#00FF41' },
  NO_HAND:   { ring: '#FF4444', inner: 'rgba(255,68,68,0.15)',  glow: '#FF4444' },
  NO_PISTOL: { ring: '#666666', inner: 'rgba(80,80,80,0.10)',   glow: 'transparent' },
  FIRING:    { ring: '#FFD700', inner: 'rgba(255,215,0,0.25)',  glow: '#FFD700' },
};

export function drawCrosshair(ctx, x, y, state) {
  const { ring, inner, glow } = CROSSHAIR_COLORS[state] || CROSSHAIR_COLORS.NO_HAND;
  const R = 28, gap = 9, bLen = 7;

  ctx.save();
  ctx.shadowBlur  = 10;
  ctx.shadowColor = glow;
  ctx.strokeStyle = ring;
  ctx.lineWidth   = 2;

  // Outer circle
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();

  // Inner fill
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();

  // Cross lines (with gap)
  ctx.lineWidth = 2;
  [[x, y - R, x, y - gap], [x, y + gap, x, y + R],
   [x - R, y, x - gap, y], [x + gap, y, x + R, y]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });

  // Corner brackets
  ctx.lineWidth = 2.5;
  const bR = R * 0.72;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const bx = x + sx * bR, by = y + sy * bR;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + sx * bLen, by);
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by + sy * bLen);
    ctx.stroke();
  });

  // Center dot
  ctx.fillStyle = ring;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Status text
  const CW = 640;
  const CH = 480;
  if (state === 'NO_HAND') {
    ctx.save();
    ctx.fillStyle = '#FF4444';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    const textX = Math.max(75, Math.min(CW - 75, x));
    const textY = y + R + 18 > CH - 15 ? y - R - 12 : y + R + 18;
    ctx.fillText('HAND NOT DETECTED', textX, textY);
    ctx.restore();
  } else if (state === 'NO_PISTOL') {
    ctx.save();
    ctx.fillStyle = '#888';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    const textX = Math.max(70, Math.min(CW - 70, x));
    const textY = y + R + 18 > CH - 15 ? y - R - 12 : y + R + 18;
    ctx.fillText('MAKE GUN GESTURE', textX, textY);
    ctx.restore();
  }
}

// ─── Particles ───────────────────────────────────────────────────
export function drawParticles(ctx, particles) {
  particles.forEach(p => {
    const alpha = p.timer / (p.timer + 0.0001); // always visible while alive
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.timer * 3.5);
    ctx.fillStyle   = p.color;
    ctx.shadowBlur  = 6;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ─── Floating score texts ─────────────────────────────────────────
export function drawFloatingTexts(ctx, texts) {
  texts.forEach(t => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.timer * 2.2);
    ctx.fillStyle   = '#FFD700';
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#FFD700';
    ctx.font        = '10px "Press Start 2P", monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  });
}

// ─── Screen flash (NES zapper) ────────────────────────────────────
export function drawScreenFlash(ctx, dt) {
  if (_flashTimer <= 0) return;
  _flashTimer -= dt;
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fillRect(0, 0, CW, CH);
}

// ─── HUD ─────────────────────────────────────────────────────────
export function drawHUD(ctx, { score, highScore, lives, maxLives, round, bullets, maxBullets, encounterNum, totalEncounters, combo, comboTimer }) {
  // ── Top bar background
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, CW, 46);

  // Score
  ctx.textAlign = 'left';
  ctx.fillStyle = '#AAAAAA';
  ctx.font      = '7px "Press Start 2P", monospace';
  ctx.fillText('SCORE', 10, 14);
  ctx.fillStyle = '#FFD700';
  ctx.font      = '13px "Press Start 2P", monospace';
  ctx.fillText(score.toString().padStart(6, '0'), 10, 34);

  // Hi-score (center)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#AAAAAA';
  ctx.font      = '7px "Press Start 2P", monospace';
  ctx.fillText('HI-SCORE', CW / 2, 14);
  ctx.fillStyle = '#FFD700';
  ctx.font      = '13px "Press Start 2P", monospace';
  ctx.fillText(highScore.toString().padStart(6, '0'), CW / 2, 34);

  // Round (top right) — offset left to avoid icon button overlap
  ctx.textAlign = 'right';
  ctx.fillStyle = '#AAAAAA';
  ctx.font      = '7px "Press Start 2P", monospace';
  ctx.fillText(`ROUND ${round}`, CW - 90, 14);

  // Lives — pixel hearts (offset left of icon buttons)
  for (let i = 0; i < maxLives; i++) {
    ctx.font      = '16px sans-serif';
    ctx.fillStyle = i < lives ? '#FF3333' : '#444';
    ctx.fillText('\u2665', CW - 92 - i * 26, 38);
  }

  // ── Bottom bar: bullets + duck counter
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, CH - 40, CW, 40);

  // Bullet icons (pixel shell style)
  const bulletStartX = CW / 2 - (maxBullets * 22) / 2;
  for (let i = 0; i < maxBullets; i++) {
    const bx     = bulletStartX + i * 26;
    const active = i < bullets;
    const by     = CH - 28;

    // Shell body
    ctx.fillStyle = active ? '#D4AC0D' : '#555';
    ctx.fillRect(bx, by, 14, 18);
    // Bullet tip
    ctx.fillStyle = active ? '#F5CBA7' : '#444';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 7, by - 9);
    ctx.lineTo(bx + 14, by);
    ctx.fill();
    // Base stripe
    ctx.fillStyle = active ? '#A08000' : '#333';
    ctx.fillRect(bx, by + 13, 14, 4);
  }

  // Duck count
  if (totalEncounters > 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#DDD';
    ctx.font      = '8px "Press Start 2P", monospace';
    ctx.fillText(`DUCK ${Math.min(encounterNum, totalEncounters)}/${totalEncounters}`, CW - 12, CH - 14);
  }

  // Combo display
  if (combo > 1 && comboTimer > 0) {
    const alpha = Math.min(1, comboTimer * 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign   = 'left';
    ctx.font        = '11px "Press Start 2P", monospace';
    ctx.fillStyle   = '#FF6B00';
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#FF6B00';
    ctx.fillText(`×${combo} COMBO!`, 12, CH - 12);
    ctx.restore();
  }

  // Encounter duck timer bar (top of bottom bar)
  // Drawn by caller — nothing to add here
}

// ─── Timer bar (duck countdown) ──────────────────────────────────
export function drawDuckTimer(ctx, elapsed, timeout) {
  if (timeout <= 0) return;
  const pct   = Math.max(0, 1 - elapsed / timeout);
  const barW  = CW - 120;
  const barX  = 60;
  const barY  = CH - 44;

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(barX, barY, barW, 5);

  const color = pct > 0.5 ? '#00FF41' : pct > 0.25 ? '#FFD700' : '#FF4444';
  ctx.fillStyle = color;
  ctx.fillRect(barX, barY, barW * pct, 5);
}

// ─── Loading screen ───────────────────────────────────────────────
export function drawLoadingScreen(ctx, progress) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CW, CH);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 107 + 53) % CW);
    const sy = ((i * 79  + 31) % (CH - 100));
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }

  // Title
  ctx.fillStyle = '#FFD700';
  ctx.shadowBlur  = 24;
  ctx.shadowColor = '#FFD700';
  ctx.font      = '28px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DUCK HUNT', CW / 2, 155);

  ctx.shadowBlur  = 10;
  ctx.shadowColor = '#00FF41';
  ctx.fillStyle = '#00FF41';
  ctx.font      = '12px "Press Start 2P", monospace';
  ctx.fillText('★ REVAMPED ★', CW / 2, 188);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#AAA';
  ctx.font      = '8px "Press Start 2P", monospace';
  ctx.fillText('LOADING AI VISION ENGINE...', CW / 2, 245);

  // Progress bar
  const bx = CW / 2 - 160, by = 268, bw = 320, bh = 18;
  ctx.strokeStyle = '#00FF41';
  ctx.lineWidth   = 2;
  ctx.strokeRect(bx, by, bw, bh);
  const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  grad.addColorStop(0, '#007700');
  grad.addColorStop(1, '#00FF41');
  ctx.fillStyle = grad;
  ctx.fillRect(bx + 2, by + 2, (bw - 4) * Math.min(progress, 1), bh - 4);

  ctx.fillStyle = '#FFF';
  ctx.font      = '8px "Press Start 2P", monospace';
  ctx.fillText(`${Math.floor(progress * 100)}%`, CW / 2, by + 14);
}

// ─── Calibration screen ───────────────────────────────────────────
export function drawCalibration(ctx, videoEl, progress, handDetected, circleX, circleY, circleR) {
  // Dimmed mirrored webcam feed
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.translate(CW, 0);
  ctx.scale(-1, 1);
  try { ctx.drawImage(videoEl, 0, 0, CW, CH); } catch (_) {}
  ctx.restore();

  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,8,0.58)';
  ctx.fillRect(0, 0, CW, CH);

  // Title
  ctx.fillStyle = '#FFD700';
  ctx.shadowBlur  = 16;
  ctx.shadowColor = '#FFD700';
  ctx.font      = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CALIBRATION', CW / 2, 68);
  ctx.shadowBlur = 0;

  // Outer glow ring when hand detected
  if (handDetected) {
    ctx.strokeStyle = 'rgba(0,255,65,0.25)';
    ctx.lineWidth   = 22;
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleR + 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Main circle
  ctx.strokeStyle = handDetected ? '#00FF41' : '#FFFFFF';
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
  ctx.stroke();

  // Progress arc
  if (progress > 0) {
    ctx.strokeStyle = '#00FF41';
    ctx.lineWidth   = 7;
    ctx.lineCap     = 'round';
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#00FF41';
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleR + 10, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineCap    = 'butt';
  }

  // Center icon
  ctx.font      = '30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('☝️', circleX, circleY + 10);

  // Progress %
  if (progress > 0.02) {
    ctx.fillStyle = '#00FF41';
    ctx.font      = '10px "Press Start 2P", monospace';
    ctx.fillText(`${Math.floor(progress * 100)}%`, circleX, circleY + 38);
  }

  // Instructions
  const instructionY = circleY + circleR + 42;
  ctx.fillStyle = handDetected ? '#00FF41' : '#CCCCCC';
  ctx.font      = '8px "Press Start 2P", monospace';
  ctx.fillText(
    handDetected ? 'HAND DETECTED — HOLD STEADY' : 'POINT YOUR INDEX FINGER',
    circleX, instructionY
  );
  ctx.fillStyle = '#888';
  ctx.font      = '7px "Press Start 2P", monospace';
  ctx.fillText('☝️  MAKE A GUN HAND GESTURE', circleX, instructionY + 22);
  ctx.fillStyle = '#555';
  ctx.fillText('WEBCAM PREVIEW IS MIRRORED', circleX, instructionY + 40);
}

// ─── Menu screen ─────────────────────────────────────────────────
export function drawMenuScreen(ctx, highScore) {
  // Dark sky bg
  ctx.fillStyle = 'rgba(0,0,20,0.88)';
  ctx.fillRect(0, 0, CW, CH);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 60; i++) {
    ctx.fillRect((i * 107 + 53) % CW, (i * 79 + 31) % 300, 1.5, 1.5);
  }

  // Title glow
  ctx.shadowBlur  = 30;
  ctx.shadowColor = '#FFD700';
  ctx.fillStyle   = '#FFD700';
  ctx.font        = '34px "Press Start 2P", monospace';
  ctx.textAlign   = 'center';
  ctx.fillText('DUCK HUNT', CW / 2, 118);

  ctx.shadowBlur  = 12;
  ctx.shadowColor = '#00FF41';
  ctx.fillStyle   = '#00FF41';
  ctx.font        = '13px "Press Start 2P", monospace';
  ctx.fillText('✦ REVAMPED ✦', CW / 2, 150);

  ctx.shadowBlur = 0;

  // Hi-score
  ctx.fillStyle = '#FFF';
  ctx.font      = '9px "Press Start 2P", monospace';
  ctx.fillText(`HI-SCORE  ${highScore.toString().padStart(6, '0')}`, CW / 2, 192);

  // Instructions
  ctx.fillStyle = '#7A8BA0';
  ctx.font      = '7px "Press Start 2P", monospace';
  ctx.fillText('HOLD UP INDEX FINGER LIKE A GUN', CW / 2, 248);
  ctx.fillText('SNAP THUMB OR JERK UP  →  SHOOT', CW / 2, 268);
  ctx.fillText('HIT DUCKS BEFORE THEY FLY AWAY!', CW / 2, 288);

  // Blinking prompt
  if (Math.floor(Date.now() / 520) % 2 === 0) {
    ctx.fillStyle = '#00FF41';
    ctx.font      = '10px "Press Start 2P", monospace';
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#00FF41';
    ctx.fillText('▼  CLICK START BELOW  ▼', CW / 2, 340);
    ctx.shadowBlur  = 0;
  }
}

// ─── Round complete screen ────────────────────────────────────────
export function drawRoundComplete(ctx, round, score) {
  ctx.fillStyle = 'rgba(0,0,30,0.88)';
  ctx.fillRect(0, 0, CW, CH);

  ctx.shadowBlur  = 20;
  ctx.shadowColor = '#FFD700';
  ctx.fillStyle   = '#FFD700';
  ctx.font        = '22px "Press Start 2P", monospace';
  ctx.textAlign   = 'center';
  ctx.fillText('ROUND CLEAR!', CW / 2, 140);

  ctx.shadowBlur = 0;
  ctx.fillStyle  = '#FFF';
  ctx.font       = '11px "Press Start 2P", monospace';
  ctx.fillText(`ROUND ${round} COMPLETE`, CW / 2, 185);

  ctx.fillStyle = '#FFD700';
  ctx.font      = '13px "Press Start 2P", monospace';
  ctx.fillText(`SCORE  ${score.toString().padStart(6, '0')}`, CW / 2, 224);

  if (Math.floor(Date.now() / 520) % 2 === 0) {
    ctx.fillStyle = '#00FF41';
    ctx.font      = '9px "Press Start 2P", monospace';
    ctx.fillText('▼  NEXT ROUND BELOW  ▼', CW / 2, 310);
  }
}

// ─── Game over screen ─────────────────────────────────────────────
export function drawGameOverScreen(ctx, score, highScore, isNewHighScore, accuracy, shotsFired, ducksHit) {
  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  ctx.fillRect(0, 0, CW, CH);

  // Flashing GAME OVER
  const flash = Math.floor(Date.now() / 320) % 2 === 0;
  ctx.shadowBlur  = flash ? 24 : 0;
  ctx.shadowColor = '#FF2222';
  ctx.fillStyle   = flash ? '#FF3333' : '#CC0000';
  ctx.font        = '30px "Press Start 2P", monospace';
  ctx.textAlign   = 'center';
  ctx.fillText('GAME OVER', CW / 2, 118);
  ctx.shadowBlur  = 0;

  // Score
  ctx.fillStyle = '#FFF';
  ctx.font      = '11px "Press Start 2P", monospace';
  ctx.fillText(`SCORE   ${score.toString().padStart(6, '0')}`, CW / 2, 165);

  // High score
  if (isNewHighScore) {
    ctx.shadowBlur  = 14;
    ctx.shadowColor = '#FFD700';
    ctx.fillStyle   = '#FFD700';
    ctx.font        = '9px "Press Start 2P", monospace';
    ctx.fillText('★  NEW HIGH SCORE!  ★', CW / 2, 196);
    ctx.shadowBlur  = 0;
  } else {
    ctx.fillStyle = '#777';
    ctx.font      = '9px "Press Start 2P", monospace';
    ctx.fillText(`HI-SCORE  ${highScore.toString().padStart(6, '0')}`, CW / 2, 196);
  }

  // Stats
  ctx.fillStyle = '#00FF41';
  ctx.font      = '8px "Press Start 2P", monospace';
  ctx.fillText(`ACCURACY    ${accuracy}%`, CW / 2, 234);
  ctx.fillStyle = '#99CCFF';
  ctx.fillText(`DUCKS HIT   ${ducksHit} / ${shotsFired} SHOTS`, CW / 2, 256);
}
