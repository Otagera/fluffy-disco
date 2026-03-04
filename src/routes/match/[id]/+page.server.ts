import { loadSaveGame, writeSaveGame, processWeekResults } from '$lib/data/store';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const save = loadSaveGame();
  
  if (!save) {
    throw error(404, 'No save game found');
  }

  const fixture = save.fixtures.find(f => f.id === params.id);
  if (!fixture) {
    throw error(404, 'Fixture not found');
  }

  const homeTeam = save.teams[fixture.homeTeamId];
  const awayTeam = save.teams[fixture.awayTeamId];

  if (!homeTeam || !awayTeam) {
    throw error(500, 'Teams for fixture not found in save data');
  }

  const homePlayers = homeTeam.players.map(pid => save.players[pid]);
  const awayPlayers = awayTeam.players.map(pid => save.players[pid]);

  return {
    fixture,
    homeTeam,
    awayTeam,
    homePlayers,
    awayPlayers
  };
};

export const actions: Actions = {
  processMatch: async ({ request, params }) => {
    const data = await request.formData();
    const homeScore = Number(data.get('homeScore'));
    const awayScore = Number(data.get('awayScore'));
    let playerStamina = undefined;
    let matchAnalytics = undefined;
    try {
      const staminaData = data.get('playerStamina');
      if (staminaData) playerStamina = JSON.parse(staminaData.toString());
      
      const analyticsData = data.get('matchAnalytics');
      if (analyticsData) matchAnalytics = JSON.parse(analyticsData.toString());
    } catch (e) {
      console.error("Failed to parse match data", e);
    }
    
    const save = loadSaveGame();
    if (!save) throw error(404, 'Save not found');

    const updatedSave = processWeekResults(save, {
      fixtureId: params.id || '',
      homeScore,
      awayScore,
      playerStamina
    });

    if (matchAnalytics) {
      updatedSave.lastMatchAnalytics = matchAnalytics;
    }

    writeSaveGame(updatedSave);
    
    throw redirect(303, '/');
  }
};
