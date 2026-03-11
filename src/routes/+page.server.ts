import { loadSaveGame, writeSaveGame, processWeekResults, saveNewGameToDB, advanceOneDay } from '$lib/data/store';
import { generateSaveGame } from '$lib/data/generator';
import { db, sqlite } from '$lib/data/db';
import * as schema from '$lib/data/schema';
import { eq, and, count } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async () => {
  const save = loadSaveGame();
  
  if (!save) {
    return { hasSave: false };
  }
  
  // Find the manager's team and league
  const managerTeamId = save.manager.teamId;
  const managerTeam = save.teams[managerTeamId];
  const activeLeague = save.leagues.find(l => l.teams.includes(managerTeamId));
  
  // Find the next fixture for the manager's team
  const nextFixture = save.fixtures.find(f => !f.played && (f.homeTeamId === managerTeamId || f.awayTeamId === managerTeamId));
  
  let opponentTeam = null;
  if (nextFixture) {
    const oppId = nextFixture.homeTeamId === managerTeamId ? nextFixture.awayTeamId : nextFixture.homeTeamId;
    opponentTeam = save.teams[oppId];
  }
  
  const unreadInboxCount = db.select({ value: count() })
    .from(schema.inboxMessages)
    .where(and(
      eq(schema.inboxMessages.teamId, managerTeamId),
      eq(schema.inboxMessages.isRead, false)
    ))
    .get();

  return {
    hasSave: true,
    manager: save.manager,
    team: managerTeam,
    activeLeagueId: activeLeague?.id,
    leagues: save.leagues,
    teams: save.teams,
    nextFixture,
    opponentTeam,
    week: save.currentWeek,
    currentSeason: save.currentSeason || 1,
    currentDate: save.currentDate,
    unreadInboxCount: unreadInboxCount?.value || 0,
    hasAnalytics: !!save.lastMatchAnalytics
  };
};

export const actions: Actions = {
  advanceDay: async () => {
    const save = loadSaveGame();
    if (!save) return fail(404, { error: 'Save not found' });
    
    const result = advanceOneDay(save);
    return { success: true, ...result, currentDate: save.currentDate };
  },
  startCareer: async ({ request }) => {
    const data = await request.formData();
    const name = data.get('managerName')?.toString() || 'The Gaffer';
    const style = data.get('leagueStyle')?.toString() || 'Global';
    
    try {
      const newSave = generateSaveGame(name, style);
      saveNewGameToDB(newSave);
      throw redirect(303, '/');
    } catch (e) {
      if ((e as any).status === 303) throw e;
      console.error(e);
      return fail(500, { error: 'Failed to generate career' });
    }
  },
  deleteCareer: async () => {
    try {
      sqlite.exec('DELETE FROM gamestate; DELETE FROM standings; DELETE FROM fixture_goals; DELETE FROM league_news; DELETE FROM fixtures; DELETE FROM player_stats; DELETE FROM players; DELETE FROM teams; DELETE FROM leagues;');
      throw redirect(303, '/');
    } catch (e) {
      if ((e as any).status === 303) throw e;
      console.error(e);
      return fail(500, { error: 'Failed to delete career' });
    }
  },
  advanceSeason: async () => {
    try {
      const save = loadSaveGame();
      if (!save) return fail(404, { error: 'Save not found' });
      
      const updatedSave = processWeekResults(save);
      writeSaveGame(updatedSave);
      throw redirect(303, '/');
    } catch (e) {
      if ((e as any).status === 303) throw e;
      console.error("End of Season Error:", e);
      return fail(500, { error: 'Failed to advance season' });
    }
  }
};
