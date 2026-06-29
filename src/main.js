// main.js — App state machine & game loop entry point

import { HandTracker }      from './handTracker.js';
import { gestures }         from './gestures.js';
import { Game }             from './game.js';
import { Calibration }      from './calibration.js';
import { audio }            from './audio.js';
import { getHighScore, setHighScore } from './storage.js';
import * as R               from './renderer.js';

const CW = 640, CH = 480;

const STATES = {
  LOADING:        'LOADING',
  CALIBRATION:    'CALIBRATION',
  MENU:           'MENU',
  PLAYING:        'PLAYING',
  ROUND_COMPLETE: 'ROUND_COMPLETE',
  GAME_OVER:      'GAME_OVER',
};


class App {
  constructor() {
    this.canvas    = document.getElementById('gameCanvas');
    this.ctx       = this.canvas.getContext('2d');
    this.videoEl   = document.getElementById('webcam');

    this.state          = STATES.LOADING;
    this.game           = new Game(CW, CH);
    this.calibration    = new Calibration();

    this.lastTs         = 0;
    this.loadProgress   = 0;
    this.crosshairState = 'NO_HAND';
    this.currentRound   = 1;
    this.isNewHighScore = false;
    this.initError      = null;
    this._scale         = 1;    // CSS scale factor (updated in _scaleGame)
    this._hoveredBtn    = null; // currently highlighted HTML button

    // DOM elements
    this._els = {
      loading:   document.getElementById('loading-screen'),
      menu:      document.getElementById('menu-buttons'),
      gameHud:   document.getElementById('game-hud'),
      gameOver:  document.getElementById('gameover-buttons'),
      roundDone: document.getElementById('round-buttons'),
      sfxBtn:    document.getElementById('sfx-btn'),
      bgmBtn:    document.getElementById('bgm-btn'),
      fsBtn:     document.getElementById('fullscreen-btn'),
      errorMsg:  document.getElementById('error-msg'),
    };

    this._bindButtons();
    this._scaleGame();
    window.addEventListener('resize', () => this._scaleGame());
  }

  // ─── Responsive scaling ─────────────────────────────────────────
  _scaleGame() {
    const container = document.getElementById('game-container');
    const scale     = Math.min(window.innerWidth / CW, window.innerHeight / CH);
    this._scale     = scale;   // store for crosshair hit-testing
    const offX      = (window.innerWidth  - CW * scale) / 2;
    const offY      = (window.innerHeight - CH * scale) / 2;
    container.style.transform       = `scale(${scale})`;
    container.style.transformOrigin = 'top left';
    container.style.left            = `${offX}px`;
    container.style.top             = `${offY}px`;
  }

  // ─── Map canvas coords → screen coords, find hovered button ────
  _updateButtonHover(canvasX, canvasY, shot) {
    // Convert canvas position to screen position
    const container = document.getElementById('game-container');
    const cr        = container.getBoundingClientRect();
    // canvas is 640×480 but rendered at _scale
    const screenX   = cr.left + canvasX * this._scale;
    const screenY   = cr.top  + canvasY * this._scale;

    // Determine which buttons are currently interactive
    const candidates = [];
    if (this.state === STATES.MENU)           candidates.push(document.getElementById('start-btn'));
    if (this.state === STATES.ROUND_COMPLETE) candidates.push(document.getElementById('next-round-btn'));
    if (this.state === STATES.GAME_OVER) {
      candidates.push(document.getElementById('restart-btn'));
      candidates.push(document.getElementById('menu-btn'));
    }

    // Clear previous hover
    if (this._hoveredBtn) {
      this._hoveredBtn.classList.remove('crosshair-hover');
      this._hoveredBtn = null;
    }

    for (const btn of candidates) {
      if (!btn) continue;
      const r = btn.getBoundingClientRect();
      if (screenX >= r.left && screenX <= r.right &&
          screenY >= r.top  && screenY <= r.bottom) {
        this._hoveredBtn = btn;
        btn.classList.add('crosshair-hover');
        if (shot) btn.click();   // fire!
        break;
      }
    }
  }

