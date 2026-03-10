
import Dexie, { type Table } from 'dexie';

export interface ReplayData {
  id?: number;
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  timestamp: string;
  frameCount: number;
  fps: number;
  blob: Blob;
  analytics?: any;
  startingLabels?: string[];
}

export class FootballSimDB extends Dexie {
  replays!: Table<ReplayData, number>;

  constructor() {
    super('FootballSimReplays');
    this.version(1).stores({
      replays: '++id, matchId, homeTeamId, awayTeamId, timestamp'
    });
  }
}

export const browserDB = new FootballSimDB();
