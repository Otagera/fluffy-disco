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

function randomName() {
  const rand = Math.random();
  if (rand < 0.1) return `${anglicizedNames.chinese.first[getRandomInt(0, anglicizedNames.chinese.first.length - 1)]} ${anglicizedNames.chinese.last[getRandomInt(0, anglicizedNames.chinese.last.length - 1)]}`;
  if (rand < 0.2) return `${anglicizedNames.japanese.first[getRandomInt(0, anglicizedNames.japanese.first.length - 1)]} ${anglicizedNames.japanese.last[getRandomInt(0, anglicizedNames.japanese.last.length - 1)]}`;
  if (rand < 0.3) return `${anglicizedNames.arabic.first[getRandomInt(0, anglicizedNames.arabic.first.length - 1)]} ${anglicizedNames.arabic.last[getRandomInt(0, anglicizedNames.arabic.last.length - 1)]}`;

  const locale = locales[getRandomInt(0, locales.length - 1)];
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

function generatePlayer(role: Role, baseAbility: number, level: number, youthWeight: number): PlayerProfile {
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

  return {
    id: `p_${Math.random().toString(36).slice(2, 11)}`,
    name: randomName(),
    age,
    role,
    potential: clamp(Math.round(baseAbility + potentialGrowth), 1, 20),
    condition: 100,
    injury: null,
    attributes
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

function generateTeam(level: number, usedNames: Set<string>): { team: TeamProfile; players: PlayerProfile[] } {
  let name = '';
  const profile = LEAGUE_GENERATION[level] ?? LEAGUE_GENERATION[4];
  const teamSuffixes = ['City', 'United', 'Rovers', 'Wanderers', 'Athletic', 'Town', 'FC', 'Sporting', 'Albion', 'Argyle', 'Alexandra', 'Thistle', 'Wednesday', 'Academicals', 'Rangers', 'Borough', 'County', 'Dons', 'Stanley', 'Orient'];

  do {
    name = `${fakerEN_GB.location.city()} ${teamSuffixes[getRandomInt(0, teamSuffixes.length - 1)]}`;
  } while (usedNames.has(name));
  usedNames.add(name);

  const reputation = getRandomInt(profile.reputationMin, profile.reputationMax);
  const teamAbility = clamp(profile.abilityBase + randomFloat(-profile.abilityVariance, profile.abilityVariance), 4, 19);

  const team: TeamProfile = {
    id: `t_${Math.random().toString(36).slice(2, 11)}`,
    name,
    reputation,
    tacticalStyle: ['Tiki-Taka', 'Gegenpress', 'Route One', 'Park the Bus', 'Fluid Counter'][getRandomInt(0, 4)],
    mentality: Math.random() > 0.82 ? ['ULTRA_DEFENSIVE', 'DEFENSIVE', 'ATTACKING', 'ULTRA_ATTACKING'][getRandomInt(0, 3)] : 'BALANCED',
    formation: ['4-4-2 Wide', '4-4-2 Diamond', '4-3-3 Wide', '4-3-3 Narrow', '3-5-2', '4-2-3-1', '3-4-3', '5-4-1'][getRandomInt(0, 7)],
    players: []
  };

  const rolePool: Role[] = ['GK', 'GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD', 'FWD', 'FWD'];
  const rawPlayers = rolePool.map((role) => {
    const p = generatePlayer(role, teamAbility + randomFloat(-1.2, 1.2), level, profile.youthWeight);
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

export function generateFixtures(teams: string[]): Fixture[] {
  const fixtures: Fixture[] = [];
  const n = teams.length;
  const tempTeams = [...teams];

  if (n % 2 !== 0) tempTeams.push('BYE');
  const numTeams = tempTeams.length;
  const rounds = numTeams - 1;
  const half = numTeams / 2;

  for (let round = 0; round < rounds; round++) {
    const week = round + 1;
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
          week,
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
      week: f.week + rounds,
      homeTeamId: f.awayTeamId,
      awayTeamId: f.homeTeamId,
      played: false
    });
  });

  return fixtures;
}

export function generateSaveGame(managerName: string, selectedTeamId?: string): SaveGame {
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
      standings: []
    };

    for (let j = 0; j < lvl.numTeams; j++) {
      const { team, players } = generateTeam(levelIndex, usedTeamNames);
      saveGame.teams[team.id] = team;
      league.teams.push(team.id);

      league.standings.push({ teamId: team.id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
      players.forEach((p) => {
        saveGame.players[p.id] = p;
      });
    }

    saveGame.fixtures.push(...generateFixtures(league.teams));
    saveGame.leagues.push(league);
  });

  if (!selectedTeamId && saveGame.leagues[0]?.teams.length) {
    saveGame.manager.teamId = saveGame.leagues[0].teams[0];
  }

  return saveGame;
}

if (process.argv[1] === import.meta.url || (typeof process !== 'undefined' && process.argv[1] === path.resolve('src/lib/data/generator.ts'))) {
  const save = generateSaveGame('The Gaffer');
  const dataDir = path.resolve('data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  fs.writeFileSync(path.join(dataDir, 'savegame.json'), JSON.stringify(save, null, 2));
  console.log(`Generated savegame.json with full fixtures for ${Object.keys(save.teams).length} teams.`);
}
