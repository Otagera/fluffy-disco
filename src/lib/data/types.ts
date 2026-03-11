export interface MatchEvent {
    type: 'pass' | 'shot' | 'foul' | 'goal' | 'save' | 'sub';
    team: number;
    playerId?: number;
    foulerId?: number;
    incomingPlayerId?: string;
    incomingPlayerNumber?: number;
    yellowCard?: boolean;
    redCard?: boolean;
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
  teamId: string | null;
  name: string;
  number?: number;
  birthDate: string; // YYYY-MM-DD
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  potential: number;
  overall?: number;
  condition: number; // 0-100
  matchSharpness?: number; // 0-100
  morale?: number; // 0-100
  preferredFoot?: 'Left' | 'Right' | 'Both';
  wage?: number;
  contractExpires?: string; // YYYY-MM-DD
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
  consistency?: number;
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

export interface GoalEvent {
  playerId: string;
  minute: number;
  teamId: string;
}

export interface NewsItem {
  id: string;
  week: number;
  headline: string;
  type: 'BIG_RESULT' | 'HAT_TRICK' | 'GOLDEN_BOOT' | 'TOP_CLASH' | 'TRANSFER';
  relatedPlayerId?: string;
  relatedTeamId?: string;
}

export interface League {
  id: string;
  name: string;
  level: number;
  teams: string[]; // Array of TeamProfile IDs
  standings: Standing[];
  news?: NewsItem[];
}

export interface Fixture {
  id: string;
  leagueId: string;
  week: number;
  date?: string; // YYYY-MM-DD
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
  goalEvents?: GoalEvent[];
}

export interface InboxMessage {
  id: string;
  teamId: string;
  date: string;
  sender: string;
  subject: string;
  body: string;
  type: 'BIRTHDAY' | 'TRANSFER' | 'LEAGUE' | 'MATCH';
  isRead: boolean;
  isUrgent: boolean;
  relatedEntityId?: string;
}

export interface ScoutingReport {
  id: string;
  teamId: string;
  playerId: string;
  level: number;
  progressDays: number;
}

export interface SaveGame {
  manager: {
    name: string;
    teamId: string;
  };
  currentSeason: number;
  currentDate: string; // YYYY-MM-DD
  currentWeek: number;
  leagues: League[];
  teams: Record<string, TeamProfile>;
  players: Record<string, PlayerProfile>;
  fixtures: Fixture[];
  lastMatchAnalytics?: MatchAnalytics;
  inbox?: InboxMessage[];
  scoutingReports?: ScoutingReport[];
}
