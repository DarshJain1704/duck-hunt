// calibration.js — Pre-game calibration screen logic

const CIRCLE_X       = 320;   // center of 640px canvas
const CIRCLE_Y       = 240;   // center of 480px canvas
const CIRCLE_RADIUS  = 90;    // px
const HOLD_DURATION  = 2.0;   // seconds hand must stay in circle

export class Calibration {
  constructor() {
    this.progress     = 0;    // 0..1
    this.holdTimer    = 0;
    this.isComplete   = false;
    this.handDetected = false;
    this.handInCircle = false;
  }

  reset() {
    this.progress     = 0;
    this.holdTimer    = 0;
    this.isComplete   = false;
    this.handDetected = false;
    this.handInCircle = false;
  }

  /**
   * @param {Array|null} landmarks - MediaPipe landmarks (21 points)
   * @param {number}     dt        - delta time in seconds
   */
  update(landmarks, dt) {
    if (this.isComplete) return;

    if (!landmarks) {
      this.handDetected = false;
      this.handInCircle = false;
      // Slowly drain progress when hand is absent
      this.holdTimer = Math.max(0, this.holdTimer - dt * 1.5);
      this.progress  = this.holdTimer / HOLD_DURATION;
      return;
    }

    this.handDetected = true;

    // Mirror x (camera is mirrored) then project to canvas
    const mirroredX = 1 - landmarks[8].x;
    const tipX = mirroredX * 640;
    const tipY = landmarks[8].y * 480;

    const dist = Math.sqrt((tipX - CIRCLE_X) ** 2 + (tipY - CIRCLE_Y) ** 2);
    this.handInCircle = dist < CIRCLE_RADIUS;

    if (this.handInCircle) {
      this.holdTimer += dt;
      this.progress   = Math.min(this.holdTimer / HOLD_DURATION, 1);
      if (this.holdTimer >= HOLD_DURATION) {
        this.isComplete = true;
      }
    } else {
      // Drain slower than fill so it's not frustrating
      this.holdTimer = Math.max(0, this.holdTimer - dt * 1.8);
      this.progress  = this.holdTimer / HOLD_DURATION;
    }
  }

  get done() { return this.isComplete; }

  // Expose for renderer
  get circleX()      { return CIRCLE_X;      }
  get circleY()      { return CIRCLE_Y;      }
  get circleRadius() { return CIRCLE_RADIUS; }
}
