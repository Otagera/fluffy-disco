import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';
import type { Player } from './types';
import { evaluatePlayerActions, type Action } from './utilityAI';
import { MoveToTarget, ExecuteKick, DribbleBall, Sequence, type BTNode } from './behaviorTree';
import { RoleRegistry } from './roles';

const behaviors: Record<string, BTNode> = {
  'PASS': new Sequence('pass', [new MoveToTarget(), new ExecuteKick(3.4)]),
  'SHOOT': new Sequence('shoot', [new MoveToTarget(), new ExecuteKick(3.8)]),
  'CLEAR': new ExecuteKick(4.0),
  'DRIBBLE': new Sequence('dribble', [new MoveToTarget(), new DribbleBall()]),
  'PRESS': new MoveToTarget(),
  'JOCKEY': new MoveToTarget(),
  'SUPPORT': new MoveToTarget(),
  'OVERLAP': new MoveToTarget()
};

const defaultMove = new MoveToTarget();

export function updateAI() {
  const allPlayers = matchState.players;

  updateTacticalAnchors();

  allPlayers.forEach(p => {
    calculateEffectivePressure(p);

    const actions = evaluatePlayerActions(p);
    let topAction = actions[0];

    // ACTION PERSISTENCE
    if (p.currentAction && p.actionTimer < 30) {
      const currentActionData = actions.find(a => a.type === p.currentAction);
      if (currentActionData) {
        const bestAlt = actions[0];
        if (bestAlt.score - currentActionData.score < 0.3) {
          topAction = currentActionData;
        }
      }
    }

    if (topAction.type !== p.currentAction) {
      p.currentAction = topAction.type;
      p.actionTimer = 0;
      p.btState = {};
    } else {
      p.actionTimer++;
    }

    const bt = behaviors[topAction.type] || defaultMove;
    bt.tick(p, topAction);

    p.aiState = topAction.type as any;
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
    const dynamicDecayFactor = 0.35 - (approachSpeed > 0 ? approachSpeed * 0.5 : 0);

    let press = Math.exp(-d * dynamicDecayFactor); 

    const forwardDir = player.team === 'home' ? 1 : -1;
    const isOpponentInFront = Math.sign(dx) === forwardDir;
    if (isOpponentInFront) press *= 1.5;

    rawPressure += press;
  });

  const composureMod = 1 + (player.attributes.composure / 10);
  player.pressure = rawPressure / composureMod;
}

