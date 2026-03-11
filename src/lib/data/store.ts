import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import * as schema from './schema';
import type { SaveGame, PlayerProfile, TeamProfile, League, Fixture, Standing } from './types';
import { generateFixtures } from './generator';
import { calculatePlayerOverall, calculateTeamOverall } from './ratings';
import { getTacticalCompatibility } from '../engine/ai/Compatibility';

export function saveNewGameToDB(save: SaveGame) {
  db.transaction((tx) => {
    // 1. Clear existing data
    tx.delete(schema.gamestate).run();
    tx.delete(schema.standings).run();
    tx.delete(schema.fixtureGoals).run();
    tx.delete(schema.leagueNews).run();
    tx.delete(schema.fixtures).run();
    tx.delete(schema.players).run();
    tx.delete(schema.teams).run();
    tx.delete(schema.leagues).run();

    // 2. Insert Leagues
    for (const l of save.leagues) {
      tx.insert(schema.leagues).values({
        id: l.id,
        name: l.name,
        level: l.level,
      }).run();
    }

    // 3. Insert Teams
    for (const t of Object.values(save.teams)) {
      const league = save.leagues.find(l => l.teams.includes(t.id));
      tx.insert(schema.teams).values({
        id: t.id,
        leagueId: league?.id || '',
        name: t.name,
        reputation: t.reputation,
        overall: t.overall || 50,
        tacticalStyle: t.tacticalStyle,
        mentality: t.mentality,
        formation: t.formation,
        stadiumName: t.stadiumName || null,
        stadiumCapacity: t.stadiumCapacity || null,
        primaryColor: t.primaryColor || null,
        secondaryColor: t.secondaryColor || null,
        transferBudget: t.transferBudget || 0,
        wageBudget: t.wageBudget || 0,
        managerConfidence: t.managerConfidence || 50,
        playerIds: t.players,
        customPositions: t.customPositions || null,
        customRoles: t.customRoles || null,
      }).run();
    }

    // 4. Initialize Standings (Now safe because teams exist)
    for (const l of save.leagues) {
      for (const teamId of l.teams) {
        tx.insert(schema.standings).values({
          leagueId: l.id,
          teamId: teamId,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
        }).run();
      }
    }

    // 5. Insert Players
    for (const p of Object.values(save.players)) {
      const team = Object.values(save.teams).find(t => t.players.includes(p.id));
      
      tx.insert(schema.players).values({
        id: p.id,
        teamId: team?.id || null,
        name: p.name,
        number: p.number || null,
        birthDate: p.birthDate,
        role: p.role,
        potential: p.potential,
        overall: p.overall || 50,
        condition: p.condition,
        matchSharpness: p.matchSharpness || 50,
        morale: p.morale || 50,
        preferredFoot: p.preferredFoot || 'Right',
        wage: p.wage || 0,
        contractExpires: p.contractExpires || null,
        injury: p.injury,
        attributes: p.attributes,
        hiddenTraits: p.hiddenTraits,
        seasonStats: p.seasonStats,
      }).run();
    }

    // 6. Insert Fixtures
    for (const f of save.fixtures) {
      tx.insert(schema.fixtures).values({
        id: f.id,
        leagueId: f.leagueId,
        week: f.week,
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        played: f.played,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
      }).run();

      if (f.goalEvents) {
        for (const g of f.goalEvents) {
          tx.insert(schema.fixtureGoals).values({
            fixtureId: f.id,
            playerId: g.playerId,
            teamId: g.teamId,
            minute: g.minute,
          }).run();
        }
      }
    }

    // 7. Insert GameState
    tx.insert(schema.gamestate).values({
      id: 1,
      managerName: save.manager.name,
      managerTeamId: save.manager.teamId,
      currentSeason: save.currentSeason,
      currentDate: save.currentDate,
      currentWeek: save.currentWeek,
    }).run();
  });
}

