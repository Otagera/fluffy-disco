import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadSaveGame } from '$lib/data/store';

export const load: PageServerLoad = () => {
  const save = loadSaveGame();
  
  if (!save) {
    throw error(404, 'No active save game found. Please start a new game.');
  }

  if (!save.lastMatchAnalytics) {
    return {
      hasAnalytics: false
    };
  }

  const rawAnalytics = save.lastMatchAnalytics;
  
  // We need to map the player indices (0-21) to actual player names and IDs.
  // The last match analytics should ideally store which teams were playing.
  // Since we don't have that explicitly, we'll try to find the last played fixture.
  const lastFixture = save.fixtures.find(f => f.status === 'FT'); // This is a bit of a hack
  
  let homePlayerIds: string[] = [];
  let awayPlayerIds: string[] = [];
  
  if (lastFixture) {
    homePlayerIds = save.teams[lastFixture.homeTeamId]?.players || [];
    awayPlayerIds = save.teams[lastFixture.awayTeamId]?.players || [];
  }

  const getPlayerName = (idx: number) => {
    const isHome = idx < 11;
    const playerIdx = isHome ? idx : idx - 11;
    const playerId = isHome ? homePlayerIds[playerIdx] : awayPlayerIds[playerIdx];
    return {
        id: playerId || `p${idx}`,
        name: save.players[playerId]?.name || `Player ${idx + 1}`
    };
  };

  const passes = (rawAnalytics.events || [])
    .filter((e: any) => e.type === 'pass')
    .map((e: any) => {
        const player = getPlayerName(e.playerId);
        return {
            fromId: player.id,
            fromName: player.name,
            toId: 'unknown', // We don't track the receiver yet
            toName: 'Teammate',
            startX: e.x / 105, // Normalize back to 0-1 for the UI
            startY: e.y / 68,
            endX: (e.endX || e.x) / 105,
            endY: (e.endY || e.y) / 68,
            team: e.team === 0 ? 'home' : 'away'
        };
    });

  const shots = (rawAnalytics.events || [])
    .filter((e: any) => e.type === 'shot')
    .map((e: any) => {
        const player = getPlayerName(e.playerId);
        return {
            playerId: player.id,
            playerName: player.name,
            x: e.x / 105,
            y: e.y / 68,
            xg: 0.1, // Placeholder
            result: e.result || 'MISS',
            team: e.team === 0 ? 'home' : 'away'
        };
    });

  const heatmapSamples = (rawAnalytics.heatmapSamples || []).map((s: any) => ({
    ...s,
    team: s.team === 0 ? 'home' : 'away'
  }));

  return {
    hasAnalytics: true,
    analytics: {
      passes,
      shots,
      heatmapSamples
    }
  };
};