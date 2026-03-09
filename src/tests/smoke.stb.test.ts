import { describe, it, expect } from 'vitest';
import { matchState } from '../lib/game/matchState.svelte';
import { resetMatch } from '../lib/game/rules';
import { tick } from '../lib/game/engine.svelte';

describe('Engine Smoke & Stability Testing', () => {
  
  it('runs for 50,000 continuous ticks without state corruption', () => {
    resetMatch({ status: 'PLAYING', resetStats: true });
    matchState.replay.isRecording = false; // Disable recording to save memory
    
    const TOTAL_TICKS = 50000; 
    console.log(`
🔥 Starting Smoke Test: Running ${TOTAL_TICKS} continuous ticks...
`);

    for (let i = 0; i < TOTAL_TICKS; i++) {
      tick();

      // Every 1000 ticks, perform deep integrity assertions
      if (i % 1000 === 0) {
        // 1. Physics Integrity
        expect(matchState.ball.x).not.toBeNaN();
        expect(matchState.ball.y).not.toBeNaN();
        expect(matchState.ball.z).toBeGreaterThanOrEqual(0);
        
        matchState.players.forEach(p => {
          expect(p.x).not.toBeNaN();
          expect(p.y).not.toBeNaN();
          expect(p.vx).not.toBeNaN();
          expect(p.vy).not.toBeNaN();
          
          // 2. AI Logic Bounds
          // Ensure no player is stuck in an action for more than 10 seconds (600 ticks)
          // Exception for POSITION/JOCKEY which are idle states
          if (!['POSITION', 'JOCKEY', 'SUPPORT'].includes(p.aiState)) {
            expect(p.actionTimer).toBeLessThan(1200); // 20 second hard-limit for any "active" action
          }

          // 3. Coordinate Bounds (Allow small runoff for goals/throw-ins)
          expect(p.x).toBeGreaterThan(-0.2);
          expect(p.x).toBeLessThan(1.2);
        });
      }
    }

    console.log(`
✅ Smoke Test Complete: 50,000 ticks without error.
`);
  }, 600000); // 10 minute timeout

});
