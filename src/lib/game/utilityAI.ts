import type { Player } from './types';
import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';
import { tacticalRoles } from './roles';

export type ActionType = 'PASS' | 'SHOOT' | 'DRIBBLE' | 'PRESS' | 'JOCKEY' | 'CLEAR' | 'SUPPORT' | 'OVERLAP';

export interface Action {
  type: ActionType;
  score: number;
  target?: any;
  audit?: string; // Telemetry for debugging AI decisions
}

const dist = (x1: number, y1: number, x2: number, y2: number) => {
  const d = Math.hypot((x1 - x2) * PITCH_W, (y1 - y2) * PITCH_H);
  return d || 0.001; 
};

export const linear = (v: number) => Math.max(0, Math.min(1, v));
export const inverse = (v: number) => 1 - linear(v);

export function evaluatePlayerActions(player: Player): Action[] {
  const isPossessor = matchState.possessionPlayerId === player.id;
  
  const modifiers = tacticalRoles[player.tacticalRole] || {
    tackling: 1.0, dribbling: 1.0, passing: 1.0, shooting: 1.0, holding: 1.0
  };

  // 1. COMPOSURE DAMPENING
  const composureMod = 1 + (player.attributes.composure / 20);
  const effectivePressure = (player.pressure || 0) / composureMod;
  const pressureFactor = inverse(effectivePressure * 0.6); 

  const staminaPct = player.currentStamina / 100;
  const fatigue = 1 - staminaPct;
  // High work rate makes players push through fatigue slightly more but tires them faster (handled in physics)
  const cognitiveLaziness = inverse(fatigue * (0.8 - (player.attributes.workRate / 50)));

  const rawActions: Action[] = [];

  if (isPossessor) {
    rawActions.push(scoreShoot(player, modifiers.shooting * pressureFactor * cognitiveLaziness));
    rawActions.push(scorePass(player, modifiers.passing * pressureFactor * cognitiveLaziness));
    rawActions.push(scoreDribble(player, modifiers.dribbling * pressureFactor * cognitiveLaziness));
    rawActions.push(scoreClear(player, (1 + (player.pressure || 0) * 1.5) * (1 + fatigue * 0.5)));
  } else {
    rawActions.push(scorePress(player, modifiers.tackling * inverse(fatigue * 0.9)));
    rawActions.push(scoreJockey(player, modifiers.holding * (1 + fatigue * 0.4)));
    
    if (player.role === 'FWD' || player.role === 'MID') {
      rawActions.push(scoreSupport(player, cognitiveLaziness));
    }

    if (player.role === 'DEF') {
      rawActions.push(scoreOverlap(player, cognitiveLaziness));
    }
  }

  // 2. DECISIONS NOISE
  const decisionAccuracy = player.attributes.decisions / 20; 
  
  const finalizedActions = rawActions.map(action => {
    const isTechnical = ['PASS', 'SHOOT', 'CLEAR'].includes(action.type);
    const noiseScale = isTechnical ? 0.4 : 0.2;
    const noise = (Math.random() - 0.5) * (1 - decisionAccuracy) * noiseScale;
    
    let score = Math.max(0, Math.min(1, action.score + noise));

    if (action.audit) {
      action.audit += ` | Noise: ${noise.toFixed(2)} | Final: ${score.toFixed(2)}`;
    }

    return { ...action, score };
  });

  return finalizedActions.sort((a, b) => b.score - a.score);
}

