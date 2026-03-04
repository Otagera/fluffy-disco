export interface RoleModifiers {
  tackling: number;
  dribbling: number;
  passing: number;
  shooting: number;
  holding: number;
}

export const tacticalRoles: Record<string, RoleModifiers> = {
  'GK': {
    tackling: 1.0, dribbling: 0.1, passing: 1.2, shooting: 0.1, holding: 2.0
  },
  'BWM': { // Ball Winning Midfielder
    tackling: 1.45, dribbling: 0.5, passing: 0.65, shooting: 0.5, holding: 0.75
  },
  'DLP': { // Deep Lying Playmaker
    tackling: 0.85, dribbling: 0.75, passing: 1.4, shooting: 0.8, holding: 1.45
  },
  'MEZ': { // Mezzala
    tackling: 0.8, dribbling: 1.25, passing: 1.15, shooting: 1.1, holding: 0.5
  },
  'B2B': { // Box-to-Box Midfielder
    tackling: 1.15, dribbling: 1.15, passing: 1.1, shooting: 1.0, holding: 0.6
  },
  'AM': { // Attacking Midfielder
    tackling: 0.6, dribbling: 1.3, passing: 1.5, shooting: 1.2, holding: 0.4
  },
  'WM': { // Wide Midfielder
    tackling: 1.1, dribbling: 1.2, passing: 1.2, shooting: 0.8, holding: 0.9
  },
  'ST': { // Standard Striker
    tackling: 0.5, dribbling: 1.2, passing: 0.8, shooting: 1.5, holding: 0.4
  },
  'IF': { // Inside Forward
    tackling: 0.5, dribbling: 1.5, passing: 1.0, shooting: 1.4, holding: 0.3
  },
  'W': { // Winger
    tackling: 0.6, dribbling: 1.4, passing: 1.4, shooting: 0.7, holding: 0.5
  },
  'CB': { // Central Defender
    tackling: 1.4, dribbling: 0.3, passing: 0.8, shooting: 0.2, holding: 1.8
  },
  'FB': { // Fullback
    tackling: 1.2, dribbling: 0.8, passing: 1.0, shooting: 0.5, holding: 1.1
  },
  'WB': { // Wing-Back
    tackling: 0.9, dribbling: 1.3, passing: 1.2, shooting: 0.7, holding: 0.6
  },
  'AF': { // Advanced Forward
    tackling: 0.4, dribbling: 1.4, passing: 0.7, shooting: 1.6, holding: 0.3
  },
  'TM': { // Target Man
    tackling: 0.6, dribbling: 0.6, passing: 1.3, shooting: 1.2, holding: 1.4
  }
};
