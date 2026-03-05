import { matchState } from './matchState.svelte';
import { PITCH_W, PITCH_H } from './constants';
import { formations } from './formations';
import type { Player } from './types';
import { resetPhysics } from './physics';
import { resetEngineState } from './engine.svelte';
import { emitMatchEvent } from './events';

import type { PlayerProfile, TeamProfile } from '../data/types';

export function normalizeAttributes(attr: any, role: string): any {
  const base = getAttributesByRole(role);
  return {
    passing: attr?.passing ?? base.passing,
    finishing: attr?.finishing ?? attr?.shooting ?? base.finishing,
    tackling: attr?.tackling ?? base.tackling,
    dribbling: attr?.dribbling ?? base.dribbling,
    crossing: attr?.crossing ?? base.crossing,
    marking: attr?.marking ?? base.marking,
    vision: attr?.vision ?? base.vision,
    composure: attr?.composure ?? base.composure,
    decisions: attr?.decisions ?? base.decisions,
    positioning: attr?.positioning ?? base.positioning,
    concentration: attr?.concentration ?? base.concentration,
    aggression: attr?.aggression ?? base.aggression,
    anticipation: attr?.anticipation ?? base.anticipation,
    workRate: attr?.workRate ?? base.workRate,
    pace: attr?.pace ?? base.pace,
    acceleration: attr?.acceleration ?? base.acceleration,
    stamina: attr?.stamina ?? base.stamina,
    strength: attr?.strength ?? base.strength,
    reflexes: attr?.reflexes ?? base.reflexes,
    handling: attr?.handling ?? base.handling
  };
}