function scoreShoot(player: Player, multiplier: number): Action {
  const homeShootsRight = !matchState.sidesSwitched;
  const isHome = player.team === 'home';
  const opponentGoalX = (isHome === homeShootsRight) ? 1.0 : 0.0;
  
  const d = Math.abs(opponentGoalX - player.x);
  const isCentral = Math.abs(player.y - 0.5);

  const gk = matchState.players.find(p => p.role === 'GK' && p.team !== player.team);
  let gkOutOfPosition = false;
  if (gk) {
    const gkDistFromGoal = Math.abs(opponentGoalX - gk.x);
    if (gkDistFromGoal > 0.1) gkOutOfPosition = true;
  }

  if (d > 0.35 && !gkOutOfPosition) return { type: 'SHOOT', score: 0, audit: 'Too far from goal' };

  const gkBonus = gkOutOfPosition ? 2.0 : 1.0;
  const distScore = inverse(d / 0.4);
  const centralScore = inverse(isCentral / 0.25);
  // NEW: Use finishing instead of generic shooting
  const attrScore = player.attributes.finishing / 20;

  const score = distScore * centralScore * attrScore * multiplier * gkBonus;
  const audit = `Dist: ${distScore.toFixed(2)} * Ctr: ${centralScore.toFixed(2)} * Fin: ${attrScore.toFixed(2)} * Multi: ${multiplier.toFixed(2)} * GKB: ${gkBonus}`;

  return { type: 'SHOOT', score: linear(score), audit };
}

function scorePass(player: Player, multiplier: number): Action {
  const teammates = matchState.players.filter(p => p.team === player.team && p.id !== player.id);
  const opponents = matchState.players.filter(p => p.team !== player.team);
  const homeShootsRight = !matchState.sidesSwitched;
  const isHome = player.team === 'home';
  const forwardDir = (isHome === homeShootsRight) ? 1 : -1;

  let bestScore = 0;
  let bestTarget = null;
  let bestAudit = "";

  teammates.forEach(t => {
    const d = dist(player.x, player.y, t.x, t.y);
    const distScore = linear(1 - (d / 60));
    
    let minDefDistToTarget = 999;
    opponents.forEach(o => {
      const dDef = dist(t.x, t.y, o.x, o.y);
      if (dDef < minDefDistToTarget) minDefDistToTarget = dDef;
    });
    const safetyScore = linear(minDefDistToTarget / 8);

    let interceptionPenalty = 1.0;
    opponents.forEach(o => {
      const isBetweenX = (o.x > player.x && o.x < t.x) || (o.x < player.x && o.x > t.x);
      if (isBetweenX) {
        const dLane = dist(player.x, player.y, t.x, t.y);
        const dDefToLane = Math.abs((t.y - player.y) * o.x - (t.x - player.x) * o.y + t.x * player.y - t.y * player.x) / dLane;
        if (dDefToLane < 3) interceptionPenalty *= 0.5;
      }
    });

    const progress = (t.x - player.x) * forwardDir;
    const progressScore = 1.0 + (progress * 2.0); 

    const visionScore = player.attributes.vision / 20;
    
    // NEW: Crossing bonus if passer is wide and target is in box
    const isPasserWide = player.y < 0.25 || player.y > 0.75;
    const isTargetInBox = Math.abs(t.x - (isHome ? 1.0 : 0.0)) < 0.2 && Math.abs(t.y - 0.5) < 0.3;
    const crossingBonus = (isPasserWide && isTargetInBox) ? (1 + (player.attributes.crossing / 40)) : 1.0;

    const score = distScore * safetyScore * visionScore * progressScore * interceptionPenalty * crossingBonus;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = t;
      bestAudit = `Dist: ${distScore.toFixed(2)} * Safe: ${safetyScore.toFixed(2)} * Vis: ${visionScore.toFixed(2)} * Prog: ${progressScore.toFixed(2)} * CB: ${crossingBonus.toFixed(2)}`;
    }
  });

  return { type: 'PASS', score: bestScore * multiplier, target: bestTarget, audit: bestAudit };
}

