import { describe, it, expect, beforeEach } from 'vitest';
import { matchState } from '../lib/game/matchState.svelte';
import { resetMatch } from '../lib/game/rules';
import { tick } from '../lib/game/engine.svelte';
import { updatePlayerPhysics, triggerSetPiece } from '../lib/game/physics';
import { calculateEffectivePressure, updateTacticalAnchors } from '../lib/game/ai';
import { evaluatePlayerActions } from '../lib/game/utilityAI';

describe('Match Engine Integration', () => {
  beforeEach(() => {
    resetMatch({ status: 'LOBBY', resetStats: true });
  });

  it('should initialize a kick-off set piece on match start', () => {
    resetMatch({ status: 'PLAYING', kickingTeam: 'home' });
    expect(matchState.status).toBe('PLAYING');
    expect((matchState.setPiece as any)?.type).toBe('kick-off');
  });

  it('should assign possession to a taker after exactly 121 ticks', () => {
    resetMatch({ status: 'PLAYING', kickingTeam: 'home' });
    for (let i = 0; i < 121; i++) {
      tick(16.67);
    }
    expect(matchState.setPiece).toBeNull();
    expect(matchState.possessionPlayerId).not.toBeNull();
  });

  it('should detect a goal and credit the correct team', () => {
    resetMatch({ status: 'PLAYING' });
    matchState.setPiece = null;
    matchState.ball.x = 1.05;
    matchState.ball.y = 0.5;
    tick(16.67);
    expect(matchState.homeScore).toBe(1);
  });

  it('should correctly assign goal kicks after side switch (Halftime)', () => {
    resetMatch({ switchSides: true, status: 'PLAYING' }); 
    matchState.setPiece = null;
    matchState.ball.x = -0.05;
    matchState.ball.y = 0.1; 
    tick(16.67);
    expect((matchState.setPiece as any)?.type).toBe('goal-kick');
    expect((matchState.setPiece as any)?.team).toBe('away');
  });

  it('should handle possession strength decay under pressure', () => {
    resetMatch({ status: 'PLAYING' });
    matchState.setPiece = null;
    const p = matchState.players[0];
    matchState.possessionPlayerId = p.id;
    p.possessionStrength = 1.0;
    const opponents = matchState.players.filter(pl => pl.team === 'away').slice(0, 3);
    opponents.forEach(o => { o.x = p.x + 0.01; o.y = p.y; });
    calculateEffectivePressure(p);
    updatePlayerPhysics();
    expect(p.possessionStrength).toBeLessThan(1.0);
  });

  it('should coordinate the defensive line as a block (Offside Trap)', () => {
    resetMatch({ status: 'PLAYING' });
    matchState.setPiece = null;
    matchState.ball.x = 0.2;
    const awayPlayer = matchState.players.find(pl => pl.team === 'away')!;
    matchState.possessionPlayerId = awayPlayer.id;
    updateTacticalAnchors();
    const homeDefenders = matchState.players.filter(p => p.team === 'home' && p.role === 'DEF');
    const leader = homeDefenders[0];
    homeDefenders.forEach(d => {
      expect(Math.abs(d.anchorX - leader.anchorX)).toBeLessThan(0.05);
    });
  });

  it('should adjust team width based on possession', () => {
    resetMatch({ status: 'PLAYING' });
    matchState.setPiece = null;
    const homePlayer = matchState.players.find(p => p.team === 'home')!;
    matchState.possessionPlayerId = homePlayer.id;
    updateTacticalAnchors();
    const widePlayer = matchState.players.find(p => p.team === 'home' && p.role === 'MID' && Math.abs(p.y - 0.5) > 0.2)!;
    const attackingAnchorY = widePlayer.anchorY;
    matchState.possessionPlayerId = matchState.players.find(p => p.team === 'away')!.id;
    updateTacticalAnchors();
    const defendingAnchorY = widePlayer.anchorY;
    expect(Math.abs(defendingAnchorY - 0.5)).toBeLessThan(Math.abs(attackingAnchorY - 0.5));
  });

  it('should prioritize wide players for corner kicks', () => {
    resetMatch({ status: 'PLAYING' });
    const winger = matchState.players.find(p => p.team === 'home' && p.role !== 'GK')!;
    winger.tacticalRole = 'W';
    winger.x = 0.9; winger.y = 0.1;
    triggerSetPiece('corner', 1.0, 0.0);
    for (let i = 0; i < 121; i++) {
      tick(16.67);
    }
    const taker = matchState.players.find(p => p.id === matchState.possessionPlayerId)!;
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
    matchState.possessionPlayerId = matchState.players.find(p => p.team === 'away')!.id;
    const bwmPress = evaluatePlayerActions(bwm).find(a => a.type === 'PRESS')!.score;
    const dlpPress = evaluatePlayerActions(dlp).find(a => a.type === 'PRESS')!.score;
    expect(bwmPress).toBeGreaterThan(dlpPress);
  });

  it('should inject decision noise based on the Decisions attribute', () => {
    resetMatch({ status: 'PLAYING' });
    matchState.setPiece = null;
    const player = matchState.players[0];
    matchState.possessionPlayerId = player.id;
    player.attributes.decisions = 20;
    const highDecScores = Array.from({length: 10}, () => evaluatePlayerActions(player)[0].score);
    const highDecRange = Math.max(...highDecScores) - Math.min(...highDecScores);
    player.attributes.decisions = 1;
    const lowDecScores = Array.from({length: 10}, () => evaluatePlayerActions(player)[0].score);
    const lowDecRange = Math.max(...lowDecScores) - Math.min(...lowDecScores);
    expect(lowDecRange).toBeGreaterThan(highDecRange);
  });
});
