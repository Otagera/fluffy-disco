import type { Player } from './types';
import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';
import type { Action } from './utilityAI';
import { resolveActionRoll, applyRollToVector } from './resolution';
import { calculateShotXG } from './recorder';
import { emitShotEvent } from './events';
import { getOpponentGoalX } from './utils';

export type BTStatus = 'SUCCESS' | 'FAILURE' | 'RUNNING';

export interface BTNode {
  tick(player: Player, action: Action): BTStatus;
}

// --- COMPOSITE NODES ---
export class Sequence implements BTNode {
  constructor(private id: string, private children: BTNode[]) {}

  tick(player: Player, action: Action): BTStatus {
    const stateKey = `seq_${this.id}_index`;
    let currentIndex = player.btState[stateKey] || 0;
    
    if (currentIndex >= this.children.length) {
      currentIndex = 0;
    }

    const child = this.children[currentIndex];
    const status = child.tick(player, action);

    if (status === 'FAILURE') {
      player.btState[stateKey] = 0;
      return 'FAILURE';
    }

    if (status === 'SUCCESS') {
      currentIndex++;
      if (currentIndex >= this.children.length) {
        player.btState[stateKey] = 0;
        return 'SUCCESS';
      }
      player.btState[stateKey] = currentIndex;
      return 'RUNNING';
    }

    return 'RUNNING';
  }
}

// --- ACTION LEAFS ---

/**
 * MoveToTarget
 * Blindly moves toward the target provided by the Brain.
 */
export class MoveToTarget implements BTNode {
  tick(player: Player, action: Action): BTStatus {
    const isPossessor = matchState.possessionPlayerId === player.id;
    
    // Possessors don't need to 'move to target' for kick actions, they are already at the ball
    if (isPossessor && ['PASS', 'SHOOT', 'CLEAR'].includes(action.type)) {
      return 'SUCCESS';
    }

    // Directive 3: Use the target provided by Utility AI
    const target = action.target || { x: player.anchorX, y: player.anchorY };
    
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const d = Math.hypot(dx * PITCH_W, dy * PITCH_H) || 0.001;

    // Arrival check
    if (d < 0.2) {
      player.vx *= 0.5;
      player.vy *= 0.5;
      return 'SUCCESS';
    }

    let accel = 0.0015 + (player.attributes.acceleration / 10000); 
    const slowingRadius = 4.0; 
    if (d < slowingRadius) accel *= (d / slowingRadius);

    player.vx += (dx * PITCH_W / d) * accel;
    player.vy += (dy * PITCH_H / d) * accel;

    return 'RUNNING';
  }
}

/**
 * ExecuteKick
 * Performs the physics resolution for a kick toward a pre-defined target.
 */
export class ExecuteKick implements BTNode {
  constructor(private basePower: number) {}

  tick(player: Player, action: Action): BTStatus {
    if (matchState.possessionPlayerId !== player.id) return 'FAILURE';
    if (!action.target) return 'FAILURE';

    const b = matchState.ball;
    const target = action.target;
    let power = this.basePower;

    const dx = (target.x - b.x) * PITCH_W;
    const dy = (target.y - b.y) * PITCH_H;
    const d = Math.sqrt(dx*dx + dy*dy) || 0.001;

    // Dynamic power for passes
    if (action.type === 'PASS') {
      power = Math.max(0.8, Math.min(3.0, (d / 20) + 0.5));
    }

    const rollType = action.type as 'PASS' | 'SHOOT' | 'CLEAR';
    const roll = resolveActionRoll(player, rollType, d);
    const vector = applyRollToVector((dx / d) * power, (dy / d) * power, roll);

    // Analytics & Stats
    const teamStats = player.team === 'home' ? matchState.stats.home : matchState.stats.away;
    if (action.type === 'PASS') teamStats.passesAttempted++;
    if (action.type === 'SHOOT') {
      teamStats.shots++;
      const xg = calculateShotXG(player, d, Math.atan2(dy, dx));
      emitShotEvent({ playerId: player.id, x: b.x, y: b.y, xg, result: 'MISS', team: player.team });
    }

    // Physics injection
    b.vx = vector.vx;
    b.vy = vector.vy;
    b.vz = action.type === 'CLEAR' ? 0.5 : 0.15;
    b.spin = (Math.random() - 0.5) * 20;

    matchState.possessionPlayerId = null;
    matchState.lastKickerId = player.id;
    matchState.lastKickType = action.type as any;
    matchState.lastKickPos = { x: b.x, y: b.y };

    return 'SUCCESS';
  }
}

/**
 * ExecuteTackle (Directive 4)
 * Active attempt to dislodge the ball from an opponent.
 */
export class ExecuteTackle implements BTNode {
  tick(player: Player, action: Action): BTStatus {
    const possessorId = matchState.possessionPlayerId;
    if (possessorId === null) return 'FAILURE';
    
    const possessor = matchState.players.find(p => p.id === possessorId);
    if (!possessor || possessor.team === player.team) return 'FAILURE';

    const d = Math.hypot((player.x - possessor.x) * PITCH_W, (player.y - possessor.y) * PITCH_H);
    if (d > 1.5) return 'RUNNING'; // Must get closer

    // Statistical Roll
    const tacklingAbility = player.attributes.tackling + (player.attributes.aggression / 2);
    const dribblingAbility = possessor.attributes.dribbling + (possessor.attributes.strength / 2);
    
    const successThreshold = (tacklingAbility / (dribblingAbility + tacklingAbility)) * 100;
    const roll = Math.random() * 100;

    if (roll < successThreshold) {
      // Success! Dislodge ball
      matchState.possessionPlayerId = null;
      matchState.ball.vx = (Math.random() - 0.5) * 5;
      matchState.ball.vy = (Math.random() - 0.5) * 5;
      return 'SUCCESS';
    } else {
      // Fail! Player is momentarily stunned or bypassed
      player.vx *= 0.2;
      player.vy *= 0.2;
      return 'FAILURE';
    }
  }
}

export class DribbleBall implements BTNode {
  tick(player: Player, action: Action): BTStatus {
    if (matchState.possessionPlayerId !== player.id || !action.target) return 'FAILURE';

    const dx = action.target.x - player.x;
    const dy = action.target.y - player.y;
    const d = Math.hypot(dx * PITCH_W, dy * PITCH_H) || 0.001;
    
    let accel = 0.001 + (player.attributes.acceleration / 15000);
    const slowingRadius = 5.0;
    if (d < slowingRadius) accel *= (d / slowingRadius);

    player.vx += (dx * PITCH_W / d) * accel;
    player.vy += (dy * PITCH_H / d) * accel;

    return 'RUNNING';
  }
}
