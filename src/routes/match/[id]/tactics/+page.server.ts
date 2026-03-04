import { loadSaveGame } from '$lib/data/store';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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
    awayPlayers,
    managerTeamId: save.manager.teamId
  };
};
