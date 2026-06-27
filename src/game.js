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
    this.comboTimer      = 0;   // how long to display combo label
    this.ducksHit        = 0;
    this.shotsFired      = 0;
    this.currentDucks    = [];
    this.particles       = [];
    this.floatingTexts   = [];
    this.ducksInRound    = 0;
    this.ducksSpawned    = 0;   // total spawned this round
    this.encounterNum    = 0;
    this.duckTimer       = 0;
    this.interludeTimer  = 0;
    this.config          = null;
    this.encounterState  = 'IDLE'; // IDLE | ACTIVE | ENCOUNTER_HIT | ENCOUNTER_MISS | INTERLUDE
    this._pendingGameOver = false;
    this._gameOver        = false;
    this._roundComplete   = false;
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
    this.currentDucks = [new Duck(this.canvasW, this.canvasH, speed, pattern)];

    if (twoAtOnce && remaining > 1) {
      this.currentDucks.push(new Duck(this.canvasW, this.canvasH, speed, pattern));
    }

    this.ducksSpawned  += this.currentDucks.length;
    this.encounterNum  += 1;
    this.bullets        = MAX_BULLETS;
    this.duckTimer      = 0;
    this.encounterState = 'ACTIVE';
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
    if (this.encounterState !== 'ACTIVE' || this.bullets <= 0) return 'NONE';

    this.bullets--;
    this.shotsFired++;

    // Check hit on each flying duck
    let hitAny = false;
    for (const duck of this.currentDucks) {
      if (duck.state === DUCK_STATES.FLYING && duck.checkHit(cx, cy)) {
        duck.hit();
        hitAny         = true;
        this.ducksHit++;
        this.combo++;
        this.comboTimer = 1.8;

        // Score: base + round bonus + bullet bonus + combo bonus
        const base        = 100 + (this.round - 1) * 50;
        const bulletBonus = this.bullets === 2 ? 1.5 : this.bullets === 1 ? 1.0 : 0.75;
        const comboBonus  = Math.min(this.combo * 0.4, 2.5);
        const points      = Math.floor(base * bulletBonus * (1 + comboBonus - 0.4));

        this.score += points;

        // Floating score text
        this.floatingTexts.push({
          x: duck.x + 32,
          y: duck.y,
          text: `+${points}`,
          maxTimer: 1.2,
          timer: 1.2,
        });

        // Burst particles
        this._spawnParticles(duck.x + 32, duck.y + 24);
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
    this.currentDucks.forEach(d => d.update(dt));

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

    switch (this.encounterState) {
      case 'ACTIVE': {
        this.duckTimer += dt;
        const flyingDucks = this.currentDucks.filter(d => d.state === DUCK_STATES.FLYING);
        // Timeout → miss
        if (flyingDucks.length > 0 && this.duckTimer >= this.config.timeout) {
          this._triggerMiss();
        }
        break;
      }

      case 'ENCOUNTER_HIT': {
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
        this.interludeTimer -= dt;
        if (this.interludeTimer <= 0) {
          this._spawnEncounter();
        }
        break;
      }
    }
  }

  // ─── Hit burst particles ──────────────────────────────────────────
  _spawnParticles(cx, cy) {
    const count  = 10;
    const colors = ['#FFD700', '#FFFFFF', '#FF4444', '#00FF41', '#FFA500'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i / count) + Math.random() * 0.6;
      const speed = 90 + Math.random() * 110;
      this.particles.push({
        x:      cx,
        y:      cy,
        vx:     Math.cos(angle) * speed,
        vy:     Math.sin(angle) * speed - 60,
        timer:  0.45 + Math.random() * 0.2,
        color:  colors[Math.floor(Math.random() * colors.length)],
        size:   2 + Math.random() * 3,
      });
    }
  }

  // ─── Getters ─────────────────────────────────────────────────────
  get isGameOver()     { return this._gameOver;     }
  get isRoundComplete(){ return this._roundComplete; }
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
