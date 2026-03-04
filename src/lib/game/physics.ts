import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';
import { resetMatch } from './rules';

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
    
    // After ~2 seconds, assign the ball to the taker and resume normal play
    if (matchState.setPiece.ticks > 120 && matchState.setPiece.takerId === null) {
      const team = matchState.setPiece.team;
      const players = matchState.players.filter(p => p.team === team);
      
      // Find a suitable taker (closest or specific role)
      let taker = players.reduce((closest, p) => {
        const d = Math.hypot((p.x - b.x) * PITCH_W, (p.y - b.y) * PITCH_H);
        const closestD = Math.hypot((closest.x - b.x) * PITCH_W, (closest.y - b.y) * PITCH_H);
        return d < closestD ? p : closest;
      }, players[0]);

      if (matchState.setPiece.type === 'goal-kick') {
        taker = players.find(p => p.role === 'GK') || taker;
      } else if (matchState.setPiece.type === 'kick-off') {
        taker = players.find(p => p.role === 'FWD') || taker;
      } else if (matchState.setPiece.type === 'corner') {
        const cornerTakers = players.filter(p => ['W', 'WM', 'IF', 'AM', 'FB', 'WB'].includes(p.tacticalRole));
        if (cornerTakers.length > 0) {
          taker = cornerTakers.reduce((closest, p) => {
            const d = Math.hypot((p.x - b.x) * PITCH_W, (p.y - b.y) * PITCH_H);
            const closestD = Math.hypot((closest.x - b.x) * PITCH_W, (closest.y - b.y) * PITCH_H);
            return d < closestD ? p : closest;
          }, cornerTakers[0]);
        }
      }

      matchState.possessionPlayerId = taker.id;
      matchState.setPiece.takerId = taker.id;
      matchState.setPiece = null; // Resume normal physics and AI
    }
    return; // Skip normal ball physics during setup
  }

  const possessor = matchState.players.find(p => p.id === matchState.possessionPlayerId);

  // 1. BALL CARRY LOGIC (Fixes Stationary Ball)
  if (possessor) {
    const forwardDir = possessor.team === 'home' ? 1 : -1;
    // Place ball slightly in front of player feet
    b.x = possessor.x + (forwardDir * 0.4) / PITCH_W;
    b.y = possessor.y;
    b.z = 0;
    // Match ball velocity to player for smooth transition on kick
    // Defensive check: ensure vx/vy exist
    b.vx = (possessor.vx || 0) * PITCH_W;
    b.vy = (possessor.vy || 0) * PITCH_H;
    b.vz = 0;
    b.spin *= 0.9;
    lastTouchTeam = possessor.team;
  } else {
    // 2. REGULAR BALL PHYSICS
    b.vz -= 0.4; 
    b.x += b.vx / PITCH_W;
    b.y += b.vy / PITCH_H;
    b.z += b.vz;

    // Air Drag
    b.vx *= 0.985;
    b.vy *= 0.985;
    b.vz *= 0.985;

    // Ground interaction
    if (b.z <= 0) {
      b.z = 0;
      b.vx *= 0.88; // Increased friction to slow passes
      b.vy *= 0.88;
      if (Math.abs(b.vz) > 0.1) {
        b.vz = -(b.vz * 0.6);
      } else {
        b.vz = 0;
      }
    }
    b.spin += (b.vx * 2.0);
  }

  // --- OUT OF BOUNDS ---
  if (b.y < 0 || b.y > 1) {
    triggerSetPiece('throw-in', b.x, b.y < 0 ? 0 : 1);
    return;
  }

  if (b.x < 0 || b.x > 1) {
    const isGoal = b.y > 0.38 && b.y < 0.62;
    // Account for side switching in scoring
    const homeGoal = b.x < 0; // Ball in left goal
    const scorer = (homeGoal !== matchState.sidesSwitched) ? 'away' : 'home';

    if (isGoal) {
      scoreGoal(scorer);
    } else {
      // Correctly identify which team is defending this end line
      const defendingSideTeam = (b.x < 0 !== matchState.sidesSwitched) ? 'home' : 'away';
      
      if (lastTouchTeam === defendingSideTeam) {
        triggerSetPiece('corner', b.x < 0 ? 0 : 1, b.y < 0.5 ? 0 : 1);
      } else {
        triggerSetPiece('goal-kick', b.x < 0 ? 0.05 : 0.95, 0.5);
      }
    }
    return;
  }
}

