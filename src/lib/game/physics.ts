import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';
import { resetMatch } from './rules';
import { emitMatchEvent, emitPassEvent } from './events';
import { getForwardDir } from './utils';

let dribbleTimer = 0;
const DRIBBLE_INTERVAL = 24;
let possessionCooldown = 0; 
let lastTouchTeam: 'home' | 'away' | null = null;

export function resetPhysics() {
  possessionCooldown = 0;
  lastTouchTeam = null;
}

export function updatePhysics() {
  const b = matchState.ball;
  
  if (matchState.setPiece) {
    b.vx = 0;
    b.vy = 0;
    b.vz = 0;
    matchState.setPiece.ticks++;
    if (matchState.setPiece.ticks > 120 && matchState.setPiece.takerId === null) {
      const team = matchState.setPiece.team;
      const players = matchState.players.filter(p => p.team === team);
      let taker = players.reduce((closest, p) => {
        const d = Math.hypot((p.x - b.x) * PITCH_W, (p.y - b.y) * PITCH_H);
        const closestD = Math.hypot((closest.x - b.x) * PITCH_W, (closest.y - b.y) * PITCH_H);
        return d < closestD ? p : closest;
      }, players[0]);
      if (matchState.setPiece.type === 'goal-kick') taker = players.find(p => p.role === 'GK') || taker;
      else if (matchState.setPiece.type === 'kick-off') taker = players.find(p => p.role === 'FWD') || taker;
      matchState.possessionPlayerId = taker.id;
      matchState.setPiece.takerId = taker.id;
      matchState.setPiece = null;
    }
    return;
  }

  const possessor = matchState.players.find(p => p.id === matchState.possessionPlayerId);

  if (possessor) {
    const forwardDir = getForwardDir(possessor.team, matchState.sidesSwitched);
    // Use a smaller offset (0.2m instead of 0.4m) to keep the ball away from the absolute edge (1.0)
    b.x = possessor.x + (forwardDir * 0.2) / PITCH_W;
    b.y = possessor.y;
    b.z = 0;
    b.vx = (possessor.vx || 0) * PITCH_W;
    b.vy = (possessor.vy || 0) * PITCH_H;
    b.vz = 0;
    b.spin *= 0.9;
    lastTouchTeam = possessor.team;
    
    if (possessor.team === 'home') matchState.stats.home.possessionTime++;
    else matchState.stats.away.possessionTime++;

    const opponentGoalX = getForwardDir(possessor.team, matchState.sidesSwitched) === 1 ? 1.0 : 0.0;
    const distToOppGoal = Math.abs(possessor.x - opponentGoalX);
    if (distToOppGoal < 0.16 && possessor.y > 0.2 && possessor.y < 0.8) {
      if ((possessor.btState.lastBoxEntryMinute || 0) < Math.floor(matchState.timer / 60)) {
        possessor.btState.lastBoxEntryMinute = Math.floor(matchState.timer / 60);
        if (possessor.team === 'home') matchState.stats.home.dangerousEntries++;
        else matchState.stats.away.dangerousEntries++;
      }
    }
  } else {
    b.vz -= 0.4; 
    b.x += b.vx / PITCH_W;
    b.y += b.vy / PITCH_H;
    b.z += b.vz;
    b.vx *= 0.985;
    b.vy *= 0.985;
    b.vz *= 0.985;
    if (b.z <= 0) {
      b.z = 0;
      b.vx *= 0.88; 
      b.vy *= 0.88;
      if (Math.abs(b.vz) > 0.1) b.vz = -(b.vz * 0.6);
      else b.vz = 0;
    }
    b.spin += (b.vx * 2.0);
    if (lastTouchTeam === 'home') matchState.stats.home.possessionTime++;
    else if (lastTouchTeam === 'away') matchState.stats.away.possessionTime++;
  }

  if (b.y < 0 || b.y > 1) { triggerSetPiece('throw-in', b.x, b.y < 0 ? 0 : 1); return; }
  if (b.x < 0 || b.x > 1) {
    const isGoal = b.y > 0.38 && b.y < 0.62;
    const homeGoal = b.x < 0; 
    const scorer = (homeGoal !== matchState.sidesSwitched) ? 'away' : 'home';
    if (isGoal) scoreGoal(scorer);
    else {
      const defendingSideTeam = (b.x < 0 !== matchState.sidesSwitched) ? 'home' : 'away';
      if (lastTouchTeam === defendingSideTeam) triggerSetPiece('corner', b.x < 0 ? 0 : 1, b.y < 0.5 ? 0 : 1);
      else triggerSetPiece('goal-kick', b.x < 0 ? 0.05 : 0.95, 0.5);
    }
    return;
  }
}

export function triggerSetPiece(type: string, x: number, y: number) {
  if (matchState.status !== 'PLAYING') return;
  const minute = Math.floor(matchState.timer / 60);
  emitMatchEvent('foul', type.toUpperCase(), minute);
  matchState.ball.x = x; matchState.ball.y = y; matchState.ball.z = 0;
  matchState.ball.vx = 0; matchState.ball.vy = 0; matchState.ball.vz = 0;
  matchState.possessionPlayerId = null;
  const defendingTeam = (x < 0.5) !== matchState.sidesSwitched ? 'home' : 'away';
  let team: 'home' | 'away' = lastTouchTeam === 'home' ? 'away' : 'home';
  if (type === 'goal-kick') team = defendingTeam;
  else if (type === 'corner') team = defendingTeam === 'home' ? 'away' : 'home';
  matchState.setPiece = { type: type as any, team, x, y, ticks: 0, takerId: null };
}