export function resetMatch(options: { 
  switchSides?: boolean, 
  status?: 'LOBBY' | 'PLAYING', 
  kickingTeam?: 'home' | 'away',
  resetStats?: boolean,
  homeTeam?: TeamProfile,
  awayTeam?: TeamProfile,
  homePlayers?: PlayerProfile[],
  awayPlayers?: PlayerProfile[],
  customRoles?: Record<number, string>,
  homeCustomPositions?: Record<number, { x: number, y: number }>,
  awayCustomPositions?: Record<number, { x: number, y: number }>
} = {}) {
  const { 
    switchSides = false, 
    status = 'PLAYING', 
    kickingTeam, 
    resetStats = false,
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers,
    customRoles = {},
    homeCustomPositions = {},
    awayCustomPositions = {}
  } = options;

  resetPhysics();
  if (switchSides) {
    matchState.sidesSwitched = !matchState.sidesSwitched;
  } else if (resetStats) {
    matchState.sidesSwitched = false;
  }

  // Update match state names if provided
  if (homeTeam) {
    matchState.homeTeamId = homeTeam.id;
    matchState.homeMentality = homeTeam.mentality as any || 'BALANCED';
  }
  if (awayTeam) {
    matchState.awayTeamId = awayTeam.id;
    matchState.awayMentality = awayTeam.mentality as any || 'BALANCED';
  }
  
  const hForm = homeTeam ? homeTeam.formation : matchState.homeFormation;
  const aForm = awayTeam ? awayTeam.formation : matchState.awayFormation;
  matchState.homeFormation = hForm;
  matchState.awayFormation = aForm;

  const homePos = formations[hForm] || formations['4-4-2 Wide'];
  const awayPos = formations[aForm] || formations['4-4-2 Wide'];

  let newPlayers: Player[] = [];
  let homeBench: Player[] = [];
  let awayBench: Player[] = [];
  
  homePos.forEach((pos, i) => {
    const custom = homeCustomPositions[i];
    let x = custom?.x ?? pos.x;
    let y = custom?.y ?? pos.y;
    if (matchState.sidesSwitched) { x = 1 - x; y = 1 - y; }
    
    const existing = matchState.players.find(p => p.id === i && p.team === 'home');
    const profile = homePlayers ? homePlayers[i] : null;
    const attributes = normalizeAttributes(profile ? profile.attributes : existing?.attributes, pos.role);
    
    const isWide = pos.y < 0.3 || pos.y > 0.7;
    const isAdvanced = pos.x > 0.35;
    const tacticalRole = customRoles[i] || (existing ? existing.tacticalRole : getTacticalRole(pos.role, i, isWide, hForm, isAdvanced));
    
    newPlayers.push({
      id: i, 
      originalId: profile?.id || existing?.originalId,
      name: profile?.name || existing?.name || `Home Player ${i + 1}`,
      team: 'home', 
      x: x, y: y, 
      homeX: x * PITCH_W, homeY: y * PITCH_H, 
      number: i + 1, role: pos.role,
      tacticalRole,
      vx: 0, vy: 0,
      aiState: 'POSITION',
      pressure: 0,
      anchorX: x,
      anchorY: y,
      currentStamina: existing ? existing.currentStamina : (profile?.condition ?? 100),
      possessionStrength: existing ? existing.possessionStrength : 1.0,
      currentAction: { type: 'POSITION', score: 1.0 },
      actionTimer: 0,
      thinkCooldown: 0,
      btState: {},
      attributes
    });
  });

  if (homePlayers && homePlayers.length > 11 && !matchState.sidesSwitched && matchState.homeBench.length === 0) {
    for (let i = 11; i < homePlayers.length; i++) {
      const p = homePlayers[i];
      homeBench.push({
        id: 100 + i,
        originalId: p.id,
        name: p.name,
        team: 'home',
        x: 0, y: 0, homeX: 0, homeY: 0, number: i + 1, role: p.role,
        tacticalRole: p.role, vx: 0, vy: 0, aiState: 'POSITION', pressure: 0,
        anchorX: 0, anchorY: 0, currentStamina: p.condition ?? 100, possessionStrength: 1.0,
        currentAction: { type: 'POSITION', score: 1.0 }, actionTimer: 0, thinkCooldown: 0, btState: {}, 
        attributes: normalizeAttributes(p.attributes, p.role)
      });
    }
  } else {
    homeBench = matchState.homeBench;
  }

  awayPos.forEach((pos, i) => {
    const custom = awayCustomPositions[i];
    let x = custom ? (1 - custom.x) : (1 - pos.x);
    let y = custom?.y ?? pos.y;
    if (matchState.sidesSwitched) { x = 1 - x; y = 1 - y; } 

    const existingId = i + 11;
    const existing = matchState.players.find(p => p.id === existingId && p.team === 'away');
    const profile = awayPlayers ? awayPlayers[i] : null;
    const attributes = normalizeAttributes(profile ? profile.attributes : existing?.attributes, pos.role);

    const isWide = pos.y < 0.3 || pos.y > 0.7;
    const isAdvanced = (1 - pos.x) > 0.35; 
    const tacticalRole = (existing ? existing.tacticalRole : getTacticalRole(pos.role, i, isWide, aForm, isAdvanced));

    newPlayers.push({
      id: existingId, 
      originalId: profile?.id || existing?.originalId,
      name: profile?.name || existing?.name || `Away Player ${i + 1}`,
      team: 'away', 
      x: x, y: y, 
      homeX: x * PITCH_W, homeY: y * PITCH_H, 
      number: i + 1, role: pos.role,
      tacticalRole,
      vx: 0, vy: 0,
      aiState: 'POSITION',
      pressure: 0,
      anchorX: x,
      anchorY: y,
      currentStamina: existing ? existing.currentStamina : (profile?.condition ?? 100),
      possessionStrength: existing ? existing.possessionStrength : 1.0,
      currentAction: { type: 'POSITION', score: 1.0 },
      actionTimer: 0,
      thinkCooldown: 0,
      btState: {},
      attributes
    });
  });

  if (awayPlayers && awayPlayers.length > 11 && !matchState.sidesSwitched && matchState.awayBench.length === 0) {
    for (let i = 11; i < awayPlayers.length; i++) {
      const p = awayPlayers[i];
      awayBench.push({
        id: 200 + i,
        originalId: p.id,
        name: p.name,
        team: 'away',
        x: 0, y: 0, homeX: 0, homeY: 0, number: i + 1, role: p.role,
        tacticalRole: p.role, vx: 0, vy: 0, aiState: 'POSITION', pressure: 0,
        anchorX: 0, anchorY: 0, currentStamina: p.condition ?? 100, possessionStrength: 1.0,
        currentAction: { type: 'POSITION', score: 1.0 }, actionTimer: 0, thinkCooldown: 0, btState: {}, 
        attributes: normalizeAttributes(p.attributes, p.role)
      });
    }
  } else {
    awayBench = matchState.awayBench;
  }
  
  matchState.players = newPlayers;
  matchState.homeBench = homeBench;
  matchState.awayBench = awayBench;
  
  matchState.ball.x = 0.5;
  matchState.ball.y = 0.5;
  matchState.ball.z = 0;
  matchState.ball.vx = 0;
  matchState.ball.vy = 0;
  matchState.ball.vz = 0;
  matchState.ball.spin = 0;
  
  if (resetStats) {
    matchState.timer = 0;
    matchState.homeScore = 0;
    matchState.awayScore = 0;
    matchState.events = [];
    matchState.homeSubsUsed = 0;
    matchState.awaySubsUsed = 0;

    matchState.stats.home = { goals: 0, shots: 0, passesAttempted: 0, passesCompleted: 0, possessionTime: 0, dangerousEntries: 0 };
    matchState.stats.away = { goals: 0, shots: 0, passesAttempted: 0, passesCompleted: 0, possessionTime: 0, dangerousEntries: 0 };
    matchState.analytics = { passes: [], shots: [], heatmapSamples: [], momentum: [] };

    resetEngineState();
  }
  
  if (status === 'PLAYING') {
    matchState.camera.mode = 'BROADCAST';
    matchState.camera.zoom = 1.0;
    matchState.camera.x = 0.5;
    matchState.camera.y = 0.5;
    matchState.possessionPlayerId = null;
    matchState.setPiece = {
      type: 'kick-off',
      team: kickingTeam || (matchState.sidesSwitched ? 'away' : 'home'),
      x: 0.5,
      y: 0.5,
      ticks: 0,
      takerId: null
    };
  } else {
    matchState.possessionPlayerId = null;
    matchState.setPiece = null;
  }

  matchState.status = status;
}

