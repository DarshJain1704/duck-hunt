# 🎯 Duck Hunt Revamped — 8-Bit Web Hand-Tracking Game

A faithful, hardware-accelerated, 8-bit retro reimagining of the classic NES Duck Hunt, built for modern web browsers. No controller required — point and shoot using just your webcam and your hand.

---

## 🌐 Live Demo

The game is deployed and fully playable on GitHub Pages!

👉 **Play it here: [https://darshjain1704.github.io/duck-hunt/](https://darshjain1704.github.io/duck-hunt/)**

*(Requires webcam permission for hand tracking. Grant access when prompted.)*

---

## 🖐️ How to Play

### Gestures

| Action | How to do it |
| :--- | :--- |
| **Pistol Pose** | Extend your **index finger** upward. Curl your middle, ring & pinky fingers in. Thumb is free. |
| **Aim** | Move your hand — the crosshair tracks your index knuckle. It's mirrored (move right → crosshair goes right). |
| **Shoot** | Lightly **pinch** your thumb tip to your index fingertip. That's it — no need to snap hard. |

### Crosshair colour guide

| Colour | Meaning |
| :--- | :--- |
| 🔴 Red | No hand detected |
| ⚫ Grey | Hand visible but not a pistol gesture |
| 🟠 Orange *ARMING...* | Pistol detected — hold still for ~0.2s |
| 🟢 Green | Armed and ready to fire |
| 🟡 Gold | Shot fired |

> **Tip:** Wait for the crosshair to turn **green** before pinching. The 0.2s arming window prevents accidental shots when you first form the pistol pose.

### Menu navigation

You can **aim your hand at any button and pinch to select it** — no mouse needed. Works on the main menu, round-complete screen, and game-over screen.

---

## 🕹️ Core Game Mechanics

- **Pre-game Calibration**: Point your gun gesture inside the calibration circle for ~2 seconds to sync the tracking. *(No webcam? Double-click the canvas to skip.)*
- **Round System**: Difficulty scales each round — ducks get faster, flight windows shrink, and later rounds spawn two ducks at once.
- **3 Bullets & 3 Lives**: 3 shots per encounter. Miss 3 ducks total → Game Over.
- **Classic Dog**: Missed a duck? The NES dog pops up and laughs at you.
- **Combo System**: Chain hits to multiply score and trigger chiptune arpeggio combos.

---

## 🎨 Retro Aesthetics & Audio

- **Pixel art & CRT scanlines** — Canvas-drawn 8-bit sprites with an authentic CRT vignette overlay.
- **8-bit SFX synthesiser** — All sound effects (gunshots, hits, dog laugh) generated live via the Web Audio API using square and noise oscillators.
- **Looping chiptune BGM** — Original 8-bit background track that loops seamlessly.
- **Independent audio controls** — Separate `SFX` and `BGM` mute buttons on the HUD.
- **Fullscreen mode** — Hit the `FULL` button for maximum immersion.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| Core | HTML5 Canvas · Vanilla JS (ES6+) · CSS3 |
| Hand tracking | [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) (GPU/WASM, video mode) |
| Audio | Web Audio API (SFX) + YouTube IFrame API (BGM) |
| Fonts | Google Fonts — *Press Start 2P* |
| Hosting | GitHub Pages |

---

## 🚀 Running Locally

No build step needed. Just serve the root folder over HTTP (MediaPipe requires a server context):

```bash
# Node
npx serve .

# Python
python3 -m http.server 3000
```

Then open `http://localhost:3000` in Chrome, Safari, or Firefox.

*Webcam access requires a secure context — `localhost` or `https://`.*

---

## 🧑‍💻 Author

Created and revamped by **[DarshJain1704](https://github.com/DarshJain1704)**.
