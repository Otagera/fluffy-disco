import fs from 'fs';
import path from 'path';
import { 
  fakerEN_GB, fakerEN_US, fakerES, fakerFR, fakerDE, fakerIT, 
  fakerPT_BR, fakerEN_NG, fakerEN_ZA 
} from '@faker-js/faker';
import type { SaveGame, League, TeamProfile, PlayerProfile, Fixture } from './types';

const locales = [
  fakerEN_GB, fakerEN_US, fakerES, fakerFR, fakerDE, fakerIT, 
  fakerPT_BR, fakerEN_NG, fakerEN_ZA
];

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

function getRandomName(list: string[]) {
  return list[getRandomInt(0, list.length - 1)];
}

function generatePlayer(role: 'GK' | 'DEF' | 'MID' | 'FWD', teamReputation: number): PlayerProfile {
  let firstName = '';
  let lastName = '';

  const rand = Math.random();
  if (rand < 0.10) {
    firstName = getRandomName(anglicizedNames.chinese.first);
    lastName = getRandomName(anglicizedNames.chinese.last);
  } else if (rand < 0.20) {
    firstName = getRandomName(anglicizedNames.japanese.first);
    lastName = getRandomName(anglicizedNames.japanese.last);
  } else if (rand < 0.30) {
    firstName = getRandomName(anglicizedNames.arabic.first);
    lastName = getRandomName(anglicizedNames.arabic.last);
  } else {
    const locale = locales[getRandomInt(0, locales.length - 1)];
    firstName = locale.person.firstName('male');
    lastName = locale.person.lastName();
  }

  const baseAttr = Math.max(1, Math.min(20, Math.floor(teamReputation / 5)));
  
  const attr = (weight = 1.0) => {
    const variance = getRandomInt(-3, 3);
    return Math.max(1, Math.min(20, Math.floor(baseAttr * weight) + variance));
  };

  let attributes = {
    passing: attr(1.0),
    finishing: attr(1.0),
    tackling: attr(1.0),
    dribbling: attr(1.0),
    crossing: attr(1.0),
    marking: attr(1.0),
    vision: attr(1.0),
    composure: attr(1.0),
    decisions: attr(1.0),
    positioning: attr(1.0),
    concentration: attr(1.0),
    aggression: attr(1.0),
    anticipation: attr(1.0),
    workRate: attr(1.0),
    pace: attr(1.0),
    acceleration: attr(1.0),
    stamina: attr(1.1),
    strength: attr(1.0),
    reflexes: attr(0.5),
    handling: attr(0.5)
  };

  if (role === 'GK') {
    attributes.reflexes = attr(1.5);
    attributes.handling = attr(1.5);
    attributes.positioning = attr(1.3);
    attributes.decisions = attr(1.2);
    attributes.concentration = attr(1.4);
  } else if (role === 'DEF') {
    attributes.tackling = attr(1.5);
    attributes.marking = attr(1.4);
    attributes.positioning = attr(1.4);
    attributes.strength = attr(1.3);
    attributes.aggression = attr(1.2);
  } else if (role === 'MID') {
    attributes.passing = attr(1.5);
    attributes.vision = attr(1.4);
    attributes.decisions = attr(1.3);
    attributes.workRate = attr(1.4);
    attributes.anticipation = attr(1.3);
  } else if (role === 'FWD') {
    attributes.finishing = attr(1.6);
    attributes.pace = attr(1.4);
    attributes.acceleration = attr(1.5);
    attributes.dribbling = attr(1.3);
    attributes.composure = attr(1.4);
  }

  return {
    id: `p_${Math.random().toString(36).substr(2, 9)}`,
    name: `${firstName} ${lastName}`,
    age: getRandomInt(16, 35),
    role,
    potential: Math.min(20, Math.floor(baseAttr * 1.2) + getRandomInt(0, 5)),
    condition: 100,
    injury: null,
    attributes
  };
}

function generateTeam(level: number, usedNames: Set<string>): { team: TeamProfile, players: PlayerProfile[] } {
  let name = '';
  const teamSuffixes = ['City', 'United', 'Rovers', 'Wanderers', 'Athletic', 'Town', 'FC', 'Sporting', 'Albion', 'Argyle', 'Alexandra', 'Thistle', 'Wednesday', 'Academicals', 'Rangers', 'Borough', 'County', 'Dons', 'Stanley', 'Orient'];
  
  do {
    const city = fakerEN_GB.location.city();
    const suffix = teamSuffixes[getRandomInt(0, teamSuffixes.length - 1)];
    name = `${city} ${suffix}`;
  } while (usedNames.has(name));
  usedNames.add(name);

  const reputation = Math.max(10, 100 - ((level - 1) * 20) - getRandomInt(0, 10));
  const formationsList = ['4-4-2 Wide', '4-4-2 Diamond', '4-3-3 Wide', '4-3-3 Narrow', '3-5-2', '4-2-3-1', '3-4-3', '5-4-1'];
  const styles = ['Tiki-Taka', 'Gegenpress', 'Route One', 'Park the Bus', 'Fluid Counter'];
  const mentalities = ['ULTRA_DEFENSIVE', 'DEFENSIVE', 'BALANCED', 'ATTACKING', 'ULTRA_ATTACKING'];

  const team: TeamProfile = {
    id: `t_${Math.random().toString(36).substr(2, 9)}`,
    name,
    reputation,
    tacticalStyle: getRandomName(styles),
    mentality: Math.random() > 0.8 ? getRandomName(mentalities) : 'BALANCED',
    formation: getRandomName(formationsList),
    players: []
  };

  const players: PlayerProfile[] = [];
  const roles: ('GK' | 'DEF' | 'MID' | 'FWD')[] = ['GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD', 'FWD', 'FWD', 'FWD'];
  
  roles.forEach(role => {
    const player = generatePlayer(role, reputation);
    players.push(player);
    team.players.push(player.id);
  });

  return { team, players };
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

      if (i === 0) {
        if (round % 2 === 1) {
          home = tempTeams[numTeams - 1 - i];
          away = tempTeams[i];
        }
      } else {
        if (round % 2 === 1) {
           home = tempTeams[numTeams - 1 - i];
           away = tempTeams[i];
        }
      }

      if (home !== 'BYE' && away !== 'BYE') {
        fixtures.push({
          id: `f_${Math.random().toString(36).substr(2, 9)}`,
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
  firstHalfFixtures.forEach(f => {
    fixtures.push({
      id: `f_${Math.random().toString(36).substr(2, 9)}`,
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
      id: `l_${Math.random().toString(36).substr(2, 9)}`,
      name: lvl.name,
      level: levelIndex,
      teams: [],
      standings: []
    };

    for (let j = 0; j < lvl.numTeams; j++) {
      const { team, players } = generateTeam(levelIndex, usedTeamNames);
      saveGame.teams[team.id] = team;
      league.teams.push(team.id);
      
      league.standings.push({
        teamId: team.id,
        played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0
      });

      players.forEach(p => { saveGame.players[p.id] = p; });
    }

    saveGame.fixtures.push(...generateFixtures(league.teams));
    saveGame.leagues.push(league);
  });

  if (!selectedTeamId && saveGame.leagues.length > 0 && saveGame.leagues[0].teams.length > 0) {
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
