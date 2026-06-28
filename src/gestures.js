// gestures.js — Pistol gesture detection, cursor smoothing, shot trigger

const LERP_FACTOR  = 0.28;   // cursor smoothing (0=sticky, 1=instant)
const RING_SIZE    = 8;      // raw position history buffer length
const DEBOUNCE_MS  = 300;    // ms between shots

// Aim: track index KNUCKLE (L5/MCP) instead of fingertip (L8)
// → the knuckle doesn't move when you pinch, so aim stays locked during firing

// Pinch trigger: thumb tip (L4) touches index tip (L8)
const PINCH_THRESHOLD = 0.07;  // normalized distance — "touching"

class GestureController {
  constructor() {
    // Smoothed cursor (for crosshair display)
    this.cursorX = 0.5;
    this.cursorY = 0.5;

    // Shot state
    this._lastShotMs  = 0;
    this._wasPinching = false;  // edge detection: fire on entry, not while held

    // Exported state
    this.shotFired = false;
    this.isPistol  = false;
    this.hasHand   = false;
  }

  // ─── Euclidean distance between two landmarks ──────────────────
  _dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }

  // ─── Main update (call once per frame) ─────────────────────────
  update(landmarks, timestamp) {
    this.shotFired = false;

    if (!landmarks || landmarks.length < 21) {
      this.hasHand      = false;
      this.isPistol     = false;
      this._wasPinching = false;
      return;
    }

    this.hasHand = true;

    // ── Named landmarks ────────────────────────────────────────────
    const L4  = landmarks[4];   // THUMB TIP
    const L5  = landmarks[5];   // INDEX MCP (knuckle) ← AIM POINT
    const L8  = landmarks[8];   // INDEX TIP           ← trigger reference
    const L9  = landmarks[9];   // MIDDLE MCP
    const L12 = landmarks[12];  // MIDDLE TIP
    const L13 = landmarks[13];  // RING MCP
    const L16 = landmarks[16];  // RING TIP
    const L17 = landmarks[17];  // PINKY MCP
    const L20 = landmarks[20];  // PINKY TIP

    // ── Aim using INDEX KNUCKLE (L5) — stable during pinch ────────
    const mirX = 1 - L5.x;   // mirror: front camera is flipped
    const rawY = L5.y;

    // ── Lerp smoothed cursor ───────────────────────────────────────
    this.cursorX += (mirX - this.cursorX) * LERP_FACTOR;
    this.cursorY += (rawY - this.cursorY) * LERP_FACTOR;

    // ── Pistol gesture gate ────────────────────────────────────────
    // Index clearly extended (tip well above knuckle)
    const indexExtended = (L5.y - L8.y) > 0.08;

    // Middle / Ring / Pinky closed (tips below or near their MCPs)
    const middleClosed = L12.y > L9.y  - 0.03;
    const ringClosed   = L16.y > L13.y - 0.03;
    const pinkyClosed  = L20.y > L17.y - 0.03;

    // NOTE: thumb is NOT part of the gate — it's the trigger variable now
    this.isPistol = indexExtended && middleClosed && ringClosed && pinkyClosed;

    // ── Pinch state ────────────────────────────────────────────────
    const pinchDist  = this._dist(L4, L8);
    const isPinching = pinchDist < PINCH_THRESHOLD;

    if (!this.isPistol) {
      // Reset pinch state when hand leaves pistol mode
      this._wasPinching = isPinching;
      return;
    }

    // ── Shot trigger: pinch ENTRY (edge detection) ─────────────────
    // Fire on the TRANSITION from not-pinching → pinching.
    // Holding the pinch does NOT continuously fire.
    if (isPinching && !this._wasPinching) {
      if (timestamp - this._lastShotMs >= DEBOUNCE_MS) {
        this.shotFired   = true;
        this._lastShotMs = timestamp;
      }
    }

    this._wasPinching = isPinching;
  }

  // ─── Public accessors ─────────────────────────────────────────────
  /** Returns smoothed cursor position in canvas pixels */
  getCursorPos(canvasW, canvasH) {
    return {
      x: this.cursorX * canvasW,
      y: this.cursorY * canvasH,
    };
  }

  getShotFired()  { return this.shotFired; }
  getHasHand()    { return this.hasHand;   }
  getIsPistol()   { return this.isPistol;  }
}

export const gestures = new GestureController();
