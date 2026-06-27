// handTracker.js — MediaPipe Tasks-Vision hand landmarker wrapper

import {
  HandLandmarker,
  FilesetResolver,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const WASM_PATH  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

class HandTrackerClass {
  constructor() {
    this.landmarker    = null;
    this.lastVideoTime = -1;
    this.landmarks     = null;   // null = no hand detected
    this.ready         = false;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
    });
    this.ready = true;
  }

  async startCamera(videoEl) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width:  { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 60, max: 60 },
        facingMode: 'user',
      },
    });
    videoEl.srcObject = stream;
    await new Promise((resolve, reject) => {
      videoEl.onloadedmetadata = resolve;
      videoEl.onerror          = reject;
    });
    await videoEl.play();
  }

  /**
   * Call once per animation frame.
   * @param {HTMLVideoElement} videoEl
   * @param {number}           timestamp - from requestAnimationFrame
   * @returns {Array|null} 21 MediaPipe landmarks, or null
   */
  processFrame(videoEl, timestamp) {
    if (!this.ready || !this.landmarker) return null;
    // Only process if video has advanced
    if (videoEl.readyState < 2)           return this.landmarks;
    if (videoEl.currentTime === this.lastVideoTime) return this.landmarks;

    this.lastVideoTime = videoEl.currentTime;
    const results = this.landmarker.detectForVideo(videoEl, timestamp);

    if (results.landmarks && results.landmarks.length > 0) {
      this.landmarks = results.landmarks[0];
    } else {
      this.landmarks = null;
    }
    return this.landmarks;
  }

  getLandmarks() { return this.landmarks; }
}

export const HandTracker = new HandTrackerClass();
