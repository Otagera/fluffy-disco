import { getTacticalCompatibility } from "./ai/Compatibility";
import { SpatialMap } from "./ai/SpatialMap";
import { TacticalManager } from "./ai/Tactics";
import {
	BALL_OFFSET_VX,
	BALL_OFFSET_VY,
	BALL_OFFSET_VZ,
	BALL_OFFSET_X,
	BALL_OFFSET_Y,
	BALL_OFFSET_Z,
	PLAYER_COUNT,
	PLAYER_OFFSET_GK_X,
	PLAYER_OFFSET_GK_Y,
	PLAYER_OFFSET_GK_Z,
	PLAYER_OFFSET_STAMINA,
	PLAYER_OFFSET_VX,
	PLAYER_OFFSET_VY,
	PLAYER_OFFSET_X,
	PLAYER_OFFSET_Y,
	PLAYER_STRIDE,
} from "./core/constants";
import { MatchMemory } from "./core/MatchMemory";
import { MathUtils } from "./core/MathUtils";
import type { MatchRecorder } from "./MatchRecorder";
import { PhysicsEngine } from "./physics/Steering";

export enum MatchStatus {
	KICKOFF = "KICKOFF",
	PLAYING = "PLAYING",
	PAUSED = "PAUSED",
	HALF_TIME = "HALF_TIME",
	SET_PIECE = "SET_PIECE",
	FREE_KICK = "FREE_KICK",
}

export interface MatchEvent {
	type: "pass" | "shot" | "foul" | "goal";
	team: number;
	playerId?: number; // Index in the player buffer
	x: number;
	y: number;
	endX?: number;
	endY?: number;
	result?: string;
	time: number;
}

/**
 * Match is the central orchestrator that links memory, physics, and AI.
 */
export class Match {
	public memory: MatchMemory;
	public spatialMap: SpatialMap;
	public tactics: TacticalManager;
	public homeScore: number = 0;
	public awayScore: number = 0;
	public status: MatchStatus = MatchStatus.KICKOFF;
	public currentHalf: number = 1;
	public managedTeam: number | null = null; // 0 for Home, 1 for Away, null for sim

	// Card Tracking
	public yellowCards: number[] = new Array(22).fill(0);
	public redCards: number[] = new Array(22).fill(0);

	// Analytics
	public analytics = {
		possessionTime: [0, 0], // [Home, Away]
		events: [] as MatchEvent[],
		heatmapSamples: [] as { x: number; y: number; team: number }[],
	};

	private initialAnchors: { x: number; y: number }[] = [];
	private playerStats: any[] = [];
	private playerRoles: string[] = []; // corresponding roles for each stat index
	private tacticalStyles: string[] = ["Balanced", "Balanced"]; // [HomeStyle, AwayStyle]
	private mentalities: string[] = ["BALANCED", "BALANCED"];
	private formationNames: string[] = ["4-4-2 Wide", "4-4-2 Wide"];

	// system bonuses based on compatibility
	private systemBonuses: [number, number] = [1.0, 1.0]; // multipliers for error (1.0 = normal, 0.8 = 20% more accurate)

	// bench storage (separate for each team)
	public benchStats: [any[], any[]] = [[], []];
	public benchRoles: [string[], string[]] = [[], []];
	public subsUsed: [number, number] = [0, 0];
	private lastSubCheckMinute: number = -1;

	private analyticsSampleTimer: number = 0;
	private spatialMapUpdateTimer: number = 0;

	public currentTime: number = 0;
	private maxDuration: number = 90 * 60; // 90 minutes in seconds
	private possessionCooldown: number = 0; // Cooldown after a kick/shot
	private lastPossessorIdx: number | null = null;

	private setPieceTimer: number = 0;
	private setPieceTakerIdx: number | null = null;

	private offsideLineTeam0: number = 52.5;
	private offsideLineTeam1: number = 52.5;
	private lastShotTimeByTeam: [number, number] = [-10, -10];

	// Ball history for interpolation and interception (e.g., GKs)
	private ballHistory: { x: number; y: number; z: number }[] = [];

	public recorder: MatchRecorder | null = null;

	get formattedTime(): string {
		const minutes = Math.floor(this.currentTime / 60);
		const seconds = Math.floor(this.currentTime % 60);
		return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
	}

	constructor() {
		this.memory = new MatchMemory();
		this.spatialMap = new SpatialMap();
		this.tactics = new TacticalManager();
	}

	/**
	 * Initializes the match with starting positions (e.g., Kick-off).
	 * Optionally supply parallel roles array that aligns with stats.
	 */
	public setup(
		startingPositions: { x: number; y: number }[],
		stats?: any[],
		roles?: string[],
		styles?: string[],
		mentalities?: string[],
		resetStamina: boolean = false,
	) {
		this.initialAnchors = startingPositions;
		if (stats && stats.length > 0) {
			this.playerStats = stats;
		} else if (this.playerStats.length === 0) {
			// Fallback default stats
			for (let i = 0; i < PLAYER_COUNT; i++) {
				this.playerStats.push({
					passing: 50,
					finishing: 50,
					tackling: 50,
					dribbling: 50,
					vision: 50,
					composure: 50,
				});
			}
		}
		if (roles && roles.length === this.playerStats.length) {
			this.playerRoles = roles;
		} else if (this.playerRoles.length === 0) {
			this.playerRoles = new Array(this.playerStats.length).fill("");
		}

		if (styles && styles.length === 2) {
			this.tacticalStyles = styles;
		}

		if (mentalities && mentalities.length === 2) {
			this.mentalities = mentalities;
		}

		this.updateSystemBonuses();
		this.lastShotTimeByTeam = [-10, -10];
		this.possessionCooldown = 4.0;
		this.lastPossessorIdx = null;

		this.memory.initialize(startingPositions, resetStamina);
		// Place ball at center
		this.memory.ballBuffer[BALL_OFFSET_X] = 52.5;
		this.memory.ballBuffer[BALL_OFFSET_Y] = 34.0;
		this.memory.ballBuffer[BALL_OFFSET_Z] = 0;
		this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
		this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
		this.memory.ballBuffer[BALL_OFFSET_VZ] = 0;
	}

	/**
	 * Executes a single simulation step.
	 * @param dt Timestep in seconds.
	 */
	public tick(dt: number) {
		if (
			this.status === MatchStatus.PAUSED ||
			this.status === MatchStatus.HALF_TIME
		)
			return;

		// Check for Half Time
		if (this.currentHalf === 1 && this.currentTime >= 2700) {
			this.status = MatchStatus.HALF_TIME;
			return;
		}

		// Calculate Offside Lines
		const homeDefendersX: number[] = [];
		const awayDefendersX: number[] = [];
		for (let i = 0; i < 11; i++) {
			homeDefendersX.push(
				this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_X],
			);
			awayDefendersX.push(
				this.memory.playerBuffer[(i + 11) * PLAYER_STRIDE + PLAYER_OFFSET_X],
			);
		}

		const homeDir = this.getAttackDir(0); // 1 for right, -1 for left
		const awayDir = this.getAttackDir(1);

		// Sort ascending if defending 0, descending if defending 105
		homeDefendersX.sort((a, b) => (homeDir === 1 ? a - b : b - a));
		awayDefendersX.sort((a, b) => (awayDir === 1 ? a - b : b - a));

		// Team 0 attacks 105 (checks against awayDefendersX[1])
		// Team 1 attacks 0 (checks against homeDefendersX[1])
		const offsideLineTeam1 = awayDefendersX[1] ?? 52.5; // Line Team 0 must not cross
		const offsideLineTeam0 = homeDefendersX[1] ?? 52.5; // Line Team 1 must not cross

		this.offsideLineTeam0 = offsideLineTeam0;
		this.offsideLineTeam1 = offsideLineTeam1;