export function loadSaveGame(): SaveGame | null {
  try {
    const gs = db.select().from(schema.gamestate).where(eq(schema.gamestate.id, 1)).get();
    if (!gs) return null;

    const save: SaveGame = {
      manager: { name: gs.managerName, teamId: gs.managerTeamId },
      currentSeason: gs.currentSeason,
      currentDate: gs.currentDate,
      currentWeek: gs.currentWeek,
      leagues: [],
      teams: {},
      players: {},
      fixtures: []
    };

    const leagues = db.select().from(schema.leagues).all();
    for (const l of leagues) {
      const news = db.select().from(schema.leagueNews).where(eq(schema.leagueNews.leagueId, l.id)).all();
      const leagueStandings = db.select().from(schema.standings).where(eq(schema.standings.leagueId, l.id)).all();
      const leagueTeams = db.select().from(schema.teams).where(eq(schema.teams.leagueId, l.id)).all();

      save.leagues.push({
        id: l.id,
        name: l.name,
        level: l.level,
        teams: leagueTeams.map(t => t.id),
        standings: leagueStandings as any,
        news: news as any[],
      });
    }

    const teams = db.select().from(schema.teams).all();
    for (const t of teams) {
      save.teams[t.id] = { 
        ...t, 
        players: t.playerIds || [], // Use persisted order
        stadiumName: t.stadiumName || undefined,
        stadiumCapacity: t.stadiumCapacity || undefined,
        primaryColor: t.primaryColor || undefined,
        secondaryColor: t.secondaryColor || undefined,
        overall: t.overall || 50,
        customPositions: t.customPositions as any,
        customRoles: t.customRoles as any
      } as any;
    }

    const players = db.select().from(schema.players).all();
    for (const p of players) {
      const player: PlayerProfile = {
        ...p,
        attributes: p.attributes as any,
        hiddenTraits: p.hiddenTraits as any,
        seasonStats: p.seasonStats as any,
        injury: p.injury as any,
      };
      save.players[p.id] = player;
      
      // If team doesn't have persisted playerIds (legacy), populate it
      if (p.teamId && save.teams[p.teamId]) {
        if (!teams.find(t => t.id === p.teamId)?.playerIds) {
            save.teams[p.teamId].players.push(p.id);
        }
      }
    }

    const fixtures = db.select().from(schema.fixtures).all();
    for (const f of fixtures) {
      const goalEvents = db.select().from(schema.fixtureGoals).where(eq(schema.fixtureGoals.fixtureId, f.id)).all();
      save.fixtures.push({
        ...f,
        goalEvents: goalEvents.map(g => ({ playerId: g.playerId, minute: g.minute, teamId: g.teamId })),
      });
    }

    const inbox = db.select().from(schema.inboxMessages)
      .where(eq(schema.inboxMessages.teamId, save.manager.teamId))
      .orderBy(sql`${schema.inboxMessages.date} DESC`)
      .all();
    save.inbox = inbox as any;

    recalculateOverallRatings(save);
    return save;
  } catch (error) {
    console.error("Error loading save game from DB:", error);
    return null;
  }
}

export function writeSaveGame(saveData: SaveGame) {
  try {
    db.transaction((tx) => {
      tx.update(schema.gamestate)
        .set({
          currentSeason: saveData.currentSeason,
          currentDate: saveData.currentDate,
          currentWeek: saveData.currentWeek,
        })
        .where(eq(schema.gamestate.id, 1))
        .run();

      for (const t of Object.values(saveData.teams)) {
        tx.update(schema.teams)
          .set({
            tacticalStyle: t.tacticalStyle,
            mentality: t.mentality,
            formation: t.formation,
            overall: t.overall || 50,
            transferBudget: t.transferBudget || 0,
            wageBudget: t.wageBudget || 0,
            managerConfidence: t.managerConfidence || 50,
            playerIds: t.players,
            customPositions: t.customPositions || null,
            customRoles: t.customRoles || null,
          })
          .where(eq(schema.teams.id, t.id))
          .run();
      }

      for (const p of Object.values(saveData.players)) {
        tx.update(schema.players)
          .set({
            condition: p.condition,
            overall: p.overall || 50,
            matchSharpness: p.matchSharpness || 50,
            morale: p.morale || 50,
            injury: p.injury,
            seasonStats: p.seasonStats,
          })
          .where(eq(schema.players.id, p.id))
          .run();
      }

      for (const f of saveData.fixtures) {
        tx.update(schema.fixtures)
          .set({
            played: f.played,
            homeScore: f.homeScore ?? null,
            awayScore: f.awayScore ?? null,
          })
          .where(eq(schema.fixtures.id, f.id))
          .run();

        if (f.played && f.goalEvents) {
          tx.delete(schema.fixtureGoals).where(eq(schema.fixtureGoals.fixtureId, f.id)).run();
          for (const g of f.goalEvents) {
            tx.insert(schema.fixtureGoals).values({
              fixtureId: f.id,
              playerId: g.playerId,
              teamId: g.teamId,
              minute: g.minute,
            }).run();
          }
        }
      }

      for (const l of saveData.leagues) {
        if (l.news) {
          tx.delete(schema.leagueNews).where(eq(schema.leagueNews.leagueId, l.id)).run();
          for (const n of l.news) {
            tx.insert(schema.leagueNews).values({
              id: n.id,
              leagueId: l.id,
              week: n.week,
              headline: n.headline,
              type: n.type,
              relatedPlayerId: n.relatedPlayerId ?? null,
              relatedTeamId: n.relatedTeamId ?? null,
            }).run();
          }
        }

        for (const s of l.standings) {
          tx.insert(schema.standings)
            .values({
              leagueId: l.id,
              teamId: s.teamId,
              played: s.played,
              won: s.won,
              drawn: s.drawn,
              lost: s.lost,
              goalsFor: s.goalsFor,
              goalsAgainst: s.goalsAgainst,
              points: s.points,
            })
            .onConflictDoUpdate({
              target: [schema.standings.leagueId, schema.standings.teamId],
              set: {
                played: s.played,
                won: s.won,
                drawn: s.drawn,
                lost: s.lost,
                goalsFor: s.goalsFor,
                goalsAgainst: s.goalsAgainst,
                points: s.points,
              },
            })
            .run();
        }
      }
    });
    return true;
  } catch (error) {
    console.error("Error writing save game to DB:", error);
    return false;
  }
}

