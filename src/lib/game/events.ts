import { matchState } from './matchState.svelte';

export type EventType = 'goal' | 'sub' | 'foul' | 'whistle' | 'card' | 'injury';

export interface MatchEvent {
  minute: number;
  type: EventType;
  desc: string;
}

export function emitMatchEvent(type: EventType, desc: string, minute?: number) {
  const currentMinute = minute ?? Math.floor(matchState.timer / 60);
  matchState.events.push({ minute: currentMinute, type, desc });
}

export function emitPassEvent(payload: {
  fromId: number;
  toId: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  team: 'home' | 'away';
}) {
  matchState.analytics.passes.push({
    ...payload,
    minute: Math.floor(matchState.timer / 60)
  });
}

export function emitShotEvent(payload: {
  playerId: number;
  x: number;
  y: number;
  xg: number;
  result: 'MISS' | 'GOAL' | 'SAVE' | 'POST' | 'BLOCK';
  team: 'home' | 'away';
}) {
  matchState.analytics.shots.push({
    ...payload,
    minute: Math.floor(matchState.timer / 60)
  });
}