export function updateTacticalAnchors() {
  const b = matchState.ball;
  const possessorId = matchState.possessionPlayerId;
  const possessor = matchState.players.find(p => p.id === possessorId);

  // Identify Defensive Leaders for both teams (Milestone 8)
  const getLeader = (teamId: 'home'|'away') => matchState.players
    .filter(p => p.team === teamId && p.role === 'DEF')
    .sort((a, b) => (b.attributes.positioning + b.attributes.decisions) - (a.attributes.positioning + a.attributes.decisions))[0];

  const leaders = { home: getLeader('home'), away: getLeader('away') };
  const teamLineDeltas = { home: 0, away: 0 };

  // Calculate the team block shift based on the leader's offside line
  ['home', 'away'].forEach(teamStr => {
    const team = teamStr as 'home' | 'away';
    const leader = leaders[team];
    if (!leader) return;

    let forwardDir = team === 'home' ? 1 : -1;
    if (matchState.sidesSwitched) forwardDir *= -1;

    const mentality = team === 'home' ? matchState.homeMentality : matchState.awayMentality;
    let mentalityShift = 0;
    if (mentality === 'ULTRA_ATTACKING') mentalityShift = 0.15;
    else if (mentality === 'ATTACKING') mentalityShift = 0.08;
    else if (mentality === 'DEFENSIVE') mentalityShift = -0.08;
    else if (mentality === 'ULTRA_DEFENSIVE') mentalityShift = -0.15;

    // Base target for leader (before trap)
    const baseLeaderX = (leader.homeX / PITCH_W) + ((b.x - 0.5) * 0.2) + (mentalityShift * forwardDir);

    const isTeamInPossession = possessor && possessor.team === team;
    if (!isTeamInPossession) {
      // Leader sets the line relative to the ball
      const ballX = b.x;
      const lineOffset = 0.15 * forwardDir;
      let idealLineX = ballX - lineOffset;
      
      // Clamp to defensive half unless attacking mentality
      if (mentality === 'BALANCED' || mentality.includes('DEFENSIVE')) {
        const midX = 0.5;
        if (forwardDir > 0) idealLineX = Math.min(midX, idealLineX);
        else idealLineX = Math.max(midX, idealLineX);
      }
      
      teamLineDeltas[team] = idealLineX - baseLeaderX;
    }
  });

  matchState.players.forEach(p => {
    const isTeamInPossession = possessor && possessor.team === p.team;
    
    // 1. BASE SHIFT: Formation horizontally shifts toward ball
    const ballShiftX = (b.x - 0.5) * 0.2;
    const ballShiftY = (b.y - 0.5) * 0.1;
    
    let targetAnchorX = p.homeX / PITCH_W + ballShiftX;
    let targetAnchorY = p.homeY / PITCH_H + ballShiftY;

    // Apply Mentality Shift
    const mentality = p.team === 'home' ? matchState.homeMentality : matchState.awayMentality;
    
    // Determine forward direction based on team AND switch state
    let forwardDir = p.team === 'home' ? 1 : -1;
    if (matchState.sidesSwitched) forwardDir *= -1;

    const roleDef = RoleRegistry.get(p.tacticalRole) || RoleRegistry.get('GK')!;
    const offsets = roleDef.getPositionalAnchorOffset(b.x, b.y, mentality, forwardDir, isTeamInPossession ?? false);

    // Don't shift GK based on mentality to prevent them walking out of the box
    if (p.role !== 'GK') {
      targetAnchorX += offsets.dx;
      
      // Apply block shift (Offside trap delta) so whole team moves up/down together
      targetAnchorX += teamLineDeltas[p.team];
      
      // Apply width modifier (pull towards or push away from center Y: 0.5)
      targetAnchorY = 0.5 + (targetAnchorY - 0.5) * offsets.widthModifier;
    }

    // 2. COORDINATED DEFENSIVE LINE (Offside Trap & Confrontation - Milestone 8)
    if (!isTeamInPossession && p.role === 'DEF') {
      const leader = p.team === 'home' ? leaders.home : leaders.away;
      const isLeader = leader && leader.id === p.id;
      
      // LINE OF CONFRONTATION:
      // If the ball is in the defensive third (within 0.3 of our goal), defenders must step up to confront
      const myGoalX = p.team === 'home' ? (matchState.sidesSwitched ? 1.0 : 0.0) : (matchState.sidesSwitched ? 0.0 : 1.0);
      const distToGoal = Math.abs(b.x - myGoalX);
      
      if (distToGoal < 0.3) {
        // Critical zone: Stop retreating and step towards the ball
        // The closer the ball, the more aggressive the step up
        const urgency = 1 - (distToGoal / 0.3); // 0 at 30m, 1 at goal line
        const dx = b.x - targetAnchorX;
        const dy = b.y - targetAnchorY;
        
        // Step forward, but also pinch inward to protect the goal mouth
        targetAnchorX += dx * 0.4 * urgency;
        targetAnchorY += dy * 0.3 * urgency;
      } else if (!isLeader && leader) {
        // Normal high-line logic
        // CONCENTRATION FAILURE: Lagging behind the line
        const concentration = p.attributes.concentration / 20; // 0 to 1
        const roll = Math.random();
        if (roll > concentration * 0.995) { // Occasional lapse
          const lag = 0.04 * forwardDir;
          targetAnchorX -= lag; // Drops deeper, potentially playing someone onside
        }
      }
    }

    // 3. RELATIONIST LOGIC: Supportive Movement
    if (isTeamInPossession && p.id !== possessorId) {
      // SUPPORT: Designate support positioning
      if (p.aiState === 'SUPPORT') {
        // Move ahead of ball but maintain relative vertical lane
        targetAnchorX = b.x + (forwardDir * 0.12);
        // Slightly tighten toward ball but keep width
        targetAnchorY = p.homeY / PITCH_H + (b.y - p.homeY / PITCH_H) * 0.3;
      }

      // OVERLAP: Wide defenders push high
      if (p.aiState === 'OVERLAP') {
        targetAnchorX = b.x + (forwardDir * 0.2);
        // Push even wider to create crossing options
        const side = p.homeY / PITCH_H > 0.5 ? 1 : -1;
        targetAnchorY = p.homeY / PITCH_H + (side * 0.05);
      }

      // COVERAGE: Midfielders drop if a defender overlaps
      if (p.role === 'MID' && p.aiState === 'JOCKEY') {
        const overlappingTeammate = matchState.players.find(t => 
          t.team === p.team && t.role === 'DEF' && t.aiState === 'OVERLAP'
        );
        if (overlappingTeammate) {
          // Drop back to cover the vacated defensive line
          targetAnchorX -= (forwardDir * 0.1);
        }
      }
    }

    // 3. GK POSITIONING
    if (p.role === 'GK') {
      // Goal is at 0.0 or 1.0 depending on team and switch state
      let ownGoalX = p.team === 'home' ? 0.02 : 0.98;
      if (matchState.sidesSwitched) ownGoalX = 1 - ownGoalX;

      const ownGoalY = 0.5;
      const distToGoal = Math.abs(b.x - ownGoalX);
      const intensity = distToGoal < 0.2 ? 0.9 : 0.4;
      targetAnchorX = ownGoalX;
      targetAnchorY = ownGoalY + (b.y - ownGoalY) * intensity;
      targetAnchorY = Math.max(0.4, Math.min(0.6, targetAnchorY));
    }

    // 4. SET PIECE OVERRIDES
    if (matchState.setPiece) {
      const sp = matchState.setPiece;
      const isAttacking = p.team === sp.team;
      
      if (sp.type === 'corner') {
        if (isAttacking) {
          if (p.role === 'CB' || p.role === 'FWD') {
            // Crowd the box
            const oppGoalX = p.team === 'home' ? (matchState.sidesSwitched ? 0.05 : 0.95) : (matchState.sidesSwitched ? 0.95 : 0.05);
            targetAnchorX = oppGoalX + (Math.random() - 0.5) * 0.1;
            targetAnchorY = 0.5 + (Math.random() - 0.5) * 0.2;
          } else if (p.role === 'FB') {
            // Stay back
            targetAnchorX = p.team === 'home' ? (matchState.sidesSwitched ? 0.6 : 0.4) : (matchState.sidesSwitched ? 0.4 : 0.6);
          }
        } else if (p.role !== 'GK') {
          // Defending team packs the box
          const ownGoalX = p.team === 'home' ? (matchState.sidesSwitched ? 0.95 : 0.05) : (matchState.sidesSwitched ? 0.05 : 0.95);
          targetAnchorX = ownGoalX + (Math.random() - 0.5) * 0.05;
          targetAnchorY = 0.5 + (Math.random() - 0.5) * 0.2;
        }
      } else if (sp.type === 'throw-in') {
        if (isAttacking && p.role !== 'GK') {
          // Move toward the thrower
          const dx = sp.x - targetAnchorX;
          const dy = sp.y - targetAnchorY;
          targetAnchorX += dx * 0.5;
          targetAnchorY += dy * 0.5;
        } else if (!isAttacking && p.role !== 'GK') {
          // Mark the area
          const dx = sp.x - targetAnchorX;
          const dy = sp.y - targetAnchorY;
          targetAnchorX += dx * 0.3;
          targetAnchorY += dy * 0.3;
        }
      }

      // Taker override
      if (sp.takerId === p.id) {
        targetAnchorX = sp.x;
        targetAnchorY = sp.y;
      } else if (!sp.takerId && isAttacking && p.role !== 'GK') {
        // Just send the closest guy if no taker assigned yet so they walk there
        const d = Math.hypot((p.x - sp.x) * PITCH_W, (p.y - sp.y) * PITCH_H);
        if (d < 5) {
          targetAnchorX = sp.x;
          targetAnchorY = sp.y;
        }
      }
    }

    p.anchorX = targetAnchorX;
    p.anchorY = targetAnchorY;
  });
}
