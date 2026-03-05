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
    
    const winger = homePlayers[10]; 
    const fullback = homePlayers[1]; 
    
    winger.tacticalRole = 'W';
    winger.role = 'FWD';
    winger.x = 0.8; 
    winger.y = 0.1;
    
    fullback.tacticalRole = 'FB';
    fullback.role = 'DEF';
    fullback.x = 0.7; 
    fullback.y = 0.15; 
    fullback.homeX = 0.7 * PITCH_W; // Advanced base for test
    fullback.homeY = 0.15 * PITCH_H;
    
    fullback.attributes.pace = 20; 
    fullback.attributes.acceleration = 20;
    fullback.attributes.workRate = 20;
    fullback.attributes.decisions = 20; 
    fullback.thinkCooldown = 0;
    
    matchState.possessionPlayerId = winger.id;
    matchState.ball.x = winger.x;
    matchState.ball.y = winger.y;

    updateAI(16.67);
    updateAI(16.67);
    
    expect(fullback.aiState).toBe('OVERLAP');
    expect(fullback.anchorX).toBeGreaterThan(winger.x);
  });

  it('Given the team loses possession, then the players should pinch inward (Dynamic Width)', () => {
    const homePlayers = matchState.players.filter(p => p.team === 'home');
    const widePlayer = homePlayers[1]; 
    const centerLine = 0.5;

    matchState.possessionPlayerId = homePlayers[0].id;
    updateTacticalAnchors();
    const attackingAnchorY = widePlayer.anchorY;
    const attackingDist = Math.abs(attackingAnchorY - centerLine);

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
    striker.anchorX = 0.85; 
    striker.anchorY = 0.5;
    
    matchState.players.filter(p => p.team === 'away').forEach(p => {
      p.x = 0.1;
    });

    const actions = evaluatePlayerActions(dlp);
    const passAction = actions.find(a => a.type === 'PASS' && a.targetPlayerId === striker.id);

    expect(passAction).toBeDefined();
    expect(passAction!.score).toBeGreaterThan(0.5);
  });

});
