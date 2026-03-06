import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { loadSaveGame, writeSaveGame } from '$lib/data/store';

export const load: PageServerLoad = async ({ params }) => {
  const save = loadSaveGame();

  if (!save) {
    return {
      hasSave: false
    };
  }

  const team = save.teams[params.id];
  if (!team) {
    throw error(404, 'Team not found');
  }

  // Only pass the players that belong to this team to save bandwidth
  const teamPlayers = team.players.map((id) => save.players[id]).filter(Boolean);

  return {
    hasSave: true,
    team,
    players: teamPlayers,
    managerTeamId: save.manager.teamId
  };
};

export const actions: Actions = {
  saveTactics: async ({ request }) => {
    const data = await request.formData();
    const formation = data.get('formation') as string;
    const playerIdsJson = data.get('playerIds') as string;

    if (!formation || !playerIdsJson) {
      return fail(400, { message: 'Missing data' });
    }

    const save = loadSaveGame();
    if (!save) return fail(500, { message: 'No save found' });

    // Ensure we are only editing the manager's team
    const team = save.teams[save.manager.teamId];
    team.formation = formation;
    team.players = JSON.parse(playerIdsJson);

    writeSaveGame(save);

    return { success: true };
  }
};