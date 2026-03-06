import { matchState } from './matchState.svelte';
import { updatePhysics, updatePlayerPhysics, resolvePossession } from './physics';
import { updateAI } from './ai';
import { updateInputLogic } from './input';
import { recordFrame } from './recorder';

let analyticsCounter = 0;
let lastMomentumMinute = -1;
let lastSubCheckMinute = -1;

/**
 * Headless Simulation Tick
 * Processes a single slice of match time. 
 * Agnostic to render loop.
 */
export function tick(dt: number = 16.67) {
  if (matchState.status !== 'PLAYING') {
    updateInputLogic();
    return;
  }

  const dtSeconds = dt / 1000;

  try {
    // 1. Cognitive Layer (AI Decisions)
    updateAI(dt);

    // 2. Physical Layer (Movement & Constraints)
    updatePlayerPhysics();
    updatePhysics();
    resolvePossession();

    // 3. Match Logic & Time
    matchState.timer += dtSeconds;
    
    const minute = Math.floor(matchState.timer / 60);
    handleMatchStateTransitions(minute);

    // 4. Persistence & Analytics
    handleCPUSubs();
    collectAnalytics();
    recordFrame();

  } catch (err) {
    console.error("Match Engine Kernel Panic:", err);
    matchState.status = 'PAUSED';
  }

  updateInputLogic();
}

function handleMatchStateTransitions(minute: number) {
  // Half-time: 45:00 = 2700s
  if (matchState.timer >= 2700 && matchState.timer < 5400 && matchState.status === 'PLAYING') {
    const alreadyHasHalftime = matchState.events.some(e => e.type === 'whistle' && e.minute === 45);
    if (!alreadyHasHalftime) {
      matchState.status = 'HALFTIME';
      matchState.events.push({ minute: 45, type: 'whistle', desc: 'Half time!' });
      
      // HALFTIME STAMINA RECOVERY: Restore to 85%
      matchState.players.forEach(p => {
        p.currentStamina = Math.min(100, 85);
      });
    }
  }

  // Full-time: 90:00 = 5400s
  if (matchState.timer >= 5400 && matchState.status === 'PLAYING') {
    matchState.status = 'FINISHED';
    matchState.events.push({ minute: 90, type: 'whistle', desc: 'Full time!' });
  }
}

function collectAnalytics() {
  analyticsCounter++;
  const minute = Math.floor(matchState.timer / 60);

  if (analyticsCounter % 120 === 0) {
    matchState.players.forEach(p => {
      matchState.analytics.heatmapSamples.push({
        team: p.team, x: p.x, y: p.y, playerId: p.id
      });
    });
  }

  if (minute > lastMomentumMinute) {
    lastMomentumMinute = minute;
    const homePower = matchState.stats.home.shots * 2 + matchState.stats.home.dangerousEntries;
    const awayPower = matchState.stats.away.shots * 2 + matchState.stats.away.dangerousEntries;
    const total = homePower + awayPower || 1;
    matchState.analytics.momentum.push((homePower - awayPower) / total);
  }
}

export function resetEngineState() {
  analyticsCounter = 0;
  lastMomentumMinute = -1;
  lastSubCheckMinute = -1;
}

function handleCPUSubs() {
  if (matchState.awayControl !== 'CPU') return;
  
  const minute = Math.floor(matchState.timer / 60);
  if (minute < 60) return; 
  if (minute === lastSubCheckMinute) return; 
  lastSubCheckMinute = minute;

  if (matchState.awaySubsUsed >= 5) return;

  const tiredPlayer = matchState.players
    .filter(p => p.team === 'away' && p.role !== 'GK')
    .sort((a, b) => a.currentStamina - b.currentStamina)[0];

  if (tiredPlayer && tiredPlayer.currentStamina < 60) {
    const outIndex = matchState.players.findIndex(p => p.id === tiredPlayer.id);
    const subIndex = matchState.awayBench.findIndex(p => p.role === tiredPlayer.role);
    
    if (outIndex !== -1 && subIndex !== -1) {
      const pIn = matchState.awayBench[subIndex];
      const pOut = matchState.players[outIndex];

      const newPlayer = {
        ...pIn,
        x: pOut.x, y: pOut.y,
        homeX: pOut.homeX, homeY: pOut.homeY,
        role: pOut.role, tacticalRole: pOut.tacticalRole,
        anchorX: pOut.anchorX, anchorY: pOut.anchorY,
        vx: 0, vy: 0,
        aiState: 'POSITION' as any,
        pressure: 0,
        currentStamina: 100,
        possessionStrength: 1.0,
        currentAction: null,
        actionTimer: 0,
        thinkCooldown: 0,
        btState: {},
        cautions: 0,
        sentOff: false
      };

      matchState.players[outIndex] = newPlayer;
      matchState.awayBench.splice(subIndex, 1);
      matchState.awaySubsUsed++;

      matchState.events.push({ 
        minute, 
        type: 'sub', 
        desc: `SUB (Away): ${pIn.name} ON for ${pOut.name}` 
      });
    }
  }
}
