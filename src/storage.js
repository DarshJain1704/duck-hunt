// storage.js — localStorage high score persistence

const STORAGE_KEY = 'duck-hunt-ai-highscore';

export function getHighScore() {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

/** Returns true if this score is a new high score */
export function setHighScore(score) {
  try {
    const current = getHighScore();
    if (score > current) {
      localStorage.setItem(STORAGE_KEY, score.toString());
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
