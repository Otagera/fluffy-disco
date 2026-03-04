import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';

let chargeStartTime = 0;

export function handleInput(event: KeyboardEvent, type: 'keydown' | 'keyup') {
  if (event.code === 'Space') {
    if (type === 'keydown' && !matchState.isCharging) {
      matchState.isCharging = true;
      chargeStartTime = performance.now();
      matchState.shotPower = 0;
    } else if (type === 'keyup' && matchState.isCharging) {
      executeShot();
      matchState.isCharging = false;
      matchState.shotPower = 0;
    }
  }

  if (event.code === 'Escape' && type === 'keydown') {
    if (matchState.status === 'PLAYING') {
      matchState.status = 'PAUSED';
    } else if (matchState.status === 'PAUSED') {
      matchState.status = 'PLAYING';
    }
  }
}

export function updateInputLogic() {
  if (matchState.isCharging) {
    const elapsed = performance.now() - chargeStartTime;
    // 0 to 100 over 1.2s (1200ms)
    matchState.shotPower = Math.min(100, (elapsed / 1200) * 100);
  }
}

function executeShot() {
  const pid = matchState.possessionPlayerId;
  if (pid === null) return;

  const b = matchState.ball;
  const targetGoalX = b.x < 0.5 ? 1 : 0;
  const targetGoalY = 0.5;

  const dx = (targetGoalX - b.x) * PITCH_W;
  const dy = (targetGoalY - b.y) * PITCH_H;
  const dist = Math.sqrt(dx*dx + dy*dy);

  const powerMult = 1.0 + (matchState.shotPower / 100) * 4.0;

  b.vx = (dx / dist) * powerMult;
  b.vy = (dy / dist) * powerMult;
  b.vz = 0.5 + (matchState.shotPower / 100) * 1.5;
  b.spin = (Math.random() - 0.5) * 20;

  matchState.possessionPlayerId = null;
}