function scoreDribble(player: Player, multiplier: number): Action {
  const homeShootsRight = !matchState.sidesSwitched;
  const isHome = player.team === 'home';
  const opponentGoalX = (isHome === homeShootsRight) ? 1.0 : 0.0;
  
  const d = Math.abs(opponentGoalX - player.x);
  const distScore = linear(d / 0.8);
  // NEW: Use dribbling and acceleration instead of generic pace
  const skillScore = (player.attributes.dribbling + player.attributes.acceleration + player.attributes.composure) / 60;

  const score = distScore * skillScore * 0.8 * multiplier;
  const audit = `Dist: ${distScore.toFixed(2)} * Skill: ${skillScore.toFixed(2)} * Multi: ${multiplier.toFixed(2)}`;

  return { type: 'DRIBBLE', score: linear(score), audit };
}

function scoreClear(player: Player, multiplier: number): Action {
  const pressureBonus = (player.pressure || 0) * 0.8;
  const homeShootsRight = !matchState.sidesSwitched;
  const isHome = player.team === 'home';
  const ownHalf = (isHome === homeShootsRight) ? player.x < 0.3 : player.x > 0.7;
  const ownHalfBonus = ownHalf ? 0.4 : 0;

  const score = (pressureBonus + ownHalfBonus) * multiplier;
  const audit = `Pres: ${pressureBonus.toFixed(2)} + Half: ${ownHalfBonus.toFixed(2)} * Multi: ${multiplier.toFixed(2)}`;

  return { type: 'CLEAR', score: linear(score), audit };
}

function scorePress(player: Player, multiplier: number): Action {
  const b = matchState.ball;
  const d = dist(player.x, player.y, b.x, b.y);
  
  const teammates = matchState.players.filter(p => p.team === player.team);
  
  // 1. COORDINATION HIERARCHY: Find rank among nearest teammates
  const sortedTeammates = teammates
    .map(t => ({ id: t.id, d: dist(t.x, t.y, b.x, b.y) }))
    .sort((a, b) => a.d - b.d);
  
  const rankIndex = sortedTeammates.slice(0, 3).findIndex(t => t.id === player.id);
  if (rankIndex === -1) return { type: 'PRESS', score: 0, audit: 'Not in top 3 nearest' };

  // Weight score by rank: Rank 0 (100%), Rank 1 (60%), Rank 2 (30%)
  // This prevents "jerking" as players won't instantly swap roles over tiny distance changes
  const rankMultipliers = [1.0, 0.6, 0.3];
  const rankWeight = rankMultipliers[rankIndex];

  // 2. GOALKEEPER RESTRICTION: Keep the GK in his box
  if (player.role === 'GK') {
    const homeShootsRight = !matchState.sidesSwitched;
    const isHome = player.team === 'home';
    const myGoalX = (isHome === homeShootsRight) ? 0.0 : 1.0;
    
    const distToMyGoal = Math.abs(b.x - myGoalX);
    const isInBox = distToMyGoal < 0.16 && b.y > 0.2 && b.y < 0.8;
    
    // GK only presses if ball is in box OR if he's the absolute last man and ball is very close
    if (!isInBox) {
      const isAbsoluteNearest = rankIndex === 0;
      if (!isAbsoluteNearest || d > 12) {
        return { type: 'PRESS', score: 0, audit: 'GK: Staying in post' };
      }
    }
  }

  // Soft decay over 80m
  const pressScore = inverse(d / 80);
  const intensityScore = (player.attributes.workRate + player.attributes.aggression + player.attributes.tackling) / 60;

  // LOOSE BALL URGENCY: Boost score if nobody has the ball
  const looseBallBoost = matchState.possessionPlayerId === null ? 1.5 : 1.0;
  
  // PENALTY BOX PANIC: If the ball is in our box, absolutely swarm it
  const homeShootsRight = !matchState.sidesSwitched;
  const isHome = player.team === 'home';
  const myGoalX = (isHome === homeShootsRight) ? 0.0 : 1.0;
  const distToMyGoal = Math.abs(b.x - myGoalX);
  const isInBox = distToMyGoal < 0.16 && b.y > 0.2 && b.y < 0.8;
  
  const boxPanicBoost = isInBox ? 2.5 : 1.0;

  const score = (pressScore + 0.4) * intensityScore * multiplier * looseBallBoost * boxPanicBoost * rankWeight;
  const audit = `Dist: ${pressScore.toFixed(2)} * Int: ${intensityScore.toFixed(2)} * Loose: ${looseBallBoost} * Box: ${boxPanicBoost} * Rank: ${rankWeight}`;

  return { type: 'PRESS', score: linear(score), audit };
}

