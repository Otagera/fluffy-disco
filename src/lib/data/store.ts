import fs from 'fs';
import path from 'path';
import type { SaveGame, Standing, Fixture, PlayerProfile, TeamProfile, League } from './types';
import { generateFixtures } from './generator';
import { calculatePlayerOverall, calculateTeamOverall } from './ratings';
import { db, initializeDatabase } from './db';

// Ensure DB is initialized
initializeDatabase();

export function saveNewGameToDB(save: SaveGame) {
    const insertLeague = db.prepare('INSERT INTO leagues (id, name, level) VALUES (?, ?, ?)');
    const insertTeam = db.prepare('INSERT INTO teams (id, name, leagueId, reputation, overall, tacticalStyle, mentality, formation, stadiumName, stadiumCapacity, primaryColor, secondaryColor, transferBudget, wageBudget, managerConfidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertPlayer = db.prepare('INSERT INTO players (id, teamId, name, squadNumber, age, role, potential, overall, condition, matchSharpness, morale, preferredFoot, wage, contractExpires, injuryType, injuryWeeksRemaining, passing, finishing, tackling, dribbling, crossing, marking, vision, composure, decisions, positioning, concentration, aggression, anticipation, workRate, pace, acceleration, stamina, strength, reflexes, handling, injuryProneness, consistency, dirtiness, importantMatches) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertPlayerStats = db.prepare('INSERT INTO player_stats (playerId) VALUES (?)');
    const insertFixture = db.prepare('INSERT INTO fixtures (id, leagueId, week, homeTeamId, awayTeamId, played) VALUES (?, ?, ?, ?, ?, ?)');
    const insertStanding = db.prepare('INSERT INTO standings (leagueId, teamId) VALUES (?, ?)');
    const insertGameState = db.prepare('INSERT OR REPLACE INTO gamestate (id, managerName, managerTeamId, currentSeason, currentDate, currentWeek) VALUES (1, ?, ?, ?, ?, ?)');

    db.transaction(() => {
        db.exec('PRAGMA foreign_keys = OFF;');
        db.exec('DELETE FROM gamestate; DELETE FROM standings; DELETE FROM fixtures; DELETE FROM player_stats; DELETE FROM players; DELETE FROM teams; DELETE FROM leagues;');
        db.exec('PRAGMA foreign_keys = ON;');

        insertGameState.run(save.manager.name, save.manager.teamId, save.currentSeason, save.currentDate, save.currentWeek);

        for (const l of save.leagues) {
            insertLeague.run(l.id, l.name, l.level);
        }

        for (const t of Object.values(save.teams)) {
            const league = save.leagues.find(l => l.teams.includes(t.id));
            insertTeam.run(t.id, t.name, league?.id || '', t.reputation, t.overall || 50, t.tacticalStyle, t.mentality, t.formation, t.stadiumName ?? null, t.stadiumCapacity ?? null, t.primaryColor ?? null, t.secondaryColor ?? null, t.transferBudget ?? 0, t.wageBudget ?? 0, t.managerConfidence ?? 50);
        }

        const playerToTeam = new Map();
        for (const t of Object.values(save.teams)) {
            for (const pId of t.players) playerToTeam.set(pId, t.id);
        }

        for (const p of Object.values(save.players)) {
            const teamId = playerToTeam.get(p.id) || null;
            insertPlayer.run(p.id, teamId, p.name, p.number || null, p.age, p.role, p.potential, p.overall || 50, p.condition, p.matchSharpness ?? 50, p.morale ?? 50, p.preferredFoot ?? 'Right', p.wage ?? 0, p.contractExpires ?? null, p.injury?.type || null, p.injury?.weeksRemaining || 0, p.attributes.passing, p.attributes.finishing, p.attributes.tackling, p.attributes.dribbling, p.attributes.crossing, p.attributes.marking, p.attributes.vision, p.attributes.composure, p.attributes.decisions, p.attributes.positioning, p.attributes.concentration, p.attributes.aggression, p.attributes.anticipation, p.attributes.workRate, p.attributes.pace, p.attributes.acceleration, p.attributes.stamina, p.attributes.strength, p.attributes.reflexes, p.attributes.handling, p.hiddenTraits?.injuryProneness ?? 50, p.hiddenTraits?.consistency ?? 50, p.hiddenTraits?.dirtiness ?? 50, p.hiddenTraits?.importantMatches ?? 50);
            insertPlayerStats.run(p.id);
        }

        for (const l of save.leagues) {
            for (const s of l.standings) {
                insertStanding.run(l.id, s.teamId);
            }
        }

        for (const f of save.fixtures) {
            const league = save.leagues.find(l => l.teams.includes(f.homeTeamId));
            insertFixture.run(f.id, league?.id || '', f.week, f.homeTeamId, f.awayTeamId, f.played ? 1 : 0);
        }
    })();
}

export function loadSaveGame(): SaveGame | null {
    try {
        const gs = db.prepare('SELECT * FROM gamestate WHERE id = 1').get();
        if (!gs) return null;

        const save = {
            manager: { name: gs.managerName, teamId: gs.managerTeamId },
            currentSeason: gs.currentSeason,
            currentDate: gs.currentDate,
            currentWeek: gs.currentWeek,
            leagues: [],
            teams: {},
            players: {},
            fixtures: []
        };

        const leaguesRaw = db.prepare('SELECT * FROM leagues ORDER BY level').all();
        for (const l of leaguesRaw) {
            save.leagues.push({ id: l.id, name: l.name, level: l.level, teams: [], standings: [] });
        }

        const teamsRaw = db.prepare('SELECT * FROM teams').all();
        for (const t of teamsRaw) {
            save.teams[t.id] = { id: t.id, name: t.name, reputation: t.reputation, overall: t.overall, tacticalStyle: t.tacticalStyle, mentality: t.mentality, formation: t.formation, stadiumName: t.stadiumName, stadiumCapacity: t.stadiumCapacity, primaryColor: t.primaryColor, secondaryColor: t.secondaryColor, transferBudget: t.transferBudget, wageBudget: t.wageBudget, managerConfidence: t.managerConfidence, players: [] };
            const league = save.leagues.find(l => l.id === t.leagueId);
            if (league) league.teams.push(t.id);
        }

        const playersRaw = db.prepare('SELECT * FROM players').all();
        for (const p of playersRaw) {
            const player = { id: p.id, name: p.name, number: p.squadNumber, age: p.age, role: p.role, potential: p.potential, overall: p.overall, condition: p.condition, matchSharpness: p.matchSharpness, morale: p.morale, preferredFoot: p.preferredFoot, wage: p.wage, contractExpires: p.contractExpires, injury: p.injuryType ? { type: p.injuryType, weeksRemaining: p.injuryWeeksRemaining } : null, attributes: { passing: p.passing, finishing: p.finishing, tackling: p.tackling, dribbling: p.dribbling, crossing: p.crossing, marking: p.marking, vision: p.vision, composure: p.composure, decisions: p.decisions, positioning: p.positioning, concentration: p.concentration, aggression: p.aggression, anticipation: p.anticipation, workRate: p.workRate, pace: p.pace, acceleration: p.acceleration, stamina: p.stamina, strength: p.strength, reflexes: p.reflexes, handling: p.handling }, hiddenTraits: { injuryProneness: p.injuryProneness, consistency: p.consistency, dirtiness: p.dirtiness, importantMatches: p.importantMatches } };
            const stats = db.prepare('SELECT * FROM player_stats WHERE playerId = ?').get(p.id);
            if (stats) player.seasonStats = { apps: stats.apps, goals: stats.goals, assists: stats.assists, cleanSheets: stats.cleanSheets, yellowCards: stats.yellowCards, redCards: stats.redCards, averageRating: stats.averageRating };
            save.players[p.id] = player;
            if (p.teamId && save.teams[p.teamId]) save.teams[p.teamId].players.push(p.id);
        }

        const standingsRaw = db.prepare('SELECT * FROM standings').all();
        for (const s of standingsRaw) {
            const league = save.leagues.find(l => l.id === s.leagueId);
            if (league) league.standings.push({ teamId: s.teamId, played: s.played, won: s.won, drawn: s.drawn, lost: s.lost, goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst, points: s.points });
        }

        const fixturesRaw = db.prepare('SELECT * FROM fixtures ORDER BY week').all();
        for (const f of fixturesRaw) {
            save.fixtures.push({ id: f.id, week: f.week, homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId, played: f.played === 1, homeScore: f.homeScore, awayScore: f.awayScore });
        }

        recalculateOverallRatings(save);
        return save;
    } catch (error) {
        console.error("Error loading save game from DB:", error);
        return null;
    }
}

export function writeSaveGame(saveData) {
    try {
        const updateGameState = db.prepare('UPDATE gamestate SET currentSeason = ?, currentDate = ?, currentWeek = ? WHERE id = 1');
        const updateTeam = db.prepare('UPDATE teams SET tacticalStyle = ?, mentality = ?, formation = ?, overall = ?, transferBudget = ?, wageBudget = ?, managerConfidence = ? WHERE id = ?');
        const updatePlayer = db.prepare('UPDATE players SET condition = ?, overall = ?, matchSharpness = ?, morale = ?, injuryType = ?, injuryWeeksRemaining = ? WHERE id = ?');
        const updatePlayerStats = db.prepare('UPDATE player_stats SET apps = ?, goals = ?, assists = ?, cleanSheets = ?, yellowCards = ?, redCards = ?, averageRating = ? WHERE playerId = ?');
        const updateFixture = db.prepare('UPDATE fixtures SET played = ?, homeScore = ?, awayScore = ? WHERE id = ?');
        const updateStanding = db.prepare('UPDATE standings SET played = ?, won = ?, drawn = ?, lost = ?, goalsFor = ?, goalsAgainst = ?, points = ? WHERE leagueId = ? AND teamId = ?');
        
        db.transaction(() => {
            updateGameState.run(saveData.currentSeason, saveData.currentDate, saveData.currentWeek);
            for (const t of Object.values(saveData.teams)) updateTeam.run(t.tacticalStyle, t.mentality, t.formation, t.overall || 50, t.transferBudget || 0, t.wageBudget || 0, t.managerConfidence || 50, t.id);
            for (const p of Object.values(saveData.players)) {
                updatePlayer.run(p.condition, p.overall || 50, p.matchSharpness || 50, p.morale || 50, p.injury?.type || null, p.injury?.weeksRemaining || 0, p.id);
                if (p.seasonStats) updatePlayerStats.run(p.seasonStats.apps, p.seasonStats.goals, p.seasonStats.assists, p.seasonStats.cleanSheets, p.seasonStats.yellowCards, p.seasonStats.redCards, p.seasonStats.averageRating, p.id);
            }
            for (const f of saveData.fixtures) updateFixture.run(f.played ? 1 : 0, f.homeScore ?? null, f.awayScore ?? null, f.id);
            for (const l of saveData.leagues) {
                for (const s of l.standings) updateStanding.run(s.played, s.won, s.drawn, s.lost, s.goalsFor, s.goalsAgainst, s.points, l.id, s.teamId);
            }
        })();
        return true;
    } catch (error) {
        console.error("Error writing save game to DB:", error);
        return false;
    }
}

function recalculateOverallRatings(save) {
  for (const player of Object.values(save.players)) player.overall = calculatePlayerOverall(player);
  for (const team of Object.values(save.teams)) team.overall = calculateTeamOverall(team, save.players);
}

export function processWeekResults(save, playerMatchResult) {
  try {
    const teamsPlayed = new Set();
    if (playerMatchResult) {
      const playerFixture = save.fixtures.find(f => f.id === playerMatchResult.fixtureId);
      if (playerFixture) {
        playerFixture.played = true;
        playerFixture.homeScore = playerMatchResult.homeScore;
        playerFixture.awayScore = playerMatchResult.awayScore;
        teamsPlayed.add(playerFixture.homeTeamId);
        teamsPlayed.add(playerFixture.awayTeamId);
      }
      simFixtures(save, f => f.week === save.currentWeek && !f.played, teamsPlayed);
      save.currentWeek++;
    } else {
      simFixtures(save, f => !f.played, teamsPlayed);
    }
    Object.values(save.players).forEach(p => {
      const recovery = 15 + (p.attributes.stamina / 2);
      p.condition = Math.min(100, (p.condition ?? 100) + recovery);
      if (p.injury && p.injury.weeksRemaining > 0) {
        p.injury.weeksRemaining--;
        if (p.injury.weeksRemaining <= 0) p.injury = null;
      }
    });
    if (playerMatchResult?.playerStamina) {
      for (const [pId, stamina] of Object.entries(playerMatchResult.playerStamina)) {
        if (save.players[pId]) {
          save.players[pId].condition = Math.max(1, stamina);
          if (stamina < 40 && Math.random() < 0.05) save.players[pId].injury = { type: "Muscle Strain", weeksRemaining: Math.floor(Math.random() * 3) + 1 };
        }
      }
    }
    teamsPlayed.forEach(tid => {
      const team = save.teams[tid];
      if (team) {
        team.players.slice(0, 14).forEach(pId => {
          if (playerMatchResult?.playerStamina && playerMatchResult.playerStamina[pId] !== undefined) return;
          const p = save.players[pId];
          if (p && !p.injury) {
            const drop = 20 + Math.random() * 15 - (p.attributes.stamina / 4);
            p.condition = Math.max(1, p.condition - drop);
            if (p.condition < 40 && Math.random() < 0.02) p.injury = { type: "Knock", weeksRemaining: Math.floor(Math.random() * 2) + 1 };
          }
        });
      }
    });
    updateAllStandings(save);
    recalculateOverallRatings(save);
    const allPlayed = save.fixtures.every(f => f.played);
    if (allPlayed && save.fixtures.length > 0) return advanceSeason(save);
  } catch (err) {
    console.error("Critical error in processWeekResults:", err);
  }
  return save;
}

function getStyleAttackModifier(style) {
  switch (style) {
    case 'Tiki-Taka': return 0.08;
    case 'Gegenpress': return 0.12;
    case 'Fluid Counter': return 0.1;
    case 'Route One': return 0.05;
    case 'Park the Bus': return -0.08;
    default: return 0;
  }
}

function getMentalityModifier(mentality) {
  switch (mentality) {
    case 'ULTRA_ATTACKING': return 0.22;
    case 'ATTACKING': return 0.12;
    case 'DEFENSIVE': return -0.08;
    case 'ULTRA_DEFENSIVE': return -0.16;
    default: return 0;
  }
}

function simFixtures(save, filter, teamsPlayed) {
  const fixturesToSim = save.fixtures.filter(filter);
  const getTeamConditionMod = (team) => {
    const topPlayers = team.players.map(id => save.players[id]).filter(p => !!p && !p.injury).sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)).slice(0, 11);
    if (topPlayers.length === 0) return -0.5;
    const avgCondition = topPlayers.reduce((sum, p) => sum + (p.condition ?? 100), 0) / topPlayers.length;
    return (Math.min(90, avgCondition) - 90) / 40; 
  };
  for (const f of fixturesToSim) {
    const homeTeam = save.teams[f.homeTeamId];
    const awayTeam = save.teams[f.awayTeamId];
    if (!homeTeam || !awayTeam) { f.played = true; f.homeScore = 0; f.awayScore = 0; continue; }
    const homeAdv = 0.24;
    const reputationDiff = (homeTeam.reputation - awayTeam.reputation) / 28;
    const overallDiff = ((homeTeam.overall ?? 1) - (awayTeam.overall ?? 1)) / 5;
    const homeConditionMod = getTeamConditionMod(homeTeam);
    const awayConditionMod = getTeamConditionMod(awayTeam);
    const homeStyle = getStyleAttackModifier(homeTeam.tacticalStyle);
    const awayStyle = getStyleAttackModifier(awayTeam.tacticalStyle);
    const homeMentality = getMentalityModifier(homeTeam.mentality);
    const awayMentality = getMentalityModifier(awayTeam.mentality);
    const lambdaHome = Math.max(0.1, 1.2 + homeAdv + reputationDiff + overallDiff + homeConditionMod + homeStyle + homeMentality - awayMentality * 0.4);
    const lambdaAway = Math.max(0.1, 1.1 - reputationDiff - overallDiff + awayConditionMod + awayStyle + awayMentality - homeMentality * 0.4);
    f.homeScore = poisson(lambdaHome);
    f.awayScore = poisson(lambdaAway);
    f.played = true;
    teamsPlayed.add(f.homeTeamId);
    teamsPlayed.add(f.awayTeamId);
  }
}

