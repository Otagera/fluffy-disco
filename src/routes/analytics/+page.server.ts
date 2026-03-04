import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadSaveGame } from '$lib/data/store';

export const load: PageServerLoad = () => {
  const save = loadSaveGame();
  
  if (!save) {
    throw error(404, 'No active save game found. Please start a new game.');
  }

  if (!save.lastMatchAnalytics) {
    // If no match has been played or analytics recorded yet, we could redirect or show a placeholder
    return {
      hasAnalytics: false
    };
  }

  // To make the analytics meaningful, we need the player names.
  // We'll attach player names to the analytics data.
  const analytics = save.lastMatchAnalytics;
  
  // We don't have the explicit team objects saved with the analytics, 
  // but we can look up the manager's team and the last played fixture if needed.
  // For simplicity, we'll just look up player names from the global players dictionary.
  
  const enrichPasses = analytics.passes.map(p => ({
    ...p,
    fromName: save.players[p.fromId]?.name || `Player ${p.fromId}`,
    toName: save.players[p.toId]?.name || `Player ${p.toId}`
  }));

  const enrichShots = analytics.shots.map(s => ({
    ...s,
    playerName: save.players[s.playerId]?.name || `Player ${s.playerId}`
  }));

  return {
    hasAnalytics: true,
    analytics: {
      passes: enrichPasses,
      shots: enrichShots,
      heatmapSamples: analytics.heatmapSamples
    }
  };
};