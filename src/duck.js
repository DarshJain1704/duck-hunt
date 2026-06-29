// duck.js — Duck entity: flight AI, hit detection, animation

export const DUCK_W = 64;
export const DUCK_H = 48;

const ANIM_FPS = 8; // animation frames per second

export const DUCK_STATES = {
  FLYING:   'FLYING',
  HIT:      'HIT',
  FALLING:  'FALLING',
  ESCAPED:  'ESCAPED',
  DONE:     'DONE',
};

export const PATTERNS = {
  ZIGZAG:   'ZIGZAG',
  SINE:     'SINE',
  ERRATIC:  'ERRATIC',
};

export class Duck {
  /**
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {number} speed   - base speed in canvas-px / frame @ 60fps
   * @param {string} pattern - one of PATTERNS
   */
  constructor(canvasW, canvasH, speed, pattern = PATTERNS.ZIGZAG, isGolden = false) {
    this.canvasW  = canvasW;
    this.canvasH  = canvasH;
    this.speed    = speed * (isGolden ? 1.4 : 1.0);   // golden ducks are 40% faster
    this.pattern  = pattern;
    this.state    = DUCK_STATES.FLYING;
    this.isGolden = isGolden;

    // Spawn at bottom, random horizontal position
    this.x  = 80 + Math.random() * (canvasW - 160);
    this.y  = canvasH - DUCK_H - 10;

    // Initial upward velocity
    const hDir = Math.random() < 0.5 ? 1 : -1;
    this.vx = hDir * this.speed * (0.6 + Math.random() * 0.4);
    this.vy = -this.speed * (0.9 + Math.random() * 0.3);

    this.direction   = this.vx >= 0 ? 'RIGHT' : 'LEFT';

    // Animation
    this.animFrame   = 0;
    this.animTimer   = 0;

    // Timers
    this.aliveTimer  = 0;
    this.hitTimer    = 0;

    // For SINE pattern
    this.sineOffset  = Math.random() * Math.PI * 2;

    // For ERRATIC pattern
    this.erraticTimer = 0;

    // For FALLING
    this.fallVelocity = 0;
    this.fallAngle    = 0;
    this.fallSpin     = (Math.random() - 0.5) * 6; // radians/s
  }

  // ─── Bounding box for hit detection ─────────────────────────────
  get bounds() { return { x: this.x, y: this.y, w: DUCK_W, h: DUCK_H }; }

  checkHit(cx, cy) {
    // Inset hitbox by 6px so near-misses feel fair
    const inset = 6;
    return cx >= this.x + inset &&
           cx <= this.x + DUCK_W - inset &&
           cy >= this.y + inset &&
           cy <= this.y + DUCK_H - inset;
  }

  hit() {
    if (this.state !== DUCK_STATES.FLYING) return;
    this.state    = DUCK_STATES.HIT;
    this.hitTimer = 0;
    this.vx = 0;
    this.vy = 0;
  }

  // ─── Main update ─────────────────────────────────────────────────
  update(dt) {
    // Animation tick (all states)
    this.animTimer += dt;
    if (this.animTimer >= 1 / ANIM_FPS) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 4;
    }

    switch (this.state) {
      case DUCK_STATES.FLYING:
        this._updateFlying(dt);
        break;

      case DUCK_STATES.HIT:
        this.hitTimer += dt;
        if (this.hitTimer >= 0.45) {
          this.state        = DUCK_STATES.FALLING;
          this.fallVelocity = -2; // brief upward pop before gravity
        }
        break;

      case DUCK_STATES.FALLING:
        this.fallVelocity  += 900 * dt;            // gravity
        this.y             += this.fallVelocity * dt;
        this.fallAngle     += this.fallSpin * dt;
        if (this.y > this.canvasH + 60) {
          this.state = DUCK_STATES.DONE;
        }
        break;

      case DUCK_STATES.ESCAPED:
        // Fly straight upward off screen
        this.x += this.vx * dt * 60 * 0.25;
        this.y += this.vy * dt * 60;
        if (this.y < -120) this.state = DUCK_STATES.DONE;
        break;

      case DUCK_STATES.DONE:
        break;
    }
  }

  _updateFlying(dt) {
    this.aliveTimer += dt;

    const playTop    = 40;   // top boundary (below HUD)
    const playBottom = 340;  // bottom boundary (above grass)

    switch (this.pattern) {
      case PATTERNS.ZIGZAG:
        // Bounce off top & bottom of play zone
        if (this.y < playTop)    { this.y = playTop;    this.vy = Math.abs(this.vy); }
        if (this.y > playBottom) { this.y = playBottom; this.vy = -Math.abs(this.vy); }
        break;

      case PATTERNS.SINE:
        this.vy = Math.sin((this.aliveTimer + this.sineOffset) * 2.5) * this.speed * 0.9;
        this.y = Math.max(playTop, Math.min(playBottom, this.y));
        break;

      case PATTERNS.ERRATIC:
        this.erraticTimer += dt;
        if (this.erraticTimer > 0.35 + Math.random() * 0.35) {
          this.erraticTimer = 0;
          this.vx = (Math.random() - 0.5) * this.speed * 2.4;
          this.vy = (Math.random() - 0.5) * this.speed * 2.4;
        }
        if (this.y < playTop)    this.vy = Math.abs(this.vy);
        if (this.y > playBottom) this.vy = -Math.abs(this.vy);
        break;
    }

    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;

    // Bounce off left/right walls
    if (this.x < 0)                   { this.x = 0;                   this.vx =  Math.abs(this.vx); }
    if (this.x > this.canvasW - DUCK_W){ this.x = this.canvasW - DUCK_W; this.vx = -Math.abs(this.vx); }

    // Update facing direction
    if (Math.abs(this.vx) > 0.1) {
      this.direction = this.vx >= 0 ? 'RIGHT' : 'LEFT';
    }
  }
}
