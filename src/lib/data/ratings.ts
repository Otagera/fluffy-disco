import type { PlayerProfile, TeamProfile } from './types';

type Role = PlayerProfile['role'];
type AttributeKey = keyof PlayerProfile['attributes'];

const WEIGHTS: Record<Role, Partial<Record<AttributeKey, number>>> = {
  GK: {
    reflexes: 0.22,
    handling: 0.2,
    positioning: 0.15,
    concentration: 0.12,
    decisions: 0.08,
    anticipation: 0.08,
    composure: 0.05,
    acceleration: 0.05,
    strength: 0.05
  },
  DEF: {
    tackling: 0.2,
    marking: 0.18,
    positioning: 0.16,
    concentration: 0.08,
    strength: 0.1,
    aggression: 0.06,
    pace: 0.08,
    acceleration: 0.05,
    passing: 0.05,
    anticipation: 0.04
  },
  MID: {
    passing: 0.19,
    vision: 0.15,
    decisions: 0.14,
    anticipation: 0.08,
    workRate: 0.09,
    stamina: 0.08,
    dribbling: 0.08,
    composure: 0.07,
    positioning: 0.06,
    tackling: 0.06
  },
  FWD: {
    finishing: 0.22,
    composure: 0.13,
    dribbling: 0.12,
    pace: 0.12,
    acceleration: 0.1,
    anticipation: 0.08,
    decisions: 0.08,
    vision: 0.06,
    strength: 0.05,
    passing: 0.04
  }
};

const TEAM_ROLE_TARGETS: Record<Role, number> = {
  GK: 1,
  DEF: 4,
  MID: 3,
  FWD: 3
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculatePlayerOverall(player: Pick<PlayerProfile, 'role' | 'attributes' | 'condition' | 'age' | 'potential'>): number {
  const weights = WEIGHTS[player.role];
  let weighted = 0;
  let weightTotal = 0;

  for (const [attribute, weight] of Object.entries(weights)) {
    if (!weight) continue;
    const key = attribute as AttributeKey;
    weighted += player.attributes[key] * weight;
    weightTotal += weight;
  }

  const base = weightTotal > 0 ? weighted / weightTotal : 1;

  // Keep current ability close to long-term potential while still reflecting fitness/age.
  const developmentGap = (player.potential - base) * (player.age < 24 ? 0.15 : 0.05);
  const fitnessMod = (clamp(player.condition, 35, 100) - 85) / 25;
  const ageDecline = player.age > 31 ? -(player.age - 31) * 0.15 : 0;

  return Math.round(clamp(base + developmentGap + fitnessMod + ageDecline, 1, 20));
}

export function calculateTeamOverall(team: TeamProfile, players: Record<string, PlayerProfile>): number {
  const squad = team.players
    .map((playerId) => players[playerId])
    .filter((player): player is PlayerProfile => !!player)
    .sort((a, b) => (b.overall ?? calculatePlayerOverall(b)) - (a.overall ?? calculatePlayerOverall(a)));

  const selected: PlayerProfile[] = [];

  for (const [role, target] of Object.entries(TEAM_ROLE_TARGETS) as [Role, number][]) {
    const rolePlayers = squad
      .filter((player) => player.role === role)
      .sort((a, b) => (b.overall ?? calculatePlayerOverall(b)) - (a.overall ?? calculatePlayerOverall(a)));

    selected.push(...rolePlayers.slice(0, target));
  }

  if (selected.length < 11) {
    const selectedIds = new Set(selected.map((player) => player.id));
    for (const player of squad) {
      if (!selectedIds.has(player.id)) {
        selected.push(player);
        selectedIds.add(player.id);
      }
      if (selected.length >= 11) break;
    }
  }

  if (selected.length === 0) return 1;

  const total = selected.reduce((sum, player) => sum + (player.overall ?? calculatePlayerOverall(player)), 0);
  return Math.round(total / selected.length);
}
