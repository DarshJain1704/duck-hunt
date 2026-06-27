// gestures.js — Pistol gesture detection, cursor smoothing, shot trigger

const LERP_FACTOR     = 0.28;   // cursor smoothing (0=sticky, 1=instant)
const RING_SIZE       = 8;      // raw position history buffer length
const DEBOUNCE_MS     = 280;    // ms between shots

// Thumb-snap trigger: thumb tip approaches index tip rapidly
const SNAP_DIST_THRESHOLD  = 0.09;   // normalized units — "close enough" to fire
const SNAP_DELTA_THRESHOLD = 0.035;  // minimum rapid decrease to count as snap

// Recoil-jerk trigger: index tip jerks upward abruptly
const JERK_THRESHOLD  = 0.055;   // normalized units/frame

class GestureController {
  constructor() {
    // Smoothed cursor (for crosshair display)
    this.cursorX = 0.5;
    this.cursorY = 0.5;

    // Raw history ring-buffers
    this._rawPos   = Array(RING_SIZE).fill({ x: 0.5, y: 0.5 });
    this._snapHist = Array(RING_SIZE).fill(1.0);

    this._lastShotMs = 0;

    // Exported state
    this.shotFired  = false;
    this.isPistol   = false;
    this.hasHand    = false;
  }

  // ─── Euclidean distance between two landmarks ──────────────────
  _dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }

  // ─── Main update (call once per frame) ─────────────────────────
  update(landmarks, timestamp) {
    this.shotFired = false;

    if (!landmarks || landmarks.length < 21) {
      this.hasHand = false;
      this.isPistol = false;
      return;
    }

    this.hasHand = true;

    // ── Named landmarks ────────────────────────────────────────────
    const L0  = landmarks[0];   // WRIST
    const L4  = landmarks[4];   // THUMB TIP
    const L5  = landmarks[5];   // INDEX MCP
    const L6  = landmarks[6];   // INDEX PIP
    const L8  = landmarks[8];   // INDEX TIP
    const L9  = landmarks[9];   // MIDDLE MCP
    const L12 = landmarks[12];  // MIDDLE TIP
    const L13 = landmarks[13];  // RING MCP
    const L16 = landmarks[16];  // RING TIP
    const L17 = landmarks[17];  // PINKY MCP
    const L20 = landmarks[20];  // PINKY TIP

    // ── Mirror x (front camera is flipped) ────────────────────────
    const mirX = 1 - L8.x;
    const rawY = L8.y;

    // ── Update ring buffers ────────────────────────────────────────
    this._rawPos.push({ x: mirX, y: rawY });
    if (this._rawPos.length > RING_SIZE) this._rawPos.shift();

    // ── Lerp smoothed cursor ───────────────────────────────────────
    this.cursorX += (mirX - this.cursorX) * LERP_FACTOR;
    this.cursorY += (rawY - this.cursorY) * LERP_FACTOR;

    // ── Pistol gesture detection ───────────────────────────────────
    // Index clearly extended (tip well above MCP)
    const indexExtended = (L5.y - L8.y) > 0.08;

    // Middle / Ring / Pinky closed (tips below or near their MCPs)
    const middleClosed = L12.y > L9.y  - 0.03;
    const ringClosed   = L16.y > L13.y - 0.03;
    const pinkyClosed  = L20.y > L17.y - 0.03;

    // Thumb extended away from palm (not tucked)
    const thumbFarFromPalm = this._dist(L4, L0) > this._dist(landmarks[3], L0) * 0.88;

    this.isPistol = indexExtended && middleClosed && ringClosed && pinkyClosed && thumbFarFromPalm;

    if (!this.isPistol) return;

    // ── Debounce check ─────────────────────────────────────────────
    if (timestamp - this._lastShotMs < DEBOUNCE_MS) return;

    // ── Shot Trigger 1: Thumb-snap ─────────────────────────────────
    const snapDist = this._dist(L4, L8);
    this._snapHist.push(snapDist);
    if (this._snapHist.length > RING_SIZE) this._snapHist.shift();

    const recentSnap = avg(this._snapHist.slice(-2));
    const prevSnap   = avg(this._snapHist.slice(-6, -2));
    const snapDelta  = prevSnap - recentSnap; // positive = finger got closer

    if (snapDelta > SNAP_DELTA_THRESHOLD && recentSnap < SNAP_DIST_THRESHOLD) {
      this.shotFired   = true;
      this._lastShotMs = timestamp;
      return;
    }

    // ── Shot Trigger 2: Recoil jerk (index tip jerks upward) ──────
    if (this._rawPos.length >= 6) {
      const recentY = avg(this._rawPos.slice(-2).map(p => p.y));
      const prevY   = avg(this._rawPos.slice(-6, -2).map(p => p.y));
      const jerk    = prevY - recentY;  // positive = moved up (y decreases upward)

      if (jerk > JERK_THRESHOLD) {
        this.shotFired   = true;
        this._lastShotMs = timestamp;
      }
    }
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

function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export const gestures = new GestureController();