export function triggerSetPiece(type: string, x: number, y: number) {
  if (matchState.status !== 'PLAYING') return;
  
  const minute = matchState.timer;
  matchState.events.push({ minute, type: 'foul', desc: type.toUpperCase() });
  
  matchState.ball.x = x;
  matchState.ball.y = y;
  matchState.ball.z = 0;
  matchState.ball.vx = 0;
  matchState.ball.vy = 0;
  matchState.ball.vz = 0;
  matchState.possessionPlayerId = null;

  const defendingTeam = (x < 0.5) !== matchState.sidesSwitched ? 'home' : 'away';
  let team: 'home' | 'away' = lastTouchTeam === 'home' ? 'away' : 'home';
  
  if (type === 'goal-kick') team = defendingTeam;
  else if (type === 'corner') team = defendingTeam === 'home' ? 'away' : 'home';

  matchState.setPiece = {
    type: type as any,
    team,
    x, y,
    ticks: 0,
    takerId: null
  };
}

export function resolvePossession() {
  const b = matchState.ball;
  const possessorId = matchState.possessionPlayerId;
  const allPlayers = matchState.players;

  if (possessionCooldown > 0) {
    possessionCooldown--;
    return;
  }

  let closestPlayer: any = null;
  let minD = 9999;
  allPlayers.forEach(p => {
    const dx = (b.x - p.x) * PITCH_W;
    const dy = (b.y - p.y) * PITCH_H;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d < minD) { minD = d; closestPlayer = p; }
  });

  // Pickup distance: 2.5 meters (increased from 1.5 to make trapping easier)
  if (minD < 2.5 && b.z < 1.0) {
    if (possessorId !== closestPlayer.id) {
      const possessor = allPlayers.find(p => p.id === possessorId);
      
      // MILESTONE 7: ATTRIBUTE-DRIVEN STEAL ROLL
      let stealThreshold = 0;
      
      if (!possessor) {
        // Free ball: always pick up if close enough
        stealThreshold = 100;
      } else {
        // Defender (closestPlayer) vs Possessor
        const dAttr = closestPlayer.attributes;
        const pAttr = possessor.attributes;
        
        const defenderAbility = (dAttr.tackling * 0.6) + (dAttr.marking * 0.2) + (dAttr.anticipation * 0.2);
        const pStrength = (possessor.possessionStrength ?? 1.0);
        const possessorAbility = ((pAttr.composure * 0.5) + (pAttr.strength * 0.3) + (pAttr.dribbling * 0.2)) * pStrength;
        
        if (pStrength < 0.85) {
          stealThreshold = (defenderAbility / (possessorAbility + 0.1)) * 15;
        }
      }
      
      const roll = Math.random() * 100;
      if (roll <= stealThreshold) {
        if (matchState.lastKickType === 'PASS' && matchState.lastKickerId !== null) {
          const kicker = allPlayers.find(p => p.id === matchState.lastKickerId);
          if (kicker && kicker.team === closestPlayer.team) {
            const teamStats = kicker.team === 'home' ? matchState.stats.home : matchState.stats.away;
            teamStats.passesCompleted++;
            
            // Record successful PassEvent for analytics
            matchState.analytics.passes.push({
              fromId: kicker.id,
              toId: closestPlayer.id,
              startX: matchState.lastKickPos?.x ?? kicker.x,
              startY: matchState.lastKickPos?.y ?? kicker.y,
              endX: closestPlayer.x,
              endY: closestPlayer.y,
              minute: Math.floor(matchState.timer / 60),
              team: kicker.team
            });
          }
        }

        matchState.possessionPlayerId = closestPlayer.id;
        lastTouchTeam = closestPlayer.team;
        possessionCooldown = 40; 
        closestPlayer.possessionStrength = 1.0; 
        matchState.lastKickerId = null; 
        matchState.lastKickType = null;
        matchState.lastKickPos = null;
      }
    }
  }
}

