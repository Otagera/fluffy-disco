import {
	BALL_OFFSET_X,
	BALL_OFFSET_Y,
	PLAYER_COUNT,
	PLAYER_OFFSET_X,
	PLAYER_OFFSET_Y,
	PLAYER_STRIDE,
} from "../core/constants";

/**
 * SpatialMap provides a grid-based influence/control map of the pitch.
 * This is a high-performance alternative to real-time Voronoi.
 */
export class SpatialMap {
	public grid: Float32Array;
	public rows: number;
	public cols: number;
	public pitchWidth: number;
	public pitchHeight: number;

	private invCellW: number;
	private invCellH: number;
	private cellW: number;
	private cellH: number;

	constructor(
		width: number = 105,
		height: number = 68,
		resolution: number = 5,
	) {
		this.pitchWidth = width;
		this.pitchHeight = height;
		this.cols = Math.ceil(width / resolution);
		this.rows = Math.ceil(height / resolution);
		this.cellW = width / this.cols;
		this.cellH = height / this.rows;
		this.invCellW = 1.0 / this.cellW;
		this.invCellH = 1.0 / this.cellH;
		// Each cell stores: [Team A Influence, Team B Influence]
		this.grid = new Float32Array(this.cols * this.rows * 2);
	}

	/**
	 * Updates the influence map based on player positions and ball location.
	 * @param ballWeightMultiplier Can be adjusted based on match phase (e.g., lower in possession, higher in loose balls)
	 */
	update(playerBuffer: Float32Array, ballBuffer: Float32Array, ballWeightMultiplier: number = 1.0) {
		this.grid.fill(0);

		const bx = ballBuffer[BALL_OFFSET_X];
		const by = ballBuffer[BALL_OFFSET_Y];

		for (let i = 0; i < PLAYER_COUNT; i++) {
			const offset = i * PLAYER_STRIDE;
			const px = playerBuffer[offset + PLAYER_OFFSET_X];
			const py = playerBuffer[offset + PLAYER_OFFSET_Y];
			const team = i < 11 ? 0 : 1; // Team A (0-10), Team B (11-21)

			// Calculate weight based on distance to ball (players near the ball have more "impact")
			const distToBallSq = (px - bx) ** 2 + (py - by) ** 2;
			// Softening the ball weight curve and making it phase-aware
			const ballWeight = 1.0 + (1.5 * ballWeightMultiplier) / (1.0 + Math.sqrt(distToBallSq) / 10.0);

			// Calculate grid bounds for influence falloff (e.g., 15m radius)
			const radius = 15;
			const radiusSq = radius * radius;
			const minCol = Math.max(0, Math.floor((px - radius) * this.invCellW));
			const maxCol = Math.min(this.cols - 1, Math.floor((px + radius) * this.invCellW));
			const minRow = Math.max(0, Math.floor((py - radius) * this.invCellH));
			const maxRow = Math.min(this.rows - 1, Math.floor((py + radius) * this.invCellH));

			for (let r = minRow; r <= maxRow; r++) {
				const rowOffset = r * this.cols;
				const cellY = (r + 0.5) * this.cellH;
				const dy = cellY - py;
				const dySq = dy * dy;

				for (let c = minCol; c <= maxCol; c++) {
					const cellX = (c + 0.5) * this.cellW;
					const dx = cellX - px;
					const distSq = dx * dx + dySq;

					if (distSq < radiusSq) {
						// Using squared distance falloff (1 - d^2/r^2) is faster than linear (1 - d/r)
						const influence = (1.0 - distSq / radiusSq) * ballWeight;
						const gridIdx = (rowOffset + c) * 2 + team;
						this.grid[gridIdx] += influence;
					}
				}
			}
		}
	}

	/**
	 * Returns the "Control" value of a specific point on the pitch.
	 * Positive = Team A controls, Negative = Team B controls.
	 */
	getControlAt(x: number, y: number): number {
		const c = Math.max(0, Math.min(this.cols - 1, Math.floor(x * this.invCellW)));
		const r = Math.max(0, Math.min(this.rows - 1, Math.floor(y * this.invCellH)));
		const idx = (r * this.cols + c) * 2;
		return this.grid[idx] - this.grid[idx + 1];
	}

	/**
	 * Fast version that skips safety bounds (caller must ensure coordinates are reasonable).
	 */
	getControlAtFast(x: number, y: number): number {
		const c = (x * this.invCellW) | 0;
		const r = (y * this.invCellH) | 0;
		// Still clamp to valid array indices just in case of out-of-bounds input
		if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return 0;
		const idx = (r * this.cols + c) * 2;
		return this.grid[idx] - this.grid[idx + 1];
	}
}
