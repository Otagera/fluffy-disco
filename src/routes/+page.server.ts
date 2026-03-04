import { loadSaveGame, writeSaveGame, processWeekResults } from '$lib/data/store';
import { generateSaveGame } from '$lib/data/generator';
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
  
  const leagueTeams: Record<string, any> = {};
  if (activeLeague) {
    activeLeague.teams.forEach(tId => {
      leagueTeams[tId] = save.teams[tId];
    });
  }

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
    hasAnalytics: !!save.lastMatchAnalytics
  };
};

export const actions: Actions = {
  startCareer: async ({ request }) => {
    const data = await request.formData();
    const name = data.get('managerName')?.toString() || 'The Gaffer';
    
    try {
      const newSave = generateSaveGame(name);
      writeSaveGame(newSave);
      throw redirect(303, '/');
    } catch (e) {
      if ((e as any).status === 303) throw e;
      console.error(e);
      return fail(500, { error: 'Failed to generate career' });
    }
  },
  deleteCareer: async () => {
    try {
      const savePath = path.resolve('data', 'savegame.json');
      if (fs.existsSync(savePath)) {
        fs.unlinkSync(savePath);
      }
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
