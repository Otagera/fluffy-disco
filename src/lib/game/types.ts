export type AIState = 'POSITION' | 'PRESS' | 'SUPPORT' | 'SHOOT' | 'DEFEND' | 'CELEBRATE';

export type Mentality = 'ULTRA_DEFENSIVE' | 'DEFENSIVE' | 'BALANCED' | 'ATTACKING' | 'ULTRA_ATTACKING';

export type ControlType = 'HUMAN' | 'CPU';

export interface Player {
  id: number;
  originalId?: string;
  name?: string;
  team: 'home' | 'away';
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  number: number;
  role: string;
  tacticalRole: string;
  vx: number;
  vy: number;
  aiState: AIState;
  pressure: number;
  anchorX: number;
  anchorY: number;
  currentStamina: number;
  possessionStrength: number;
  currentAction: string | null;
  actionTimer: number;
  btState: Record<string, any>;
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

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
}

export interface TeamStats {
  goals: number;
  shots: number;
  passesAttempted: number;
  passesCompleted: number;
  possessionTime: number;
}

export interface PassEvent {
  fromId: number;
  toId: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  minute: number;
  team: 'home' | 'away';
}

export interface ShotEvent {
  playerId: number;
  x: number;
  y: number;
  xg: number;
  result: 'GOAL' | 'SAVE' | 'MISS' | 'BLOCK';
  minute: number;
  team: 'home' | 'away';
}

export interface MatchAnalytics {
  passes: PassEvent[];
  shots: ShotEvent[];
  heatmapSamples: { team: 'home' | 'away', x: number, y: number, playerId: number }[];
}
