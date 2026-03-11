import fs from 'fs';
import path from 'path';
import {
  fakerDE,
  fakerEN_GB,
  fakerEN_NG,
  fakerEN_US,
  fakerEN_ZA,
  fakerES,
  fakerFR,
  fakerIT,
  fakerPT_BR
} from '@faker-js/faker';
import type { Fixture, League, PlayerProfile, SaveGame, TeamProfile } from './types';
import { calculatePlayerOverall, calculateTeamOverall } from './ratings';

const locales = [fakerEN_GB, fakerEN_US, fakerES, fakerFR, fakerDE, fakerIT, fakerPT_BR, fakerEN_NG, fakerEN_ZA];

type Role = PlayerProfile['role'];

type LeagueGenerationProfile = {
  reputationMin: number;
  reputationMax: number;
  abilityBase: number;
  abilityVariance: number;
  youthWeight: number;
};

const LEAGUE_GENERATION: Record<number, LeagueGenerationProfile> = {
  1: { reputationMin: 78, reputationMax: 96, abilityBase: 14.4, abilityVariance: 1.7, youthWeight: 0.18 },
  2: { reputationMin: 62, reputationMax: 82, abilityBase: 12.1, abilityVariance: 1.9, youthWeight: 0.22 },
  3: { reputationMin: 46, reputationMax: 68, abilityBase: 10.1, abilityVariance: 2.0, youthWeight: 0.26 },
  4: { reputationMin: 32, reputationMax: 56, abilityBase: 8.5, abilityVariance: 2.1, youthWeight: 0.32 }
};

const anglicizedNames = {
  chinese: {
    first: ['Wei', 'Qiang', 'Lei', 'Jun', 'Yong', 'Jie', 'Tao', 'Zhen', 'Ming', 'Gang', 'Hao', 'Yi', 'Peng', 'Feng'],
    last: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou', 'Xu', 'Sun', 'Ma', 'Zhu']
  },
  japanese: {
    first: ['Hiroshi', 'Kenji', 'Takashi', 'Akira', 'Shinji', 'Yuki', 'Kaito', 'Ren', 'Sora', 'Haruto', 'Yuto'],
    last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato']
  },
  arabic: {
    first: ['Ahmed', 'Mohamed', 'Omar', 'Ali', 'Youssef', 'Ibrahim', 'Mahmoud', 'Mustafa', 'Hassan', 'Khaled', 'Kareem'],
    last: ['Mansour', 'Haddad', 'Saleh', 'Abadi', 'Fahmy', 'Said', 'Ghanem', 'Zaki', 'Rahman', 'Nagi']
  },
  nigerian: {
    first: ['Chukwudi', 'Okafor', 'Adeyemi', 'Olumide', 'Femi', 'Chinedu', 'Tunde', 'Ifeanyi', 'Segun', 'Uche', 'Emeka', 'Babatunde', 'Kolawole'],
    last: ['Okonkwo', 'Balogun', 'Obi', 'Eze', 'Adebayo', 'Olatunji', 'Nwosu', 'Ibrahim', 'Musa', 'Onuoha', 'Abubakar', 'Lawal']
  }
};

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const styleLocales: Record<string, any> = {
  'Global': locales,
  'English': [fakerEN_GB],
  'Spanish': [fakerES],
  'German': [fakerDE],
  'Italian': [fakerIT],
  'French': [fakerFR],
  'Brazilian': [fakerPT_BR],
  'Nigerian': [fakerEN_NG]
};

function randomName(style: string = 'Global') {
  const activeLocales = styleLocales[style] || locales;
  const isGlobal = style === 'Global';
  
  // If global, keep the old chaotic mix. If regional, 80% chance of local, 20% international
  const rand = Math.random();
  if (isGlobal || rand > 0.8) {
    if (rand < (isGlobal ? 0.1 : 0.05)) return `${anglicizedNames.chinese.first[getRandomInt(0, anglicizedNames.chinese.first.length - 1)]} ${anglicizedNames.chinese.last[getRandomInt(0, anglicizedNames.chinese.last.length - 1)]}`;
    if (rand < (isGlobal ? 0.2 : 0.1)) return `${anglicizedNames.japanese.first[getRandomInt(0, anglicizedNames.japanese.first.length - 1)]} ${anglicizedNames.japanese.last[getRandomInt(0, anglicizedNames.japanese.last.length - 1)]}`;
    if (rand < (isGlobal ? 0.3 : 0.15)) return `${anglicizedNames.arabic.first[getRandomInt(0, anglicizedNames.arabic.first.length - 1)]} ${anglicizedNames.arabic.last[getRandomInt(0, anglicizedNames.arabic.last.length - 1)]}`;
    if (rand < (isGlobal ? 0.4 : 0.2)) return `${anglicizedNames.nigerian.first[getRandomInt(0, anglicizedNames.nigerian.first.length - 1)]} ${anglicizedNames.nigerian.last[getRandomInt(0, anglicizedNames.nigerian.last.length - 1)]}`;
    
    if (!isGlobal) {
      const randomLocale = locales[getRandomInt(0, locales.length - 1)];
      return `${randomLocale.person.firstName('male')} ${randomLocale.person.lastName()}`;
    }
  }

  const locale = activeLocales[getRandomInt(0, activeLocales.length - 1)];
  return `${locale.person.firstName('male')} ${locale.person.lastName()}`;
}

