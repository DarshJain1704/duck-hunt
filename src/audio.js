// audio.js — Web Audio API 8-bit SFX synthesizer and YouTube BGM player

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxMuted = false;
    this.bgmMuted = false;
    this.ytPlayer = null;
    this.ytReady = false;
    this.bgmPlaying = false;
    this._initYT();
  }

  _initYT() {
    if (typeof window === 'undefined') return;
    if (window.loadingYT) return;
    window.loadingYT = true;

    // Create a hidden div for YT player in body if it doesn't exist
    let ytDiv = document.getElementById('yt-player');
    if (!ytDiv) {
      ytDiv = document.createElement('div');
      ytDiv.id = 'yt-player';
      // Style it to be rendered but off-screen and invisible so it plays
      ytDiv.style.position = 'absolute';
      ytDiv.style.width = '1px';
      ytDiv.style.height = '1px';
      ytDiv.style.opacity = '0.001';
      ytDiv.style.pointerEvents = 'none';
      ytDiv.style.top = '-1000px';
      document.body.appendChild(ytDiv);
    }

    // Load YT Script
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // YouTube API callback
    window.onYouTubeIframeAPIReady = () => {
      this.ytPlayer = new YT.Player('yt-player', {
        height: '1',
        width: '1',
        videoId: 'DzFXGsRvSwA',
        playerVars: {
          'autoplay': 0,
          'loop': 1,
          'playlist': 'DzFXGsRvSwA', // required for loop to work on single video
          'controls': 0,
          'disablekb': 1,
          'fs': 0,
          'modestbranding': 1,
          'rel': 0,
          'showinfo': 0
        },
        events: {
          'onReady': () => {
            this.ytReady = true;
            if (this.bgmPlaying) {
              if (this.bgmMuted) {
                this.ytPlayer.mute();
              } else {
                this.ytPlayer.unMute();
                this.ytPlayer.playVideo();
              }
            }
          },
          'onStateChange': (event) => {
            // Re-insure loop in case loop: 1 doesn't work perfectly
            if (event.data === YT.PlayerState.ENDED) {
              this.ytPlayer.playVideo();
            }
          }
        }
      });
    };
  }

  /** Lazily create AudioContext on first user gesture */
  _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    // Also trigger BGM play on interaction if requested
    this.playBGM();
  }

  /** Play BGM */
  playBGM() {
    this.bgmPlaying = true;
    if (this.ytPlayer && this.ytReady) {
      if (this.bgmMuted) {
        this.ytPlayer.mute();
      } else {
        this.ytPlayer.unMute();
        this.ytPlayer.playVideo();
      }
    }
  }

  /** Stop BGM */
  stopBGM() {
    this.bgmPlaying = false;
    if (this.ytPlayer && this.ytReady) {
      this.ytPlayer.stopVideo();
    }
  }

  /** Toggle SFX mute. Returns new muted state. */
  toggleSFX() {
    this.sfxMuted = !this.sfxMuted;
    return this.sfxMuted;
  }

  /** Toggle BGM mute. Returns new muted state. */
  toggleBGM() {
    this.bgmMuted = !this.bgmMuted;
    if (this.ytPlayer && this.ytReady) {
      if (this.bgmMuted) {
        this.ytPlayer.mute();
      } else {
        this.ytPlayer.unMute();
        this.ytPlayer.playVideo();
      }
    }
    return this.bgmMuted;
  }

  /** Play a square/triangle/sawtooth tone with exponential decay */
  _tone(freq, type, startTime, duration, gainVal = 0.35) {
    if (this.sfxMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  /** Pitch-bend a tone */
  _bend(freqStart, freqEnd, type, startTime, duration, gainVal = 0.35) {
    if (this.sfxMuted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  /** White noise burst */
  _noise(startTime, duration, gainVal = 0.2) {
    if (this.sfxMuted || !this.ctx) return;
    const bufferSize = Math.ceil(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    source.start(startTime);
    source.stop(startTime + duration + 0.01);
  }

  // ─── Public SFX API ───────────────────────────────────────────────

  playShot() {
    this._ensure();
    if (this.sfxMuted) return;
    const t = this.ctx.currentTime;
    this._bend(900, 80, 'square', t, 0.18, 0.45);
    this._noise(t, 0.10, 0.35);
  }

  playHit() {
    this._ensure();
    if (this.sfxMuted) return;
    const t = this.ctx.currentTime;
    // Bright ascending arpeggio — C5 → E5 → G5 → C6
    this._tone(523, 'square', t,        0.09, 0.4);
    this._tone(659, 'square', t + 0.09, 0.09, 0.4);
    this._tone(784, 'square', t + 0.18, 0.09, 0.4);
    this._tone(1047,'square', t + 0.27, 0.18, 0.35);
  }

  playMiss() {
    this._ensure();
    if (this.sfxMuted) return;
    const t = this.ctx.currentTime;
    // Descending sad tones + noise rumble
    this._tone(330, 'square', t,        0.12, 0.3);
    this._tone(247, 'square', t + 0.12, 0.12, 0.3);
    this._tone(196, 'square', t + 0.24, 0.20, 0.3);
    this._noise(t, 0.45, 0.12);
  }

  playRoundComplete() {
    this._ensure();
    if (this.sfxMuted) return;
    const t = this.ctx.currentTime;
    // Triumphant 4-note fanfare
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => this._tone(f, 'square', t + i * 0.1, 0.12, 0.38));
  }

  playGameOver() {
    this._ensure();
    if (this.sfxMuted) return;
    const t = this.ctx.currentTime;
    // Slow chromatic descent
    const notes = [523, 494, 466, 440, 415, 392, 370, 349, 330, 294, 262];
    notes.forEach((f, i) => this._tone(f, 'square', t + i * 0.14, 0.16, 0.28));
  }

  playDogLaugh() {
    this._ensure();
    if (this.sfxMuted) return;
    const t = this.ctx.currentTime;
    // Bouncy "ha ha" notes
    [440, 880, 440, 880].forEach((f, i) =>
      this._tone(f, 'square', t + i * 0.18, 0.12, 0.25)
    );
  }

  playCombo() {
    this._ensure();
    if (this.sfxMuted) return;
    const t = this.ctx.currentTime;
    this._bend(600, 1200, 'square', t, 0.12, 0.3);
  }
}

export const audio = new AudioEngine();
