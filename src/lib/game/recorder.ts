import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';

let frameCounter = 0;
const RECORD_FREQUENCY = 5; 

export function recordFrame() {
  if (!matchState.replay.isRecording) return;

  frameCounter++;
  if (frameCounter % RECORD_FREQUENCY !== 0) return;

  const b = matchState.ball;
  const p = matchState.players;
  
  const frame = {
    minute: matchState.timer,
    ball: { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy },
    players: p.map(player => ({
      id: player.id,
      x: player.x,
      y: player.y,
      state: player.aiState,
      pressure: player.pressure,
      stamina: player.currentStamina
    })),
    score: { home: matchState.homeScore, away: matchState.awayScore }
  };

  matchState.replay.frames.push(frame);
}

export function clearReplay() {
  matchState.replay.frames = [];
}

export function downloadReplay(matchId: string) {
  const frames = matchState.replay.frames;
  if (frames.length === 0) return;
  
  const analytics = calculateAnalytics(frames);

  const data = {
    matchId,
    timestamp: new Date().toISOString(),
    frameCount: frames.length,
    analytics,
    frames
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `match-${matchId}-analytics.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function calculateAnalytics(frames: any[]) {
  const homeHeatmap: Record<string, number> = {};
  const awayHeatmap: Record<string, number> = {};
  let totalPressureHome = 0;
  let totalPressureAway = 0;
  
  frames.forEach(f => {
    f.players.forEach((p: any) => {
      const gridX = Math.floor(p.x * 10);
      const gridY = Math.floor(p.y * 10);
      const key = `${gridX},${gridY}`;
      
      const playerObj = matchState.players.find(pl => pl.id === p.id);
      if (playerObj?.team === 'home') {
        homeHeatmap[key] = (homeHeatmap[key] || 0) + 1;
        totalPressureHome += p.pressure;
      } else {
        awayHeatmap[key] = (awayHeatmap[key] || 0) + 1;
        totalPressureAway += p.pressure;
      }
    });
  });

  const avgPressureHome = totalPressureHome / (frames.length * 11);
  const avgPressureAway = totalPressureAway / (frames.length * 11);

  return {
    homeHeatmap,
    awayHeatmap,
    averagePressure: { home: avgPressureHome, away: avgPressureAway },
    finalScore: { home: matchState.homeScore, away: matchState.awayScore }
  };
}

export function calculateShotXG(player: any, distance: number, angle: number): number {
  // xG = BaseDistFactor * AnglePenalty * PressurePenalty * AttributeModifier
  const distFactor = Math.exp(-distance * 0.08);
  const angleFactor = Math.abs(Math.cos(angle));
  const pressFactor = Math.max(0.1, 1 - (player.pressure || 0) * 0.7);
  // NEW: Use finishing attribute (fall back to shooting if finishing is missing)
  const finishing = player.attributes.finishing ?? player.attributes.shooting ?? 10;
  const attrFactor = 0.5 + (finishing / 40);

  return Math.min(0.99, distFactor * angleFactor * pressFactor * attrFactor);
}
