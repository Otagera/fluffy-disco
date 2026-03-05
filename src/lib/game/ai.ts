import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';
import type { Player } from './types';
import { evaluatePlayerActions, type Action } from './utilityAI';
import { MoveToTarget, ExecuteKick, DribbleBall, ExecuteTackle, Sequence, type BTNode } from './behaviorTree';
import { RoleRegistry } from './roles';
import { getForwardDir, getMyGoalX, getOpponentGoalX } from './utils';

const behaviors: Record<string, BTNode> = {
  'PASS': new Sequence('pass', [new MoveToTarget(), new ExecuteKick(3.4)]),
  'SHOOT': new Sequence('shoot', [new MoveToTarget(), new ExecuteKick(3.8)]),
  'CLEAR': new ExecuteKick(4.0),
  'DRIBBLE': new DribbleBall(),
  'TACKLE': new ExecuteTackle(),
  'PRESS': new MoveToTarget(),
  'JOCKEY': new MoveToTarget(),
  'SUPPORT': new MoveToTarget(),
  'OVERLAP': new MoveToTarget()
};

const defaultMove = new MoveToTarget();

/**
 * Cognitive AI Update
 * Players decide what to do based on their think cycles.
 */
export function updateAI(dt: number) {
  const allPlayers = matchState.players;
  const ball = matchState.ball;
  const dtSeconds = dt / 1000;

  // 1. GLOBAL ANCHOR UPDATE (Positional awareness)
  updateTacticalAnchors();

  allPlayers.forEach(p => {
    const isPossessor = matchState.possessionPlayerId === p.id;
    
    // Decrease think cooldown
    if (p.thinkCooldown > 0) {
      p.thinkCooldown -= dtSeconds;
    }

    // TRIGGER RE-EVALUATION
    // High-priority triggers: just got ball, or cooldown expired
    const needsToThink = isPossessor || p.thinkCooldown <= 0;

    if (needsToThink) {
      const actions = evaluatePlayerActions(p);
      const topAction = actions[0];
      
      p.currentAction = topAction;
      p.btState = {}; // Reset BT state on new decision

      // Set next think cooldown based on mental attributes
      // Range: ~0.2s (Elite) to ~1.2s (Poor)
      const mentalSum = p.attributes.anticipation + p.attributes.decisions;
      p.thinkCooldown = Math.max(0.2, 1.2 - (mentalSum / 40));
      
      // Possessors think faster (higher intensity)
      if (isPossessor) p.thinkCooldown *= 0.5;
    }

    // EXECUTE CURRENT INTENT (Behavior Tree)
    if (p.currentAction) {
      const bt = behaviors[p.currentAction.type] || defaultMove;
      bt.tick(p, p.currentAction); 
    }

    p.aiState = (p.currentAction?.type || 'POSITION') as any;
  });
}

export function updateTacticalAnchors() {
  const b = matchState.ball;
  const possessionId = matchState.possessionPlayerId;
  const isTeamInPossession = possessionId !== null && 
    matchState.players.find(p => p.id === possessionId)?.team;

  // Coordinated line logic
  const leaders = {
    home: matchState.players.find(p => p.team === 'home' && p.tacticalRole === 'CB'),
    away: matchState.players.find(p => p.team === 'away' && p.tacticalRole === 'CB')
  };

  const teamLineDeltas = {
    home: leaders.home ? (b.x - 0.5) * 0.3 : 0,
    away: leaders.away ? (b.x - 0.5) * 0.3 : 0
  };

  matchState.players.forEach(p => {
    let targetAnchorX = p.homeX / PITCH_W;
    let targetAnchorY = p.homeY / PITCH_H;

    const mentality = p.team === 'home' ? matchState.homeMentality : matchState.awayMentality;
    const forwardDir = getForwardDir(p.team, matchState.sidesSwitched);
    const roleDef = RoleRegistry.get(p.tacticalRole) || RoleRegistry.get('GK')!;
    const offsets = roleDef.getPositionalAnchorOffset(b.x, b.y, mentality, forwardDir, isTeamInPossession === p.team);

    if (p.role !== 'GK') {
      targetAnchorX += offsets.dx;
      targetAnchorX += teamLineDeltas[p.team];
      targetAnchorY = 0.5 + (targetAnchorY - 0.5) * offsets.widthModifier;

      // TOPOLOGICAL OVERLAP SHIFT (Milestone 8)
      if (p.aiState === 'OVERLAP') {
        targetAnchorX += forwardDir * 0.2;
      }
    }

    p.anchorX = targetAnchorX;
    p.anchorY = targetAnchorY;
  });
}

export function calculateEffectivePressure(player: Player) {
  const opponents = matchState.players.filter(p => p.team !== player.team);
  let rawPressure = 0;

  opponents.forEach(opp => {
    const dx = (opp.x - player.x) * PITCH_W;
    const dy = (opp.y - player.y) * PITCH_H;
    const d = Math.sqrt(dx*dx + dy*dy) || 0.001;
    
    const approachSpeed = -((opp.vx * dx) + (opp.vy * dy)) / d; 
    const rawDecay = 0.35 - (approachSpeed > 0 ? approachSpeed * 0.5 : 0);
    const dynamicDecayFactor = Math.max(0.08, Math.min(0.45, rawDecay));

    let press = Math.exp(-d * dynamicDecayFactor); 

    const forwardDir = getForwardDir(player.team, matchState.sidesSwitched);
    const isOpponentInFront = Math.sign(dx) === forwardDir;
    if (isOpponentInFront) press *= 1.5;

    rawPressure += press;
  });

  player.pressure = rawPressure;
}

