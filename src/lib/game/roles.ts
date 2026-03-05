import type { Mentality } from './types';

export interface TacticalRoleDef {
  id: string;
  duty: 'Defend' | 'Support' | 'Attack';
  getPositionalAnchorOffset: (ballX: number, ballY: number, mentality: Mentality, forwardDir: number, isTeamInPossession: boolean) => { dx: number, dy: number, widthModifier: number };
  utilityMultipliers: {
    tackling: number;
    dribbling: number;
    passing: number;
    shooting: number;
    holding: number;
  };
}

function getMentalityShift(mentality: Mentality): number {
  if (mentality === 'ULTRA_ATTACKING') return 0.15;
  if (mentality === 'ATTACKING') return 0.08;
  if (mentality === 'DEFENSIVE') return -0.08;
  if (mentality === 'ULTRA_DEFENSIVE') return -0.15;
  return 0;
}

function getWidthModifier(mentality: Mentality, isTeamInPossession: boolean): number {
  if (!isTeamInPossession) return 0.7; // Compact when defending
  if (mentality === 'ULTRA_ATTACKING' || mentality === 'ATTACKING') return 1.2; // Expand when attacking
  return 1.0;
}

// Base factory for standard outfield roles
function createOutfieldRole(
  id: string, 
  duty: 'Defend' | 'Support' | 'Attack', 
  multipliers: TacticalRoleDef['utilityMultipliers']
): TacticalRoleDef {
  return {
    id, duty,
    utilityMultipliers: multipliers,
    getPositionalAnchorOffset: (ballX, ballY, mentality, forwardDir, isTeamInPossession) => {
      const shift = getMentalityShift(mentality);
      const width = getWidthModifier(mentality, isTeamInPossession);
      return { dx: shift * forwardDir, dy: 0, widthModifier: width };
    }
  };
}

export const RoleRegistry = new Map<string, TacticalRoleDef>();

RoleRegistry.set('GK', {
  id: 'GK', duty: 'Defend',
  utilityMultipliers: { tackling: 1.0, dribbling: 0.1, passing: 1.2, shooting: 0.1, holding: 2.0 },
  getPositionalAnchorOffset: () => ({ dx: 0, dy: 0, widthModifier: 1.0 })
});

RoleRegistry.set('BWM', createOutfieldRole('BWM', 'Defend', { tackling: 1.45, dribbling: 0.5, passing: 0.65, shooting: 0.5, holding: 0.75 }));
RoleRegistry.set('DLP', createOutfieldRole('DLP', 'Support', { tackling: 0.85, dribbling: 0.75, passing: 1.4, shooting: 0.8, holding: 1.45 }));
RoleRegistry.set('MEZ', createOutfieldRole('MEZ', 'Attack', { tackling: 0.8, dribbling: 1.25, passing: 1.15, shooting: 1.1, holding: 0.5 }));
RoleRegistry.set('B2B', createOutfieldRole('B2B', 'Support', { tackling: 1.15, dribbling: 1.15, passing: 1.1, shooting: 1.0, holding: 0.6 }));
RoleRegistry.set('AM', createOutfieldRole('AM', 'Attack', { tackling: 0.6, dribbling: 1.3, passing: 1.5, shooting: 1.2, holding: 0.4 }));
RoleRegistry.set('WM', createOutfieldRole('WM', 'Support', { tackling: 1.1, dribbling: 1.2, passing: 1.2, shooting: 0.8, holding: 0.9 }));
RoleRegistry.set('ST', createOutfieldRole('ST', 'Attack', { tackling: 0.5, dribbling: 1.2, passing: 0.8, shooting: 1.5, holding: 0.4 }));
RoleRegistry.set('IF', createOutfieldRole('IF', 'Attack', { tackling: 0.5, dribbling: 1.5, passing: 1.0, shooting: 1.4, holding: 0.3 }));
RoleRegistry.set('W', createOutfieldRole('W', 'Attack', { tackling: 0.6, dribbling: 1.4, passing: 1.4, shooting: 0.7, holding: 0.5 }));
RoleRegistry.set('CB', createOutfieldRole('CB', 'Defend', { tackling: 1.4, dribbling: 0.3, passing: 0.8, shooting: 0.2, holding: 1.8 }));
RoleRegistry.set('FB', createOutfieldRole('FB', 'Defend', { tackling: 1.2, dribbling: 0.8, passing: 1.0, shooting: 0.5, holding: 1.1 }));
RoleRegistry.set('WB', createOutfieldRole('WB', 'Support', { tackling: 0.9, dribbling: 1.3, passing: 1.2, shooting: 0.7, holding: 0.6 }));
RoleRegistry.set('AF', createOutfieldRole('AF', 'Attack', { tackling: 0.4, dribbling: 1.4, passing: 0.7, shooting: 1.6, holding: 0.3 }));
RoleRegistry.set('TM', createOutfieldRole('TM', 'Attack', { tackling: 0.6, dribbling: 0.6, passing: 1.3, shooting: 1.2, holding: 1.4 }));

// For backwards compatibility in utilityAI
export const tacticalRoles: Record<string, TacticalRoleDef['utilityMultipliers']> = {};
RoleRegistry.forEach((def, key) => {
  tacticalRoles[key] = def.utilityMultipliers;
});