		// 1. Update AI Spatial Awareness (Influence Map) - Throttled for performance
		this.spatialMapUpdateTimer += dt;
		if (this.spatialMapUpdateTimer >= 0.2) {
			this.spatialMapUpdateTimer = 0;

			// Phase-aware ball weight:
			// 0.8 during settled possession (discourage excessive swarming)
			// 1.5 during loose balls or set pieces (encourage convergence to action)
			// 1.2 during immediate transition
			let ballWeightMultiplier = 1.0;
			const possessionIdx = this.resolvePossession();

			if (this.status === MatchStatus.SET_PIECE || this.status === MatchStatus.FREE_KICK || possessionIdx === null) {
				ballWeightMultiplier = 1.5;
			} else {
				const team = possessionIdx < 11 ? 0 : 1;
				const phase = this.tactics.getPhase(team);
				if (phase === "possession") ballWeightMultiplier = 0.8;
				else if (phase === "transition") ballWeightMultiplier = 1.2;
			}

			this.spatialMap.update(this.memory.playerBuffer, this.memory.ballBuffer, ballWeightMultiplier);
		}

		// 1.5 AI Substitutions (CPU)
		this.handleCPUSubs();

		// Analytics: Heatmap Sampling (every 5 seconds)
		this.analyticsSampleTimer += dt;
		if (this.analyticsSampleTimer >= 5.0) {
			this.analyticsSampleTimer = 0;
			const bx = this.memory.ballBuffer[BALL_OFFSET_X];
			const by = this.memory.ballBuffer[BALL_OFFSET_Y];
			const lastPossessorTeam =
				this.lastPossessorIdx !== null
					? this.lastPossessorIdx < 11
						? 0
						: 1
					: null;
			if (lastPossessorTeam !== null) {
				this.analytics.heatmapSamples.push({
					x: bx / 105,
					y: by / 68,
					team: lastPossessorTeam,
				});
			}
		}

		// Set Piece / Free Kick Logic
		if (
			this.status === MatchStatus.SET_PIECE ||
			this.status === MatchStatus.FREE_KICK
		) {
			this.setPieceTimer -= dt;

			// --- FIXED: LET BALL SETTLE DURING DEAD BALL ---
			// Unless the taker has actually arrived to snap it, let gravity and friction work
			if (!this.setPieceTakerIdx || this.setPieceTimer > 0) {
				PhysicsEngine.updateBall(this.memory.ballBuffer, dt);
			}

			// Calculate Tactical Anchors for everyone to settle
			this.tactics.updatePhase(this.memory.ballBuffer, this.setPieceTakerIdx);
			const targets = this.tactics.calculateAnchors(
				this.memory.ballBuffer,
				this.initialAnchors,
				this.playerRoles,
				this.tacticalStyles,
				this.offsideLineTeam0,
				this.offsideLineTeam1,
				this.playerStats,
				this.memory.playerBuffer,
				this.setPieceTakerIdx === null,
				this.currentHalf,
			);

			// Override taker's target to be exactly the ball's position
			let hasArrived = false;
			if (this.setPieceTakerIdx !== null) {
				const bx = this.memory.ballBuffer[BALL_OFFSET_X];
				const by = this.memory.ballBuffer[BALL_OFFSET_Y];
				targets[this.setPieceTakerIdx] = { x: bx, y: by };

				const takerTeam = this.setPieceTakerIdx < 11 ? 0 : 1;

				// Dynamic Set Piece Targets
				if (this.status === MatchStatus.SET_PIECE) {
					// Throw-in / Corner logic: Pull a teammate close
					let closestTeammate = -1;
					let minTeammateDistSq = Infinity;
					const startIdx = takerTeam === 0 ? 0 : 11;
					const endIdx = takerTeam === 0 ? 11 : 22;

					for (let i = startIdx; i < endIdx; i++) {
						if (i === this.setPieceTakerIdx || i === 0 || i === 11) continue;
						const target = targets[i];
						const distSq = (target.x - bx) ** 2 + (target.y - by) ** 2;
						if (distSq < minTeammateDistSq) {
							minTeammateDistSq = distSq;
							closestTeammate = i;
						}
					}

					if (closestTeammate !== -1) {
						// Pull teammate 70% of the way towards the thrower
						targets[closestTeammate].x =
							bx + (targets[closestTeammate].x - bx) * 0.3;
						targets[closestTeammate].y =
							by + (targets[closestTeammate].y - by) * 0.3;

						// Find closest opponent to mark them
						const oppStart = takerTeam === 0 ? 11 : 0;
						const oppEnd = takerTeam === 0 ? 22 : 11;
						let closestOpp = -1;
						let minOppDistSq = Infinity;

						for (let j = oppStart; j < oppEnd; j++) {
							if (j === 0 || j === 11) continue;
							const target = targets[j];
							const teammateTarget = targets[closestTeammate];
							const distSq =
								(target.x - teammateTarget.x) ** 2 +
								(target.y - teammateTarget.y) ** 2;
							if (distSq < minOppDistSq) {
								minOppDistSq = distSq;
								closestOpp = j;
							}
						}

						if (closestOpp !== -1) {
							// Place opponent slightly goal-side of the receiver
							const teammateTarget = targets[closestTeammate];
							const goalX = takerTeam === 0 ? 0 : 105; // Defending goal
							const dx = goalX - teammateTarget.x;
							const length = Math.abs(dx) || 1;
							targets[closestOpp].x = teammateTarget.x + (dx / length) * 2.0;
							targets[closestOpp].y = teammateTarget.y;
						}
					}
				} else if (this.status === MatchStatus.FREE_KICK) {
					// Free Kick logic: Defensive Wall
					const attackDir = this.getAttackDir(takerTeam);
					const goalX = attackDir === 1 ? 105 : 0;
					const goalY = 34;
					const distToGoal = Math.max(Math.sqrt((goalX - bx) ** 2 + (goalY - by) ** 2), 0.1);

					if (distToGoal < 30) {
						// Assemble a wall 9.15m away
						const wallDist = 9.15;
						const wx = bx + ((goalX - bx) / distToGoal) * wallDist;
						const wy = by + ((goalY - by) / distToGoal) * wallDist;

						const oppStart = takerTeam === 0 ? 11 : 0;
						const oppEnd = takerTeam === 0 ? 22 : 11;

						// Pick 3 opponents for the wall
						const wallBuilders = [];
						for (let j = oppStart; j < oppEnd; j++) {
							if (j === 0 || j === 11) continue;
							wallBuilders.push({
								idx: j,
								dist: Math.abs(targets[j].x - wx) + Math.abs(targets[j].y - wy),
							});
						}
						wallBuilders.sort((a, b) => a.dist - b.dist);

						for (let w = 0; w < 3; w++) {
							const pIdx = wallBuilders[w].idx;
							// Line them up perpendicular to the shot path
							const perpX = -(goalY - by) / distToGoal;
							const perpY = (goalX - bx) / distToGoal;
							const offset = (w - 1) * 1.0; // Space them 1m apart
							targets[pIdx].x = wx + perpX * offset;
							targets[pIdx].y = wy + perpY * offset;
						}
					}
				}

				// Check if taker has arrived at the ball
				const offset = this.setPieceTakerIdx * PLAYER_STRIDE;
				const px = this.memory.playerBuffer[offset + PLAYER_OFFSET_X];
				const py = this.memory.playerBuffer[offset + PLAYER_OFFSET_Y];
				const distSq = (px - bx) ** 2 + (py - by) ** 2;

				if (distSq < 6.25) {
					// within 2.5m (increased from 1.5m for reliability at high speeds)
					hasArrived = true;
					// Snap the taker exactly to the ball to prevent orbiting
					this.memory.playerBuffer[offset + PLAYER_OFFSET_X] = bx;
					this.memory.playerBuffer[offset + PLAYER_OFFSET_Y] = by;
					this.memory.playerBuffer[offset + PLAYER_OFFSET_VX] = 0;
					this.memory.playerBuffer[offset + PLAYER_OFFSET_VY] = 0;
				}
			}

			// Update players to move into position
			PhysicsEngine.updatePlayers(this.memory.playerBuffer, targets, dt);

			// Resume play only after timer expires AND taker has arrived
			// Safety Timeout: Force resume if stuck in set piece for more than 10 seconds
			if (
				(this.setPieceTimer <= 0 && hasArrived && this.setPieceTakerIdx !== null) ||
				this.setPieceTimer < -10.0
			) {
				const team = this.setPieceTakerIdx !== null ? (this.setPieceTakerIdx < 11 ? 0 : 1) : 0;
				const attackDir = this.getAttackDir(team);
				const stats = (this.setPieceTakerIdx !== null ? this.playerStats[this.setPieceTakerIdx] : null) || {
					passing: 50,
					finishing: 50,
				};
				const bx = this.memory.ballBuffer[BALL_OFFSET_X];
				const by = this.memory.ballBuffer[BALL_OFFSET_Y];

				const goalX = attackDir === 1 ? 105 : 0;
				const distToGoal = Math.max(Math.sqrt((goalX - bx) ** 2 + (34 - by) ** 2), 0.1);

				if (this.status === MatchStatus.FREE_KICK && distToGoal < 30) {
					// Direct shot on goal
					const dx = goalX - bx;
					const dy = 34 - by;

					const consistency = stats.consistency || 10;
					const consistencyMultiplier = 1.0 + (10 - consistency) * 0.05;

					const errorSpread = MathUtils.clamp(
						5.0 * (1.0 - stats.finishing / 100) * consistencyMultiplier,
						0.5,
						8.0,
					);
					const ty = 34 + MathUtils.nextGaussian(0, errorSpread);
					const targetedDy = ty - by;

					const shotPower = 20.0 + (stats.finishing / 100) * 10.0;
					this.memory.ballBuffer[BALL_OFFSET_VX] =
						(dx / distToGoal) * shotPower;
					this.memory.ballBuffer[BALL_OFFSET_VY] =
						(targetedDy / distToGoal) * shotPower;
					this.memory.ballBuffer[BALL_OFFSET_VZ] = 4.0; // Loft it over the wall
				} else {
					// Execute pass to resume play
					const passTarget = this.setPieceTakerIdx !== null ? this.findPassTarget(
						this.setPieceTakerIdx,
						team,
						this.status === MatchStatus.SET_PIECE,
					) : null;
					if (passTarget) {
						const dx = passTarget.x - bx;
						const dy = passTarget.y - by;
						const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.1);

						const passPower = 12.0;
						this.memory.ballBuffer[BALL_OFFSET_VX] = (dx / dist) * passPower;
						this.memory.ballBuffer[BALL_OFFSET_VY] = (dy / dist) * passPower;

						const loft = dist > 15.0 ? Math.min((dist - 15.0) * 0.15, 6.0) : 0;
						this.memory.ballBuffer[BALL_OFFSET_VZ] = loft;
					} else {
						// Just kick it slightly into the pitch if no target
						this.memory.ballBuffer[BALL_OFFSET_VX] = attackDir * 5.0;
						this.memory.ballBuffer[BALL_OFFSET_VY] = by < 34 ? 5.0 : -5.0;
					}
				}

				this.possessionCooldown = 0.5;
				this.lastPossessorIdx = this.setPieceTakerIdx;
				this.status = MatchStatus.PLAYING;
				this.setPieceTakerIdx = null;
			}

