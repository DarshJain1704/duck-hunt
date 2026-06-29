// game.js — Game loop, round management, duck spawning, scoring

import { Duck, DUCK_STATES } from './duck.js';
import { Dog } from './dog.js';

// ─── Difficulty configs per round ─────────────────────────────────
const ROUND_CONFIGS = [
  { speed: 2.4, duckCount: 10, timeout: 8.0, pattern: 'ZIGZAG',  twoAtOnce: false }, // Round 1
  { speed: 3.0, duckCount: 10, timeout: 7.5, pattern: 'ZIGZAG',  twoAtOnce: false }, // Round 2
  { speed: 3.8, duckCount: 12, timeout: 7.0, pattern: 'SINE',    twoAtOnce: false }, // Round 3
  { speed: 4.5, duckCount: 12, timeout: 6.0, pattern: 'ERRATIC', twoAtOnce: true  }, // Round 4
  { speed: 5.5, duckCount: 14, timeout: 5.0, pattern: 'ERRATIC', twoAtOnce: true  }, // Round 5+
];

const MAX_LIVES   = 3;
const MAX_BULLETS = 3;

function getConfig(round) {
  return ROUND_CONFIGS[Math.min(round - 1, ROUND_CONFIGS.length - 1)];
}

export class Game {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.dog     = new Dog(canvasW, canvasH);
    this._init();
  }

  _init() {
    this.score           = 0;
    this.lives           = MAX_LIVES;
    this.round           = 1;
    this.bullets         = MAX_BULLETS;
    this.combo           = 0;
    this.comboTimer      = 0;
    this.comboLegend     = false;   // true for one frame when combo hits 5
    this.ducksHit        = 0;
    this.shotsFired      = 0;
    this.currentDucks    = [];
    this.particles       = [];
    this.floatingTexts   = [];
    this.ducksInRound    = 0;
    this.ducksSpawned    = 0;
    this.encounterNum    = 0;
    this.duckTimer       = 0;
    this.interludeTimer  = 0;
    this.config          = null;
    this.encounterState  = 'IDLE';
    this._pendingGameOver = false;
    this._gameOver        = false;
    this._roundComplete   = false;
    // ── Time freeze power-up ────────────────────────────────────────
    this.freezeTimer      = 0;     // seconds remaining of freeze effect
    this.freezePowerup    = null;  // { x, y, timer } — floating icon on screen
    this._freezeCooldown  = 0;     // so we don't spawn another immediately
  }

  reset() {
    this._init();
    this.dog = new Dog(this.canvasW, this.canvasH);
  }

  // ─── Start a round ────────────────────────────────────────────────
  startRound(roundNum) {
    this.round          = roundNum;
    this.config         = getConfig(roundNum);
    this.ducksInRound   = this.config.duckCount;
    this.ducksSpawned   = 0;
    this.encounterNum   = 0;
    this._roundComplete = false;
    this._gameOver      = false;
    this._pendingGameOver = false;
    this.encounterState = 'IDLE';
    this._spawnEncounter();
  }

  _spawnEncounter() {
    const remaining = this.ducksInRound - this.ducksSpawned;
    if (remaining <= 0) {
      this._roundComplete = true;
      this.encounterState = 'IDLE';
      return;
    }

    const { speed, pattern, twoAtOnce } = this.config;

    // 1-in-8 chance of a golden duck (not on two-at-once to avoid chaos)
    const golden = !twoAtOnce && Math.random() < 0.125;
    this.currentDucks = [new Duck(this.canvasW, this.canvasH, speed, pattern, golden)];

    if (twoAtOnce && remaining > 1) {
      this.currentDucks.push(new Duck(this.canvasW, this.canvasH, speed, pattern, false));
    }

    this.ducksSpawned  += this.currentDucks.length;
    this.encounterNum  += 1;
    this.bullets        = MAX_BULLETS;
    this.duckTimer      = 0;
    this.encounterState = 'ACTIVE';

    // Occasionally spawn a freeze power-up (after encounter 2, ~30% chance, 1 per spawn window)
    if (this.encounterNum > 2 && this._freezeCooldown <= 0 &&
        Math.random() < 0.30 && !this.freezePowerup) {
      this.freezePowerup = {
        x:     120 + Math.random() * (this.canvasW - 240),
        y:     80  + Math.random() * 180,
        timer: 6.0,   // disappears after 6s if not collected
      };
      this._freezeCooldown = 20; // encounters before next powerup can appear
    }
    if (this._freezeCooldown > 0) this._freezeCooldown--;
  }

  // ─── Shoot — called from main loop when shot gesture fires ────────
  /**
   * @returns {'HIT'|'MISS'|'SHOT'|'NONE'}
   *   HIT  = duck was hit
   *   MISS = all bullets spent with duck still alive
   *   SHOT = shot fired but no duck hit (bullet remains)
   *   NONE = shot ignored (wrong state)
   */
  shoot(cx, cy) {
    // ── Dog hit (easter egg) ────────────────────────────────────────
    if (this.dog.checkHit(cx, cy)) {
      this.dog.scare();
      const bonus = 200;
      this.score += bonus;
      this.floatingTexts.push({
        x: this.dog.x + 36, y: this.dog.y - 10,
        text: `+${bonus} BAD DOG!`, maxTimer: 1.8, timer: 1.8,
      });
      this._spawnParticles(this.dog.x + 36, this.dog.y + 45, ['#FF4444','#FFD700','#FFA500']);
      return 'DOG_HIT';
    }

    if (this.encounterState !== 'ACTIVE' || this.bullets <= 0) return 'NONE';

    this.bullets--;
    this.shotsFired++;

    // ── Freeze power-up hit ─────────────────────────────────────────
    if (this.freezePowerup) {
      const fp = this.freezePowerup;
      const r  = 22;
      if (Math.abs(cx - fp.x) < r && Math.abs(cy - fp.y) < r) {
        this.freezePowerup = null;
        this.freezeTimer   = 5.0;  // 5 seconds of slow-mo
        this.floatingTexts.push({
          x: fp.x, y: fp.y - 10,
          text: 'TIME FREEZE!', maxTimer: 1.5, timer: 1.5,
        });
        
        // Refund bullet so player isn't penalized for collecting it
        this.bullets++;
        this.shotsFired--;
        
        return 'FREEZE';
      }
    }

    // Check hit on each flying duck
    let hitAny = false;
    for (const duck of this.currentDucks) {
      if (duck.state === DUCK_STATES.FLYING && duck.checkHit(cx, cy)) {
        duck.hit();
        hitAny         = true;
        this.ducksHit++;
        this.combo++;
        this.comboTimer  = 1.8;
        this.comboLegend = (this.combo === 5);  // fire combo legend at exactly 5

        // Score: golden duck = 500 flat, else base + bonuses
        let points;
        if (duck.isGolden) {
          points = 500;
        } else {
          const base        = 100 + (this.round - 1) * 50;
          const bulletBonus = this.bullets === 2 ? 1.5 : this.bullets === 1 ? 1.0 : 0.75;
          const comboBonus  = Math.min(this.combo * 0.4, 2.5);
          points = Math.floor(base * bulletBonus * (1 + comboBonus - 0.4));
        }

        this.score += points;

        const label = duck.isGolden ? `✨ +${points} GOLDEN!` : `+${points}`;
        this.floatingTexts.push({
          x: duck.x + 32, y: duck.y,
          text: label, maxTimer: 1.4, timer: 1.4,
        });

        this._spawnParticles(
          duck.x + 32, duck.y + 24,
          duck.isGolden
            ? ['#FFD700','#FFF8A0','#FFA500','#FFFFFF']
            : ['#FFD700','#FFFFFF','#FF4444','#00FF41','#FFA500']
        );
      }
    }

    if (hitAny) {
      const allResolved = this.currentDucks.every(d => d.state !== DUCK_STATES.FLYING);
      if (allResolved) this.encounterState = 'ENCOUNTER_HIT';
      return 'HIT';
    }

    // Miss — no duck hit
    if (this.bullets === 0) {
      this._triggerMiss();
      return 'MISS';
    }

    return 'SHOT';
  }

  _triggerMiss() {
    if (this.encounterState === 'ENCOUNTER_MISS') return;
    this.encounterState = 'ENCOUNTER_MISS';
    this.combo = 0;

    // Make still-flying ducks escape upward
    for (const duck of this.currentDucks) {
      if (duck.state === DUCK_STATES.FLYING) {
        duck.state = DUCK_STATES.ESCAPED;
        duck.vx   *= 0.3;
        duck.vy    = -7;
      }
    }

    this.lives--;
    this._pendingGameOver = this.lives <= 0;
    this.dog.show();
  }

  // ─── Main update ─────────────────────────────────────────────────
  update(dt) {
    if (this._gameOver || this._roundComplete) return;

    this.dog.update(dt);
    // Ducks are updated inside the switch cases below (with freeze scaling applied)

    // Floating texts
    this.floatingTexts = this.floatingTexts.filter(t => {
      t.y     -= 45 * dt;
      t.timer -= dt;
      return t.timer > 0;
    });

    // Particles
    this.particles = this.particles.filter(p => {
      p.x     += p.vx * dt;
      p.y     += p.vy * dt;
      p.vy    += 250 * dt; // gravity
      p.timer -= dt;
      return p.timer > 0;
    });

    // Combo display decay
    if (this.comboTimer > 0) this.comboTimer -= dt;
    this.comboLegend = false;   // reset each frame (only true for exactly 1 frame)

    // Freeze power-up tick
    if (this.freezeTimer > 0) this.freezeTimer -= dt;
    if (this.freezePowerup) {
      this.freezePowerup.timer -= dt;
      if (this.freezePowerup.timer <= 0) this.freezePowerup = null;
    }

    switch (this.encounterState) {
      case 'ACTIVE': {
        this.duckTimer += this.freezeTimer > 0 ? 0 : dt;  // freeze pauses timer
        const freezeDt  = this.freezeTimer > 0 ? dt * 0.2 : dt;
        this.currentDucks.forEach(d => d.update(freezeDt));
        const flyingDucks = this.currentDucks.filter(d => d.state === DUCK_STATES.FLYING);
        // Timeout → miss (only when not frozen)
        if (flyingDucks.length > 0 && this.duckTimer >= this.config.timeout) {
          this._triggerMiss();
        }
        break;
      }

      case 'ENCOUNTER_HIT': {
        this.currentDucks.forEach(d => d.update(dt));
        // Wait for all ducks to finish their fall animation
        const allDone = this.currentDucks.every(
          d => d.state === DUCK_STATES.DONE || d.state === DUCK_STATES.ESCAPED
        );
        if (allDone) {
          this.encounterState = 'INTERLUDE';
          this.interludeTimer = 0.6;
        }
        break;
      }

      case 'ENCOUNTER_MISS': {
        this.currentDucks.forEach(d => d.update(dt));
        // Wait for dog animation to finish
        if (this.dog.isHidden()) {
          if (this._pendingGameOver) {
            this._gameOver = true;
          } else {
            this._spawnEncounter();
          }
        }
        break;
      }

      case 'INTERLUDE': {
        this.currentDucks.forEach(d => d.update(dt));
        this.interludeTimer -= dt;
        if (this.interludeTimer <= 0) {
          this._spawnEncounter();
        }
        break;
      }
    }
  }

  // ─── Hit burst particles ──────────────────────────────────────────
  _spawnParticles(cx, cy, colors = ['#FFD700','#FFFFFF','#FF4444','#00FF41','#FFA500']) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i / count) + Math.random() * 0.6;
      const speed = 90 + Math.random() * 110;
      this.particles.push({
        x:     cx,
        y:     cy,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 60,
        timer: 0.45 + Math.random() * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size:  2 + Math.random() * 3,
      });
    }
  }

  /** Spawn a large rainbow burst for combo legend */
  spawnComboLegendBurst(cx, cy) {
    const rainbow = ['#FF0000','#FF7700','#FFFF00','#00FF41','#0088FF','#8800FF','#FF00FF'];
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i / 30) + Math.random() * 0.4;
      const speed = 140 + Math.random() * 180;
      this.particles.push({
        x:     cx,
        y:     cy,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 80,
        timer: 0.7 + Math.random() * 0.4,
        color: rainbow[i % rainbow.length],
        size:  3 + Math.random() * 4,
      });
    }
  }

  get isGameOver()     { return this._gameOver;     }
  get isRoundComplete(){ return this._roundComplete; }
  get freezeActive()   { return this.freezeTimer > 0; }
  get accuracy() {
    if (this.shotsFired === 0) return 100;
    return Math.round((this.ducksHit / this.shotsFired) * 100);
  }
  get ducksLeftInRound() {
    return Math.max(0, this.ducksInRound - this.ducksSpawned);
  }
  get totalEncounters() {
    return this.config ? Math.ceil(this.ducksInRound / (this.config.twoAtOnce ? 2 : 1)) : 0;
  }
}
