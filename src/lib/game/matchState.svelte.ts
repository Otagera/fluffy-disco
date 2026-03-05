import { type AIState, type Player, type Mentality, type ControlType, type TeamStats, type MatchAnalytics, type CameraMode } from './types';

export interface MatchState {
  status: 'LOBBY' | 'PLAYING' | 'PAUSED' | 'HALFTIME' | 'FINISHED';
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

export const matchState = $state<MatchState>({
  status: 'LOBBY',
  timer: 0,
  homeScore: 0,
  awayScore: 0,
  events: [],
  ball: {
    x: 0.5,
    y: 0.5,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spin: 0
  },
  possessionPlayerId: null,
  players: [],
  homeBench: [],
  awayBench: [],
  homeSubsUsed: 0,
  awaySubsUsed: 0,
  homeFormation: '4-4-2 Wide',
  awayFormation: '4-3-3 Wide',
  homeTacticalStyle: 'Balanced',
  awayTacticalStyle: 'Balanced',
  homeMentality: 'BALANCED',
  awayMentality: 'BALANCED',
  homeControl: 'HUMAN',
  awayControl: 'CPU',
  sidesSwitched: false,
  homeTeamId: 'castle',
  awayTeamId: 'lions',
  shotPower: 0,
  isCharging: false,
  setPiece: null,
  lastKickerId: null,
  lastKickType: null,
  lastKickPos: null,
  stats: {
    home: { goals: 0, shots: 0, passesAttempted: 0, passesCompleted: 0, possessionTime: 0, dangerousEntries: 0 },
    away: { goals: 0, shots: 0, passesAttempted: 0, passesCompleted: 0, possessionTime: 0, dangerousEntries: 0 }
  },
  camera: {
    mode: 'BROADCAST',
    zoom: 1.0,
    x: 0.5,
    y: 0.5
  },
  analytics: {
    passes: [],
    shots: [],
    heatmapSamples: [],
    momentum: []
  },
  replay: {
    frames: [],
    isRecording: false
  }
});

if (typeof window !== 'undefined') {
  (window as any).matchState = matchState;
}
