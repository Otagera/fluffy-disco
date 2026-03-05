import { type MatchState } from './types';

export const matchState = $state<MatchState>({
  status: 'LOBBY',
  isSimulating: false,
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
