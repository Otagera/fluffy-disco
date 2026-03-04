import { describe, it } from 'vitest';
import { matchState } from '../lib/game/matchState.svelte';
import { resetMatch } from '../lib/game/rules';
import { tick } from '../lib/game/engine.svelte';

describe('Headless Batch Simulator', () => {
  
  function runSingleMatch() {
    resetMatch({ status: 'PLAYING', resetStats: true });
    matchState.replay.isRecording = false; // Disable recording for speed
    
    // 90 minutes = 5400 ticks (at 60fps)
    const TOTAL_TICKS = 5400;
    
    for (let i = 0; i < TOTAL_TICKS; i++) {
      tick();
      // Simple timer increment
      matchState.timer = Math.floor(i / 60); 
    }
    
    return {
      home: { ...matchState.stats.home },
      away: { ...matchState.stats.away }
    };
  }

  it('runs 100 matches and aggregates statistics', () => {
    const NUM_MATCHES = 100;
    const results = [];
    
    console.log(`\n🚀 Starting Large-Scale Batch Simulation: ${NUM_MATCHES} matches...\n`);
    
    // Suppress logs during simulation for speed
    const originalLog = console.log;
    console.log = () => {};

    const startTime = Date.now();
    
    for (let m = 0; m < NUM_MATCHES; m++) {
      results.push(runSingleMatch());
    }
    
    const endTime = Date.now();
    console.log = originalLog;

    // Aggregation
    const totals = {
      home: { goals: 0, shots: 0, passesA: 0, passesC: 0 },
      away: { goals: 0, shots: 0, passesA: 0, passesC: 0 }
    };
    
    results.forEach(res => {
      totals.home.goals += res.home.goals;
      totals.home.shots += res.home.shots;
      totals.home.passesA += res.home.passesAttempted;
      totals.home.passesC += res.home.passesCompleted;
      
      totals.away.goals += res.away.goals;
      totals.away.shots += res.away.shots;
      totals.away.passesA += res.away.passesAttempted;
      totals.away.passesC += res.away.passesCompleted;
    });
    
    const avg = (val: number) => (val / NUM_MATCHES).toFixed(2);
    const pct = (c: number, a: number) => a === 0 ? '0%' : `${((c / a) * 100).toFixed(1)}%`;

    console.table([
      {
        Team: 'HOME (Castle)',
        'Avg Goals': avg(totals.home.goals),
        'Avg Shots': avg(totals.home.shots),
        'Pass %': pct(totals.home.passesC, totals.home.passesA),
        'Total Games': NUM_MATCHES
      },
      {
        Team: 'AWAY (Lions)',
        'Avg Goals': avg(totals.away.goals),
        'Avg Shots': avg(totals.away.shots),
        'Pass %': pct(totals.away.passesC, totals.away.passesA),
        'Total Games': NUM_MATCHES
      }
    ]);
    
    console.log(`\n✅ Large-Scale Simulation Complete in ${((endTime - startTime) / 1000).toFixed(2)}s\n`);
  }, 1200000); // 20 minute timeout

});