if (typeof window !== 'undefined') {
  (window as any).resetMatch = resetMatch;
}

export function loadMatchState(data: any) {
  if (!data.frames || data.frames.length === 0) return;
  
  const lastFrame = data.frames[data.frames.length - 1];
  
  matchState.timer = lastFrame.minute;
  matchState.homeScore = lastFrame.score.home;
  matchState.awayScore = lastFrame.score.away;
  matchState.ball = { ...lastFrame.ball, vx: 0, vy: 0, vz: 0, spin: 0 };
  
  matchState.players.forEach(p => {
    const saved = lastFrame.players.find((sp: any) => sp.id === p.id);
    if (saved) {
      p.x = saved.x;
      p.y = saved.y;
      p.currentStamina = saved.stamina || 100;
      p.vx = 0;
      p.vy = 0;
      p.aiState = saved.state;
      p.currentAction = { type: saved.state, score: 1.0 };
      p.thinkCooldown = 0;
    }
  });

  matchState.status = 'PAUSED';
}

export function getTacticalRole(role: string, index: number, isWide: boolean, formation: string, isAdvanced: boolean): string {
  if (role === 'GK') return 'GK';
  if (role === 'DEF') {
    if (!isWide) return 'CB';
    if (formation.startsWith('5') || formation.startsWith('3')) return 'WB';
    return 'FB';
  }
  if (role === 'FWD') {
    if (isWide) {
      return index % 2 === 0 ? 'IF' : 'W';
    }
    const fwdRoles = ['ST', 'AF', 'TM'];
    return fwdRoles[index % fwdRoles.length];
  }
  if (role === 'MID') {
    if (isWide) return 'WM';
    if (isAdvanced) return 'AM';
    const midRoles = ['DLP', 'BWM', 'MEZ', 'B2B'];
    return midRoles[index % midRoles.length];
  }
  return role;
}