function scoreJockey(player: Player, multiplier: number): Action {
  const audit = `Base: 0.50 * Multi: ${multiplier.toFixed(2)}`;
  return { type: 'JOCKEY', score: 0.5 * multiplier, audit };
}

function scoreSupport(player: Player, cognitiveLaziness: number): Action {
  const b = matchState.ball;
  const possessorId = matchState.possessionPlayerId;
  if (possessorId === null) return { type: 'SUPPORT', score: 0 };
  
  const possessor = matchState.players.find(p => p.id === possessorId);
  if (!possessor || possessor.team !== player.team) return { type: 'SUPPORT', score: 0 };

  const teammates = matchState.players.filter(p => p.team === player.team && p.id !== possessorId);
  
  const nearestTeammatesToBall = teammates
    .map(t => ({ id: t.id, d: dist(t.x, t.y, b.x, b.y) }))
    .sort((p1, p2) => p1.d - p2.d)
    .slice(0, 3) 
    .map(t => t.id);

  if (!nearestTeammatesToBall.includes(player.id)) return { type: 'SUPPORT', score: 0, audit: 'Not in group' };

  const homeShootsRight = !matchState.sidesSwitched;
  const isHome = player.team === 'home';
  const forwardDir = (isHome === homeShootsRight) ? 1 : -1;
  
  const isAhead = (player.x - b.x) * forwardDir > 0;
  
  // NEW: Use anticipation
  const anticipationBonus = 1 + (player.attributes.anticipation / 100);
  const baseScore = isAhead ? 0.75 : 0.55;
  const score = baseScore * cognitiveLaziness * anticipationBonus;
  const audit = `Base: ${baseScore.toFixed(2)} * Lazy: ${cognitiveLaziness.toFixed(2)} * Ant: ${anticipationBonus.toFixed(2)}`;

  return { type: 'SUPPORT', score, audit };
}

function scoreOverlap(player: Player, cognitiveLaziness: number): Action {
  const b = matchState.ball;
  const possessorId = matchState.possessionPlayerId;
  if (possessorId === null) return { type: 'OVERLAP', score: 0 };

  const possessor = matchState.players.find(p => p.id === possessorId);
  if (!possessor || possessor.team !== player.team) return { type: 'OVERLAP', score: 0 };

  const homeShootsRight = !matchState.sidesSwitched;
  const isHome = player.team === 'home';

  const inAttack = (isHome === homeShootsRight) ? b.x > 0.5 : b.x < 0.5;
  if (!inAttack) return { type: 'OVERLAP', score: 0, audit: 'Not in attacking half' };

  const isWide = player.homeY / PITCH_H < 0.3 || player.homeY / PITCH_H > 0.7;
  if (!isWide) return { type: 'OVERLAP', score: 0, audit: 'Not wide enough' };

  const staminaFactor = player.currentStamina / 100;
  // NEW: Use acceleration and work rate
  const physicalFactor = (player.attributes.pace + player.attributes.acceleration + player.attributes.workRate) / 60;
  
  const isFinalThird = (isHome === homeShootsRight) ? b.x > 0.7 : b.x < 0.3;
  const finalThirdBoost = isFinalThird ? 1.6 : 1.0;

  const score = 0.7 * staminaFactor * physicalFactor * cognitiveLaziness * finalThirdBoost;
  const audit = `Stam: ${staminaFactor.toFixed(2)} * Phys: ${physicalFactor.toFixed(2)} * Lazy: ${cognitiveLaziness.toFixed(2)} * F3B: ${finalThirdBoost.toFixed(2)}`;

  return { type: 'OVERLAP', score: linear(score), audit };
}
