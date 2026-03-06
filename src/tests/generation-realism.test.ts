import { describe, expect, it } from 'vitest';
import { generateSaveGame } from '../lib/data/generator';

describe('world generation realism', () => {
  it('stratifies team quality by league level', () => {
    const save = generateSaveGame('Tester');

    const avgByLevel = save.leagues.map((league) => {
      const values = league.teams.map((teamId) => save.teams[teamId].overall ?? 1);
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    });

    expect(avgByLevel[0]).toBeGreaterThan(avgByLevel[1]);
    expect(avgByLevel[1]).toBeGreaterThan(avgByLevel[2]);
    expect(avgByLevel[2]).toBeGreaterThan(avgByLevel[3]);
  });

  it('creates matchday benches with a reserve goalkeeper', () => {
    const save = generateSaveGame('Tester');

    for (const team of Object.values(save.teams)) {
      const benchIds = team.players.slice(11, 20);
      const benchPlayers = benchIds.map((id) => save.players[id]);
      expect(benchPlayers.length).toBe(9);
      expect(benchPlayers.some((p) => p.role === 'GK')).toBe(true);
    }
  });
});
