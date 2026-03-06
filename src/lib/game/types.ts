export type AIState = 'POSITION' | 'PRESS' | 'SUPPORT' | 'SHOOT' | 'DEFEND' | 'CELEBRATE' | 'OVERLAP';

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
  currentAction: any; 
  actionTimer: number;
  thinkCooldown: number;
  btState: Record<string, any>;
  cautions: number; // Yellow cards accumulated
  sentOff: boolean; // Red card sent off
  lastPassReceiver?: number; // For receiver-based pass variance
  recentTouchTime?: number; // Last time player touched ball
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

export type CameraMode = 'TACTICAL' | 'BROADCAST' | 'ACTION';

export interface TeamStats {
  goals: number;
  shots: number;
  passesAttempted: number;
  passesCompleted: number;
  possessionTime: number;
  dangerousEntries: number;
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
  result: 'GOAL' | 'SAVE' | 'MISS' | 'BLOCK' | 'POST';
  minute: number;
  team: 'home' | 'away';
}

export interface MatchAnalytics {
  passes: PassEvent[];
  shots: ShotEvent[];
  heatmapSamples: { team: 'home' | 'away', x: number, y: number, playerId: number }[];
  momentum: number[];
}

export interface MatchState {
  status: 'LOBBY' | 'PLAYING' | 'PAUSED' | 'HALFTIME' | 'FINISHED';
  isSimulating: boolean;
  timer: number;
  homeScore: number;
  awayScore: number;
  events: { minute: number; type: string; desc: string }[];
  ball: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    spin: number;
  };
  camera: {
    mode: CameraMode;
    zoom: number;
    x: number;
    y: number;
  };
  possessionPlayerId: number | null;
  players: Player[];
  homeBench: Player[];
  awayBench: Player[];
  homeSubsUsed: number;
  awaySubsUsed: number;
  homeFormation: string;
  awayFormation: string;
  homeTacticalStyle: string;
  awayTacticalStyle: string;
  homeMentality: Mentality;
  awayMentality: Mentality;
  homeControl: ControlType;
  awayControl: ControlType;
  sidesSwitched: boolean;
  homeTeamId: string;
  awayTeamId: string;
  shotPower: number;
  isCharging: boolean;
  setPiece: {
    type: 'throw-in' | 'corner' | 'goal-kick' | 'kick-off';
    team: 'home' | 'away';
    x: number;
    y: number;
    ticks: number;
    takerId: number | null;
  } | null;
  lastKickerId: number | null;
  lastKickType: 'PASS' | 'SHOOT' | 'CLEAR' | null;
  lastKickPos: { x: number, y: number } | null;
  stats: {
    home: TeamStats;
    away: TeamStats;
  };
  analytics: MatchAnalytics;
  replay: {
    frames: {
      minute: number;
      ball: { x: number; y: number; z: number };
      players: { id: number; x: number; y: number; state: string }[];
      score: { home: number; away: number };
    }[];
    isRecording: boolean;
  };
}