  // ─── Button bindings ─────────────────────────────────────────────
  _bindButtons() {
    document.getElementById('start-btn').addEventListener('click', () => {
      if (this.state !== STATES.MENU) return;
      audio._ensure();
      this._startGame();
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      if (this.state !== STATES.GAME_OVER) return;
      audio._ensure();
      this._startGame();
    });

    document.getElementById('menu-btn').addEventListener('click', () => {
      if (this.state !== STATES.GAME_OVER) return;
      this._setState(STATES.MENU);
    });

    document.getElementById('next-round-btn').addEventListener('click', () => {
      if (this.state !== STATES.ROUND_COMPLETE) return;
      this.currentRound++;
      this.game.startRound(this.currentRound);
      this._setState(STATES.PLAYING);
    });

    this._els.sfxBtn.addEventListener('click', () => {
      const muted = audio.toggleSFX();
      this._els.sfxBtn.textContent = muted ? 'MUT.S' : 'SFX';
    });

    this._els.bgmBtn.addEventListener('click', () => {
      const muted = audio.toggleBGM();
      this._els.bgmBtn.textContent = muted ? 'MUT.B' : 'BGM';
    });

    this._els.fsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    });

    // Skip calibration (double-click on canvas during calibration)
    this.canvas.addEventListener('dblclick', () => {
      if (this.state === STATES.CALIBRATION) {
        audio._ensure();
        this._setState(STATES.MENU);
      }
    });
  }

  // ─── State transitions ───────────────────────────────────────────
  _setState(newState) {
    this.state = newState;

    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

    switch (newState) {
      case STATES.LOADING:
        this._els.loading.classList.remove('hidden');
        break;
      case STATES.MENU:
        this._els.menu.classList.remove('hidden');
        this._els.sfxBtn.classList.remove('hidden');
        this._els.bgmBtn.classList.remove('hidden');
        this._els.fsBtn.classList.remove('hidden');
        break;
      case STATES.PLAYING:
        this._els.gameHud.classList.remove('hidden');
        this._els.sfxBtn.classList.remove('hidden');
        this._els.bgmBtn.classList.remove('hidden');
        this._els.fsBtn.classList.remove('hidden');
        break;
      case STATES.ROUND_COMPLETE:
        this._els.roundDone.classList.remove('hidden');
        this._els.sfxBtn.classList.remove('hidden');
        this._els.bgmBtn.classList.remove('hidden');
        this._els.fsBtn.classList.remove('hidden');
        audio.playRoundComplete();
        break;
      case STATES.GAME_OVER:
        this._els.gameOver.classList.remove('hidden');
        this._els.sfxBtn.classList.remove('hidden');
        this._els.bgmBtn.classList.remove('hidden');
        this._els.fsBtn.classList.remove('hidden');
        audio.playGameOver();
        break;
    }
  }

  _startGame() {
    this.game.reset();
    this.currentRound   = 1;
    this.isNewHighScore = false;
    this.game.startRound(1);
    this._setState(STATES.PLAYING);
  }

  // ─── Initialization ──────────────────────────────────────────────
  async init() {
    this._setState(STATES.LOADING);

    // Fake progress animation while loading
    const progressInterval = setInterval(() => {
      this.loadProgress = Math.min(this.loadProgress + 0.04, 0.78);
    }, 180);

    try {
      await document.fonts.ready;          // ensure Press Start 2P is loaded
      await HandTracker.init();
      clearInterval(progressInterval);
      this.loadProgress = 0.9;

      await HandTracker.startCamera(this.videoEl);
      this.loadProgress = 1.0;

      // Brief pause so user sees 100%
      await delay(600);
      this.calibration.reset();
      this._setState(STATES.CALIBRATION);
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Init error:', err);
      this.initError = err.message || 'Unknown error';
      // Show error and fall through to menu so game is still usable
      if (this._els.errorMsg) {
        this._els.errorMsg.textContent = `⚠ ${this.initError}`;
        this._els.errorMsg.classList.remove('hidden');
      }
      await delay(2000);
      this._setState(STATES.MENU);
    }

    requestAnimationFrame(ts => this._loop(ts));
  }

  // ─── Main game loop ──────────────────────────────────────────────
  _loop(ts) {
    const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
    this.lastTs = ts;

    // ── Hand tracking ───────────────────────────────────────────────
    const landmarks      = HandTracker.processFrame(this.videoEl, ts);
    const worldLandmarks = HandTracker.getWorldLandmarks();
    gestures.update(landmarks, ts, worldLandmarks);

    const pos            = gestures.getCursorPos(CW, CH);
    const hasHand        = gestures.getHasHand();
    const isPistol       = gestures.getIsPistol();
    const shot           = gestures.getShotFired();
    this.crosshairState  = gestures.getXhairState();

    // ── State logic ─────────────────────────────────────────────────
    switch (this.state) {
      case STATES.LOADING:
        break;

      case STATES.CALIBRATION:
        this.calibration.update(landmarks, dt);
        if (this.calibration.done) {
          audio._ensure();
          this._setState(STATES.MENU);
        }
        break;

      case STATES.PLAYING: {
        // Process shot
        if (shot && isPistol) {
          R.triggerFlash();
          audio.playShot();

          const result = this.game.shoot(pos.x, pos.y);
          if (result === 'HIT') {
            audio.playHit();
            if (this.game.comboLegend) {
              // Combo legend: 5-hit streak — rainbow burst from screen center
              this.game.spawnComboLegendBurst(CW / 2, CH / 2);
              audio.playComboLegend();
            } else if (this.game.combo > 1) {
              audio.playCombo();
            }
          }
          if (result === 'MISS')    { audio.playMiss(); audio.playDogLaugh(); }
          if (result === 'DOG_HIT') { audio.playDogScared(); }
          if (result === 'FREEZE')  { audio.playTimeFreeze(); }
        }

        this.game.update(dt);

        // Check transitions
        if (this.game.isGameOver) {
          const isNew = setHighScore(this.game.score);
          this.isNewHighScore = isNew;
          this._setState(STATES.GAME_OVER);
        } else if (this.game.isRoundComplete) {
          this._setState(STATES.ROUND_COMPLETE);
        }
        break;
      }

      // MENU / ROUND_COMPLETE / GAME_OVER — check button hover + shoot
      case STATES.MENU:
      case STATES.ROUND_COMPLETE:
      case STATES.GAME_OVER:
        if (isPistol) this._updateButtonHover(pos.x, pos.y, shot);
        else if (this._hoveredBtn) {
          this._hoveredBtn.classList.remove('crosshair-hover');
          this._hoveredBtn = null;
        }
        break;
    }

    // ── Render ──────────────────────────────────────────────────────
    this._render(dt, pos, ts);

    requestAnimationFrame(ts2 => this._loop(ts2));
  }

  // ─── Render dispatch ─────────────────────────────────────────────
  _render(dt, pos, ts) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CW, CH);

    switch (this.state) {
      case STATES.LOADING:
        R.drawLoadingScreen(ctx, this.loadProgress);
        break;

      case STATES.CALIBRATION:
        R.drawCalibration(
          ctx, this.videoEl,
          this.calibration.progress,
          this.calibration.handDetected,
          this.calibration.circleX,
          this.calibration.circleY,
          this.calibration.circleRadius,
        );
        R.drawCrosshair(ctx, pos.x, pos.y, this.crosshairState);
        break;

      case STATES.MENU:
        R.drawBackground(ctx);
        R.drawMenuScreen(ctx, getHighScore());
        R.drawCrosshair(ctx, pos.x, pos.y, this.crosshairState);
        break;

      case STATES.PLAYING: {
        R.drawBackground(ctx);

        // Ducks
        for (const duck of this.game.currentDucks) R.drawDuck(ctx, duck);

        // Dog
        this.game.dog.draw(ctx);

        // Freeze power-up icon (shoot it to collect)
        R.drawFreezePowerup(ctx, this.game.freezePowerup);

        // Freeze blue tint overlay (active after collecting)
        R.drawFreezeOverlay(ctx, this.game.freezeTimer, CW, CH);

        // Particles + floating texts
        R.drawParticles(ctx, this.game.particles);
        R.drawFloatingTexts(ctx, this.game.floatingTexts);

        // Screen flash (covers everything)
        R.drawScreenFlash(ctx, dt);

        // HUD
        R.drawHUD(ctx, {
          score:          this.game.score,
          highScore:      getHighScore(),
          lives:          this.game.lives,
          maxLives:       3,
          round:          this.game.round,
          bullets:        this.game.bullets,
          maxBullets:     3,
          encounterNum:   this.game.encounterNum,
          totalEncounters:this.game.totalEncounters,
          combo:          this.game.combo,
          comboTimer:     this.game.comboTimer,
        });

        // Duck timeout bar
        if (this.game.encounterState === 'ACTIVE') {
          R.drawDuckTimer(ctx, this.game.duckTimer, this.game.config?.timeout ?? 8);
        }

        // Crosshair (always on top)
        R.drawCrosshair(ctx, pos.x, pos.y, this.crosshairState);
        break;
      }

      case STATES.ROUND_COMPLETE:
        R.drawBackground(ctx);
        R.drawRoundComplete(ctx, this.game.round, this.game.score);
        R.drawCrosshair(ctx, pos.x, pos.y, this.crosshairState);
        break;

      case STATES.GAME_OVER:
        R.drawBackground(ctx);
        R.drawGameOverScreen(
          ctx,
          this.game.score,
          getHighScore(),
          this.isNewHighScore,
          this.game.accuracy,
          this.game.shotsFired,
          this.game.ducksHit,
        );
        R.drawCrosshair(ctx, pos.x, pos.y, this.crosshairState);
        break;
    }
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Bootstrap ───────────────────────────────────────────────────
const app = new App();
app.init();
