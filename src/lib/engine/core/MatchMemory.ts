import {
	BALL_OFFSET_FRICTION,
	BALL_STRIDE,
	PLAYER_COUNT,
	PLAYER_STRIDE,
} from "./constants";

/**
 * MatchMemory handles the allocation and access of the flat simulation state.
 * No Svelte proxies, no objects. Just raw floats for high-speed simulation.
 */
export class MatchMemory {
	public playerBuffer: Float32Array;
	public ballBuffer: Float32Array;

	constructor() {
		// Pre-allocate contiguous memory for 22 players and 1 ball
		this.playerBuffer = new Float32Array(PLAYER_COUNT * PLAYER_STRIDE);
		this.ballBuffer = new Float32Array(BALL_STRIDE);

		// Default Ball State
		this.ballBuffer[5] = 0; // VZ
		this.ballBuffer[6] = 0.45; // Mass (kg)
		this.ballBuffer[7] = 5.0; // Linear Friction (m/s^2 deceleration)
		this.ballBuffer[8] = 0; // Spin X
		this.ballBuffer[9] = 0; // Spin Y
	}

	/**
	 * Utility to reset player positions to a center point or formation.
	 */
	public initialize(
		startingPositions: { x: number; y: number }[],
		resetStamina: boolean = false,
	) {
		for (let i = 0; i < PLAYER_COUNT; i++) {
			const offset = i * PLAYER_STRIDE;
			const pos = startingPositions[i] || { x: 0, y: 0 };

			this.playerBuffer[offset + 0] = pos.x; // X
			this.playerBuffer[offset + 1] = pos.y; // Y
			this.playerBuffer[offset + 4] = 10.5; // Max Speed 10.5m/s (~38km/h)
			this.playerBuffer[offset + 5] = 850.0; // High acceleration force (increased for maneuverability/braking)
			this.playerBuffer[offset + 6] = 75.0; // Mass
			this.playerBuffer[offset + 8] = -1; // GK_X sentinel
			this.playerBuffer[offset + 9] = -1; // GK_Y sentinel
			this.playerBuffer[offset + 10] = -1; // GK_Z sentinel
			if (resetStamina) {
				this.playerBuffer[offset + 7] = 1.0; // 100% stamina
			}
		}
	}
}
