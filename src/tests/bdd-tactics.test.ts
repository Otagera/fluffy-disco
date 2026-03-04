import { describe, it, expect, beforeEach } from 'vitest';
import { matchState } from '../lib/game/matchState.svelte';
import { resetMatch } from '../lib/game/rules';
import { updateAI, updateTacticalAnchors } from '../lib/game/ai';
import { evaluatePlayerActions } from '../lib/game/utilityAI';
import { PITCH_W, PITCH_H } from '../lib/game/constants';

describe('Tactical Behavior (BDD)', () => {
  
  beforeEach(() => {
    resetMatch({ status: 'PLAYING', resetStats: true });
    matchState.setPiece = null;
  });

  it('Given a winger has the ball, then the supporting fullback should initiate an overlap', () => {
    const homePlayers = matchState.players.filter(p => p.team === 'home');
    
    // Manually assign roles for deterministic test
    const winger = homePlayers[10]; 
    const fullback = homePlayers[1]; 
    
    winger.tacticalRole = 'W';
    winger.role = 'FWD';
    winger.homeY = 10 * 0.1 * PITCH_H; 
    
    fullback.tacticalRole = 'FB';
    fullback.role = 'DEF';
    fullback.homeY = 15 * 0.1 * PITCH_H;
    fullback.attributes.pace = 20; 
    fullback.attributes.decisions = 20; 
    
    matchState.possessionPlayerId = winger.id;
    winger.x = 0.8; 
    winger.y = winger.homeY / PITCH_H;
    fullback.x = 0.7; 
    
    matchState.ball.x = winger.x;
    matchState.ball.y = winger.y;

    // Run two cycles so anchor logic sees the updated aiState
    updateAI();
    updateAI();
    
    // Expectation: Fullback should be in OVERLAP state
    expect(fullback.aiState).toBe('OVERLAP');
    
    // Expectation: The anchor should be further forward than the winger
    expect(fullback.anchorX).toBeGreaterThan(winger.x);
  });

  it('Given the team loses possession, then the players should pinch inward (Dynamic Width)', () => {
    const homePlayers = matchState.players.filter(p => p.team === 'home');
    const widePlayer = homePlayers[1]; 
    const centerLine = 0.5;

    // Scenario A: Team HAS possession (Wide width)
    matchState.possessionPlayerId = homePlayers[0].id;
    updateTacticalAnchors();
    const attackingAnchorY = widePlayer.anchorY;
    const attackingDist = Math.abs(attackingAnchorY - centerLine);

    // Scenario B: Team LOSES possession (Compact width)
    matchState.possessionPlayerId = matchState.players.find(p => p.team === 'away')!.id;
    updateTacticalAnchors();
    const defendingAnchorY = widePlayer.anchorY;
    const defendingDist = Math.abs(defendingAnchorY - centerLine);

    expect(defendingDist).toBeLessThan(attackingDist);
  });

  it('Given a striker is deep in the box, then the midfielder should look for a through-ball (PASS utility)', () => {
    const homePlayers = matchState.players.filter(p => p.team === 'home');
    const dlp = homePlayers[5]; 
    const striker = homePlayers[10];
    
    dlp.tacticalRole = 'DLP';
    dlp.attributes.vision = 20;
    dlp.attributes.decisions = 20;
    striker.role = 'FWD';
    
    matchState.possessionPlayerId = dlp.id;
    dlp.x = 0.6; 
    dlp.y = 0.5;
    striker.x = 0.85; 
    striker.y = 0.5;
    
    matchState.players.filter(p => p.team === 'away').forEach(p => {
      p.x = 0.1;
    });

    const actions = evaluatePlayerActions(dlp);
    const passAction = actions.find(a => a.type === 'PASS' && a.target?.id === striker.id);

    expect(passAction).toBeDefined();
    expect(passAction!.score).toBeGreaterThan(0.5);
  });

});