function scoreGoal(team: 'home' | 'away') {
  if (matchState.status !== 'PLAYING') return;
  
  const scorerStats = team === 'home' ? matchState.stats.home : matchState.stats.away;
  
  if (team === 'home') matchState.homeScore += 1;
  else matchState.awayScore += 1;
  
  scorerStats.goals += 1;
  
  // Update last shot in analytics to GOAL
  const lastShot = matchState.analytics.shots[matchState.analytics.shots.length - 1];
  if (lastShot && lastShot.team === team) {
    lastShot.result = 'GOAL';
  }
  
  if (matchState.lastKickType !== 'SHOOT') {
    scorerStats.shots += 1;
  }
  
  const minute = matchState.timer;
  matchState.events.push({ minute, type: 'goal', desc: `GOAL! ${team.toUpperCase()} scores!` });

  const kickingTeam = team === 'home' ? 'away' : 'home';
  resetMatch({ status: 'PLAYING', kickingTeam });
}

export function updatePlayerPhysics() {
  matchState.players.forEach(p => {
    // 1. Stamina (Milestone 9)
    const speed = Math.hypot(p.vx * PITCH_W, p.vy * PITCH_H);
    
    // Tactical Intensity Modifier
    const tacticalStyle = p.team === 'home' ? matchState.homeTacticalStyle : matchState.awayTacticalStyle;
    let intensityMod = 1.0;
    if (tacticalStyle === 'Gegenpress') intensityMod = 1.4; 
    else if (tacticalStyle === 'Park the Bus') intensityMod = 0.7; 
    else if (tacticalStyle === 'Fluid Counter') intensityMod = 1.1; 

    const staminaCost = ((speed * 0.005) + (p.aiState === 'PRESS' ? 0.015 : 0)) * intensityMod;
    
    const workRatePenalty = 1 + (p.attributes.workRate / 100);
    const staminaEfficiency = 1 - (p.attributes.stamina / 100); 
    
    p.currentStamina = Math.max(0, p.currentStamina - (staminaCost * staminaEfficiency * workRatePenalty));

    // 2. POSSESSION STRENGTH (Milestone 7)
    const isPossessor = matchState.possessionPlayerId === p.id;
    const press = p.pressure || 0;
    if (isPossessor) {
      const strengthMod = 1 - (p.attributes.strength / 100);
      const decay = ((press * 0.02) + 0.002) * strengthMod;
      p.possessionStrength = Math.max(0, (p.possessionStrength || 1.0) - decay);
    } else {
      const recovery = 0.01;
      p.possessionStrength = Math.min(1.0, (p.possessionStrength || 1.0) + recovery);
    }

    // 3. Physical Limits (Speed Cap based on Fatigue)
    const fatigueCap = 0.6 + (p.currentStamina / 100) * 0.4;
    const maxV = (0.0015 + (p.attributes.pace / 10000)) * fatigueCap; 

    const currV = Math.hypot(p.vx, p.vy);
    if (currV > maxV && currV > 0) {
      p.vx = (p.vx / currV) * maxV;
      p.vy = (p.vy / currV) * maxV;
    }

    // 4. Move
    p.x += p.vx;
    p.y += p.vy;

    // 5. Damping
    const friction = 0.9; 

    p.vx *= friction;
    p.vy *= friction;
    
    // Bounds
    p.x = Math.max(0, Math.min(1, p.x));
    p.y = Math.max(0, Math.min(1, p.y));
  });
}