function updateAllStandings(save) {
  for (const league of save.leagues) {
    const standingsMap = {};
    league.teams.forEach(tid => { standingsMap[tid] = { teamId: tid, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }; });
    const leagueFixtures = save.fixtures.filter(f => f.played && standingsMap[f.homeTeamId]);
    for (const f of leagueFixtures) {
      const h = standingsMap[f.homeTeamId];
      const a = standingsMap[f.awayTeamId];
      if (!h || !a) continue;
      const hs = f.homeScore || 0;
      const as = f.awayScore || 0;
      h.played++; a.played++; h.goalsFor += hs; h.goalsAgainst += as; a.goalsFor += as; a.goalsAgainst += hs;
      if (hs > as) { h.won++; h.points += 3; a.lost++; }
      else if (as > hs) { a.won++; a.points += 3; h.lost++; }
      else { h.drawn++; h.points++; a.drawn++; a.points++; }
    }
    league.standings = Object.values(standingsMap);
  }
}

function advanceSeason(save) {
  const sortStandings = (standings) => [...standings].sort((a, b) => { if (b.points !== a.points) return b.points - a.points; return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst); });
  const L1 = save.leagues.find(l => l.level === 1);
  const L2 = save.leagues.find(l => l.level === 2);
  const L3 = save.leagues.find(l => l.level === 3);
  const L4 = save.leagues.find(l => l.level === 4);
  if (!L1 || !L2 || !L3 || !L4) return save;
  const s1 = sortStandings(L1.standings);
  const s2 = sortStandings(L2.standings);
  const s3 = sortStandings(L3.standings);
  const s4 = sortStandings(L4.standings);
  const resolvePlayoff = (teams) => { if (teams.length === 0) return ""; const totalPoints = teams.reduce((sum, t) => sum + t.points, 0); let roll = Math.random() * (totalPoints || 1); for (const t of teams) { roll -= t.points; if (roll <= 0) return t.teamId; } return teams[0].teamId; };
  const rel1 = s1.slice(-3).map(s => s.teamId);
  const pro2 = [...s2.slice(0, 2).map(s => s.teamId), resolvePlayoff(s2.slice(2, 6))];
  const rel2 = s2.slice(-3).map(s => s.teamId);
  const pro3 = [...s3.slice(0, 2).map(s => s.teamId), resolvePlayoff(s3.slice(2, 6))];
  const rel3 = s3.slice(-4).map(s => s.teamId);
  const pro4 = [...s4.slice(0, 3).map(s => s.teamId), resolvePlayoff(s4.slice(3, 7))];
  const performSwap = (l, leave, enter) => { l.teams = l.teams.filter(t => !leave.includes(t)); l.teams.push(...enter.filter(t => t && t !== "")); };
  performSwap(L1, rel1, pro2); performSwap(L2, [...pro2, ...rel2], [...rel1, ...pro3]); performSwap(L3, [...pro3, ...rel3], [...rel2, ...pro4]); performSwap(L4, pro4, rel3);
  save.currentSeason = (save.currentSeason || 1) + 1; save.currentWeek = 1; save.fixtures = [];
  save.leagues.forEach(league => { league.standings = league.teams.map(tid => ({ teamId: tid, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })); save.fixtures.push(...generateFixtures(league.teams)); });
  return save;
}

function poisson(lambda) { let L = Math.exp(-lambda); let p = 1.0; let k = 0; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
