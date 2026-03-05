import { matchState } from './matchState.svelte';
import { updatePhysics, updatePlayerPhysics, resolvePossession } from './physics';
import { updateAI } from './ai';
import { updateInputLogic } from './input';
import { recordFrame } from './recorder';
import { emitMatchEvent } from './events';

let lastTime = 0;
let accumulator = 0;
const TIMESTEP = 1000 / 60;

export function startEngine() {
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

let analyticsCounter = 0;
let lastMomentumMinute = -1;

function collectAnalytics() {
  analyticsCounter++;
  const minute = Math.floor(matchState.timer / 60);

  // Sample positions every 2 seconds (120 ticks) for heatmap
  if (analyticsCounter % 120 === 0) {
    matchState.players.forEach(p => {
      matchState.analytics.heatmapSamples.push({
        team: p.team,
        x: p.x,
        y: p.y,
        playerId: p.id
      });
    });
  }

  // Momentum calculation (every minute)
  if (minute > lastMomentumMinute) {
    lastMomentumMinute = minute;
    // Simple momentum based on dangerous entries and shots in the last minute
    // Usually we'd need a rolling window, but for a sparkline, we can just look at the delta
    const homePower = matchState.stats.home.shots * 2 + matchState.stats.home.dangerousEntries;
    const awayPower = matchState.stats.away.shots * 2 + matchState.stats.away.dangerousEntries;
    const total = homePower + awayPower || 1;
    const momentum = (homePower - awayPower) / total; // -1 to 1
    matchState.analytics.momentum.push(momentum);
  }
}

export function tick() {
  if (matchState.status === 'PLAYING') {
    try {
      updateAI();
      updatePlayerPhysics();
      updatePhysics();
      resolvePossession();
      handleCPUSubs();
      collectAnalytics();
      recordFrame();
      updateCamera();
    } catch (err) {
      console.error("Simulation Engine Crash:", err);
      matchState.status = 'PAUSED';
    }
  }
  updateInputLogic();
}

function updateCamera() {
  const b = matchState.ball;
  const cam = matchState.camera;
  
  let targetX = 0.5;
  let targetY = 0.5;
  let targetZoom = 1.0;

  if (cam.mode === 'BROADCAST') {
    targetX = b.x;
    targetY = 0.5;
    targetZoom = 1.5;
  } else if (cam.mode === 'ACTION') {
    targetX = b.x;
    targetY = b.y;
    targetZoom = 2.2;
  }

  // Smooth lerp
  const lerp = 0.05;
  cam.x += (targetX - cam.x) * lerp;
  cam.y += (targetY - cam.y) * lerp;
  cam.zoom += (targetZoom - cam.zoom) * lerp;
}

let lastSubCheckMinute = 0;

export function resetEngineState() {
  lastSubCheckMinute = 0;
  analyticsCounter = 0;
  lastMomentumMinute = -1;
}

function handleCPUSubs() {
  if (matchState.awayControl !== 'CPU') return;
  
  const minute = Math.floor(matchState.timer / 60);
  if (minute < 60) return; // Don't sub before 60th min
  if (minute === lastSubCheckMinute) return;
  lastSubCheckMinute = minute;

  // Make up to 1 sub every 5-10 minutes if stamina is low
  if (matchState.awaySubsUsed < 5 && minute % 5 === 0) {
    const awayPitch = matchState.players.filter(p => p.team === 'away' && p.role !== 'GK');
    const awayBench = matchState.awayBench;

    if (awayBench.length === 0) return;

    // Find most tired player on pitch
    const tiredPlayer = awayPitch.reduce((mostTired, p) => p.currentStamina < mostTired.currentStamina ? p : mostTired, awayPitch[0]);

    // Only sub if they are actually tired (< 60% stamina)
    if (tiredPlayer.currentStamina < 60) {
      // Find a bench player with the same role
      const subIndex = awayBench.findIndex(p => p.role === tiredPlayer.role);
      
      if (subIndex !== -1) {
        const pIn = awayBench[subIndex];
        const outIndex = matchState.players.findIndex(p => p.id === tiredPlayer.id);

        const newPlayer = {
          ...pIn,
          x: tiredPlayer.x,
          y: tiredPlayer.y,
          homeX: tiredPlayer.homeX,
          homeY: tiredPlayer.homeY,
          role: tiredPlayer.role,
          tacticalRole: tiredPlayer.tacticalRole,
          anchorX: tiredPlayer.anchorX,
          anchorY: tiredPlayer.anchorY,
          vx: 0, vy: 0,
          aiState: 'POSITION' as any,
          pressure: 0,
          currentStamina: 100, // Fresh legs!
          possessionStrength: 1.0,
          currentAction: null,
          actionTimer: 0,
          btState: {}
        };

        matchState.players[outIndex] = newPlayer;
        matchState.awayBench.splice(subIndex, 1);
        matchState.awaySubsUsed++;

        emitMatchEvent('sub', `SUB (Away): ${pIn.name} ON for ${tiredPlayer.name}`, minute);
      }
    }
  }
}

function loop(currentTime: number) {
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  if (matchState.status === 'PLAYING' || matchState.status === 'PAUSED' || matchState.status === 'HALFTIME') {
    accumulator += deltaTime;

    while (accumulator >= TIMESTEP) {
      tick();
      accumulator -= TIMESTEP;
    }
  }

  requestAnimationFrame(loop);
}

let clockInterval: number;
export function startClock() {
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(() => {
    if (matchState.status === 'PLAYING') {
      matchState.timer += 10; // 1 real second = 10 game seconds
      
      // Half-time: 45:00 = 2700 game seconds
      if (matchState.timer < 2700 && matchState.timer + 10 >= 2700) {
        matchState.status = 'HALFTIME';
        emitMatchEvent('whistle', 'Half time!', 45);
      }

      // Full-time: 90:00 = 5400 game seconds
      if (matchState.timer >= 5400) {
        matchState.status = 'FINISHED';
        emitMatchEvent('whistle', 'Full time!', 90);
        clearInterval(clockInterval);
      }
    }
  }, 1000);
}

export function stopClock() {
  clearInterval(clockInterval);
}
