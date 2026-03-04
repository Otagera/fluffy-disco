import { describe, it, expect, beforeEach } from 'vitest';
import { matchState } from '../lib/game/matchState.svelte';
import { resetMatch } from '../lib/game/rules';
import { tick } from '../lib/game/engine.svelte';
import { updatePlayerPhysics, triggerSetPiece } from '../lib/game/physics';
import { calculateEffectivePressure, updateTacticalAnchors } from '../lib/game/ai';
import { evaluatePlayerActions } from '../lib/game/utilityAI';

describe('Match Engine Integration', () => {
  beforeEach(() => {
    // Fresh state for every test
    resetMatch({ status: 'LOBBY', resetStats: true });
  });

  it('should initialize a kick-off set piece on match start', () => {
    resetMatch({ status: 'PLAYING', kickingTeam: 'home' });
    
    expect(matchState.status).toBe('PLAYING');
    expect(matchState.setPiece).not.toBeNull();
    expect(matchState.setPiece?.type).toBe('kick-off');
    expect(matchState.setPiece?.team).toBe('home');
    expect(matchState.possessionPlayerId).toBeNull();
  });

  it('should assign possession to a taker after exactly 121 ticks', () => {
    resetMatch({ status: 'PLAYING', kickingTeam: 'home' });
    
    // Simulate exactly 121 ticks
    for (let i = 0; i < 121; i++) {
      tick();
    }
    
    // After 121 ticks, the setPiece should be cleared and possession assigned
    expect(matchState.setPiece).toBeNull();
    expect(matchState.possessionPlayerId).not.toBeNull();
    
    const possessor = matchState.players.find(p => p.id === matchState.possessionPlayerId);
    expect(possessor?.team).toBe('home');
  });

  it('should detect a goal and credit the correct team', () => {
    resetMatch({ status: 'PLAYING' });
    matchState.setPiece = null; // Important: Clear setPiece or physics returns early
    
    // Manually place ball in away goal (right side, x > 1)
    matchState.ball.x = 1.05;
    matchState.ball.y = 0.5;
    matchState.ball.z = 0;
    
    tick(); // This should trigger scoreGoal('home')
    
    expect(matchState.homeScore).toBe(1);
    expect(matchState.events[0].type).toBe('goal');
  });

  it('should correctly assign goal kicks after side switch (Halftime)', () => {
    // 1. Trigger halftime side switch
    resetMatch({ switchSides: true, status: 'PLAYING' }); // sidesSwitched = true
    matchState.setPiece = null;
    
    // 2. Ball goes out at the LEFT end (x < 0)
    // Since sides are switched, the LEFT goal (0.0) is now the AWAY goal.
    matchState.ball.x = -0.05;
    matchState.ball.y = 0.1; // Not a goal
    
    tick();
    
    expect(matchState.setPiece?.type).toBe('goal-kick');
    expect(matchState.setPiece?.team).toBe('away');
  });

  it('should handle possession strength decay under pressure', () => {
    resetMatch({ status: 'PLAYING' });
    matchState.setPiece = null;
    
    // Assign ball to a player
    const p = matchState.players[0];
    matchState.possessionPlayerId = p.id;
    p.possessionStrength = 1.0;
    
    // Position opponents close to create pressure
    const opponents = matchState.players.filter(pl => pl.team === 'away').slice(0, 3);
    opponents.forEach(o => {
      o.x = p.x + 0.01;
      o.y = p.y;
    });
    
    // Manually run pressure calculation and physics to avoid AI kicking ball away
    calculateEffectivePressure(p);
    expect(p.pressure).toBeGreaterThan(0);
    
    updatePlayerPhysics();
    
    // Expect strength to have decayed from 1.0
    expect(p.possessionStrength).toBeLessThan(1.0);
  });

  it('should coordinate the defensive line as a block (Offside Trap)', () => {
    resetMatch({ status: 'PLAYING' });
    matchState.setPiece = null;
    
    // Move the ball deep into the home half
    matchState.ball.x = 0.2;
    matchState.ball.y = 0.5;
    
    // Assign ball to away team (home team is defending)
    const awayPlayer = matchState.players.find(pl => pl.team === 'away')!;
    matchState.possessionPlayerId = awayPlayer.id;
    awayPlayer.x = 0.2;
    
    // Run AI to set anchors
    updateTacticalAnchors();
    
    const homeDefenders = matchState.players.filter(p => p.team === 'home' && p.role === 'DEF');
    const leader = homeDefenders.sort((a, b) => (b.attributes.positioning + b.attributes.decisions) - (a.attributes.positioning + a.attributes.decisions))[0];
    
    // All defenders should have very similar anchorX (synchronized line)
    homeDefenders.forEach(d => {
      // Allow for small variation due to concentration failure logic if it triggers
      expect(Math.abs(d.anchorX - leader.anchorX)).toBeLessThan(0.05);
    });
  });

  it('should adjust team width based on possession', () => {
    resetMatch({ status: 'PLAYING' });
    matchState.setPiece = null;
    
    // 1. Team IN possession (Home)
    const homePlayer = matchState.players.find(p => p.team === 'home')!;
    matchState.possessionPlayerId = homePlayer.id;
    
    updateTacticalAnchors();
    
    const widePlayer = matchState.players.find(p => p.team === 'home' && p.role === 'MID' && Math.abs(p.y - 0.5) > 0.2)!;
    const attackingAnchorY = widePlayer.anchorY;

    // 2. Team OUT of possession (Home loses ball)
    matchState.possessionPlayerId = matchState.players.find(p => p.team === 'away')!.id;
    updateTacticalAnchors();
    
    const defendingAnchorY = widePlayer.anchorY;
    
    // When defending, player should be closer to the center (0.5)
    const distAttacking = Math.abs(attackingAnchorY - 0.5);
    const distDefending = Math.abs(defendingAnchorY - 0.5);
    
    expect(distDefending).toBeLessThan(distAttacking);
  });

  it('should prioritize wide players for corner kicks', () => {
    resetMatch({ status: 'PLAYING' });
    
    // Trigger a corner for home team at top-right
    triggerSetPiece('corner', 1.0, 0.0);
    
    expect(matchState.setPiece?.type).toBe('corner');
    expect(matchState.setPiece?.team).toBe('home');
    
    // Advance 121 ticks to assign taker
    for (let i = 0; i < 121; i++) {
      tick();
    }
    
    const taker = matchState.players.find(p => p.id === matchState.possessionPlayerId)!;
    
    // Should be a wide role (W, WM, IF, AM, FB, etc.)
    const wideRoles = ['W', 'WM', 'IF', 'AM', 'FB', 'WB'];
    expect(wideRoles).toContain(taker.tacticalRole);
  });

  it('should apply tactical role multipliers to utility scores', () => {
    resetMatch({ status: 'PLAYING' });
    matchState.setPiece = null;
    
    const bwm = matchState.players.find(p => p.team === 'home' && p.role === 'MID')!;
    const dlp = matchState.players.find(p => p.team === 'home' && p.id !== bwm.id && p.role === 'MID')!;
    
    bwm.tacticalRole = 'BWM';
    dlp.tacticalRole = 'DLP';
    
    // Position ball near them
    matchState.ball.x = 0.5;
    matchState.ball.y = 0.5;
    bwm.x = 0.51; bwm.y = 0.51;
    dlp.x = 0.52; dlp.y = 0.52;
    
    // Away team has ball
    matchState.possessionPlayerId = matchState.players.find(p => p.team === 'away')!.id;
    
    const bwmActions = evaluatePlayerActions(bwm);
    const dlpActions = evaluatePlayerActions(dlp);
    
    const bwmPress = bwmActions.find(a => a.type === 'PRESS')!.score;
    const dlpPress = dlpActions.find(a => a.type === 'PRESS')!.score;
    
    // BWM should have higher PRESS utility than DLP due to role multipliers
    expect(bwmPress).toBeGreaterThan(dlpPress);
  });

  it('should inject decision noise based on the Decisions attribute', () => {
    resetMatch({ status: 'PLAYING' });
    matchState.setPiece = null;
    
    const player = matchState.players[0];
    matchState.possessionPlayerId = player.id;
    
    // Scenario: High Decisions (Expect stable scores)
    player.attributes.decisions = 20;
    const highDecScores = Array.from({length: 10}, () => evaluatePlayerActions(player)[0].score);
    const highDecRange = Math.max(...highDecScores) - Math.min(...highDecScores);
    
    // Scenario: Low Decisions (Expect high variance/noise)
    player.attributes.decisions = 1;
    const lowDecScores = Array.from({length: 10}, () => evaluatePlayerActions(player)[0].score);
    const lowDecRange = Math.max(...lowDecScores) - Math.min(...lowDecScores);
    
    expect(lowDecRange).toBeGreaterThan(highDecRange);
  });
});
