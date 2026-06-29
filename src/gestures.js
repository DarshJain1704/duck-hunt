// gestures.js — Pistol detection, crosshair smoothing, shot trigger
//
// DESIGN:
//   Aim  → L5 (index MCP/knuckle) — rock-solid, doesn't move during pinch
//   Fire → pinch entry: thumb tip touches index tip
//
// THREE-LAYER RELIABILITY SYSTEM:
//   1. World landmarks   — real-world metre distances, ORIENTATION-INVARIANT
//                          Works regardless of hand angle to camera
//   2. ARMED state       — must hold pistol for ARMED_HOLD_MS before shooting
//   3. Frame confirmation — pinch must persist for PINCH_FRAMES consecutive frames
//
// WHY WORLD LANDMARKS FOR EXTENSION:
//   Image-space Y check (L5.y - L8.y) fails when the hand faces the camera
//   or is tilted — the tip and knuckle appear at the same Y even when fully
//   extended. World-space distance is always ~7-8cm when extended, ~3cm curled,
//   regardless of hand orientation.
//
// State machine:  IDLE ──► ARMING ──► ARMED ──► COOLDOWN ──► ARMED
//                   └──────────────────────────────────────────┘ (hand lost → IDLE)

const LERP_FACTOR    = 0.22;   // cursor smoothing (lower = smoother but laggier)
const ARMED_HOLD_MS  = 150;    // ms pistol must be held before first shot is possible
const DEBOUNCE_MS    = 350;    // ms cooldown between shots
const PINCH_FRAMES   = 2;      // consecutive frames pinch must hold to fire (~33ms @60fps)

// ── Index extension (world space) ───────────────────────────────────
// Finger is "extended" when tip is >5cm from knuckle in 3D world space.
// Finger is "curled"   when tip is <3.5cm from knuckle.
const INDEX_EXTENDED_WORLD_M = 0.050;  // 5 cm — orientation-invariant
const INDEX_EXTENDED_NORM_Y  = 0.07;   // fallback: Y-diff when world unavailable

// ── Pinch thresholds ─────────────────────────────────────────────────
// World (metres): real physical distance, immune to depth/hand size
// Norm ratio    : dist(L4,L8)/palmSize, fallback
const PINCH_WORLD_M = 0.035;  // 3.5 cm — deliberate touch with jitter margin
const PINCH_NORM_R  = 0.22;   // 22% of palm length — normalized fallback

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
    this._pistolStartMs = 0;   // when we first detected pistol this streak
    this._lastShotMs    = 0;   // timestamp of the last registered shot
    this._pinchFrames   = 0;   // consecutive frames of active pinch

    // ── Exported state ──────────────────────────────────────────────
    this.shotFired  = false;
    this.isPistol   = false;
    this.hasHand    = false;
    this.xhairState = XHAIR.NO_HAND;
  }

  // ── Euclidean distance (works for both image and world landmarks) ─
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
    const hasWorld = worldLandmarks && worldLandmarks.length >= 21;

    // ── Landmarks ───────────────────────────────────────────────────
    const L0 = landmarks[0];   // WRIST
    const L4 = landmarks[4];   // THUMB TIP       ← trigger
    const L5 = landmarks[5];   // INDEX MCP       ← AIM POINT (stable during pinch)
    const L8 = landmarks[8];   // INDEX TIP       ← extension & pinch ref
    const L9 = landmarks[9];   // MIDDLE MCP      ← palm size ref (normalized fallback)

    // ── AIM: track index knuckle (L5) — not fingertip ──────────────
    // L5 doesn't move when the thumb pinches, so aim is locked during fire.
    const mirX = 1 - L5.x;    // mirror: front camera is flipped
    this.cursorX += (mirX  - this.cursorX) * LERP_FACTOR;
    this.cursorY += (L5.y  - this.cursorY) * LERP_FACTOR;

    // ── PISTOL GATE — index extended ────────────────────────────────
    // KEY FIX: Use world-space distance (L5→L8) when available.
    // Image-space Y check (L5.y - L8.y) FAILS when the hand faces the
    // camera or tilts — tip and knuckle appear at the same image Y even
    // when the finger is fully extended. World distance is always ~7-8cm
    // when extended, regardless of hand orientation.
    let indexExtended;
    if (hasWorld) {
      // World distance from knuckle to tip: ~7cm extended, ~3cm curled
      const wExtension = this._dist(worldLandmarks[5], worldLandmarks[8]);
      indexExtended = wExtension > INDEX_EXTENDED_WORLD_M;
    } else {
      // Fallback: Y-diff in image space (works when hand is not facing cam)
      indexExtended = (L5.y - L8.y) > INDEX_EXTENDED_NORM_Y;
    }

    this.isPistol = indexExtended;

    if (!this.isPistol) {
      this._pistolStartMs = 0;
      this._pinchFrames   = 0;
      this.xhairState     = XHAIR.NO_PISTOL;
      return;
    }

    // ── ARMED STATE ─────────────────────────────────────────────────
    // Require the index to have been extended for ARMED_HOLD_MS continuously.
    // Prevents accidental fires when the finger first extends into position.
    if (this._pistolStartMs === 0) this._pistolStartMs = timestamp;
    const pistolHeldMs = timestamp - this._pistolStartMs;
    const isArmed = pistolHeldMs >= ARMED_HOLD_MS &&
                    (timestamp - this._lastShotMs) >= DEBOUNCE_MS;

    if (!isArmed) {
      this._pinchFrames = 0;
      this.xhairState   = XHAIR.ARMING;
      return;
    }

    this.xhairState = XHAIR.ACTIVE;

    // ── PINCH DISTANCE ──────────────────────────────────────────────
    // PRIORITY 1: World landmarks — real cm, immune to camera depth & hand size
    // PRIORITY 2: Normalized ratio — dist/palmSize, depth-corrected fallback
    let isPinching;
    if (hasWorld) {
      const worldPinchM = this._dist(worldLandmarks[4], worldLandmarks[8]);
      isPinching = worldPinchM < PINCH_WORLD_M;
    } else {
      const palmSize   = this._dist(L0, L9);
      const pinchRatio = palmSize > 0.001 ? this._dist(L4, L8) / palmSize : 1;
      isPinching = pinchRatio < PINCH_NORM_R;
    }

    // ── FRAME CONFIRMATION ──────────────────────────────────────────
    // Pinch must be true for PINCH_FRAMES consecutive frames.
    // Eliminates single-frame noise. Fires on the frame count is exactly met
    // (not >=) so holding the pinch doesn't spam shots.
    if (isPinching) {
      this._pinchFrames++;
    } else {
      this._pinchFrames = 0;
    }

    if (this._pinchFrames === PINCH_FRAMES) {
      this.shotFired      = true;
      this._lastShotMs    = timestamp;
      this._pistolStartMs = timestamp;  // re-arm after each shot
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
