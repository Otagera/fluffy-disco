export type TacticalStyle =
	| "Tiki-Taka"
	| "Gegenpress"
	| "Fluid Counter"
	| "Route One"
	| "Park the Bus"
	| "Balanced";
export type Mentality =
	| "ULTRA_ATTACKING"
	| "ATTACKING"
	| "BALANCED"
	| "DEFENSIVE"
	| "ULTRA_DEFENSIVE";

export interface CompatibilityMatrix {
	style: TacticalStyle;
	preferredMentalities: Mentality[];
	formationKeywords: string[]; // Keywords found in formation names
	description: string;
}

export const TACTICAL_COMPATIBILITY: Record<
	TacticalStyle,
	CompatibilityMatrix
> = {
	"Tiki-Taka": {
		style: "Tiki-Taka",
		preferredMentalities: ["ATTACKING", "BALANCED"],
		formationKeywords: ["4-3-3", "4-2-3-1", "Diamond"],
		description:
			"Focuses on short passing and high possession. Best with technical players and expansive formations.",
	},
	Gegenpress: {
		style: "Gegenpress",
		preferredMentalities: ["ULTRA_ATTACKING", "ATTACKING"],
		formationKeywords: ["4-3-3", "4-4-2 Wide", "4-2-3-1"],
		description:
			"High intensity pressing to win the ball back immediately. Requires high stamina and aggressive mindsets.",
	},
	"Fluid Counter": {
		style: "Fluid Counter",
		preferredMentalities: ["BALANCED", "DEFENSIVE"],
		formationKeywords: ["3-5-2", "5-3-2", "4-4-1-1", "4-1-4-1"],
		description:
			"Absorb pressure and break with speed. Best with a solid defensive base and fast attackers.",
	},
	"Route One": {
		style: "Route One",
		preferredMentalities: ["BALANCED", "DEFENSIVE"],
		formationKeywords: ["4-4-2", "5-4-1", "3-4-3"],
		description:
			"Long balls to a target man. Simple, direct, and effective with physically strong players.",
	},
	"Park the Bus": {
		style: "Park the Bus",
		preferredMentalities: ["DEFENSIVE", "ULTRA_DEFENSIVE"],
		formationKeywords: ["5-4-1", "4-5-1", "5-3-2"],
		description:
			"Extreme defensive focus. Aiming to concede zero space and frustrate the opponent.",
	},
	Balanced: {
		style: "Balanced",
		preferredMentalities: ["BALANCED", "ATTACKING", "DEFENSIVE"],
		formationKeywords: [], // Fits anything
		description: "A standard approach without extreme tactical leanings.",
	},
};

/**
 * Calculates a compatibility score from 0 to 1.
 */
export function getTacticalCompatibility(
	style: string,
	mentality: string,
	formation: string,
): number {
	const config = TACTICAL_COMPATIBILITY[style as TacticalStyle];
	if (!config) return 0.5;

	let score = 0.5; // Base score

	// Check mentality match
	if (config.preferredMentalities.includes(mentality as Mentality)) {
		score += 0.25;
	} else if (
		(style === "Park the Bus" && mentality.includes("ATTACKING")) ||
		(style === "Gegenpress" && mentality.includes("DEFENSIVE")) ||
		(style === "Tiki-Taka" && mentality === "ULTRA_DEFENSIVE")
	) {
		score -= 0.25; // Explicit anti-patterns
	}

	// Check formation match
	if (config.formationKeywords.length > 0) {
		const matchesFormation = config.formationKeywords.some((k) =>
			formation.includes(k),
		);
		if (matchesFormation) {
			score += 0.25;
		}
	} else if (style === "Balanced") {
		score += 0.25; // Balanced is compatible with everything
	}

	return Math.max(0, Math.min(1, score));
}