function recalculateOverallRatings(save: SaveGame) {
  for (const player of Object.values(save.players)) player.overall = calculatePlayerOverall(player, save.currentDate);
  for (const team of Object.values(save.teams)) team.overall = calculateTeamOverall(team, save.players, save.currentDate);
}

export function addInboxMessage(save: SaveGame, message: Omit<InboxMessage, 'id' | 'isRead'>) {
  const msg: InboxMessage = {
    ...message,
    id: `msg_${Math.random().toString(36).slice(2, 11)}`,
    isRead: false
  };
  
  if (!save.inbox) save.inbox = [];
  save.inbox.unshift(msg);

  // Persist to DB
  db.insert(schema.inboxMessages).values({
    id: msg.id,
    teamId: msg.teamId,
    date: msg.date,
    sender: msg.sender,
    subject: msg.subject,
    body: msg.body,
    type: msg.type,
    isRead: false,
    isUrgent: msg.isUrgent,
    relatedEntityId: msg.relatedEntityId
  }).run();

  return msg;
}

export function advanceOneDay(save: SaveGame): { mustStop: boolean; reason?: string } {
  const date = new Date(save.currentDate);
  date.setDate(date.getDate() + 1);
  save.currentDate = date.toISOString().split('T')[0];

  let mustStop = false;
  let reason = '';

  // 1. Check for Birthdays
  const managerTeam = save.teams[save.manager.teamId];
  if (managerTeam) {
    for (const pid of managerTeam.players) {
      const p = save.players[pid];
      if (p && p.birthDate.endsWith(save.currentDate.slice(5))) {
        const newAge = calculateAge(p.birthDate, save.currentDate);
        addInboxMessage(save, {
          teamId: managerTeam.id,
          date: save.currentDate,
          sender: 'Assistant Manager',
          subject: `Happy Birthday: ${p.name}`,
          body: `${p.name} turns ${newAge} today! The squad had a small celebration in training. He looks sharp and ready for the next match.`,
          type: 'BIRTHDAY',
          isUrgent: false,
          relatedEntityId: p.id
        });
      }
    }
  }

  // 2. Check for Match Day
  const todayFixture = save.fixtures.find(f => 
    f.played === false && 
    (f.homeTeamId === save.manager.teamId || f.awayTeamId === save.manager.teamId) &&
    f.date === save.currentDate
  );

  if (todayFixture) {
    mustStop = true;
    reason = 'Match Day';
  }

  // 3. Update DB
  db.update(schema.gamestate)
    .set({ currentDate: save.currentDate })
    .where(eq(schema.gamestate.id, 1))
    .run();

  // Recalculate ratings in case of aging
  recalculateOverallRatings(save);

  return { mustStop, reason };
}

