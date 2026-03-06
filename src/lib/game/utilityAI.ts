import type { Player } from './types';
import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';
import { tacticalRoles } from './roles';
import { getForwardDir, getOpponentGoalX, getMyGoalX } from './utils';

export type ActionType = 'PASS' | 'SHOOT' | 'DRIBBLE' | 'PRESS' | 'JOCKEY' | 'CLEAR' | 'SUPPORT' | 'OVERLAP' | 'TACKLE' | 'SHOT_STOP' | 'DISTRIBUTE' | 'CLAIM_CROSS';

export interface Action {
  type: ActionType;
  score: number;
  target?: { x: number, y: number };
  targetPlayerId?: number;
  audit?: string; 
}

const dist = (x1: number, y1: number, x2: number, y2: number) => {
  const d = Math.hypot((x1 - x2) * PITCH_W, (y1 - y2) * PITCH_H);
  return d || 0.001; 
};

export const linear = (v: number) => Math.max(0, Math.min(1, v));
export const inverse = (v: number) => 1 - linear(v);

/**
 * GK-specific action evaluation
 * GKs focus on shot-stopping, distributing, and claiming crosses
 */
function evaluateGKActions(player: Player, isPossessor: boolean, isTeamInPossession: boolean, possessor: Player | null): Action[] {
  const ball = matchState.ball;
  const rawActions: Action[] = [];
  
  const staminaPct = player.currentStamina / 100;
  const fatigue = 1 - staminaPct;
  const decisionAccuracy = player.attributes.decisions / 20;
  
  if (isPossessor) {
    // GK has ball: distribute to defender or midfield
    rawActions.push(scoreGKDistribute(player, 1.0));
  } else {
    // GK defending
    const ballDist = dist(player.x, player.y, ball.x, ball.y);
    
    // SHOT_STOP: attempt to block incoming shot
    rawActions.push(scoreGKShotStop(player, inverse(fatigue * 0.5)));
    
    // CLAIM_CROSS: attempt to claim crosses (in penalty area)
    if (ballDist < 10 / PITCH_W) { // ~10m radius
      rawActions.push(scoreGKClaimCross(player, inverse(fatigue * 0.3)));
    } else {
      rawActions.push({ type: 'CLAIM_CROSS', score: 0 });
    }
    
    // JOCKEY as fallback
    rawActions.push({ type: 'JOCKEY', score: 0.3 });
  }
  
  const finalizedActions = rawActions.map(action => {
    const isTechnical = ['DISTRIBUTE', 'SHOT_STOP'].includes(action.type);
    const noiseScale = isTechnical ? 0.3 : 0.2;
    const noise = (Math.random() - 0.5) * (1 - decisionAccuracy) * noiseScale;
    let score = Math.max(0, Math.min(1, action.score + noise));
    return { ...action, score };
  });
  
  return finalizedActions.sort((a, b) => b.score - a.score);
}

/**
 * Score GK's shot-stopping ability
 * Higher reflexes + lower distance increases score
 */
function scoreGKShotStop(gk: Player, multiplier: number): Action {
  const ball = matchState.ball;
  const possessor = matchState.players.find(p => p.id === matchState.possessionPlayerId);
  
  // Check if there's an incoming shot (opponent has ball and is in attacking position)
  if (!possessor || possessor.team === gk.team) {
    return { type: 'SHOT_STOP', score: 0 };
  }
  
  // Rough estimate: is opponent in position to shoot?
  const opponentGoal = gk.team === 'home' ? 0 : 1;
  const isInShootingPosition = gk.team === 'home' 
    ? possessor.x > 0.6 
    : possessor.x < 0.4;
  
  if (!isInShootingPosition) {
    return { type: 'SHOT_STOP', score: 0 };
  }
  
  const reflexScore = gk.attributes.reflexes / 20;
  const positioningScore = gk.attributes.positioning / 20;
  const ballDist = dist(gk.x, gk.y, ball.x, ball.y);
  const proximityScore = inverse(ballDist / 20); // further away = lower score
  
  const score = (reflexScore * 0.6 + positioningScore * 0.4) * proximityScore * multiplier;
  return { type: 'SHOT_STOP', score: linear(score), target: { x: ball.x, y: ball.y } };
}

/**
 * Score GK's distribution decision
 * Routes to CB (safest), then fullbacks
 */
function scoreGKDistribute(gk: Player, multiplier: number): Action {
  const teammates = matchState.players.filter(
    p => p.team === gk.team && p.id !== gk.id && p.role !== 'GK'
  );
  
  // Prefer center-backs
  const cbs = teammates.filter(p => p.tacticalRole === 'CB' || p.role === 'DEF');
  const target = cbs.length > 0 ? cbs[0] : (teammates.length > 0 ? teammates[0] : gk);
  
  // GK distribution is ~70% accurate (vs 85% for field players)
  const passAccuracy = 0.7 * (gk.attributes.passing / 20);
  const score = passAccuracy * multiplier;
  
  return { 
    type: 'DISTRIBUTE', 
    score: linear(score), 
    target: { x: target.anchorX, y: target.anchorY },
    targetPlayerId: target.id
  };
}

