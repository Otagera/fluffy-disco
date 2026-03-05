import type { MatchAnalytics } from '../game/types';

export interface PlayerProfile {
  id: string;
  name: string;
  age: number;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  potential: number;
  condition: number; // 0-100
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
}

export interface TeamProfile {
  id: string;
  name: string;
  reputation: number; // 1-100
  tacticalStyle: string;
  mentality: string; // ULTRA_DEFENSIVE, DEFENSIVE, BALANCED, ATTACKING, ULTRA_ATTACKING
  formation: string;
  players: string[]; // Array of PlayerProfile IDs
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
