import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { loadSaveGame, writeSaveGame, toggleShortlist, toggleScoutingPriority } from '$lib/data/store';
import { calculateAge } from '$lib/data/ratings';

export const load: PageServerLoad = async ({ url }) => {
  const save = loadSaveGame();

  if (!save) {
    return {
      hasSave: false,
      players: [],
      totalCount: 0,
      shortlist: [],
      shortlistedPlayers: [],
      scoutingReports: [],
      managerTeamId: '',
      currentDate: '',
      teams: {}
    };
  }

  const page = Number(url.searchParams.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const searchQuery = url.searchParams.get('search')?.toLowerCase() || '';
  const roleFilter = url.searchParams.get('role') || '';
  const minAge = Number(url.searchParams.get('minAge') || '15');
  const maxAge = Number(url.searchParams.get('maxAge') || '45');
  const knowledgeFilter = url.searchParams.get('knowledge') || ''; // '0', '1', '2'

  let allPlayers = Object.values(save.players);

  // Apply filters
  let filteredPlayers = allPlayers.filter(p => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery)) return false;
    if (roleFilter && p.role !== roleFilter) return false;
    
    const age = calculateAge(p.birthDate, save.currentDate);
    if (age < minAge || age > maxAge) return false;

    if (knowledgeFilter !== '') {
      const report = (save.scoutingReports || []).find(r => r.playerId === p.id && r.teamId === save.manager.teamId);
      const level = p.teamId === save.manager.teamId ? 2 : (report?.level || 0);
      if (level.toString() !== knowledgeFilter) return false;
    }

    return true;
  });

  const totalCount = filteredPlayers.length;

  // Sorting: Default by OVR (if known) or Name
  filteredPlayers.sort((a, b) => {
    const reportA = (save.scoutingReports || []).find(r => r.playerId === a.id && r.teamId === save.manager.teamId);
    const reportB = (save.scoutingReports || []).find(r => r.playerId === b.id && r.teamId === save.manager.teamId);
    
    const levelA = a.teamId === save.manager.teamId ? 2 : (reportA?.level || 0);
    const levelB = b.teamId === save.manager.teamId ? 2 : (reportB?.level || 0);

    if (levelA === 2 && levelB === 2) {
      return (b.overall || 0) - (a.overall || 0);
    }
    
    return a.name.localeCompare(b.name);
  });

  const paginatedPlayers = filteredPlayers.slice(offset, offset + limit);
  const shortlistedPlayers = (save.shortlist || []).map(id => save.players[id]).filter(Boolean);

  return {
    hasSave: true,
    players: paginatedPlayers,
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit),
    shortlist: save.shortlist || [],
    shortlistedPlayers,
    scoutingReports: save.scoutingReports || [],
    managerTeamId: save.manager.teamId,
    currentDate: save.currentDate,
    teams: save.teams
  };
};

export const actions: Actions = {
  toggleShortlist: async ({ request }) => {
    const data = await request.formData();
    const playerId = data.get('playerId') as string;

    if (!playerId) return fail(400, { message: 'Missing player ID' });

    const save = loadSaveGame();
    if (!save) return fail(500, { message: 'No save found' });

    toggleShortlist(save, playerId);
    writeSaveGame(save);
    return { success: true };
  },
  togglePriority: async ({ request }) => {
    const data = await request.formData();
    const playerId = data.get('playerId') as string;

    if (!playerId) return fail(400, { message: 'Missing player ID' });

    const save = loadSaveGame();
    if (!save) return fail(500, { message: 'No save found' });

    const result = toggleScoutingPriority(save, playerId);
    if (!result.success) return fail(400, { message: result.message });

    writeSaveGame(save);
    return { success: true };
  }
};