			this.currentTime += dt;
			return;
		}

		// 2. Identify Possession
		if (this.possessionCooldown > 0) {
			this.possessionCooldown -= dt;
		}
		const possessionIdx = this.resolvePossession();

		if (possessionIdx !== null) {
			const team = possessionIdx < 11 ? 0 : 1;
			this.analytics.possessionTime[team] += dt;
		}

		// Auto-start play if ball moves or someone grabs it,
		// or just start after a tiny delay to get players moving
		// note: currentTime hasn't been incremented yet this tick so include dt
		if (
			this.status === MatchStatus.KICKOFF &&
			(possessionIdx !== null || this.currentTime + dt > 0.1)
		) {
			this.status = MatchStatus.PLAYING;
		}

		this.tactics.updatePhase(this.memory.ballBuffer, possessionIdx);

		// 3. Calculate Tactical Anchors
		const targets =
			this.status === MatchStatus.KICKOFF
				? this.initialAnchors
				: this.tactics.calculateAnchors(
						this.memory.ballBuffer,
						this.initialAnchors,
						this.playerRoles,
						this.tacticalStyles,
						this.offsideLineTeam0,
						this.offsideLineTeam1,
						this.playerStats,
						this.memory.playerBuffer,
						possessionIdx === null,
						this.currentHalf,
					);

		// 4. Basic Ball Interaction (Dribbling, Passing, & Shooting)
		if (possessionIdx !== null) {
			const offset = possessionIdx * PLAYER_STRIDE;
			const px = this.memory.playerBuffer[offset + PLAYER_OFFSET_X];
			const py = this.memory.playerBuffer[offset + PLAYER_OFFSET_Y];
			const vx = this.memory.playerBuffer[offset + PLAYER_OFFSET_VX];
			const vy = this.memory.playerBuffer[offset + PLAYER_OFFSET_VY];

			const team = possessionIdx < 11 ? 0 : 1;
			const speed = Math.sqrt(vx * vx + vy * vy);
			const lead = 0.6;
			const stats = this.playerStats[possessionIdx] || {
				passing: 50,
				finishing: 50,
				tackling: 50,
				dribbling: 50,
				vision: 50,
				composure: 50,
				consistency: 10,
			};
			const role = this.playerRoles[possessionIdx] || "";

			// Calculate consistency multiplier (1-20 scale)
			// Consistency 20 -> 0.5 (half spread), Consistency 1 -> 1.45 (wider spread)
			const consistency = stats.consistency || 10;
			const consistencyMultiplier = 1.0 + (10 - consistency) * 0.05;

			// AI Action Decisions
			const attackDir = this.getAttackDir(team);
			const inShootingRange = attackDir === 1 ? px > 80 : px < 25; // Restrict to more realistic shot zones

			let basePassChance = 0.65;
			let baseShotChance = 0.22; // Increased from 0.18

			const mentality = this.mentalities[team];
			const style = this.tacticalStyles[team];

			// Apply Team Mentality Modifiers
			if (mentality === "ULTRA_ATTACKING") {
				baseShotChance *= 1.5;
				basePassChance *= 0.8;
			} else if (mentality === "ATTACKING") {
				baseShotChance *= 1.2;
				basePassChance *= 0.9;
			} else if (mentality === "DEFENSIVE") {
				baseShotChance *= 0.8;
				basePassChance *= 1.1;
			} else if (mentality === "ULTRA_DEFENSIVE") {
				baseShotChance *= 0.6;
				basePassChance *= 1.3;
			}

			// Apply Team Style Modifiers
			if (style === "Tiki-Taka") {
				basePassChance *= 1.5;
			} else if (style === "Route One") {
				basePassChance *= 0.7;
				baseShotChance *= 1.2;
			}

			// Apply Tactical Role Intent Modifiers
			if (role === "TM") {
				// Target Man: Wait for support (hold up ball)
				basePassChance *= 0.3;
				baseShotChance *= 0.6;
			} else if (role === "IF") {
				// Inverted Forward: Selfish, looking to shoot
				basePassChance *= 0.7;
				baseShotChance *= 1.5;
			} else if (role === "BWM" || role === "CB") {
				// Defensive player: Lay it off quickly, rarely shoot
				basePassChance *= 1.5;
				baseShotChance *= 0.1;
			} else if (role === "W") {
				// Winger: Pass (cross) when wide
				basePassChance *= 1.3;
				baseShotChance *= 0.4;
			}

			const nearestOppDist = this.getNearestOpponentDistance(
				possessionIdx,
				team,
			);
			const pressureFactor = MathUtils.clamp(
				1.0 - nearestOppDist / 8.0,
				0.0,
				1.0,
			);
			const dribbleSkill =
				((stats.dribbling || 50) * 0.7 + (stats.composure || 50) * 0.3) / 100;

			// Through on Goal Check
			const activeOffsideLine =
				team === 0 ? this.offsideLineTeam1 : this.offsideLineTeam0;
			const isThroughOnGoal =
				attackDir === 1 ? px > activeOffsideLine : px < activeOffsideLine;
			const shotQuality = this.evaluateShotQuality(px, py, team);

			// Pressure-aware behavior: pressed players release quickly unless elite dribblers.
			basePassChance *= 0.9 + pressureFactor * 0.9;
			baseShotChance *= 0.85 + shotQuality * 1.8;

			// Comfortable + technically gifted players dribble more often to break lines.
			const dribbleBias = MathUtils.clamp(
				(1.0 - pressureFactor) * dribbleSkill,
				0.0,
				0.5,
			);
			basePassChance *= 1.0 - dribbleBias;

			// Under heavy pressure and in poor shooting positions, avoid wasteful shots.
			if (pressureFactor > 0.65 && shotQuality < 0.35) {
				baseShotChance *= 0.55;
			}

			if (isThroughOnGoal) {
				// Ignore passing, focus entirely on attacking the net
				basePassChance = 0.0;
				baseShotChance = inShootingRange ? 3.6 : 0.0; // Shoot immediately if in range, otherwise force dribble
			}

			const minShotInterval = 9.0;
			const canTeamShootNow =
				this.currentTime - this.lastShotTimeByTeam[team] >= minShotInterval;
			const canTakeShot =
				canTeamShootNow || shotQuality > 0.78 || isThroughOnGoal;

			// Use dt-scaled probabilities so decisions remain stable across render speeds.
			const randomPassChance = this.rollChancePerSecond(basePassChance, dt);
			const randomShotChance = canTakeShot
				? this.rollChancePerSecond(baseShotChance, dt)
				: false;

			if (inShootingRange && randomShotChance) {
				// Shooting
				const targetGoalX = attackDir === 1 ? 105 : 0;
				const targetGoalY = 34; // Goal center

				const dx = targetGoalX - px;
				const approximateDist = Math.abs(dx);

				// Add Gaussian error based on finishing rating
				const systemBonus = this.systemBonuses[team];
				const shotComposure =
					((stats.finishing || 50) * 0.8 + (stats.composure || 50) * 0.2) / 100;
				const pressureError =
					1.0 + pressureFactor * (1.0 - shotComposure) * 1.2;
				const longShotPenalty = MathUtils.clamp(
					(approximateDist - 20) / 28,
					0,
					1,
				);

				const errorSpread = MathUtils.clamp(
					1.8 *
						(1.0 - stats.finishing / 100) *
						systemBonus *
						pressureError *
						consistencyMultiplier +
						longShotPenalty * 1.15,
					0.12,
					3.8,
				);
				const gkBias = MathUtils.nextGaussian(
					0,
					0.9 * (1.0 - shotQuality) * consistencyMultiplier,
				);
				const ty =
					targetGoalY + gkBias + MathUtils.nextGaussian(0, errorSpread);

				const dy = ty - py;
				const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.1);

				// Variable shot power based on finishing + distance context.
				const shotPower =
					18.0 +
					(stats.finishing / 100) * 12.0 +
					MathUtils.clamp(dist / 30.0, 0, 0.45) * 8.0;
				this.memory.ballBuffer[BALL_OFFSET_VX] = (dx / dist) * shotPower;
				this.memory.ballBuffer[BALL_OFFSET_VY] = (dy / dist) * shotPower;
				// Add some height to shots
				this.memory.ballBuffer[BALL_OFFSET_VZ] = MathUtils.clamp(
					1.0 + dist / 24.0 + Math.random() * 2.2,
					0.8,
					4.8,
				);

				this.analytics.events.push({
					type: "shot",
					team,
					playerId: possessionIdx,
					x: px,
					y: py,
					time: this.currentTime,
					xg: shotQuality,
				});

				this.possessionCooldown = 2.0;
				this.lastShotTimeByTeam[team] = this.currentTime;
				this.lastPossessorIdx = possessionIdx;
			} else if (randomPassChance) {
				// Passing
				const passTarget = this.findPassTarget(possessionIdx, team);
				if (passTarget) {
					// Add Gaussian error based on passing rating
					const systemBonus = this.systemBonuses[team];
					const passCalm =
						((stats.passing || 50) * 0.75 + (stats.composure || 50) * 0.25) /
						100;
					const pressurePassError =
						1.0 + pressureFactor * (1.0 - passCalm) * 1.1;
					const errorSpread = MathUtils.clamp(
						2.5 *
							(1.0 - stats.passing / 100) *
							systemBonus *
							pressurePassError *
							consistencyMultiplier,
						0.15,
						4.0,
					);
					const tx = passTarget.x + MathUtils.nextGaussian(0, errorSpread);
					const ty = passTarget.y + MathUtils.nextGaussian(0, errorSpread);

					const dx = tx - px;
					const dy = ty - py;
					const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.1);

					// Variable pass power based on passing rating (10.0 to 20.0)
					const passPower = 10.0 + (stats.passing / 100) * 10.0;
					this.memory.ballBuffer[BALL_OFFSET_VX] = (dx / dist) * passPower;
					this.memory.ballBuffer[BALL_OFFSET_VY] = (dy / dist) * passPower;

					// If the pass is longer than 15 meters, apply some loft so it clears the grass friction
					const loft = dist > 15.0 ? Math.min((dist - 15.0) * 0.15, 6.0) : 0;
					this.memory.ballBuffer[BALL_OFFSET_VZ] = loft;

					this.analytics.events.push({
						type: "pass",
						team,
						playerId: possessionIdx,
						x: px,
						y: py,
						endX: tx,
						endY: ty,
						time: this.currentTime,
					});

					this.possessionCooldown = 0.35 + pressureFactor * 0.25; // quick recycle when pressed
					this.lastPossessorIdx = possessionIdx;
				} else {
					// Dribble if no pass available
					this.dribbleBall(
						px,
						py,
						vx,
						vy,
						speed,
						lead,
						team,
						pressureFactor,
						stats.dribbling || 50,
					);
				}
			} else {
				// Dribble
				this.dribbleBall(
					px,
					py,
					vx,
					vy,
					speed,
					lead,
					team,
					pressureFactor,
					stats.dribbling || 50,
				);
			}
		}

		// 5. Update Physics
		PhysicsEngine.updatePlayers(this.memory.playerBuffer, targets, dt);
		PhysicsEngine.updateBall(this.memory.ballBuffer, dt);

		if (this.recorder) {
			this.recorder.captureFrame(this.memory, this.currentTime);
		}

		// Update Ball History for GK window
		this.ballHistory.push({
			x: this.memory.ballBuffer[BALL_OFFSET_X],
			y: this.memory.ballBuffer[BALL_OFFSET_Y],
			z: this.memory.ballBuffer[BALL_OFFSET_Z],
		});
		if (this.ballHistory.length > 5) this.ballHistory.shift();

		this.checkBoundariesAndGoals();

		this.currentTime += dt;

		// Catch-all: If ball position becomes NaN, reset it to prevent full freeze
		if (isNaN(this.memory.ballBuffer[BALL_OFFSET_X])) {
			console.error("[Engine] CRITICAL: Ball position became NaN! Resetting...");
			this.memory.ballBuffer[BALL_OFFSET_X] = 52.5;
			this.memory.ballBuffer[BALL_OFFSET_Y] = 34.0;
			this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
			this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
		}
	}

	private dribbleBall(
		px: number,
		py: number,
		vx: number,
		vy: number,
		speed: number,
		lead: number,
		team: number,
		pressureFactor: number = 0,
		dribbling: number = 50,
	) {
		const attackDir = this.getAttackDir(team);
		const dirX = speed > 0.1 ? vx / speed : attackDir;
		const dirY = speed > 0.1 ? vy / speed : 0.0;

		// Find lower-pressure side channel so dribbles look like intentional carries.
		const lateralProbe = 3.5;
		const rightControl = this.spatialMap.getControlAtFast(
			px + attackDir * 2.5,
			py + lateralProbe,
		);
		const leftControl = this.spatialMap.getControlAtFast(
			px + attackDir * 2.5,
			py - lateralProbe,
		);
		const teamAdjustedRight = team === 0 ? rightControl : -rightControl;
		const teamAdjustedLeft = team === 0 ? leftControl : -leftControl;
		const evadeSide = teamAdjustedRight > teamAdjustedLeft ? 1 : -1;

		const sideBias =
			pressureFactor > 0.25 ? evadeSide * (0.15 + (dribbling / 100) * 0.35) : 0;
		const blendedX = dirX * 0.85 + attackDir * 0.15;
		const blendedY = dirY * 0.7 + sideBias;
		const blendedMag =
			Math.sqrt(blendedX * blendedX + blendedY * blendedY) || 1.0;

		// Constraint dribbling to pitch boundaries to prevent running out of stadium
		this.memory.ballBuffer[BALL_OFFSET_X] = MathUtils.clamp(
			px + (blendedX / blendedMag) * lead,
			-1.0,
			106.0,
		);
		this.memory.ballBuffer[BALL_OFFSET_Y] = MathUtils.clamp(
			py + (blendedY / blendedMag) * lead,
			-1.0,
			69.0,
		);
		// Keep existing Z and VZ during dribble instead of flattening

		this.memory.ballBuffer[BALL_OFFSET_VX] =
			(blendedX / blendedMag) * Math.max(speed, 3.0);
		this.memory.ballBuffer[BALL_OFFSET_VY] =
			(blendedY / blendedMag) * Math.max(speed * 0.9, 2.5);
	}

	private getNearestOpponentDistance(playerIdx: number, team: number): number {
		const oppStart = team === 0 ? 11 : 0;
		const oppEnd = team === 0 ? 22 : 11;
		const px =
			this.memory.playerBuffer[playerIdx * PLAYER_STRIDE + PLAYER_OFFSET_X];
		const py =
			this.memory.playerBuffer[playerIdx * PLAYER_STRIDE + PLAYER_OFFSET_Y];
		let minDistSq = Infinity;

		for (let i = oppStart; i < oppEnd; i++) {
			const ox = this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_X];
			const oy = this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_Y];
			const dx = ox - px;
			const dy = oy - py;
			const distSq = dx * dx + dy * dy;
			if (distSq < minDistSq) minDistSq = distSq;
		}

		return Math.sqrt(minDistSq);
	}

	private evaluateShotQuality(px: number, py: number, team: number): number {
		const attackDir = this.getAttackDir(team);
		const goalX = attackDir === 1 ? 105 : 0;
		const distToGoal = Math.max(Math.sqrt((goalX - px) ** 2 + (34 - py) ** 2), 0.1);
		const centrality = 1.0 - Math.min(1.0, Math.abs(py - 34) / 24);
		const distanceScore = 1.0 - Math.min(1.0, distToGoal / 32);
		const localControl = this.spatialMap.getControlAtFast(px, py);
		const teamControl = team === 0 ? localControl : -localControl;
		const pressureScore = MathUtils.clamp((teamControl + 1.5) / 3.0, 0, 1);
		return MathUtils.clamp(
			distanceScore * 0.55 + centrality * 0.25 + pressureScore * 0.2,
			0,
			1,
		);
	}

	private getAttackDir(teamIdx: number): number {
		// Half 1: Team 0 -> right (1), Team 1 -> left (-1)
		// Half 2: Team 0 -> left (-1), Team 1 -> right (1)
		if (this.currentHalf === 1) {
			return teamIdx === 0 ? 1 : -1;
		} else {
			return teamIdx === 0 ? -1 : 1;
		}
	}

	private rollChancePerSecond(ratePerSecond: number, dt: number): boolean {
		if (ratePerSecond <= 0 || dt <= 0) return false;
		const p = 1 - Math.exp(-ratePerSecond * dt);
		return Math.random() < p;
	}

	private updateSystemBonuses() {
		const homeComp = getTacticalCompatibility(
			this.tacticalStyles[0],
			this.mentalities[0],
			this.formationNames[0],
		);
		const awayComp = getTacticalCompatibility(
			this.tacticalStyles[1],
			this.mentalities[1],
			this.formationNames[1],
		);

		// Bonus: 1.0 (at 50% comp) to 0.8 (at 100% comp) or 1.2 (at 0% comp)
		this.systemBonuses[0] = 1.2 - homeComp * 0.4;
		this.systemBonuses[1] = 1.2 - awayComp * 0.4;
	}

	public get homeStyle(): string { return this.tacticalStyles[0]; }
	public set homeStyle(s: string) {
		this.tacticalStyles[0] = s;
		this.updateSystemBonuses();
	}
	public get awayStyle(): string { return this.tacticalStyles[1]; }
	public set awayStyle(s: string) {
		this.tacticalStyles[1] = s;
		this.updateSystemBonuses();
	}
	public get homeMentality(): string { return this.mentalities[0]; }
	public set homeMentality(m: string) {
		this.mentalities[0] = m;
		this.updateSystemBonuses();
	}
	public get awayMentality(): string { return this.mentalities[1]; }
	public set awayMentality(m: string) {
		this.mentalities[1] = m;
		this.updateSystemBonuses();
	}

	/**
	 * Handles automatic CPU substitutions for both teams.
	 * Called each tick but only acts once per minute starting after 60'.
	 */
	private handleCPUSubs() {
		const minute = Math.floor(this.currentTime / 60);
		if (minute < 60 || minute === this.lastSubCheckMinute) return;
		this.lastSubCheckMinute = minute;

		for (let team = 0; team < 2; team++) {
			if (team === this.managedTeam) continue; // Skip auto-subs for the user
			if (this.subsUsed[team] >= 5) continue;
			const startIdx = team === 0 ? 0 : 11;
			const endIdx = team === 0 ? 11 : 22;

			// find tired non-GK player
			let tiredIdx = -1;
			let minStam = 999;
			for (let i = startIdx; i < endIdx; i++) {
				if (this.redCards[i] > 0) continue;
				const stam =
					this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_STAMINA];
				const role = this.playerRoles[i] || "";
				if (role === "GK") continue;
				if (stam < minStam) {
					minStam = stam;
					tiredIdx = i;
				}
			}

			// stamina is stored 0..1 so threshold around 0.6 corresponds to 60%
			if (tiredIdx !== -1 && minStam < 0.6 && this.benchStats[team].length > 0) {
				const tiredRole = this.playerRoles[tiredIdx] || "";
				const benchIdx = this.benchRoles[team].findIndex((r) => r === tiredRole);
				if (benchIdx !== -1) {
					// perform substitution
					this.makeSub(team, tiredIdx - startIdx, benchIdx);
				}
			}
		}
	}

	/**
	 * Swap a starter (outIdx relative to team 0-10) with a bench entry.
	 * team: 0 home, 1 away
	 */
	public makeSub(team: number, outIdx: number, benchIdx: number): boolean {
		const globalIdx = team * 11 + outIdx;
		if (team < 0 || team > 1) return false;
		if (outIdx < 0 || outIdx > 10) return false;
		if (this.redCards[globalIdx] > 0) return false; // Cannot sub off a sent-off player
		if (this.subsUsed[team] >= 5) return false;
		if (benchIdx < 0 || benchIdx >= this.benchStats[team].length) return false;
		const incomingStats = this.benchStats[team].splice(benchIdx, 1)[0];
		const incomingRole = this.benchRoles[team].splice(benchIdx, 1)[0];

		// replace starter stats/role
		this.playerStats[globalIdx] = incomingStats;
		this.playerRoles[globalIdx] = incomingRole;

		// restore stamina for new player (scale 0..1)
		this.memory.playerBuffer[
			globalIdx * PLAYER_STRIDE + PLAYER_OFFSET_STAMINA
		] = 1.0;

		this.subsUsed[team]++;

		this.analytics.events.push({
			type: "sub",
			team,
			playerId: globalIdx,
			incomingPlayerId: incomingStats.id, // Assuming stats has id, or we just rely on index
			incomingPlayerNumber: incomingStats.number,
			x: 0,
			y: 0,
			time: this.currentTime,
		});

		return true;
	}

	/**
	 * Finds a valid passing target for the current possessor.
	 */
	private findPassTarget(
		possessorIdx: number,
		team: number,
		safeShortPass: boolean = false,
	): { x: number; y: number } | null {
		const startIdx = team === 0 ? 0 : 11;
		const endIdx = team === 0 ? 11 : 22;
		const attackDir = this.getAttackDir(team);

		const px =
			this.memory.playerBuffer[possessorIdx * PLAYER_STRIDE + PLAYER_OFFSET_X];
		const py =
			this.memory.playerBuffer[possessorIdx * PLAYER_STRIDE + PLAYER_OFFSET_Y];

		const vision = this.playerStats[possessorIdx]?.vision || 50;
		const visionRange = 10.0 + (vision / 100) * 40.0; // 10m to 50m

		let bestTarget = null;
		let bestScore = 0; // Floor score to prevent passing if all options are terrible

		// Use appropriate offside line depending on team and half direction
		let activeOffsideLine: number | null = null;
		if (attackDir === 1) {
			activeOffsideLine =
				team === 0 ? this.offsideLineTeam1 : this.offsideLineTeam0;
		} else {
			activeOffsideLine =
				team === 0 ? this.offsideLineTeam1 : this.offsideLineTeam0;
		}

		const mentality = this.mentalities[team];
		const style = this.tacticalStyles[team];

		let progressionWeight = 2.0;
		let safetyWeight = 10.0;
		let distancePenalty = 0.1;

		if (mentality === "ULTRA_ATTACKING") {
			progressionWeight = 5.0;
			safetyWeight = 4.0;
		} else if (mentality === "ATTACKING") {
			progressionWeight = 3.5;
			safetyWeight = 7.0;
		} else if (mentality === "DEFENSIVE") {
			progressionWeight = 1.0;
			safetyWeight = 12.0;
		} else if (mentality === "ULTRA_DEFENSIVE") {
			progressionWeight = 0.5;
			safetyWeight = 15.0;
		}

		if (style === "Route One") {
			progressionWeight *= 1.5;
			distancePenalty = 0.01;
		} else if (style === "Tiki-Taka") {
			distancePenalty = 0.4;
			safetyWeight *= 1.2;
		} else if (style === "Gegenpress") {
			progressionWeight *= 1.2;
		}

		for (let i = startIdx; i < endIdx; i++) {
			if (i === possessorIdx || this.redCards[i] > 0) continue;

			const targetX =
				this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_X];
			const targetY =
				this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_Y];

			// Offside Check
			// A player is offside if they are in the opponent's half, ahead of the ball, AND ahead of the offside line
			const inOpponentHalf = attackDir === 1 ? targetX > 52.5 : targetX < 52.5;
			const aheadOfBall = attackDir === 1 ? targetX > px : targetX < px;
			const aheadOfLine =
				attackDir === 1
					? targetX > activeOffsideLine
					: targetX < activeOffsideLine;

			if (inOpponentHalf && aheadOfBall && aheadOfLine && !safeShortPass) {
				continue; // Cannot pass to an offside player
			}

			const dx = targetX - px;
			const dy = targetY - py;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist < 2.0 || dist > visionRange) continue;

			// 1. Progression Score
			const progression = (targetX - px) * attackDir;

			// 2. Lane Safety (Raycasting influence map)
			let laneSafety = 0;
			const steps = 5;
			for (let s = 1; s <= steps; s++) {
				const t = s / steps;
				const sampleX = px + dx * t;
				const sampleY = py + dy * t;
				// Team influence: Team 0 is +, Team 1 is -
				const control = this.spatialMap.getControlAtFast(sampleX, sampleY);
				laneSafety += team === 0 ? control : -control;
			}
			laneSafety /= steps;

			// Final score calculation
			let score = 0;
			if (safeShortPass) {
				score = -dist; // Just prefer closest
			} else {
				// Heuristic: Weighted progression, lane safety, and distance penalty
				score =
					progression * progressionWeight +
					laneSafety * safetyWeight -
					dist * distancePenalty;
			}

			if (score > bestScore) {
				bestScore = score;
				bestTarget = { x: targetX, y: targetY };
			}
		}

		return bestTarget;
	}

	/**
	 * Checks if the ball crossed any pitch boundaries and updates scores if a goal was scored.
	 */
	private checkBoundariesAndGoals() {
		const bx = this.memory.ballBuffer[BALL_OFFSET_X];
		const by = this.memory.ballBuffer[BALL_OFFSET_Y];
		const bz = this.memory.ballBuffer[BALL_OFFSET_Z];

		// Check Goal Lines
		if (bx < 0 || bx > 105) {
			// Goal posts Y range roughly 30.34 to 37.66
			// Must also be below crossbar height (roughly 2.44m) and moving toward that goal line.
			const vx = this.memory.ballBuffer[BALL_OFFSET_VX];
			const movingTowardGoal = bx < 0 ? vx < 0 : vx > 0;
			const isGoalArea = by > 30.34 && by < 37.66 && bz < 2.44;

			if (isGoalArea && movingTowardGoal) {
				const vy = this.memory.ballBuffer[BALL_OFFSET_VY];
				const speedSq = vx ** 2 + vy ** 2;
				const ballSpeed = Math.sqrt(speedSq);

				// Determine which team is defending this goal
				const defendingTeam = bx < 0 
					? (this.getAttackDir(0) === 1 ? 0 : 1)
					: (this.getAttackDir(0) === -1 ? 0 : 1);

				const defendingGkIdx = defendingTeam === 0 ? 0 : 11;
				const gkStats = this.playerStats[defendingGkIdx] || {
					reflexes: 50,
					handling: 50,
					jumping: 50,
				};

				// GK Position
				const gkOffset = defendingGkIdx * PLAYER_STRIDE;
				const gkY = this.memory.playerBuffer[gkOffset + PLAYER_OFFSET_Y];
				const goalLineX = bx < 0 ? 0 : 105;

				// --- Interception Window Logic ---
				// Find where the ball actually crossed the goal line using ballHistory
				let crossingY = by;
				let crossingZ = bz;

				if (this.ballHistory.length >= 2) {
					const prev = this.ballHistory[this.ballHistory.length - 2];
					const curr = this.ballHistory[this.ballHistory.length - 1];
					const dx = curr.x - prev.x;
					if (Math.abs(dx) > 0.001) {
						const t = (goalLineX - prev.x) / dx;
						crossingY = prev.y + (curr.y - prev.y) * t;
						crossingZ = prev.z + (curr.z - prev.z) * t;
					}
				}

				// Check if it's actually in the goal after interpolation
				if (crossingY > 30.34 && crossingY < 37.66 && crossingZ < 2.44) {
					// Snap GK Hands for visual rendering
					this.memory.playerBuffer[gkOffset + PLAYER_OFFSET_GK_X] = goalLineX;
					this.memory.playerBuffer[gkOffset + PLAYER_OFFSET_GK_Y] = crossingY;
					this.memory.playerBuffer[gkOffset + PLAYER_OFFSET_GK_Z] = crossingZ;

					const diveReachY = 2.0 + ((gkStats.reflexes || 50) / 100) * 2.5; 
					const diveReachZ = 1.6 + ((gkStats.jumping || 50) / 100) * 1.6; 
					const distY = Math.abs(gkY - crossingY);
					const distZ = crossingZ;

					// Reaction Difficulty based on distance and ball speed
					const reactionDifficulty = (distY / diveReachY) * 0.4 + (ballSpeed / 40) * 0.3;
					
					let saved = false;

					if (distY <= diveReachY && distZ <= diveReachZ) {
						const handlingFactor = (gkStats.handling || 50) / 100;
						const fumbleChance = 0.5 - (handlingFactor * 0.3) + reactionDifficulty;

						if (Math.random() > MathUtils.clamp(fumbleChance, 0.05, 0.95)) {
							saved = true;
						} else {
							// Deflection
							this.memory.ballBuffer[BALL_OFFSET_VX] *= -0.4;
							this.memory.ballBuffer[BALL_OFFSET_VY] += (Math.random() - 0.5) * 15;
							this.memory.ballBuffer[BALL_OFFSET_VZ] = Math.random() * 6;
							this.memory.ballBuffer[BALL_OFFSET_X] = bx < 0 ? 0.5 : 104.5;

							this.analytics.events.push({
								type: "save",
								team: defendingTeam,
								playerId: defendingGkIdx,
								x: bx,
								y: by,
								time: this.currentTime,
							});
							return;
						}
					}

					if (saved) {
						this.analytics.events.push({
							type: "save",
							team: defendingTeam,
							playerId: defendingGkIdx,
							x: bx,
							y: by,
							time: this.currentTime,
						});

						// GK catches the ball
						this.memory.ballBuffer[BALL_OFFSET_X] = bx < 0 ? 2.0 : 103.0;
						this.memory.ballBuffer[BALL_OFFSET_Y] = 34.0;
						this.memory.ballBuffer[BALL_OFFSET_Z] = 0;
						this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
						this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
						this.memory.ballBuffer[BALL_OFFSET_VZ] = 0;
						this.lastPossessorIdx = defendingGkIdx;
						this.possessionCooldown = 2.0;
						return;
					}

					// If not saved, it's a Goal
					let scoringTeam;
					if (this.currentHalf === 1) {
						scoringTeam = bx < 0 ? 1 : 0;
						if (bx < 0) this.awayScore++;
						else this.homeScore++;
					} else {
						scoringTeam = bx < 0 ? 0 : 1;
						if (bx < 0) this.homeScore++;
						else this.awayScore++;
					}

					console.log(`[Engine] GOAL! Score now ${this.homeScore}-${this.awayScore} (Half: ${this.currentHalf}, X: ${bx.toFixed(2)})`);

					this.analytics.events.push({
						type: "goal",
						team: scoringTeam,
						playerId: this.lastPossessorIdx !== null ? this.lastPossessorIdx : undefined,
						x: bx,
						y: by,
						time: this.currentTime,
					});

					// Reset positions
					this.setup(this.initialAnchors, this.playerStats, undefined, undefined, undefined, false);
					
					// Reset GK Sentinels
					this.memory.playerBuffer[0 * PLAYER_STRIDE + PLAYER_OFFSET_GK_X] = -1;
					this.memory.playerBuffer[11 * PLAYER_STRIDE + PLAYER_OFFSET_GK_X] = -1;
					this.status = MatchStatus.KICKOFF;
					return;
				}
			}
			
			// If it crossed the goal line but wasn't a goal area -> Goal Kick / Corner
			if (bx < -0.5 || bx > 105.5) {
				const lastTeam = this.lastPossessorIdx !== null ? (this.lastPossessorIdx < 11 ? 0 : 1) : 0;
				const leftDefendingTeam = this.currentHalf === 1 ? 0 : 1;
				const rightDefendingTeam = this.currentHalf === 1 ? 1 : 0;
				const defendingSide = bx < 0 ? leftDefendingTeam : rightDefendingTeam;
				const attackingTeam = lastTeam === 0 ? 1 : 0;

				if (lastTeam === defendingSide) {
					// Defender kicked it out of their own backline -> Corner
					this.memory.ballBuffer[BALL_OFFSET_X] = bx < 0 ? 0.5 : 104.5;
					this.memory.ballBuffer[BALL_OFFSET_Y] = by < 34 ? 0.5 : 67.5; // nearest corner
				} else {
					// Attacker kicked it out -> Goal Kick
					this.memory.ballBuffer[BALL_OFFSET_X] = bx < 0 ? 5.5 : 99.5;
					this.memory.ballBuffer[BALL_OFFSET_Y] = 34.0; // Goal box
				}

				this.memory.ballBuffer[BALL_OFFSET_Z] = 0;
				this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
				this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
				this.memory.ballBuffer[BALL_OFFSET_VZ] = 0;

				// Reset GK Sentinels
				this.memory.playerBuffer[0 * PLAYER_STRIDE + PLAYER_OFFSET_GK_X] = -1;
				this.memory.playerBuffer[11 * PLAYER_STRIDE + PLAYER_OFFSET_GK_X] = -1;
				this.triggerSetPiece(attackingTeam);
			}
		}

		// Check Sidelines
		else if (by < 0 || by > 68) {
			// Throw-in
			this.memory.ballBuffer[BALL_OFFSET_Y] = by < 0 ? 0.5 : 67.5;
			this.memory.ballBuffer[BALL_OFFSET_X] = MathUtils.clamp(bx, 0.5, 104.5);
			this.memory.ballBuffer[BALL_OFFSET_Z] = 0;
			this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
			this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
			this.memory.ballBuffer[BALL_OFFSET_VZ] = 0;

			// Reset GK Sentinels
			this.memory.playerBuffer[0 * PLAYER_STRIDE + PLAYER_OFFSET_GK_X] = -1;
			this.memory.playerBuffer[11 * PLAYER_STRIDE + PLAYER_OFFSET_GK_X] = -1;

			const lastTeam = this.lastPossessorIdx !== null ? (this.lastPossessorIdx < 11 ? 0 : 1) : 0;
			const attackingTeam = lastTeam === 0 ? 1 : 0;
			this.triggerSetPiece(attackingTeam);
		}
	}

	private triggerSetPiece(attackingTeam: number) {
		this.status = MatchStatus.SET_PIECE;
		this.setPieceTimer = 3.0; // Wait 3 simulation seconds for players to settle and taker to arrive

		const bx = this.memory.ballBuffer[BALL_OFFSET_X];
		const by = this.memory.ballBuffer[BALL_OFFSET_Y];

		// Find closest player on the attacking team to take the set piece
		const startIdx = attackingTeam === 0 ? 0 : 11;
		const endIdx = attackingTeam === 0 ? 11 : 22;

		let closest = startIdx;
		let minDistSq = Infinity;

		for (let i = startIdx; i < endIdx; i++) {
			// Prefer outfield players for throw-ins and corners
			if (i === 0 || i === 11) continue;

			const offset = i * PLAYER_STRIDE;
			const px = this.memory.playerBuffer[offset + PLAYER_OFFSET_X];
			const py = this.memory.playerBuffer[offset + PLAYER_OFFSET_Y];

			const distSq = (px - bx) ** 2 + (py - by) ** 2;
			if (distSq < minDistSq) {
				minDistSq = distSq;
				closest = i;
			}
		}

		this.setPieceTakerIdx = closest;
	}

	public updateRoleOverrides(team: number, roles: any) {
		const teamIdx = team === 0 ? 0 : 11;
		for (let i = 0; i < 11; i++) {
			if (roles[i]) {
				this.playerRoles[teamIdx + i] = roles[i];
			}
		}
	}

	public updatePositionOverrides(team: number, anchors: any) {
		const teamIdx = team === 0 ? 0 : 11;
		for (let i = 0; i < 11; i++) {
			if (anchors[i]) {
				this.initialAnchors[teamIdx + i] = anchors[i];
			}
		}
	}

	/**
	 * Runs a full match simulation at maximum CPU speed.
	 */
	public simulateMatch(): {
		homeScore: number;
		awayScore: number;
		duration: number;
	} {
		const step = 0.2; // Increased from 0.1 for faster background sim
		const totalSteps = this.maxDuration / step;

		for (let i = 0; i < totalSteps; i++) {
			if (this.currentTime >= this.maxDuration) break;
			
			if (this.status === MatchStatus.HALF_TIME) {
				// Auto-start second half in simulation
				this.currentHalf = 2;

				// Swap sides
				for (let p = 0; p < PLAYER_COUNT; p++) {
					const offset = p * PLAYER_STRIDE;
					this.memory.playerBuffer[offset + PLAYER_OFFSET_X] =
						105 - this.memory.playerBuffer[offset + PLAYER_OFFSET_X];
					this.memory.playerBuffer[offset + PLAYER_OFFSET_Y] =
						68 - this.memory.playerBuffer[offset + PLAYER_OFFSET_Y];
				}

				// Half-time Stamina Recovery
				for (let p = 0; p < PLAYER_COUNT; p++) {
					const offset = p * PLAYER_STRIDE + PLAYER_OFFSET_STAMINA;
					this.memory.playerBuffer[offset] = Math.min(
						1.0,
						this.memory.playerBuffer[offset] + 0.15,
					);
				}

				this.status = MatchStatus.KICKOFF;
				this.memory.ballBuffer[BALL_OFFSET_X] = 52.5;
				this.memory.ballBuffer[BALL_OFFSET_Y] = 34.0;
				this.memory.ballBuffer[BALL_OFFSET_Z] = 0;
				this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
				this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
				this.memory.ballBuffer[BALL_OFFSET_VZ] = 0;
			}
			this.tick(step);
		}

		return {
			homeScore: this.homeScore,
			awayScore: this.awayScore,
			duration: this.currentTime,
		};
	}

	/**
	 * Identifies which player (if any) is in possession of the ball.
	 */
	private resolvePossession(): number | null {
		if (this.possessionCooldown > 0) return null;

		const bx = this.memory.ballBuffer[BALL_OFFSET_X];
		const by = this.memory.ballBuffer[BALL_OFFSET_Y];
		const bz = this.memory.ballBuffer[BALL_OFFSET_Z];
		const reach = 2.0; // Reach in meters
		const reachSq = reach * reach;

		// Ball must be low enough to control
		if (bz > 1.5) return null;

		const contenders: { idx: number; distSq: number }[] = [];

		for (let i = 0; i < PLAYER_COUNT; i++) {
			if (this.redCards[i] > 0) continue; // Skip ejected players

			const offset = i * PLAYER_STRIDE;
			const px = this.memory.playerBuffer[offset + PLAYER_OFFSET_X];
			const py = this.memory.playerBuffer[offset + PLAYER_OFFSET_Y];

			const dx = px - bx;
			const dy = py - by;
			const distSq = dx * dx + dy * dy;
			if (distSq <= reachSq) {
				contenders.push({ idx: i, distSq });
			}
		}

		if (contenders.length === 0) return null;

		contenders.sort((a, b) => a.distSq - b.distSq);
		const closest = contenders[0].idx;

		// If the closest is someone new, and the last possessor is also in contention
		if (this.lastPossessorIdx !== null && closest !== this.lastPossessorIdx) {
			const lastPossessorTeam = this.lastPossessorIdx < 11 ? 0 : 1;
			const closestTeam = closest < 11 ? 0 : 1;

			if (lastPossessorTeam !== closestTeam) {
				// Check if last possessor is actually in the contenders list (i.e., they are close too)
				const lastPossessorContending = contenders.find(
					(c) => c.idx === this.lastPossessorIdx,
				);

				if (lastPossessorContending) {
					// Gaussian Tackling Duel!
					const attackerStats = this.playerStats[this.lastPossessorIdx] || {
						dribbling: 50,
						composure: 50,
						consistency: 10,
					};
					const defenderStats = this.playerStats[closest] || {
						tackling: 50,
						aggression: 50,
						consistency: 10,
					};

					const attackerConsistency = attackerStats.consistency || 10;
					const attackerMultiplier = 1.0 + (10 - attackerConsistency) * 0.05;
					const defenderConsistency = defenderStats.consistency || 10;
					const defenderMultiplier = 1.0 + (10 - defenderConsistency) * 0.05;

					// Mean is based on attribute, spread is based on composure/concentration
					const tackleScore = MathUtils.nextGaussian(
						defenderStats.tackling,
						15 * defenderMultiplier,
					);
					const dribbleScore = MathUtils.nextGaussian(
						attackerStats.dribbling,
						15 * attackerMultiplier,
					);

					if (tackleScore < dribbleScore) {
						// Check for Foul (Critical Failure + High Aggression)
						if (
							dribbleScore - tackleScore > 25 &&
							Math.random() < defenderStats.aggression / 100
						) {
							this.triggerFoul(this.lastPossessorIdx, closest);
							return null;
						}
						return this.lastPossessorIdx; // Failed tackle, attacker keeps it
					} else {
						// Successful tackle
						this.possessionCooldown = 0.5; // Prevent immediate re-steal
					}
				}
			}
		}

		return closest;
	}

	private triggerFoul(fouledIdx: number, foulerIdx: number) {
		this.status = MatchStatus.FREE_KICK;
		this.setPieceTimer = 3.0;
		this.setPieceTakerIdx = fouledIdx;

		const fouledTeam = fouledIdx < 11 ? 0 : 1;
		const fx =
			this.memory.playerBuffer[fouledIdx * PLAYER_STRIDE + PLAYER_OFFSET_X];
		const fy =
			this.memory.playerBuffer[fouledIdx * PLAYER_STRIDE + PLAYER_OFFSET_Y];

		const foulerStats = this.playerStats[foulerIdx] || { aggression: 50 };
		let yellowCard = false;
		let redCard = false;

		// Base 30% chance of yellow for a foul, scaling up with aggression
		if (Math.random() < 0.3 + foulerStats.aggression / 200) {
			this.yellowCards[foulerIdx]++;
			yellowCard = true;

			// Second yellow = Red
			if (this.yellowCards[foulerIdx] >= 2) {
				redCard = true;
			}
		}
		// Straight red for extremely aggressive fouls (rare)
		else if (Math.random() < 0.02 + foulerStats.aggression / 1000) {
			redCard = true;
		}

		if (redCard) {
			this.redCards[foulerIdx] = 1;
			// Eject player from pitch
			this.memory.playerBuffer[foulerIdx * PLAYER_STRIDE + 4] = 0; // Set MAX_SPEED to 0
			this.memory.playerBuffer[foulerIdx * PLAYER_STRIDE + 0] = 500; // Move off pitch X
			this.memory.playerBuffer[foulerIdx * PLAYER_STRIDE + 1] = 500; // Move off pitch Y
		}

		this.analytics.events.push({
			type: "foul",
			team: fouledTeam,
			playerId: fouledIdx,
			foulerId: foulerIdx,
			yellowCard,
			redCard,
			x: fx,
			y: fy,
			time: this.currentTime,
		});

		// Stop the ball dead
		this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
		this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
		this.memory.ballBuffer[BALL_OFFSET_VZ] = 0;
	}
}
