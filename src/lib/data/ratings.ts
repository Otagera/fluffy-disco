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

export function calculateAge(birthDate: string, currentDate: string): number {
  if (!birthDate || !currentDate) return 20; // Fallback
  const birth = new Date(birthDate);
  const current = new Date(currentDate);
  let age = current.getFullYear() - birth.getFullYear();
  const m = current.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && current.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function calculatePlayerOverall(player: Pick<PlayerProfile, 'role' | 'attributes' | 'condition' | 'potential' | 'birthDate' | 'morale'>, currentDate: string, options?: { includeTransient?: boolean }): number {
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
  const currentAge = calculateAge(player.birthDate, currentDate);

  // Keep current ability close to long-term potential while still reflecting fitness/age.
  const developmentGap = (player.potential - base) * (currentAge < 24 ? 0.15 : 0.05);
  const ageDecline = currentAge > 31 ? -(currentAge - 31) * 0.15 : 0;

  let score = base + developmentGap + ageDecline;

  // Morale Impact
  const morale = player.morale ?? 50;
  if (morale < 30) score -= (30 - morale) / 10; // Max -3 penalty
  else if (morale > 90) score += 1;

  if (options?.includeTransient) {
    const fitnessMod = (clamp(player.condition, 35, 100) - 85) / 25;
    score += fitnessMod;
  }

  return Math.round(clamp(score, 1, 20));
}

export function calculateTeamOverall(team: TeamProfile, players: Record<string, PlayerProfile>, currentDate: string): number {
  const squad = team.players
    .map((playerId) => players[playerId])
    .filter((player): player is PlayerProfile => !!player)
    .sort((a, b) => (b.overall ?? calculatePlayerOverall(b, currentDate)) - (a.overall ?? calculatePlayerOverall(a, currentDate)));

  const selected: PlayerProfile[] = [];

  for (const [role, target] of Object.entries(TEAM_ROLE_TARGETS) as [Role, number][]) {
    const rolePlayers = squad
      .filter((player) => player.role === role)
      .sort((a, b) => (b.overall ?? calculatePlayerOverall(b, currentDate)) - (a.overall ?? calculatePlayerOverall(a, currentDate)));

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

  const total = selected.reduce((sum, player) => sum + (player.overall ?? calculatePlayerOverall(player, currentDate)), 0);
  return Math.round(total / selected.length);
}

/**
 * Estimating player market value in Euros.
 */
export function calculatePlayerValue(player: PlayerProfile, currentDate: string): number {
  const ovr = player.overall || calculatePlayerOverall(player, currentDate);
  const currentAge = calculateAge(player.birthDate, currentDate);
  
  // Exponential base: a 20 OVR is worth much more than a 10 OVR.
  // 10 OVR ~ 1M, 15 OVR ~ 15M, 20 OVR ~ 100M
  const baseValue = Math.pow(1.45, ovr) * 250000;
  
  // Potential premium: young players with high ceilings are worth more
  const potGap = Math.max(0, player.potential - ovr);
  const potentialPremium = potGap * 2000000 * (currentAge < 25 ? 1.5 : 0.5);
  
  // Age Multiplier
  let ageMod = 1.0;
  if (currentAge < 21) ageMod = 1.4;
  else if (currentAge < 24) ageMod = 1.2;
  else if (currentAge > 29) ageMod = Math.max(0.05, 1.0 - (currentAge - 29) * 0.12);

  const value = (baseValue + potentialPremium) * ageMod;
  
  // Round to nearest 50k
  return Math.round(value / 50000) * 50000;
}