/**
 * resolvePossession
 * Only handles ball pickup and pass reception. 
 * Stealing is now cognitive.
 */
export function resolvePossession() {
  const b = matchState.ball;
  const possessorId = matchState.possessionPlayerId;
  const allPlayers = matchState.players;

  if (possessionCooldown > 0) {
    possessionCooldown--;
    return;
  }

  // 1. If someone already has the ball, we don't 'steal' here anymore.
  if (possessorId !== null) return;

  // 2. Pickup free ball
  let closestPlayer: any = null;
  let minD = 9999;
  allPlayers.forEach(p => {
    const dx = (b.x - p.x) * PITCH_W;
    const dy = (b.y - p.y) * PITCH_H;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d < minD) { minD = d; closestPlayer = p; }
  });

  if (minD < 2.5 && b.z < 1.0) {
    // Record pass completion if applicable
    if (matchState.lastKickType === 'PASS' && matchState.lastKickerId !== null) {
      const kicker = allPlayers.find(p => p.id === matchState.lastKickerId);
      if (kicker && kicker.team === closestPlayer.team) {
        const teamStats = kicker.team === 'home' ? matchState.stats.home : matchState.stats.away;
        teamStats.passesCompleted++;
        emitPassEvent({ fromId: kicker.id, toId: closestPlayer.id, startX: matchState.lastKickPos?.x ?? kicker.x, startY: matchState.lastKickPos?.y ?? kicker.y, endX: closestPlayer.x, endY: closestPlayer.y, team: kicker.team });
      }
    }

    matchState.possessionPlayerId = closestPlayer.id;
    lastTouchTeam = closestPlayer.team;
    possessionCooldown = 20; 
    closestPlayer.possessionStrength = 1.0; 
    matchState.lastKickerId = null; matchState.lastKickType = null; matchState.lastKickPos = null;
  }
}

function scoreGoal(team: 'home' | 'away') {
  if (matchState.status !== 'PLAYING') return;
  const scorerStats = team === 'home' ? matchState.stats.home : matchState.stats.away;
  if (team === 'home') matchState.homeScore += 1;
  else matchState.awayScore += 1;
  scorerStats.goals += 1;
  const lastShot = matchState.analytics.shots[matchState.analytics.shots.length - 1];
  if (lastShot && lastShot.team === team) lastShot.result = 'GOAL';
  if (matchState.lastKickType !== 'SHOOT') scorerStats.shots += 1;
  
  const minute = Math.floor(matchState.timer / 60);
  emitMatchEvent('goal', `GOAL! ${team.toUpperCase()} scores!`, minute);

  // Cinematic Zoom
  matchState.camera.mode = 'ACTION';
  matchState.camera.zoom = 3.5;

  const kickingTeam = team === 'home' ? 'away' : 'home';
  resetMatch({ status: 'PLAYING', kickingTeam });
}

export function updatePlayerPhysics() {
  matchState.players.forEach(p => {
    const speed = Math.hypot(p.vx * PITCH_W, p.vy * PITCH_H);
    const tacticalStyle = p.team === 'home' ? matchState.homeTacticalStyle : matchState.awayTacticalStyle;
    let intensityMod = 1.0;
    if (tacticalStyle === 'Gegenpress') intensityMod = 1.4; 
    else if (tacticalStyle === 'Park the Bus') intensityMod = 0.7; 
    else if (tacticalStyle === 'Fluid Counter') intensityMod = 1.1; 

    const staminaCost = ((speed * 0.005) + (p.aiState === 'PRESS' ? 0.015 : 0)) * intensityMod;
    p.currentStamina = Math.max(0, p.currentStamina - (staminaCost * (1 - p.attributes.stamina / 100) * (1 + p.attributes.workRate / 100)));

    if (matchState.possessionPlayerId === p.id) {
      p.possessionStrength = Math.max(0, (p.possessionStrength || 1.0) - (((p.pressure || 0) * 0.02) + 0.002) * (1 - p.attributes.strength / 100));
    } else {
      p.possessionStrength = Math.min(1.0, (p.possessionStrength || 1.0) + 0.01);
    }

    const maxV = (0.0015 + (p.attributes.pace / 10000)) * (0.6 + (p.currentStamina / 100) * 0.4); 
    const currV = Math.hypot(p.vx, p.vy);
    if (currV > maxV && currV > 0) { p.vx = (p.vx / currV) * maxV; p.vy = (p.vy / currV) * maxV; }
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.9; p.vy *= 0.9;
    p.x = Math.max(0, Math.min(1, p.x)); p.y = Math.max(0, Math.min(1, p.y));
  });

  const allPlayers = matchState.players;
  for (let i = 0; i < allPlayers.length; i++) {
    for (let j = i + 1; j < allPlayers.length; j++) {
      let p1 = allPlayers[i]; let p2 = allPlayers[j];
      let dx = (p2.x - p1.x); let dy = (p2.y - p1.y);
      let d = Math.hypot(dx * PITCH_W, dy * PITCH_H) || 0.001;
      const minSafeDist = 0.04; 
      if (d < minSafeDist) {
        const force = (minSafeDist - d) * 0.03; 
        const nx = dx * PITCH_W / d; const ny = dy * PITCH_H / d;
        allPlayers[i].vx -= (nx / PITCH_W) * force; allPlayers[i].vy -= (ny / PITCH_H) * force;
        allPlayers[j].vx += (nx / PITCH_W) * force; allPlayers[j].vy += (ny / PITCH_H) * force;
      }
    }
  }
}
