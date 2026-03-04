export type Position = { role: string, x: number, y: number };

/**
 * All coordinates are normalized (0 to 1).
 * 0 = Own Goal, 1 = Opponent Goal.
 * Base formations should stay within [0.05, 0.45] so they stay in their own half at kickoff.
 * The AI "shift" logic will push them forward during play.
 */
export const formations: Record<string, Position[]> = {
  '4-4-2 Wide': [
    { role: 'GK', x: 0.05, y: 0.5 },
    { role: 'DEF', x: 0.15, y: 0.2 }, { role: 'DEF', x: 0.15, y: 0.4 }, { role: 'DEF', x: 0.15, y: 0.6 }, { role: 'DEF', x: 0.15, y: 0.8 },
    { role: 'MID', x: 0.32, y: 0.15 }, { role: 'MID', x: 0.30, y: 0.4 }, { role: 'MID', x: 0.30, y: 0.6 }, { role: 'MID', x: 0.32, y: 0.85 },
    { role: 'FWD', x: 0.45, y: 0.35 }, { role: 'FWD', x: 0.45, y: 0.65 }
  ],
  '4-4-2 Diamond': [
    { role: 'GK', x: 0.05, y: 0.5 },
    { role: 'DEF', x: 0.15, y: 0.2 }, { role: 'DEF', x: 0.15, y: 0.4 }, { role: 'DEF', x: 0.15, y: 0.6 }, { role: 'DEF', x: 0.15, y: 0.8 },
    { role: 'MID', x: 0.26, y: 0.5 }, { role: 'MID', x: 0.32, y: 0.3 }, { role: 'MID', x: 0.32, y: 0.7 }, { role: 'MID', x: 0.38, y: 0.5 },
    { role: 'FWD', x: 0.45, y: 0.4 }, { role: 'FWD', x: 0.45, y: 0.6 }
  ],
  '4-3-3 Wide': [
    { role: 'GK', x: 0.05, y: 0.5 },
    { role: 'DEF', x: 0.15, y: 0.2 }, { role: 'DEF', x: 0.15, y: 0.4 }, { role: 'DEF', x: 0.15, y: 0.6 }, { role: 'DEF', x: 0.15, y: 0.8 },
    { role: 'MID', x: 0.30, y: 0.3 }, { role: 'MID', x: 0.28, y: 0.5 }, { role: 'MID', x: 0.30, y: 0.7 },
    { role: 'FWD', x: 0.42, y: 0.15 }, { role: 'FWD', x: 0.48, y: 0.5 }, { role: 'FWD', x: 0.42, y: 0.85 }
  ],
  '4-3-3 Narrow': [
    { role: 'GK', x: 0.05, y: 0.5 },
    { role: 'DEF', x: 0.15, y: 0.2 }, { role: 'DEF', x: 0.15, y: 0.4 }, { role: 'DEF', x: 0.15, y: 0.6 }, { role: 'DEF', x: 0.15, y: 0.8 },
    { role: 'MID', x: 0.30, y: 0.3 }, { role: 'MID', x: 0.28, y: 0.5 }, { role: 'MID', x: 0.30, y: 0.7 },
    { role: 'FWD', x: 0.45, y: 0.35 }, { role: 'FWD', x: 0.48, y: 0.5 }, { role: 'FWD', x: 0.45, y: 0.65 }
  ],
  '3-5-2': [
    { role: 'GK', x: 0.05, y: 0.5 },
    { role: 'DEF', x: 0.15, y: 0.25 }, { role: 'DEF', x: 0.15, y: 0.5 }, { role: 'DEF', x: 0.15, y: 0.75 },
    { role: 'MID', x: 0.30, y: 0.1 }, { role: 'MID', x: 0.30, y: 0.3 }, { role: 'MID', x: 0.30, y: 0.5 }, { role: 'MID', x: 0.30, y: 0.7 }, { role: 'MID', x: 0.30, y: 0.9 },
    { role: 'FWD', x: 0.45, y: 0.35 }, { role: 'FWD', x: 0.45, y: 0.65 }
  ],
  '4-2-3-1': [
    { role: 'GK', x: 0.05, y: 0.5 },
    { role: 'DEF', x: 0.15, y: 0.15 }, { role: 'DEF', x: 0.15, y: 0.38 }, { role: 'DEF', x: 0.15, y: 0.62 }, { role: 'DEF', x: 0.15, y: 0.85 },
    { role: 'MID', x: 0.28, y: 0.35 }, { role: 'MID', x: 0.28, y: 0.65 },
    { role: 'MID', x: 0.40, y: 0.2 }, { role: 'MID', x: 0.40, y: 0.5 }, { role: 'MID', x: 0.40, y: 0.8 },
    { role: 'FWD', x: 0.48, y: 0.5 }
  ],
  '3-4-3': [
    { role: 'GK', x: 0.05, y: 0.5 },
    { role: 'DEF', x: 0.15, y: 0.2 }, { role: 'DEF', x: 0.15, y: 0.5 }, { role: 'DEF', x: 0.15, y: 0.8 },
    { role: 'MID', x: 0.30, y: 0.15 }, { role: 'MID', x: 0.30, y: 0.38 }, { role: 'MID', x: 0.30, y: 0.62 }, { role: 'MID', x: 0.30, y: 0.85 },
    { role: 'FWD', x: 0.45, y: 0.2 }, { role: 'FWD', x: 0.48, y: 0.5 }, { role: 'FWD', x: 0.45, y: 0.8 }
  ],
  '5-4-1': [
    { role: 'GK', x: 0.05, y: 0.5 },
    { role: 'DEF', x: 0.15, y: 0.1 }, { role: 'DEF', x: 0.15, y: 0.3 }, { role: 'DEF', x: 0.15, y: 0.5 }, { role: 'DEF', x: 0.15, y: 0.7 }, { role: 'DEF', x: 0.15, y: 0.9 },
    { role: 'MID', x: 0.32, y: 0.2 }, { role: 'MID', x: 0.32, y: 0.4 }, { role: 'MID', x: 0.32, y: 0.6 }, { role: 'MID', x: 0.32, y: 0.8 },
    { role: 'FWD', x: 0.48, y: 0.5 }
  ]
};
