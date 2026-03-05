import { describe, it, expect } from 'vitest';
import { resolveActionRoll } from '../lib/game/resolution';
import type { Player } from '../lib/game/types';

describe('Monte Carlo Statistical Balancing', () => {
  
  function createMockPlayer(attributes: Partial<Player['attributes']>, pressure: number = 0): Player {
    return {
      id: Math.random(),
      team: 'home',
      x: 0, y: 0, homeX: 0, homeY: 0,
      number: 1,
      role: 'MID',
      tacticalRole: 'CM',
      vx: 0, vy: 0,
      aiState: 'POSITION',
      pressure: pressure,
      anchorX: 0, anchorY: 0,
      currentStamina: 100,
      possessionStrength: 1.0,
      currentAction: null,
      actionTimer: 0,
      thinkCooldown: 0,
      btState: {},
      attributes: {
        passing: 10, finishing: 10, tackling: 10, vision: 10, 
        composure: 10, decisions: 10, positioning: 10, pace: 10, 
        stamina: 10, concentration: 10, aggression: 10,
        dribbling: 10, crossing: 10, marking: 10, anticipation: 10,
        workRate: 10, acceleration: 10, strength: 10, reflexes: 10, handling: 10,
        ...attributes
      }
    };
  }

  function runMonteCarlo(
    iterations: number, 
    actionType: 'PASS' | 'SHOOT', 
    actor: Player, 
    opponent: Player | null
  ) {
    let successes = 0;
    
    for (let i = 0; i < iterations; i++) {
      const result = resolveActionRoll(actor, actionType, 15); // Use distance 15 as a neutral baseline
      if (result.success) successes++;
    }
    
    return successes / iterations;
  }

  it('Elite Passer vs Average Defender (Moderate Pressure) converges to 80-90% success', () => {
    const elitePasser = createMockPlayer({ passing: 20, vision: 20, composure: 15 }, 0.5);
    const avgDefender = createMockPlayer({ positioning: 10 });
    
    const successRate = runMonteCarlo(10000, 'PASS', elitePasser, avgDefender);
    
    console.log(`Elite Passer Success Rate: ${(successRate * 100).toFixed(2)}%`);
    expect(successRate).toBeGreaterThanOrEqual(0.75);
    expect(successRate).toBeLessThanOrEqual(0.95);
  });

  it('Average Passer vs Elite Defender (High Pressure) crashes to 10-30% success', () => {
    const avgPasser = createMockPlayer({ passing: 10, vision: 10, composure: 10 }, 0.9);
    const eliteDefender = createMockPlayer({ positioning: 20 });
    
    const successRate = runMonteCarlo(10000, 'PASS', avgPasser, eliteDefender);
    
    console.log(`Average Passer (Under Pressure) Success Rate: ${(successRate * 100).toFixed(2)}%`);
    expect(successRate).toBeGreaterThanOrEqual(0.05);
    expect(successRate).toBeLessThanOrEqual(0.40);
  });

  it('Composure stat successfully mitigates pressure penalties', () => {
    const panickedPasser = createMockPlayer({ passing: 12, vision: 12, composure: 1 }, 0.8);
    const panickedRate = runMonteCarlo(10000, 'PASS', panickedPasser, null);

    const calmPasser = createMockPlayer({ passing: 12, vision: 12, composure: 20 }, 0.8);
    const calmRate = runMonteCarlo(10000, 'PASS', calmPasser, null);

    console.log(`Panicked Rate: ${(panickedRate * 100).toFixed(2)}% | Calm Rate: ${(calmRate * 100).toFixed(2)}%`);
    expect(calmRate).toBeGreaterThan(panickedRate + 0.10); 
  });

});