function roleBoost(role: Role, key: keyof PlayerProfile['attributes']) {
  if (role === 'GK') {
    return ['reflexes', 'handling', 'positioning', 'concentration', 'decisions'].includes(key) ? 2.3 : -1.8;
  }
  if (role === 'DEF') {
    return ['tackling', 'marking', 'positioning', 'strength', 'concentration'].includes(key) ? 1.9 : 0;
  }
  if (role === 'MID') {
    return ['passing', 'vision', 'decisions', 'workRate', 'anticipation'].includes(key) ? 1.8 : 0;
  }
  return ['finishing', 'pace', 'acceleration', 'dribbling', 'composure'].includes(key) ? 2 : 0;
}

function generateAge(level: number, youthWeight: number) {
  const roll = Math.random();
  if (roll < youthWeight) return getRandomInt(17, 21);
  if (roll < 0.72) return getRandomInt(22, 28);
  return getRandomInt(level <= 2 ? 27 : 25, 35);
}

function generatePlayer(role: Role, baseAbility: number, level: number, youthWeight: number, style: string = 'Global'): PlayerProfile {
  const age = generateAge(level, youthWeight);

  const attr = (key: keyof PlayerProfile['attributes'], spread = 2.2) => {
    const value = baseAbility + roleBoost(role, key) + randomFloat(-spread, spread);
    return Math.round(clamp(value, 1, 20));
  };

  const attributes = {
    passing: attr('passing'),
    finishing: attr('finishing'),
    tackling: attr('tackling'),
    dribbling: attr('dribbling'),
    crossing: attr('crossing'),
    marking: attr('marking'),
    vision: attr('vision'),
    composure: attr('composure'),
    decisions: attr('decisions'),
    positioning: attr('positioning'),
    concentration: attr('concentration'),
    aggression: attr('aggression'),
    anticipation: attr('anticipation'),
    workRate: attr('workRate'),
    pace: attr('pace'),
    acceleration: attr('acceleration'),
    stamina: attr('stamina', 1.8),
    strength: attr('strength', 2.0),
    reflexes: attr('reflexes'),
    handling: attr('handling')
  };

  const potentialGrowth = age <= 21 ? getRandomInt(2, 6) : age <= 24 ? getRandomInt(1, 4) : getRandomInt(0, 2);

  // Calculate birthDate by subtracting age from '2024-08-01' and picking a random month/day
  const birthYear = 2024 - age;
  const birthMonth = getRandomInt(1, 12).toString().padStart(2, '0');
  const birthDay = getRandomInt(1, 28).toString().padStart(2, '0');
  const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;

  return {
    id: `p_${Math.random().toString(36).slice(2, 11)}`,
    name: randomName(style),
    birthDate,
    role,
    potential: clamp(Math.round(baseAbility + potentialGrowth), 1, 20),
    condition: 100,
    matchSharpness: getRandomInt(80, 100),
    morale: getRandomInt(70, 100),
    consistency: getRandomInt(1, 20),
    preferredFoot: Math.random() > 0.8 ? 'Left' : 'Right',
    wage: Math.round((baseAbility * 1000) * (level === 1 ? 5 : level === 2 ? 2 : 1)),
    contractExpires: `${2024 + getRandomInt(1, 4)}-06-30`,
    injury: null,
    attributes,
    seasonStats: { apps: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, averageRating: 0 }
  };
}

function pickStartingXI(players: PlayerProfile[]) {
  const byRole = {
    GK: players.filter((p) => p.role === 'GK').sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)),
    DEF: players.filter((p) => p.role === 'DEF').sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)),
    MID: players.filter((p) => p.role === 'MID').sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)),
    FWD: players.filter((p) => p.role === 'FWD').sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
  };

  return [...byRole.GK.slice(0, 1), ...byRole.DEF.slice(0, 4), ...byRole.MID.slice(0, 3), ...byRole.FWD.slice(0, 3)];
}

