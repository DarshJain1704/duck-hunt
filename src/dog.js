// dog.js — The laughing dog that pops up after a miss

const DOG_RISE_SPEED = 260; // px/s
const LAUGH_DURATION = 2.2;  // seconds

export class Dog {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.restY   = canvasH + 150;          // hidden well below canvas
    this.peekY   = canvasH - 140;          // visible position
    this.x       = canvasW * 0.15 - 36;   // bottom left area
    this.y       = this.restY;
    this.state   = 'HIDDEN';   // HIDDEN | RISING | LAUGHING | DESCENDING
    this.timer   = 0;
    this.animFrame  = 0;
    this.animTimer  = 0;
    this.onDone     = null;    // optional callback when animation finishes
  }

  show(onDone = null) {
    this.y      = this.restY;
    this.state  = 'RISING';
    this.timer  = 0;
    this.onDone = onDone;
  }

  isHidden() { return this.state === 'HIDDEN'; }

  update(dt) {
    // Animate frames
    this.animTimer += dt;
    if (this.animTimer >= 0.28) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % 3;
    }

    switch (this.state) {
      case 'RISING':
        this.y -= DOG_RISE_SPEED * dt;
        if (this.y <= this.peekY) {
          this.y    = this.peekY;
          this.state = 'LAUGHING';
          this.timer = 0;
        }
        break;

      case 'LAUGHING':
        this.timer += dt;
        if (this.timer >= LAUGH_DURATION) {
          this.state = 'DESCENDING';
        }
        break;

      case 'DESCENDING':
        this.y += DOG_RISE_SPEED * dt;
        if (this.y >= this.restY) {
          this.y  = this.restY;
          this.state = 'HIDDEN';
          if (this.onDone) this.onDone();
        }
        break;

      case 'HIDDEN':
        break;
    }
  }

  draw(ctx) {
    if (this.state === 'HIDDEN') return;
    this._drawDog(ctx, this.x, this.y);
  }

  _drawDog(ctx, x, y) {
    const frame = this.animFrame;

    // ── Grass hiding patch (the grass he pops out of) ──────────────
    ctx.fillStyle = '#3A7D44';
    ctx.fillRect(x - 8, y + 115, 88, 30);
    ctx.fillStyle = '#5ECF00';
    ctx.fillRect(x - 8, y + 112, 88, 8);

    // ── Body ────────────────────────────────────────────────────────
    ctx.fillStyle = '#C68642';
    ctx.fillRect(x + 12, y + 58, 48, 52);

    // ── Head ────────────────────────────────────────────────────────
    ctx.fillStyle = '#D4944A';
    ctx.beginPath();
    ctx.arc(x + 36, y + 45, 28, 0, Math.PI * 2);
    ctx.fill();

    // ── Ears (flop up/down by frame) ────────────────────────────────
    ctx.fillStyle = '#A0632A';
    // left ear
    const earL = frame === 1 ? 8 : 0;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 22);
    ctx.lineTo(x + 0,  y + 52 + earL);
    ctx.lineTo(x + 20, y + 35);
    ctx.closePath();
    ctx.fill();
    // right ear
    const earR = frame === 2 ? 8 : 0;
    ctx.beginPath();
    ctx.moveTo(x + 60, y + 22);
    ctx.lineTo(x + 72, y + 52 + earR);
    ctx.lineTo(x + 52, y + 35);
    ctx.closePath();
    ctx.fill();

    // ── Eyes (squinting laugh lines) ────────────────────────────────
    ctx.strokeStyle = '#1a0a00';
    ctx.lineWidth = 2.5;
    // left
    ctx.beginPath();
    ctx.arc(x + 24, y + 40, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // right
    ctx.beginPath();
    ctx.arc(x + 48, y + 40, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // ── Nose ────────────────────────────────────────────────────────
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath();
    ctx.ellipse(x + 36, y + 53, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Laughing mouth ──────────────────────────────────────────────
    ctx.fillStyle = '#CC2222';
    ctx.beginPath();
    ctx.arc(x + 36, y + 62, 12, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#1a0a00';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // teeth
    ctx.fillStyle = '#FFF';
    ctx.fillRect(x + 27, y + 62, 6, 7);
    ctx.fillRect(x + 35, y + 62, 6, 7);
    // tongue
    ctx.fillStyle = '#FF7777';
    ctx.beginPath();
    ctx.ellipse(x + 36, y + 71, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── "HA" speech bubbles ─────────────────────────────────────────
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${frame === 1 ? 14 : 12}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    const ha = frame === 0 ? 'HA!' : frame === 1 ? 'HA HA!' : 'HA!';
    ctx.fillText(ha, x + 36, y - 4);
  }
}