export function processWeekResults(save: any, playerMatchResult: any) {
  try {
    const teamsPlayed = new Set<string>();
    if (playerMatchResult) {
      const playerFixture = save.fixtures.find((f: any) => f.id === playerMatchResult.fixtureId);
      if (playerFixture) {
        playerFixture.played = true;
        playerFixture.homeScore = playerMatchResult.homeScore;
        playerFixture.awayScore = playerMatchResult.awayScore;
        teamsPlayed.add(playerFixture.homeTeamId);
        teamsPlayed.add(playerFixture.awayTeamId);

        const homeTeam = save.teams[playerFixture.homeTeamId];
        const awayTeam = save.teams[playerFixture.awayTeamId];
        
        const processPlayedTeamStats = (team: any, isHome: boolean, opponentScore: number) => {
          const players = team.players.slice(0, 11).map((id: string) => save.players[id]).filter(Boolean);
          players.forEach((p: any) => {
            if (!p.seasonStats) p.seasonStats = { apps: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, averageRating: 0 };
            p.seasonStats.apps++;
          });
          const gk = players.find((p: any) => p.role === 'GK');
          if (opponentScore === 0 && gk) {
            if (!gk.seasonStats) gk.seasonStats = { apps: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, averageRating: 0 };
            gk.seasonStats.cleanSheets++;
          }
        };

        if (homeTeam && awayTeam) {
            processPlayedTeamStats(homeTeam, true, playerMatchResult.awayScore);
            processPlayedTeamStats(awayTeam, false, playerMatchResult.homeScore);
        }

        if (playerMatchResult.matchAnalytics && playerMatchResult.matchAnalytics.events) {
            const events = playerMatchResult.matchAnalytics.events;
            
            const homePlayers = homeTeam?.players.slice(0, 11).map((id: string) => save.players[id]) || [];
            const awayPlayers = awayTeam?.players.slice(0, 11).map((id: string) => save.players[id]) || [];
            const fullSquad = [...homePlayers, ...awayPlayers];
            if (!playerFixture.goalEvents) playerFixture.goalEvents = [];

            for (let i = 0; i < events.length; i++) {
                const event = events[i];
                if (event.type === 'goal' && event.playerId !== undefined) {
                    const scorer = fullSquad[event.playerId];
                    if (scorer) {
                        if (!scorer.seasonStats) scorer.seasonStats = { apps: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, averageRating: 0 };
                        scorer.seasonStats.goals++;

                        const minute = Math.min(90, Math.ceil(event.time / 60) || 1);
                        
                        playerFixture.goalEvents.push({
                            playerId: scorer.id,
                            teamId: event.team === 0 ? playerFixture.homeTeamId : playerFixture.awayTeamId,
                            minute: minute
                        });

                        for (let j = i - 1; j >= 0; j--) {
                            const prevEvent = events[j];
                            if (prevEvent.time < event.time - 10) break;
                            if (prevEvent.type === 'pass' && prevEvent.team === event.team && prevEvent.playerId !== undefined && prevEvent.playerId !== event.playerId) {
                                const assister = fullSquad[prevEvent.playerId];
                                if (assister) {
                                    if (!assister.seasonStats) assister.seasonStats = { apps: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, averageRating: 0 };
                                    assister.seasonStats.assists++;
                                }
                                break;
                            }
                        }
                    }
                } else if (event.type === 'foul' && event.foulerId !== undefined) {
                    const fouler = fullSquad[event.foulerId];
                    if (fouler) {
                        if (!fouler.seasonStats) fouler.seasonStats = { apps: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, averageRating: 0 };
                        if (event.yellowCard) fouler.seasonStats.yellowCards++;
                        if (event.redCard) fouler.seasonStats.redCards++;
                    }
                }
            }
        }
      }
      simFixtures(save, (f: any) => f.week === save.currentWeek && !f.played, teamsPlayed);
      generateNews(save, save.currentWeek);
      save.currentWeek++;
    } else {
      simFixtures(save, f => !f.played, teamsPlayed);
      generateNews(save, save.currentWeek);
    }
    Object.values(save.players).forEach((p: any) => {
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
          save.players[pId].condition = Math.max(1, stamina as number);
          if ((stamina as number) < 40 && Math.random() < 0.05) save.players[pId].injury = { type: "Muscle Strain", weeksRemaining: Math.floor(Math.random() * 3) + 1 };
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
    const allPlayed = save.fixtures.every((f: any) => f.played);
    if (allPlayed && save.fixtures.length > 0) return advanceSeason(save);
  } catch (err) {
    console.error("Critical error in processWeekResults:", err);
  }
  return save;
}

function getStyleAttackModifier(style: string) {
  switch (style) {
    case 'Tiki-Taka': return 0.08;
    case 'Gegenpress': return 0.12;
    case 'Fluid Counter': return 0.1;
    case 'Route One': return 0.05;
    case 'Park the Bus': return -0.08;
    default: return 0;
  }
}

function getMentalityModifier(mentality: string) {
  switch (mentality) {
    case 'ULTRA_ATTACKING': return 0.22;
    case 'ATTACKING': return 0.12;
    case 'DEFENSIVE': return -0.08;
    case 'ULTRA_DEFENSIVE': return -0.16;
    default: return 0;
  }
}

function simFixtures(save: any, filter: (f: any) => boolean, teamsPlayed: Set<string>) {
  const fixturesToSim = save.fixtures.filter(filter);
  
  const getStartingXI = (team: any) => {
    return team.players
      .map((id: string) => save.players[id])
      .filter((p: any) => !!p && !p.injury)
      .sort((a: any, b: any) => (b.overall ?? 0) - (a.overall ?? 0))
      .slice(0, 11);
  };

  const getTeamConditionMod = (topPlayers: any[]) => {
    if (topPlayers.length === 0) return -0.5;
    const avgCondition = topPlayers.reduce((sum: number, p: any) => sum + (p.condition ?? 100), 0) / topPlayers.length;
    return (Math.min(90, avgCondition) - 90) / 40; 
  };

  const distributeStats = (scorersCount: number, teamPlayers: any[], opponentScore: number, fixture: any, teamId: string) => {
    if (teamPlayers.length === 0) return;

    const gk = teamPlayers.find(p => p.role === 'GK');
    teamPlayers.forEach(p => {
      if (!p.seasonStats) p.seasonStats = { apps: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, averageRating: 0 };
      p.seasonStats.apps++;
    });

    if (opponentScore === 0 && gk) {
      if (!gk.seasonStats) gk.seasonStats = { apps: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0, averageRating: 0 };
      gk.seasonStats.cleanSheets++;
    }

    const outfielders = teamPlayers.filter(p => p.role !== 'GK');
    if (outfielders.length === 0) return;

    if (!fixture.goalEvents) fixture.goalEvents = [];

    for (let i = 0; i < scorersCount; i++) {
      const scorerWeights = outfielders.map(p => {
        let weight = p.attributes.finishing * 2 + p.attributes.positioning;
        if (p.role === 'FWD') weight *= 2.5;
        if (p.role === 'MID') weight *= 1.2;
        return weight;
      });
      const totalScorerWeight = scorerWeights.reduce((a, b) => a + b, 0);
      let scorerRoll = Math.random() * totalScorerWeight;
      let scorerIdx = 0;
      for (let j = 0; j < scorerWeights.length; j++) {
        scorerRoll -= scorerWeights[j];
        if (scorerRoll <= 0) { scorerIdx = j; break; }
      }
      const scorer = outfielders[scorerIdx];
      scorer.seasonStats.goals++;

      let minute;
      const roll = Math.random();
      if (roll < 0.15) minute = getRandomInt(40, 45);
      else if (roll < 0.4) minute = getRandomInt(80, 90);
      else if (roll < 0.7) minute = getRandomInt(46, 80);
      else minute = getRandomInt(1, 39);
      
      fixture.goalEvents.push({
        playerId: scorer.id,
        teamId: teamId,
        minute: minute
      });

      if (Math.random() < 0.7) {
        const assistWeights = outfielders.map((p, idx) => {
          if (idx === scorerIdx) return 0;
          let weight = p.attributes.passing * 2 + p.attributes.vision;
          if (p.role === 'MID') weight *= 2.0;
          if (p.role === 'FWD') weight *= 1.5;
          if (p.role === 'DEF') weight *= 0.5;
          return weight;
        });
        const totalAssistWeight = assistWeights.reduce((a, b) => a + b, 0);
        if (totalAssistWeight > 0) {
          let assistRoll = Math.random() * totalAssistWeight;
          for (let j = 0; j < assistWeights.length; j++) {
            assistRoll -= assistWeights[j];
            if (assistRoll <= 0) { 
              outfielders[j].seasonStats.assists++; 
              break; 
            }
          }
        }
      }
    }
  };

  for (const f of fixturesToSim) {
    const homeTeam = save.teams[f.homeTeamId];
    const awayTeam = save.teams[f.awayTeamId];
    if (!homeTeam || !awayTeam) { f.played = true; f.homeScore = 0; f.awayScore = 0; continue; }
    
    const homeXI = getStartingXI(homeTeam);
    const awayXI = getStartingXI(awayTeam);

    const homeAdv = 0.24;
    const reputationDiff = (homeTeam.reputation - awayTeam.reputation) / 28;
    const overallDiff = ((homeTeam.overall ?? 1) - (awayTeam.overall ?? 1)) / 5;
    const homeConditionMod = getTeamConditionMod(homeXI);
    const awayConditionMod = getTeamConditionMod(awayXI);
    const homeStyle = getStyleAttackModifier(homeTeam.tacticalStyle);
    const awayStyle = getStyleAttackModifier(awayTeam.tacticalStyle);
    const homeMentality = getMentalityModifier(homeTeam.mentality);
    const awayMentality = getMentalityModifier(awayTeam.mentality);
    
    const lambdaHome = Math.max(0.1, 1.2 + homeAdv + reputationDiff + overallDiff + homeConditionMod + homeStyle + homeMentality - awayMentality * 0.4);
    const lambdaAway = Math.max(0.1, 1.1 - reputationDiff - overallDiff + awayConditionMod + awayStyle + awayMentality - homeMentality * 0.4);
    
    f.homeScore = poisson(lambdaHome);
    f.awayScore = poisson(lambdaAway);
    f.played = true;

    distributeStats(f.homeScore, homeXI, f.awayScore, f, f.homeTeamId);
    distributeStats(f.awayScore, awayXI, f.homeScore, f, f.awayTeamId);

    teamsPlayed.add(f.homeTeamId);
    teamsPlayed.add(f.awayTeamId);
  }
}

function generateNews(save: SaveGame, week: number) {
    for (const league of save.leagues) {
        if (!league.news) league.news = [];
        
        const weekFixtures = save.fixtures.filter(f => f.week === week && league.teams.includes(f.homeTeamId));
        
        for (const f of weekFixtures) {
            const margin = Math.abs((f.homeScore || 0) - (f.awayScore || 0));
            if (margin >= 4) {
                const winner = f.homeScore! > f.awayScore! ? save.teams[f.homeTeamId] : save.teams[f.awayTeamId];
                const loser = f.homeScore! > f.awayScore! ? save.teams[f.awayTeamId] : save.teams[f.homeTeamId];
                const scoreStr = f.homeScore! > f.awayScore! ? `${f.homeScore}-${f.awayScore}` : `${f.awayScore}-${f.homeScore}`;
                
                league.news.push({
                    id: `n_${Math.random().toString(36).slice(2, 11)}`,
                    week,
                    headline: `${winner.name} dominant in ${scoreStr} thrashing of ${loser.name}!`,
                    type: 'BIG_RESULT',
                    relatedTeamId: winner.id
                });
            }

            if (f.goalEvents) {
                const scorerCounts: Record<string, number> = {};
                for (const g of f.goalEvents) {
                    scorerCounts[g.playerId] = (scorerCounts[g.playerId] || 0) + 1;
                }
                for (const [pId, count] of Object.entries(scorerCounts)) {
                    if (count >= 3) {
                        const player = save.players[pId];
                        league.news.push({
                            id: `n_${Math.random().toString(36).slice(2, 11)}`,
                            week,
                            headline: `Hat-trick hero! ${player.name} hits ${count} in ${save.teams[f.homeTeamId].name} vs ${save.teams[f.awayTeamId].name}`,
                            type: 'HAT_TRICK',
                            relatedPlayerId: pId,
                            relatedTeamId: player.teamId
                        });
                    }
                }
            }
        }

        const allPlayersInLeague = Object.values(save.players).filter(p => league.teams.includes(p.teamId!));
        const topScorer = allPlayersInLeague.sort((a, b) => (b.seasonStats?.goals || 0) - (a.seasonStats?.goals || 0))[0];
        
        if (topScorer && (topScorer.seasonStats?.goals || 0) >= 5) {
            const milestone = topScorer.seasonStats!.goals;
            if (milestone % 5 === 0) {
                const headline = `${topScorer.name} is on fire! Hits ${milestone} goals for the season.`;
                if (!league.news.some(n => n.headline === headline)) {
                    league.news.push({
                        id: `n_${Math.random().toString(36).slice(2, 11)}`,
                        week,
                        headline,
                        type: 'GOLDEN_BOOT',
                        relatedPlayerId: topScorer.id
                    });
                }
            }
        }

        const sorted = [...league.standings].sort((a, b) => b.points - a.points);
        if (sorted.length >= 2) {
            const first = sorted[0].teamId;
            const second = sorted[1].teamId;
            const clash = weekFixtures.find(f => (f.homeTeamId === first && f.awayTeamId === second) || (f.homeTeamId === second && f.awayTeamId === first));
            if (clash) {
                league.news.push({
                    id: `n_${Math.random().toString(36).slice(2, 11)}`,
                    week,
                    headline: `TITLE CLASH: ${save.teams[first].name} and ${save.teams[second].name} face off in a massive week ${week} fixture.`,
                    type: 'TOP_CLASH',
                    relatedTeamId: first
                });
            }
        }
    }
}

function updateAllStandings(save: SaveGame) {
  for (const league of save.leagues) {
    const standingsMap: Record<string, Standing> = {};
    league.teams.forEach(tid => { standingsMap[tid] = { teamId: tid, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 } as any; });
    
    const leagueFixtures = save.fixtures.filter((f: any) => f.played && f.leagueId === league.id);
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

function advanceSeason(save: SaveGame) {
  const sortStandings = (standings: Standing[]) => [...standings].sort((a, b) => { if (b.points !== a.points) return b.points - a.points; return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst); });
  const L1 = save.leagues.find(l => l.level === 1);
  const L2 = save.leagues.find(l => l.level === 2);
  const L3 = save.leagues.find(l => l.level === 3);
  const L4 = save.leagues.find(l => l.level === 4);
  if (!L1 || !L2 || !L3 || !L4) return save;
  const s1 = sortStandings(L1.standings);
  const s2 = sortStandings(L2.standings);
  const s3 = sortStandings(L3.standings);
  const s4 = sortStandings(L4.standings);
  const resolvePlayoff = (teams: any[]) => { if (teams.length === 0) return ""; const totalPoints = teams.reduce((sum, t) => sum + t.points, 0); let roll = Math.random() * (totalPoints || 1); for (const t of teams) { roll -= t.points; if (roll <= 0) return t.teamId; } return teams[0].teamId; };
  const rel1 = s1.slice(-3).map(s => s.teamId);
  const pro2 = [...s2.slice(0, 2).map(s => s.teamId), resolvePlayoff(s2.slice(2, 6))];
  const rel2 = s2.slice(-3).map(s => s.teamId);
  const pro3 = [...s3.slice(0, 2).map(s => s.teamId), resolvePlayoff(s3.slice(2, 6))];
  const rel3 = s3.slice(-4).map(s => s.teamId);
  const pro4 = [...s4.slice(0, 3).map(s => s.teamId), resolvePlayoff(s4.slice(3, 7))];
  const performSwap = (l: League, leave: string[], enter: string[]) => { l.teams = l.teams.filter(t => !leave.includes(t)); l.teams.push(...enter.filter(t => t && t !== "")); };
  performSwap(L1, rel1, pro2); performSwap(L2, [...pro2, ...rel2], [...rel1, ...pro3]); performSwap(L3, [...pro3, ...rel3], [...rel2, ...pro4]); performSwap(L4, pro4, rel3);
  save.currentSeason = (save.currentSeason || 1) + 1; save.currentWeek = 1; save.fixtures = [];
  save.leagues.forEach(league => { league.standings = league.teams.map(tid => ({ teamId: tid, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 })); save.fixtures.push(...generateFixtures(league.teams, league.id)); });
  return save;
}

function poisson(lambda: number) { let L = Math.exp(-lambda); let p = 1.0; let k = 0; do { k++; p *= Math.random(); } while (p > L); return k - 1; }

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