function orderSquadForMatchday(players: PlayerProfile[]) {
  const starters = pickStartingXI(players);
  const starterIds = new Set(starters.map((p) => p.id));
  const remaining = players.filter((p) => !starterIds.has(p.id)).sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));

  const bench: PlayerProfile[] = [];
  const reserveGk = remaining.find((p) => p.role === 'GK');
  if (reserveGk) {
    bench.push(reserveGk);
  }

  for (const player of remaining) {
    if (bench.length >= 9) break;
    if (bench.some((p) => p.id === player.id)) continue;
    bench.push(player);
  }

  const rest = remaining.filter((p) => !bench.some((b) => b.id === p.id));
  return [...starters, ...bench, ...rest];
}

import { TACTICAL_COMPATIBILITY, type TacticalStyle, getTacticalCompatibility } from '../engine/ai/Compatibility';
import { formations } from '../engine/ai/Formations';

export function generateTeam(level: number, usedNames: Set<string>, style: string = 'Global'): { team: TeamProfile; players: PlayerProfile[] } {
  let name = '';
  const profile = LEAGUE_GENERATION[level] ?? LEAGUE_GENERATION[4];
  
  const suffixesByStyle: Record<string, string[]> = {
    'Global': ['City', 'United', 'Rovers', 'FC', 'Sporting', 'Athletic'],
    'English': ['City', 'United', 'Rovers', 'Wanderers', 'Athletic', 'Town', 'FC', 'Albion', 'Argyle', 'Wednesday'],
    'Spanish': ['CF', 'Real', 'Deportivo', 'Sporting', 'UD', 'CD'],
    'German': ['FC', '04', 'SV', 'Borussia', 'Eintracht', 'VfL', 'TSG'],
    'Italian': ['AC', 'FC', 'AS', 'SS', 'US', 'Calcio'],
    'French': ['FC', 'Olympique', 'AS', 'RC', 'Stade'],
    'Brazilian': ['FC', 'EC', 'FR', 'CR', 'SE'],
    'Nigerian': ['United', 'Rangers Int\'l', 'Pillars', 'Enyimba', 'Stars', 'Warriors', 'Sunshine', 'Heartland', 'Tornadoes', 'Insurance']
  };

  const activeLocales = styleLocales[style] || locales;
  const locale = activeLocales[getRandomInt(0, activeLocales.length - 1)];
  const teamSuffixes = suffixesByStyle[style] || suffixesByStyle['Global'];

  do {
    const cityName = locale.location.city();
    if (['Spanish', 'Italian', 'French', 'German'].includes(style) && Math.random() > 0.5) {
        name = `${teamSuffixes[getRandomInt(0, teamSuffixes.length - 1)]} ${cityName}`;
    } else if (style === 'Nigerian') {
        const prefixes = ['Rivers', 'Plateau', 'Lobi', 'Remo', 'Kwara', 'Akwa', 'Bayelsa', 'Bendel', 'Kano', 'Abia'];
        if (Math.random() > 0.4) {
            name = `${prefixes[getRandomInt(0, prefixes.length - 1)]} ${teamSuffixes[getRandomInt(0, teamSuffixes.length - 1)]}`;
        } else {
            name = `${cityName} ${teamSuffixes[getRandomInt(0, teamSuffixes.length - 1)]}`;
        }
    } else {
        name = `${cityName} ${teamSuffixes[getRandomInt(0, teamSuffixes.length - 1)]}`;
    }
  } while (usedNames.has(name));
  usedNames.add(name);

  const reputation = getRandomInt(profile.reputationMin, profile.reputationMax);
  const teamAbility = clamp(profile.abilityBase + randomFloat(-profile.abilityVariance, profile.abilityVariance), 4, 19);

  // LOGICAL TACTICS GENERATION
  const allStyles = Object.keys(TACTICAL_COMPATIBILITY);
  const tacticalStyle = allStyles[getRandomInt(0, allStyles.length - 1)];
  const config = TACTICAL_COMPATIBILITY[tacticalStyle as TacticalStyle];
  
  const mentality = config.preferredMentalities[getRandomInt(0, config.preferredMentalities.length - 1)];
  
  const formationNames = Object.keys(formations);
  const compatibleFormations = formationNames.filter(f => config.formationKeywords.some(k => f.includes(k)));
  const formation = (compatibleFormations.length > 0 && Math.random() > 0.3) 
    ? compatibleFormations[getRandomInt(0, compatibleFormations.length - 1)] 
    : formationNames[getRandomInt(0, formationNames.length - 1)];

  const team: TeamProfile = {
    id: `t_${Math.random().toString(36).slice(2, 11)}`,
    name,
    reputation,
    tacticalStyle,
    mentality,
    formation,
    stadiumName: `${name} Stadium`,
    stadiumCapacity: getRandomInt(5000, 60000),
    transferBudget: Math.round(reputation * 1000000),
    wageBudget: Math.round(reputation * 50000),
    managerConfidence: 70,
    players: []
  };

  const rolePool: Role[] = ['GK', 'GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD', 'FWD', 'FWD'];
  const rawPlayers = rolePool.map((role) => {
    const p = generatePlayer(role, teamAbility + randomFloat(-1.2, 1.2), level, profile.youthWeight, style);
    p.overall = calculatePlayerOverall(p);
    return p;
  });

  const orderedPlayers = orderSquadForMatchday(rawPlayers);
  orderedPlayers.forEach((p, index) => {
    p.number = index + 1;
    team.players.push(p.id);
  });
  team.overall = calculateTeamOverall(team, Object.fromEntries(orderedPlayers.map((p) => [p.id, p])));

  return { team, players: orderedPlayers };
}

