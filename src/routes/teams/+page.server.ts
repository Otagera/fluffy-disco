import type { PageServerLoad } from './$types';
import { loadSaveGame } from '$lib/data/store';

export const load: PageServerLoad = async () => {
  const save = loadSaveGame();

  if (!save) {
    return {
      hasSave: false,
      teams: [],
      players: {}
    };
  }

  return {
    hasSave: true,
    managerTeamId: save.manager.teamId,
    teams: Object.values(save.teams),
    players: save.players
  };
};
