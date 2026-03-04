import type { Player } from './types';
import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';

export interface RollResult {
  success: boolean;
  errorAngle: number;
  errorPower: number;
  quality: number; 
}

export function resolveActionRoll(player: Player, type: 'PASS' | 'SHOOT' | 'CLEAR'): RollResult {
  // MILESTONE 9: PHYSICAL FATIGUE IMPACT
  let fatigueMod = 0.7 + (player.currentStamina / 100) * 0.3;
  if (player.currentStamina < 30) {
    fatigueMod *= 0.6; // Severe penalty when exhausted
  }
  
  // COMPOSURE DAMPENING
  const composureFactor = 1 + (player.attributes.composure / 10); 
  const effectivePressure = player.pressure / composureFactor;

  if (type === 'PASS') {
    // Technical check: Passing + Vision
    const baseAbility = ((player.attributes.passing * 0.7) + (player.attributes.vision * 0.3)) * fatigueMod;
    
    const oppositionFactor = 1.5; 
    const pressurePenalty = effectivePressure * 12;
    
    const threshold = baseAbility - pressurePenalty - oppositionFactor;
    
    const roll = Math.random() * 20;
    const margin = threshold - roll;

    if (margin >= 0) {
      return { success: true, errorAngle: 0, errorPower: 1.0, quality: 0.8 + (margin / 20) };
    } else {
      const failScale = Math.abs(margin) / 10;
      return { 
        success: false, 
        errorAngle: (Math.random() - 0.5) * 45 * failScale, 
        errorPower: 0.7 + (Math.random() * 0.6 * failScale),
        quality: 0.3
      };
    }
  }

  if (type === 'SHOOT') {
    // NEW: Use finishing instead of generic shooting
    const baseAbility = ((player.attributes.finishing * 0.8) + (player.attributes.composure * 0.2)) * fatigueMod;
    
    const gk = matchState.players.find(p => p.role === 'GK' && p.team !== player.team);
    // NEW: Factor in GK reflexes
    const gkFactor = gk ? (gk.attributes.positioning + gk.attributes.reflexes) / 6 : 4;
    
    const pressurePenalty = effectivePressure * 8;
    const threshold = baseAbility - pressurePenalty - gkFactor;
    
    const roll = Math.random() * 20;
    const margin = threshold - roll;

    if (margin >= 0) {
      return { success: true, errorAngle: (Math.random() - 0.5) * 5, errorPower: 1.0, quality: 0.9 };
    } else {
      const failScale = Math.abs(margin) / 10;
      return { 
        success: false, 
        errorAngle: (Math.random() - 0.5) * 30 * failScale, 
        errorPower: 0.8 + (Math.random() * 0.4),
        quality: 0.4
      };
    }
  }

  // CLEAR: Basic check, mostly reliant on strength and desperation
  const baseAbility = (player.attributes.strength / 2 + 10) * fatigueMod;
  const threshold = baseAbility - (effectivePressure * 5);
  const roll = Math.random() * 20;
  
  return { 
    success: threshold > roll, 
    errorAngle: (Math.random() - 0.5) * 40, 
    errorPower: 1.0, 
    quality: 0.5 
  };
}

export function applyRollToVector(vx: number, vy: number, roll: RollResult): { vx: number, vy: number } {
  const angle = Math.atan2(vy, vx) + (roll.errorAngle * Math.PI / 180);
  const mag = Math.hypot(vx, vy) * roll.errorPower;
  return {
    vx: Math.cos(angle) * mag,
    vy: Math.sin(angle) * mag
  };
}
