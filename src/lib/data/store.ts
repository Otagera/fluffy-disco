import fs from 'fs';
import path from 'path';
import type { SaveGame, Standing, Fixture } from './types';
import { generateFixtures } from './generator';

const SAVE_FILE_PATH = path.join(process.cwd(), 'data', 'savegame.json');

export function loadSaveGame(): SaveGame | null {
  try {
    if (fs.existsSync(SAVE_FILE_PATH)) {
      const data = fs.readFileSync(SAVE_FILE_PATH, 'utf-8');
      return JSON.parse(data) as SaveGame;
    }
  } catch (error) {
    console.error("Error loading save game:", error);
  }
  return null;
}

export function writeSaveGame(saveData: SaveGame): boolean {
  try {
    const dataDir = path.dirname(SAVE_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    // Minify JSON to save time/space during season transitions
    fs.writeFileSync(SAVE_FILE_PATH, JSON.stringify(saveData));
    return true;
  } catch (error) {
    console.error("Error writing save game:", error);
    return false;
  }
}

export function processWeekResults(save: SaveGame, playerMatchResult?: { fixtureId: string, homeScore: number, awayScore: number, playerStamina?: Record<string, number> }): SaveGame {
  try {
    const teamsPlayed = new Set<string>();

    // 1. Update the player's match if provided
    if (playerMatchResult) {
      const playerFixture = save.fixtures.find(f => f.id === playerMatchResult.fixtureId);
      if (playerFixture) {
        playerFixture.played = true;
        playerFixture.homeScore = playerMatchResult.homeScore;
        playerFixture.awayScore = playerMatchResult.awayScore;
        teamsPlayed.add(playerFixture.homeTeamId);
        teamsPlayed.add(playerFixture.awayTeamId);
      }
      
      // Quick Sim other fixtures for CURRENT week ONLY
      simFixtures(save, f => f.week === save.currentWeek && !f.played, teamsPlayed);
      save.currentWeek++;
    } else {
      // Manual advancement: Sim everything that's left in the season
      simFixtures(save, f => !f.played, teamsPlayed);
    }

    // 2. Condition & Injuries Update
    Object.values(save.players).forEach(p => {
      // Base recovery between weeks
      const recovery = 15 + (p.attributes.stamina / 2);
      p.condition = Math.min(100, (p.condition ?? 100) + recovery);

      // Handle Injuries
      if (p.injury && p.injury.weeksRemaining > 0) {
        p.injury.weeksRemaining--;
        if (p.injury.weeksRemaining <= 0) p.injury = null;
      }
    });

    // Apply specific stamina drops from the 3D match
    if (playerMatchResult?.playerStamina) {
      for (const [pId, stamina] of Object.entries(playerMatchResult.playerStamina)) {
        if (save.players[pId]) {
          save.players[pId].condition = Math.max(1, stamina); // Cannot drop below 1
          
          // Risk of injury if exhausted
          if (stamina < 40 && Math.random() < 0.05) {
            save.players[pId].injury = { type: 'Muscle Strain', weeksRemaining: Math.floor(Math.random() * 3) + 1 };
          }
        }
      }
    }

    // Apply generic stamina drops for CPU simulated matches
    teamsPlayed.forEach(tid => {
      const team = save.teams[tid];
      if (team) {
        // Just drop the first 14 players (starters + subs) by a random amount to simulate match load
        team.players.slice(0, 14).forEach(pId => {
          // Skip if this player's stamina was already handled by the 3D match payload
          if (playerMatchResult?.playerStamina && playerMatchResult.playerStamina[pId] !== undefined) return;
          
          const p = save.players[pId];
          if (p && !p.injury) {
            const drop = 20 + Math.random() * 15 - (p.attributes.stamina / 4);
            p.condition = Math.max(1, p.condition - drop);

            if (p.condition < 40 && Math.random() < 0.02) {
              p.injury = { type: 'Knock', weeksRemaining: Math.floor(Math.random() * 2) + 1 };
            }
          }
        });
      }
    });

    // 3. Update Standings
    updateAllStandings(save);

    // 4. Check for season end
    const allPlayed = save.fixtures.every(f => f.played);
    if (allPlayed && save.fixtures.length > 0) {
      return advanceSeason(save);
    }
  } catch (err) {
    console.error("Critical error in processWeekResults:", err);
  }
  
  return save;
}

function simFixtures(save: SaveGame, filter: (f: Fixture) => boolean, teamsPlayed: Set<string>) {
  const fixturesToSim = save.fixtures.filter(filter);
  for (const f of fixturesToSim) {
    const homeTeam = save.teams[f.homeTeamId];
    const awayTeam = save.teams[f.awayTeamId];
    if (!homeTeam || !awayTeam) {
      f.played = true;
      f.homeScore = 0;
      f.awayScore = 0;
      continue;
    }

    const homeAdv = 0.3;
    const diff = (homeTeam.reputation - awayTeam.reputation) / 20;
    const lambdaHome = Math.max(0.2, 1.4 + diff + homeAdv);
    const lambdaAway = Math.max(0.2, 1.4 - diff);
    
    f.homeScore = poisson(lambdaHome);
    f.awayScore = poisson(lambdaAway);
    f.played = true;

    teamsPlayed.add(f.homeTeamId);
    teamsPlayed.add(f.awayTeamId);
  }
}

function updateAllStandings(save: SaveGame) {
  for (const league of save.leagues) {
    // Reset standings map for clean recalculation
    const standingsMap: Record<string, Standing> = {};
    league.teams.forEach(tid => {
      standingsMap[tid] = { teamId: tid, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    });

    // Only process fixtures belonging to this league
    const leagueFixtures = save.fixtures.filter(f => f.played && standingsMap[f.homeTeamId]);

    for (const f of leagueFixtures) {
      const h = standingsMap[f.homeTeamId];
      const a = standingsMap[f.awayTeamId];
      if (!h || !a) continue;

      const hs = f.homeScore || 0;
      const as = f.awayScore || 0;

      h.played++; a.played++;
      h.goalsFor += hs; h.goalsAgainst += as;
      a.goalsFor += as; a.goalsAgainst += hs;

      if (hs > as) { h.won++; h.points += 3; a.lost++; }
      else if (as > hs) { a.won++; a.points += 3; h.lost++; }
      else { h.drawn++; h.points++; a.drawn++; a.points++; }
    }

    league.standings = Object.values(standingsMap);
  }
}

function advanceSeason(save: SaveGame): SaveGame {
  const sortStandings = (standings: Standing[]) => {
    return [...standings].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      return gdB - gdA;
    });
  };

  const L1 = save.leagues.find(l => l.level === 1);
  const L2 = save.leagues.find(l => l.level === 2);
  const L3 = save.leagues.find(l => l.level === 3);
  const L4 = save.leagues.find(l => l.level === 4);

  if (!L1 || !L2 || !L3 || !L4) return save;

  const s1 = sortStandings(L1.standings);
  const s2 = sortStandings(L2.standings);
  const s3 = sortStandings(L3.standings);
  const s4 = sortStandings(L4.standings);

  const resolvePlayoff = (teams: Standing[]) => {
    if (teams.length === 0) return "";
    const totalPoints = teams.reduce((sum, t) => sum + t.points, 0);
    let roll = Math.random() * (totalPoints || 1);
    for (const t of teams) {
      roll -= t.points;
      if (roll <= 0) return t.teamId;
    }
    return teams[0].teamId;
  };

  // 1. Identify Movement
  const rel1 = s1.slice(-3).map(s => s.teamId);
  const pro2 = [...s2.slice(0, 2).map(s => s.teamId), resolvePlayoff(s2.slice(2, 6))];
  
  const rel2 = s2.slice(-3).map(s => s.teamId);
  const pro3 = [...s3.slice(0, 2).map(s => s.teamId), resolvePlayoff(s3.slice(2, 6))];
  
  const rel3 = s3.slice(-4).map(s => s.teamId);
  const pro4 = [...s4.slice(0, 3).map(s => s.teamId), resolvePlayoff(s4.slice(3, 7))];

  // 2. Perform Swaps
  const performSwap = (l: any, leave: string[], enter: string[]) => {
    l.teams = l.teams.filter((t: string) => !leave.includes(t));
    l.teams.push(...enter.filter(t => t && t !== ""));
  };

  performSwap(L1, rel1, pro2);
  performSwap(L2, [...pro2, ...rel2], [...rel1, ...pro3]);
  performSwap(L3, [...pro3, ...rel3], [...rel2, ...pro4]);
  performSwap(L4, pro4, rel3);

  // 3. Update Global Season State
  save.currentSeason = (save.currentSeason || 1) + 1;
  save.currentWeek = 1;
  save.fixtures = [];

  // 4. Reputation Shifts & Reset Standings & Generate New Fixtures
  save.leagues.forEach(league => {
    league.standings = league.teams.map(tid => ({
      teamId: tid, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0
    }));
    save.fixtures.push(...generateFixtures(league.teams));
  });

  return save;
}

function poisson(lambda: number): number {
  let L = Math.exp(-lambda);
  let p = 1.0;
  let k = 0;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}
