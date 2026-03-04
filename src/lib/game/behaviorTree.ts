import type { Player } from './types';
import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';
import type { Action } from './utilityAI';
import { resolveActionRoll, applyRollToVector } from './resolution';
import { calculateShotXG } from './recorder';

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
export class MoveToTarget implements BTNode {
  tick(player: Player, action: Action): BTStatus {
    const isPossessor = matchState.possessionPlayerId === player.id;
    
    if (isPossessor && (action.type === 'PASS' || action.type === 'SHOOT' || action.type === 'CLEAR')) {
      return 'SUCCESS';
    }

    let targetX = player.x;
    let targetY = player.y;

    if (action.type === 'PRESS' || action.type === 'DRIBBLE' || action.type === 'PASS' || action.type === 'SHOOT' || action.type === 'CLEAR') {
      targetX = matchState.ball.x;
      targetY = matchState.ball.y;
    } else if (action.type === 'JOCKEY') {
      targetX = player.anchorX;
      targetY = player.anchorY;
    } else if (action.type === 'SUPPORT' || action.type === 'OVERLAP') {
      targetX = player.anchorX;
      targetY = player.anchorY;
    } else if (action.target) {
      targetX = action.target.x;
      targetY = action.target.y;
    }

    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const d = Math.hypot(dx * PITCH_W, dy * PITCH_H) || 0.001;

    if (d < 0.2) {
      player.vx *= 0.5;
      player.vy *= 0.5;
      return 'SUCCESS';
    }

    // NEW: Factor in acceleration attribute
    let accel = 0.0015 + (player.attributes.acceleration / 10000); 
    const slowingRadius = 4.0; 
    if (d < slowingRadius) {
      accel *= (d / slowingRadius);
    }

    const dirX = (dx * PITCH_W) / d;
    const dirY = (dy * PITCH_H) / d;
    
    player.vx += dirX * accel;
    player.vy += dirY * accel;

    return 'RUNNING';
  }
}

export class ExecuteKick implements BTNode {
  constructor(private basePower: number) {}

  tick(player: Player, action: Action): BTStatus {
    if (action.type !== 'PASS' && action.type !== 'SHOOT' && action.type !== 'CLEAR') return 'FAILURE';
    if (matchState.possessionPlayerId !== player.id) return 'FAILURE';

    const b = matchState.ball;
    let targetX = 0.5;
    let targetY = 0.5;
    let power = this.basePower;

    if (action.type === 'PASS' && action.target) {
      targetX = action.target.anchorX;
      targetY = action.target.anchorY;
      
      const distToTarget = Math.hypot((targetX - b.x) * PITCH_W, (targetY - b.y) * PITCH_H);
      // Reduce the base power and cap it so passes are more controlled.
      power = Math.max(0.8, Math.min(3.0, (distToTarget / 20) + 0.5));
    } else if (action.type === 'SHOOT') {
      // Correct direction depends on sidesSwitched
      const homeShootsRight = !matchState.sidesSwitched;
      const opponentGoalX = (player.team === 'home' === homeShootsRight) ? 1.0 : 0.0;
      
      targetX = opponentGoalX;
      targetY = 0.5 + (Math.random() - 0.5) * 0.1;
      power = 3.8; 
    } else if (action.type === 'CLEAR') {
      const homeShootsRight = !matchState.sidesSwitched;
      const opponentGoalX = (player.team === 'home' === homeShootsRight) ? 1.0 : 0.0;
      targetX = opponentGoalX;
      targetY = Math.random();
      power = 4.5; 
    }

    const dx = (targetX - b.x) * PITCH_W;
    const dy = (targetY - b.y) * PITCH_H;
    const d = Math.sqrt(dx*dx + dy*dy) || 0.001;

    const rollType = action.type as 'PASS' | 'SHOOT' | 'CLEAR';
    const roll = resolveActionRoll(player, rollType);
    
    const vector = applyRollToVector(
      (dx / d) * power, 
      (dy / d) * power, 
      roll
    );

    if (!roll.success) {
      console.log(`[Resolution] Player ${player.id} MISPLACED ${action.type}! Quality: ${roll.quality.toFixed(2)}`);
    }

    // Telemetry
    const minute = Math.floor(matchState.timer / 60);
    matchState.lastKickerId = player.id;
    matchState.lastKickType = action.type as any;
    matchState.lastKickPos = { x: b.x, y: b.y };
    const teamStats = player.team === 'home' ? matchState.stats.home : matchState.stats.away;
    
    if (action.type === 'PASS') {
      teamStats.passesAttempted++;
    }
    
    if (action.type === 'SHOOT') {
      teamStats.shots++;
      
      // Calculate xG
      const homeShootsRight = !matchState.sidesSwitched;
      const targetGoalX = (player.team === 'home' === homeShootsRight) ? 1.0 : 0.0;
      const distToGoal = Math.hypot((targetGoalX - b.x) * PITCH_W, (0.5 - b.y) * PITCH_H);
      const angleToGoal = Math.atan2((0.5 - b.y) * PITCH_H, (targetGoalX - b.x) * PITCH_W);
      const xg = calculateShotXG(player, distToGoal, angleToGoal);
      
      matchState.analytics.shots.push({
        playerId: player.id,
        x: b.x,
        y: b.y,
        xg,
        result: 'MISS', // Default, will be updated by goal/save logic
        minute,
        team: player.team
      });
    }

    b.vx = vector.vx;
    b.vy = vector.vy;
    b.vz = action.type === 'CLEAR' ? 0.5 : 0.15;
    b.spin = (Math.random() - 0.5) * 20;

    matchState.possessionPlayerId = null;
    return 'SUCCESS';
  }
}

export class DribbleBall implements BTNode {
  tick(player: Player, action: Action): BTStatus {
    if (action.type !== 'DRIBBLE') return 'FAILURE';
    if (matchState.possessionPlayerId !== player.id) return 'FAILURE';

    const homeShootsRight = !matchState.sidesSwitched;
    const opponentGoalX = (player.team === 'home' === homeShootsRight) ? 1.0 : 0.0;
    
    const dxP = opponentGoalX - player.x;
    const dyP = 0.5 - player.y;
    const dP = Math.hypot(dxP * PITCH_W, dyP * PITCH_H) || 0.001;
    
    // NEW: Factor in acceleration
    let accel = 0.001 + (player.attributes.acceleration / 15000);
    const slowingRadius = 5.0;
    if (dP < slowingRadius) accel *= (dP / slowingRadius);

    const dirPX = (dxP * PITCH_W) / dP;
    const dirPY = (dyP * PITCH_H) / dP;

    player.vx += dirPX * accel;
    player.vy += dirPY * accel;

    return 'RUNNING';
  }
}
