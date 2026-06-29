// gestures.js — Pistol detection, crosshair smoothing, shot trigger
//
// DESIGN:
//   Aim  → L5 (index MCP/knuckle) — rock-solid, doesn't move during pinch
//   Fire → pinch entry: thumb tip touches index tip
//
// THREE-LAYER RELIABILITY SYSTEM:
//   1. World landmarks   — real-world metre distances, immune to camera depth / hand size
//   2. ARMED state       — must hold pistol for ARMED_HOLD_MS before shooting is possible
//   3. Frame confirmation — pinch must persist for PINCH_FRAMES consecutive frames
//
// State machine:  IDLE ──► ARMING ──► ARMED ──► COOLDOWN ──► ARMED
//                   └──────────────────────────────────────────┘ (if hand lost → IDLE)

const LERP_FACTOR    = 0.22;   // cursor smoothing (lower = smoother but laggier)
const ARMED_HOLD_MS  = 180;    // ms pistol must be held before first shot is possible
const DEBOUNCE_MS    = 350;    // ms cooldown between shots
const PINCH_FRAMES   = 3;      // consecutive frames pinch must hold to fire (~50ms @60fps)

// Pinch thresholds — tried in priority order:
//   World (metres): real physical distance; best, immune to depth
//   Norm ratio    : dist(L4,L8)/palmSize; fallback when world unavailable
const PINCH_WORLD_M  = 0.020;  // 2 cm in world space  ← deliberate touch, above jitter noise
const PINCH_NORM_R   = 0.14;   // 14% of palm length   ← normalized fallback

// Crosshair states (exported for renderer)
export const XHAIR = {
  NO_HAND:   'NO_HAND',
  NO_PISTOL: 'NO_PISTOL',
  ARMING:    'ARMING',    // pistol detected, counting to armed
  ACTIVE:    'ACTIVE',    // armed and ready
  FIRING:    'FIRING',    // shot just fired
};

class GestureController {
  constructor() {
    // ── Smoothed cursor ─────────────────────────────────────────────
    this.cursorX = 0.5;
    this.cursorY = 0.5;

    // ── Internal state ──────────────────────────────────────────────
    this._pistolStartMs  = 0;     // when we first detected pistol this streak
    this._lastShotMs     = 0;     // timestamp of the last registered shot
    this._pinchFrames    = 0;     // consecutive frames of active pinch
    this._wasFiring      = false; // for debounce / edge logic

    // ── Exported state ──────────────────────────────────────────────
    this.shotFired = false;
    this.isPistol  = false;
    this.hasHand   = false;
    this.xhairState = XHAIR.NO_HAND;
  }

  // ── Euclidean distance ──────────────────────────────────────────
  _dist(a, b) {
    return Math.sqrt(
      (a.x - b.x) ** 2 +
      (a.y - b.y) ** 2 +
      (a.z - b.z) ** 2
    );
  }

  // ── Main update — call once per animation frame ─────────────────
  update(landmarks, timestamp, worldLandmarks = null) {
    this.shotFired = false;

    // ── No hand ─────────────────────────────────────────────────────
    if (!landmarks || landmarks.length < 21) {
      this.hasHand        = false;
      this.isPistol       = false;
      this._pistolStartMs = 0;
      this._pinchFrames   = 0;
      this.xhairState     = XHAIR.NO_HAND;
      return;
    }

    this.hasHand = true;

    // ── Landmarks ───────────────────────────────────────────────────
    const L0  = landmarks[0];   // WRIST
    const L4  = landmarks[4];   // THUMB TIP       ← trigger
    const L5  = landmarks[5];   // INDEX MCP       ← AIM POINT (stable during pinch)
    const L8  = landmarks[8];   // INDEX TIP       ← pinch reference & extension check
    const L9  = landmarks[9];   // MIDDLE MCP      ← palm size reference

    // ── AIM: track index knuckle (L5) — not fingertip ──────────────
    // The knuckle doesn't move when you bring your thumb in for a pinch,
    // so the crosshair stays rock-solid through the entire firing motion.
    const mirX = 1 - L5.x;    // mirror: front camera is flipped
    this.cursorX += (mirX   - this.cursorX) * LERP_FACTOR;
    this.cursorY += (L5.y   - this.cursorY) * LERP_FACTOR;

    // ── PISTOL GATE ─────────────────────────────────────────────────
    // Only requirement: index finger clearly extended.
    // Other fingers (middle/ring/pinky/thumb) are ignored —
    // the ARMED state + pinch threshold handle all false-positive prevention.
    const indexExtended = (L5.y - L8.y) > 0.10;  // tighter than before (was 0.08)
    this.isPistol = indexExtended;

    if (!this.isPistol) {
      this._pistolStartMs = 0;
      this._pinchFrames   = 0;
      this.xhairState     = XHAIR.NO_PISTOL;
      return;
    }

    // ── ARMED STATE ─────────────────────────────────────────────────
    // Record when we first entered pistol mode this streak.
    if (this._pistolStartMs === 0) this._pistolStartMs = timestamp;
    const pistolHeldMs = timestamp - this._pistolStartMs;
    const isArmed      = pistolHeldMs >= ARMED_HOLD_MS &&
                         (timestamp - this._lastShotMs) >= DEBOUNCE_MS;

    if (!isArmed) {
      this._pinchFrames = 0;
      this.xhairState   = XHAIR.ARMING;
      return;
    }

    this.xhairState = XHAIR.ACTIVE;

    // ── PINCH DISTANCE ──────────────────────────────────────────────
    // PRIORITY 1: World landmarks (real metres, immune to depth/size)
    // PRIORITY 2: Normalized ratio  (dist / palm size)
    let isPinching;

    if (worldLandmarks && worldLandmarks.length >= 21) {
      // World coordinates are in metres relative to the wrist
      const wL4 = worldLandmarks[4];
      const wL8 = worldLandmarks[8];
      const worldPinchM = this._dist(wL4, wL8);
      isPinching = worldPinchM < PINCH_WORLD_M;
    } else {
      // Fallback: normalise by palm length so hand size / depth don't matter
      const palmSize   = this._dist(L0, L9);
      const pinchRatio = palmSize > 0.001 ? this._dist(L4, L8) / palmSize : 1;
      isPinching = pinchRatio < PINCH_NORM_R;
    }

    // ── FRAME CONFIRMATION ──────────────────────────────────────────
    // Require PINCH_FRAMES consecutive frames of pinch before firing.
    // Eliminates single-frame noise spikes completely.
    if (isPinching) {
      this._pinchFrames++;
    } else {
      this._pinchFrames = 0;
    }

    // Fire on the EXACT frame we reach the confirmation count.
    // Subsequent frames while held do NOT re-fire.
    if (this._pinchFrames === PINCH_FRAMES) {
      this.shotFired      = true;
      this._lastShotMs    = timestamp;
      this._pistolStartMs = timestamp;   // reset armed timer (need to re-arm after shot)
      this.xhairState     = XHAIR.FIRING;
    }
  }

  // ── Cursor position in canvas pixels ─────────────────────────────
  getCursorPos(canvasW, canvasH) {
    return {
      x: this.cursorX * canvasW,
      y: this.cursorY * canvasH,
    };
  }

  getShotFired()   { return this.shotFired;   }
  getHasHand()     { return this.hasHand;     }
  getIsPistol()    { return this.isPistol;    }
  getXhairState()  { return this.xhairState;  }
}

export const gestures = new GestureController();