function getFixtureDate(startStr: string, weekOffset: number): string {
  const d = new Date(startStr);
  // Find first Saturday
  const day = d.getDay();
  const daysToSaturday = (6 - day + 7) % 7;
  d.setDate(d.getDate() + daysToSaturday + (weekOffset - 1) * 7);
  return d.toISOString().split('T')[0];
}

export function generateFixtures(teams: string[], leagueId: string, seasonStartDate: string): Fixture[] {
  const fixtures: Fixture[] = [];
  const n = teams.length;
  const tempTeams = [...teams];

  if (n % 2 !== 0) tempTeams.push('BYE');
  const numTeams = tempTeams.length;
  const rounds = numTeams - 1;
  const half = numTeams / 2;

  for (let round = 0; round < rounds; round++) {
    const week = round + 1;
    const date = getFixtureDate(seasonStartDate, week);
    for (let i = 0; i < half; i++) {
      let home = tempTeams[i];
      let away = tempTeams[numTeams - 1 - i];

      if (round % 2 === 1) {
        home = tempTeams[numTeams - 1 - i];
        away = tempTeams[i];
      }

      if (home !== 'BYE' && away !== 'BYE') {
        fixtures.push({
          id: `f_${Math.random().toString(36).slice(2, 11)}`,
          leagueId,
          week,
          date,
          homeTeamId: home,
          awayTeamId: away,
          played: false
        });
      }
    }
    tempTeams.splice(1, 0, tempTeams.pop()!);
  }

  const firstHalfFixtures = [...fixtures];
  firstHalfFixtures.forEach((f) => {
    fixtures.push({
      id: `f_${Math.random().toString(36).slice(2, 11)}`,
      leagueId,
      week: f.week + rounds,
      date: getFixtureDate(seasonStartDate, f.week + rounds),
      homeTeamId: f.awayTeamId,
      awayTeamId: f.homeTeamId,
      played: false
    });
  });

  return fixtures;
}

export function generateSaveGame(managerName: string, style: string = 'Global', selectedTeamId?: string): SaveGame {
  const saveGame: SaveGame = {
    manager: { name: managerName, teamId: selectedTeamId || '' },
    currentSeason: 1,
    currentDate: '2024-08-01',
    currentWeek: 1,
    leagues: [],
    teams: {},
    players: {},
    fixtures: []
  };

  const usedTeamNames = new Set<string>();
  const levels = [
    { name: 'Premier League', numTeams: 20 },
    { name: 'Championship', numTeams: 24 },
    { name: 'League One', numTeams: 24 },
    { name: 'League Two', numTeams: 24 }
  ];

  levels.forEach((lvl, i) => {
    const levelIndex = i + 1;
    const league: League = {
      id: `l_${Math.random().toString(36).slice(2, 11)}`,
      name: lvl.name,
      level: levelIndex,
      teams: [],
      standings: [],
      news: []
    };

    for (let j = 0; j < lvl.numTeams; j++) {
      const { team, players } = generateTeam(levelIndex, usedTeamNames, style);
      saveGame.teams[team.id] = team;
      league.teams.push(team.id);

      league.standings.push({ teamId: team.id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
      players.forEach((p) => {
        saveGame.players[p.id] = p;
      });
    }

    saveGame.fixtures.push(...generateFixtures(league.teams, league.id, saveGame.currentDate));
    saveGame.leagues.push(league);
  });

  if (!selectedTeamId && saveGame.leagues[0]?.teams.length) {
    saveGame.manager.teamId = saveGame.leagues[0].teams[0];
  }

  return saveGame;
}

if (process.argv[1] === import.meta.url || (typeof process !== 'undefined' && process.argv[1] === path.resolve('src/lib/data/generator.ts'))) {
  const { saveNewGameToDB } = require('./store.ts');
  const save = generateSaveGame('The Gaffer');
  saveNewGameToDB(save);
  console.log(`Generated and saved game state to SQLite DB for ${Object.keys(save.teams).length} teams.`);
}
