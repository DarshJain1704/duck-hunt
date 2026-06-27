# 🎯 Duck Hunt Revamped — 8-Bit Web Hand-Tracking Game

A faithful, hardware-accelerated, 8-bit retro reimagining of the classic NES Duck Hunt game, built for modern web browsers. Instead of using a physical light gun, the game utilizes your webcam and MediaPipe's WebAssembly-powered machine learning pipeline to track your hand.

Make a **physical hand-gun gesture** to control the crosshair, and **snap your thumb** or **jerk your hand upwards** to fire!

---

## 🖐️ Gameplay & Gesture Controls

Ensure your hand is fully visible to your webcam. The tracking is mirrored so moving your hand right moves the crosshair right.

| Action | Physical Gesture |
| :--- | :--- |
| **Pistol Activation** | Extend your **Index Finger** (Tip 8) and **Thumb** (Tip 4) out. Keep Middle, Ring, and Pinky fingers curled in. |
| **Aiming** | Move your extended "pistol" hand around. The reticle smoothly tracks your index finger tip. |
| **Shoot (Thumb Snap)** | Quickly bring your extended thumb down towards your hand (closing the distance between your thumb tip and index base). |
| **Shoot (Recoil Jerk)** | Abruptly jerk your index finger upward (creating a fast negative Y-velocity spike). |

---

## 🕹️ Core Game Mechanics

*   **Pre-game Calibration**: When you start, point your "gun" inside the central calibration target circle for 2 continuous seconds to calibrate the hand-tracking scale and optimal camera distance. *(Double-click the canvas during calibration to skip if you don't have a webcam).*
*   **Round System**: The game progresses through rounds with escalating difficulty (faster ducks, shorter flight windows, erratic flight paths, and two-at-once spawns).
*   **3 Bullets & 3 Lives**: You get 3 bullets per encounter. If you miss 3 ducks (by running out of bullets or letting the duck survive past the timer), it's Game Over!
*   **Classic Laughing Dog**: Missed a duck? The classic NES dog will pop up from the grass and laugh at you.
*   **Combo System**: Chain consecutive hits to rack up high scores and trigger arpeggio combos.

---

## 🎨 Retro Aesthetics & Audio

*   **Pixel Art & CRT Scanlines**: Features custom canvas-drawn 8-bit pixel sprites, an authentic sky-and-forest background, and an overlay of vintage CRT monitor scanlines with a subtle vignette.
*   **8-Bit Synthesizer (SFX)**: Employs the native browser Web Audio API to synthetically generate nostalgic 8-bit square and noise waveforms for gunshots, hit chimes, and dog laughs.
*   **Looping BGM**: Streams a looping retro 8-bit background music track directly.
*   **Independent Controls**: Separate `SFX` and `BGM` mute buttons on the HUD let you toggle sounds independently.
*   **Fullscreen Mode**: Click the `FULL` button on the top-right to enter fullscreen mode for maximum immersion.

---

## 🛠️ Architecture & Tech Stack

*   **Core**: HTML5 Canvas, CSS3 Custom Properties, Vanilla ES6+ Javascript.
*   **Tracking**: [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) CDN. Runs in video mode using GPU/Neural Engine acceleration.
*   **Audio**: Web Audio API (Synthesizer) + YouTube Player IFrame API (BGM).
*   **Fonts**: Google Fonts (`Press Start 2P`).

---

## 🚀 Running Locally

No installation or compilation needed. You just need to serve the root directory using a local web server (since MediaPipe requires a server context):

```bash
# Using Node's serve
npx serve .

# Or Python's built-in server
python3 -m http.server 3000
```
Then visit `http://localhost:3000` in Chrome, Safari, or Firefox.

*Note: Accessing the webcam requires a secure context (`localhost` or `https://` in production).*

---

## 🧑‍💻 Author

Created and revamped by **[DarshJain1704](https://github.com/DarshJain1704)**.