/**
 * Score GK's ability to claim crosses
 * Higher handling + concentration + proximity = better
 */
function scoreGKClaimCross(gk: Player, multiplier: number): Action {
  const ball = matchState.ball;
  const ballDist = dist(gk.x, gk.y, ball.x, ball.y);
  
  // Only in penalty area and when ball is in air
  const inPenaltyArea = gk.team === 'home' ? gk.x < 0.16 : gk.x > 0.84;
  if (!inPenaltyArea || ball.z < 0.5) {
    return { type: 'CLAIM_CROSS', score: 0 };
  }
  
  const handlingScore = gk.attributes.handling / 20;
  const concentrationScore = gk.attributes.concentration / 20;
  const proximityScore = inverse(ballDist / 15);
  
  const score = (handlingScore * 0.5 + concentrationScore * 0.5) * proximityScore * multiplier;
  return { type: 'CLAIM_CROSS', score: linear(score), target: { x: ball.x, y: ball.y } };
}

export function evaluatePlayerActions(player: Player): Action[] {
  const isPossessor = matchState.possessionPlayerId === player.id;
  const possessionId = matchState.possessionPlayerId;
  const possessor = possessionId !== null ? matchState.players.find(p => p.id === possessionId) : null;
  const isTeamInPossession = possessor?.team === player.team;

  // GK-SPECIFIC DECISION TREE
  if (player.role === 'GK') {
    return evaluateGKActions(player, isPossessor, isTeamInPossession, possessor || null);
  }

  const modifiers = tacticalRoles[player.tacticalRole] || {
    tackling: 1.0, dribbling: 1.0, passing: 1.0, shooting: 1.0, holding: 1.0
  };

  const composureMod = 1 + (player.attributes.composure / 20);
  const effectivePressure = (player.pressure || 0) / composureMod;
  const pressureFactor = inverse(effectivePressure * 0.6); 

  const staminaPct = player.currentStamina / 100;
  const fatigue = 1 - staminaPct;
  const cognitiveLaziness = inverse(fatigue * (0.6 - (player.attributes.workRate / 60)));

  const rawActions: Action[] = [];

  if (isPossessor) {
    rawActions.push(scoreShoot(player, modifiers.shooting * pressureFactor * cognitiveLaziness));
    rawActions.push(scorePass(player, modifiers.passing * pressureFactor * cognitiveLaziness));
    rawActions.push(scoreDribble(player, modifiers.dribbling * pressureFactor * cognitiveLaziness));
    rawActions.push(scoreClear(player, (1 + (player.pressure || 0) * 1.5) * (1 + fatigue * 0.5)));
  } else {
    // Only press/tackle if opponent has ball or ball is free
    const defensiveMultiplier = (!isTeamInPossession || possessionId === null) ? 1.0 : 0.0;
    
    rawActions.push(scoreTackle(player, modifiers.tackling * inverse(fatigue * 0.5) * defensiveMultiplier));
    rawActions.push(scorePress(player, modifiers.tackling * inverse(fatigue * 0.8) * defensiveMultiplier));
    rawActions.push(scoreJockey(player, modifiers.holding * (1 + fatigue * 0.2)));
    
    if (player.role === 'FWD' || player.role === 'MID') {
      rawActions.push(scoreSupport(player, cognitiveLaziness * (isTeamInPossession ? 1.0 : 0.0)));
    }
    if (player.role === 'DEF') {
      rawActions.push(scoreOverlap(player, cognitiveLaziness * (isTeamInPossession ? 1.0 : 0.0)));
    }
  }

  const decisionAccuracy = player.attributes.decisions / 20; 
  const finalizedActions = rawActions.map(action => {
    const isTechnical = ['PASS', 'SHOOT', 'CLEAR', 'TACKLE'].includes(action.type);
    const noiseScale = isTechnical ? 0.4 : 0.2;
    const noise = (Math.random() - 0.5) * (1 - decisionAccuracy) * noiseScale;
    let score = Math.max(0, Math.min(1, action.score + noise));
    return { ...action, score };
  });

  return finalizedActions.sort((a, b) => b.score - a.score);
}

function scoreShoot(player: Player, multiplier: number): Action {
  const opponentGoalX = getOpponentGoalX(player.team, matchState.sidesSwitched);
  const d = Math.abs(opponentGoalX - player.x);
  const isCentral = Math.abs(player.y - 0.5);
  if (d > 0.4) return { type: 'SHOOT', score: 0 };
  const distScore = inverse(d / 0.4);
  const centralScore = inverse(isCentral / 0.25);
  const attrScore = player.attributes.finishing / 20;
  const targetY = 0.5 + (Math.random() - 0.5) * 0.1;
  return { type: 'SHOOT', score: linear(distScore * centralScore * attrScore * multiplier), target: { x: opponentGoalX, y: targetY } };
}

