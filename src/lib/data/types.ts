export interface MatchEvent {
    type: 'pass' | 'shot' | 'foul' | 'goal';
    team: number;
    playerId?: number;
    x: number;
    y: number;
    endX?: number;
    endY?: number;
    result?: string;
    time: number;
}

export interface MatchAnalytics {
    possessionTime: [number, number];
    events: MatchEvent[];
    heatmapSamples: { x: number, y: number, team: number }[];
}

export interface PlayerProfile {
  id: string;
  name: string;
  number?: number;
  age: number;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  potential: number;
  overall?: number;
  condition: number; // 0-100
  matchSharpness?: number; // 0-100
  morale?: number; // 0-100
  preferredFoot?: 'Left' | 'Right' | 'Both';
  wage?: number;
  contractExpires?: number;
  injury: { type: string; weeksRemaining: number } | null;
  attributes: {
    // Technical
    passing: number;
    finishing: number;
    tackling: number;
    dribbling: number;
    crossing: number;
    marking: number;
    // Mental
    vision: number;
    composure: number;
    decisions: number;
    positioning: number;
    concentration: number;
    aggression: number;
    anticipation: number;
    workRate: number;
    // Physical
    pace: number;
    acceleration: number;
    stamina: number;
    strength: number;
    // GK
    reflexes: number;
    handling: number;
  };
  hiddenTraits?: {
    injuryProneness: number;
    consistency: number;
    dirtiness: number;
    importantMatches: number;
  };
  seasonStats?: {
    apps: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    yellowCards: number;
    redCards: number;
    averageRating: number;
  };
}

export interface TeamProfile {
  id: string;
  name: string;
  reputation: number; // 1-100
  overall?: number;
  tacticalStyle: string;
  mentality: string; // ULTRA_DEFENSIVE, DEFENSIVE, BALANCED, ATTACKING, ULTRA_ATTACKING
  formation: string;
  stadiumName?: string;
  stadiumCapacity?: number;
  primaryColor?: string;
  secondaryColor?: string;
  transferBudget?: number;
  wageBudget?: number;
  managerConfidence?: number;
  players: string[]; // Array of PlayerProfile IDs
  customPositions?: Record<number, {x: number, y: number}>;
  customRoles?: Record<number, string>;
}

export interface Standing {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface League {
  id: string;
  name: string;
  level: number;
  teams: string[]; // Array of TeamProfile IDs
  standings: Standing[];
}

export interface Fixture {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
}

export interface SaveGame {
  manager: {
    name: string;
    teamId: string;
  };
  currentSeason: number;
  currentDate: string;
  currentWeek: number;
  leagues: League[];
  teams: Record<string, TeamProfile>;
  players: Record<string, PlayerProfile>;
  fixtures: Fixture[];
  lastMatchAnalytics?: MatchAnalytics;
}
