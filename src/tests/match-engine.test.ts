import { describe, it, expect, beforeEach } from 'vitest';
import { matchState } from '../lib/game/matchState.svelte';
import { resetMatch } from '../lib/game/rules';
import { tick } from '../lib/game/engine.svelte';
import { updatePlayerPhysics, triggerSetPiece } from '../lib/game/physics';
import { calculateEffectivePressure, updateTacticalAnchors } from '../lib/game/ai';
import { evaluatePlayerActions } from '../lib/game/utilityAI';
import { Match, MatchStatus } from '../lib/engine/Match.svelte.ts';
import { PLAYER_STRIDE, PLAYER_OFFSET_STAMINA } from '../lib/engine/core/constants';

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

  it('match engine should leave status KICKOFF until after ~0.1s then switch to PLAYING', () => {
    const m = new Match();
    const positions = new Array(22).fill({ x:0,y:0 });
    m.setup(positions);
    expect(m.status).toBe(MatchStatus.KICKOFF);
    m.tick(0.05);
    expect(m.status).toBe(MatchStatus.KICKOFF);
    // another small increment pushes past the threshold used in the check
    m.tick(0.06);
    expect(m.status).toBe(MatchStatus.PLAYING);
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

  describe('bench and substitutions (Match class)', () => {
    it('should accept bench stats and perform a manual sub', () => {
      const m = new Match();
      const positions = new Array(22).fill({ x:0, y:0 });
      const stats = new Array(22).fill({ passing:50, finishing:50, tackling:50, dribbling:50, vision:50, composure:50 });
      const roles = new Array(22).fill('');
      m.setup(positions, stats, roles);
      // attach bench players
      m.benchStats = [{ passing: 70 }, { passing: 80 }];
      m.benchRoles = ['MID', 'ST'];
      expect(m.benchStats.length).toBe(2);
      // manually substitute first bench into home team first starter
      m.makeSub(0, 0, 0);
      expect(m.playerStats[0]).toEqual({ passing: 70 });
      expect(m.benchStats.length).toBe(1);
      expect(m.subsUsed[0]).toBe(0); // manual sub doesn't increment
    });

    it('should let CPU automatically sub tired players after the 60th minute', () => {
      const m = new Match();
      const positions = new Array(22).fill({ x:0, y:0 });
      const stats = new Array(22).fill({ passing:50, finishing:50, tackling:50, dribbling:50, vision:50, composure:50 });
      const roles = new Array(22).fill('');
      // make player 0 non-GK so eligible
      roles[0] = 'DEF';
      m.setup(positions, stats, roles);
      m.benchStats = [{ passing: 99 }];
      m.benchRoles = ['DEF'];
      // drop stamina of first home player below threshold (0..1 scale)
      m.memory.playerBuffer[0 * PLAYER_STRIDE + PLAYER_OFFSET_STAMINA] = 0.1;

      // simulate second half so we don't hit half-time early
      m.currentHalf = 2;
      // advance time to 61 minutes
      m.currentTime = 61 * 60;
      // call CPU subs directly (tick normally would also invoke it)
      (m as any).lastSubCheckMinute = -1;
      // debug values before
      const minute = Math.floor(m.currentTime / 60);
      console.log('minute', minute, 'lastSubCheck', (m as any).lastSubCheckMinute);
      const team = 0;
      const startIdx = team === 0 ? 0 : 11;
      const endIdx = team === 0 ? 11 : 22;
      let tiredIdx = -1;
      let minStam = 999;
      for (let i = startIdx; i < endIdx; i++) {
        const stam = m.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_STAMINA];
        if (stam < minStam) { minStam = stam; tiredIdx = i; }
      }
      console.log('tiredIdx', tiredIdx, 'minStam', minStam, 'benchStats', m.benchStats.length, 'role', m.playerRoles[tiredIdx]);
      const benchIdx = m.benchRoles.findIndex(r => r === m.playerRoles[tiredIdx]);
      console.log('benchIdx', benchIdx);
      
      (m as any).handleCPUSubs();
      
      expect(m.subsUsed[0]).toBe(1);
      expect(m.playerStats[0].passing).toBe(99);
      expect(m.benchStats.length).toBe(0);
      
      // also ensure tick wrapper doesn't break if we call it afterward
      m.tick(0.1);
      expect(m.subsUsed[0]).toBe(1);    });
  });
});