export function getAttributesByRole(role: string) {
  const base = {
    passing: 10, finishing: 10, tackling: 10, vision: 10, composure: 10, 
    decisions: 10, positioning: 10, pace: 10, stamina: 10, 
    concentration: 10, aggression: 10, dribbling: 10, crossing: 10, marking: 10,
    anticipation: 10, workRate: 10, acceleration: 10, strength: 10, reflexes: 10, handling: 10
  };

  switch (role) {
    case 'GK':
      return { ...base, positioning: 18, vision: 14, decisions: 15, concentration: 16, reflexes: 17, handling: 17 };
    case 'DEF':
      return { ...base, tackling: 16, positioning: 16, composure: 12, pace: 12, concentration: 14, aggression: 14, marking: 16, strength: 15 };
    case 'MID':
      return { ...base, passing: 16, vision: 16, decisions: 16, composure: 15, stamina: 18, concentration: 12, workRate: 17, anticipation: 15 };
    case 'FWD':
      return { ...base, finishing: 17, pace: 16, composure: 16, decisions: 14, aggression: 15, dribbling: 16, acceleration: 17 };
    default:
      return base;
  }
}

export function checkOffside() {
  const b = matchState.ball;
  const allPlayers = matchState.players;
  const possessorId = matchState.possessionPlayerId;
  const possessor = allPlayers.find(p => p.id === possessorId);
  
  if (!possessor) return false;

  const opponents = allPlayers.filter(p => p.team !== possessor.team);
  const defenderXs = opponents.map(p => p.x);
  const lastDefenderX = possessor.team === 'home' 
    ? Math.max(...defenderXs) 
    : Math.min(...defenderXs);

  const teammates = allPlayers.filter(p => p.team === possessor.team && p.id !== possessor.id);
  const offsideTeammate = teammates.find(p => {
    const isAheadOfBall = possessor.team === 'home' ? p.x > b.x : p.x < b.x;
    const isBehindDefense = possessor.team === 'home' ? p.x > (lastDefenderX - 2/PITCH_W) : p.x < (lastDefenderX + 2/PITCH_W);
    return isAheadOfBall && isBehindDefense;
  });

  return !!offsideTeammate;
}

export function triggerOffside() {
  const minute = Math.floor(matchState.timer / 60);
  emitMatchEvent('foul', 'OFFSIDE!', minute);
  
  matchState.ball.vx = 0;
  matchState.ball.vy = 0;
  matchState.ball.vz = 0;
}

export function updateTeamTactics(team: 'home' | 'away', formation: string, style: string, mentality: string) {
  if (team === 'home') {
    matchState.homeFormation = formation;
    matchState.homeTacticalStyle = style;
    matchState.homeMentality = mentality as any;
  } else {
    matchState.awayFormation = formation;
    matchState.awayTacticalStyle = style;
    matchState.awayMentality = mentality as any;
  }

  const posData = formations[formation] || formations['4-4-2 Wide'];
  
  // Directly iterate the relevant 11 indices in matchState.players
  const offset = team === 'home' ? 0 : 11;
  for (let i = 0; i < 11; i++) {
    const p = matchState.players[offset + i];
    if (!p) continue;
    const pos = posData[i];
    if (!pos) continue;

    let x = pos.x;
    let y = pos.y;

    if (team === 'away') {
      x = 1 - x;
    }

    if (matchState.sidesSwitched) {
      x = 1 - x;
      y = 1 - y;
    }

    const isWide = pos.y < 0.3 || pos.y > 0.7;
    const isAdvanced = team === 'home' ? pos.x > 0.35 : (1 - pos.x) > 0.35;
    
    p.homeX = x * PITCH_W;
    p.homeY = y * PITCH_H;
    p.role = pos.role;
    p.tacticalRole = getTacticalRole(pos.role, i, isWide, formation, isAdvanced);
    p.thinkCooldown = 0;
    p.btState = {};
  }
}