function scorePass(player: Player, multiplier: number): Action {
  const teammates = matchState.players.filter(p => p.team === player.team && p.id !== player.id);
  const forwardDir = getForwardDir(player.team, matchState.sidesSwitched);
  let bestScore = 0;
  let bestTarget = { x: 0.5, y: 0.5 };
  let bestTargetId = -1;
  teammates.forEach(t => {
    const d = dist(player.x, player.y, t.x, t.y);
    const distScore = linear(1 - (d / 60));
    const progress = (t.x - player.x) * forwardDir;
    const progressScore = 1.0 + (progress * 2.0); 
    const isRecentPasser = matchState.lastKickerId === t.id;
    const backPassPenalty = isRecentPasser ? 0.4 : 1.0;
    const score = distScore * progressScore * backPassPenalty * (player.attributes.vision / 20);
    if (score > bestScore) {
      bestScore = score;
      bestTarget = { x: t.anchorX, y: t.anchorY };
      bestTargetId = t.id;
    }
  });
  return { type: 'PASS', score: bestScore * multiplier, target: bestTarget, targetPlayerId: bestTargetId };
}

function scoreDribble(player: Player, multiplier: number): Action {
  const forwardDir = getForwardDir(player.team, matchState.sidesSwitched);
  let bestX = player.x + (forwardDir * 0.1);
  let bestY = player.y;
  const skillScore = (player.attributes.dribbling + player.attributes.acceleration) / 40;
  return { type: 'DRIBBLE', score: linear(skillScore * multiplier), target: { x: bestX, y: bestY } };
}

function scoreTackle(player: Player, multiplier: number): Action {
  const ball = matchState.ball;
  const d = dist(player.x, player.y, ball.x, ball.y);
  const possessorId = matchState.possessionPlayerId;
  if (possessorId === null || d > 3.0) return { type: 'TACKLE', score: 0 };
  const possessor = matchState.players.find(p => p.id === possessorId);
  if (!possessor || possessor.team === player.team) return { type: 'TACKLE', score: 0 };
  const tacklingAttr = player.attributes.tackling / 20;
  const aggressionAttr = player.attributes.aggression / 20;
  const proximityScore = inverse(d / 3.0);
  return { type: 'TACKLE', score: linear(proximityScore * (tacklingAttr + aggressionAttr) * multiplier), target: { x: ball.x, y: ball.y } };
}

function scorePress(player: Player, multiplier: number): Action {
  const ball = matchState.ball;
  const d = dist(player.x, player.y, ball.x, ball.y);
  if (multiplier <= 0) return { type: 'PRESS', score: 0 };
  return { type: 'PRESS', score: linear(inverse(d / 80) * multiplier), target: { x: ball.x, y: ball.y } };
}

function scoreJockey(player: Player, multiplier: number): Action {
  return { type: 'JOCKEY', score: 0.5 * multiplier, target: { x: player.anchorX, y: player.anchorY } };
}

function scoreSupport(player: Player, cognitiveLaziness: number): Action {
  if (cognitiveLaziness <= 0) return { type: 'SUPPORT', score: 0 };
  return { type: 'SUPPORT', score: 0.6 * cognitiveLaziness, target: { x: player.anchorX, y: player.anchorY } };
}

function scoreOverlap(player: Player, cognitiveLaziness: number): Action {
  if (cognitiveLaziness <= 0) return { type: 'OVERLAP', score: 0 };
  const b = matchState.ball;
  const possessorId = matchState.possessionPlayerId;
  if (possessorId === null) return { type: 'OVERLAP', score: 0 };
  const possessor = matchState.players.find(p => p.id === possessorId);
  if (!possessor || possessor.team !== player.team) return { type: 'OVERLAP', score: 0 };
  const forwardDir = getForwardDir(player.team, matchState.sidesSwitched);
  const inAttack = forwardDir === 1 ? b.x > 0.5 : b.x < 0.5;
  if (!inAttack) return { type: 'OVERLAP', score: 0 };
  const isWide = player.homeY / PITCH_H < 0.3 || player.homeY / PITCH_H > 0.7;
  if (!isWide) return { type: 'OVERLAP', score: 0 };
  const physicalFactor = (player.attributes.pace + player.attributes.acceleration + player.attributes.workRate) / 60;
  const isFinalThird = forwardDir === 1 ? b.x > 0.7 : b.x < 0.3;
  const finalThirdBoost = isFinalThird ? 1.6 : 1.0;
  const score = 0.8 * physicalFactor * cognitiveLaziness * finalThirdBoost;
  return { type: 'OVERLAP', score: linear(score), target: { x: player.anchorX, y: player.anchorY } };
}

function scoreClear(player: Player, multiplier: number): Action {
  const opponentGoalX = getOpponentGoalX(player.team, matchState.sidesSwitched);
  return { type: 'CLEAR', score: 0.5 * multiplier, target: { x: opponentGoalX, y: Math.random() } };
}
