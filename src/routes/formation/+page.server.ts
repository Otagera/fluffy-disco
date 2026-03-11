import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { loadSaveGame, writeSaveGame } from '$lib/data/store';

export const load: PageServerLoad = async () => {
  const save = loadSaveGame();

  if (!save) {
    throw redirect(302, '/');
  }

  const team = save.teams[save.manager.teamId];
  const players = team.players.map(id => save.players[id]).filter(Boolean);

  return {
    team,
    players,
    currentDate: save.currentDate
  };
};

export const actions: Actions = {
  saveTactics: async ({ request }) => {
    const data = await request.formData();
    const formation = data.get('formation') as string;
    const tacticalStyle = data.get('tacticalStyle') as string;
    const mentality = data.get('mentality') as string;
    const playerIdsJson = data.get('playerIds') as string;
    const customPositionsJson = data.get('customPositions') as string;
    const customRolesJson = data.get('customRoles') as string;

    if (!formation || !playerIdsJson) {
      return fail(400, { message: 'Missing data' });
    }

    const save = loadSaveGame();
    if (!save) return fail(500, { message: 'No save found' });

    const team = save.teams[save.manager.teamId];
    team.formation = formation;
    if (tacticalStyle) team.tacticalStyle = tacticalStyle;
    if (mentality) team.mentality = mentality;
    team.players = JSON.parse(playerIdsJson);
    
    if (customPositionsJson) {
      team.customPositions = JSON.parse(customPositionsJson);
    }
    if (customRolesJson) {
      team.customRoles = JSON.parse(customRolesJson);
    }

    writeSaveGame(save);

    return { success: true };
  }
};