import { loadSaveGame } from '$lib/data/store';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const save = loadSaveGame();
  
  if (!save) {
    throw error(404, 'No save game found');
  }

  // Get active league based on query param or default to manager's team league
  let activeLeagueId = url.searchParams.get('id');
  
  if (!activeLeagueId) {
    const managerTeam = save.teams[save.manager.teamId];
    if (managerTeam) {
      const league = save.leagues.find(l => l.teams.includes(managerTeam.id));
      if (league) {
        activeLeagueId = league.id;
      }
    }
  }

  if (!activeLeagueId && save.leagues.length > 0) {
    activeLeagueId = save.leagues[0].id;
  }

  const activeLeague = save.leagues.find(l => l.id === activeLeagueId);
  if (!activeLeague) {
    throw error(404, 'League not found');
  }

  // Filter fixtures to only this league
  const leagueFixtures = save.fixtures.filter(f => activeLeague.teams.includes(f.homeTeamId));

  return {
    save, // Passing entire save for team names/data, might want to optimize later
    leagues: save.leagues.map(l => ({ id: l.id, name: l.name })),
    activeLeagueId,
    activeLeague,
    leagueFixtures,
    managerTeamId: save.manager.teamId,
    currentWeek: save.currentWeek
  };
};
