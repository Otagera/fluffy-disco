import { 
    PLAYER_COUNT, PLAYER_STRIDE, 
    PLAYER_OFFSET_X, PLAYER_OFFSET_Y,
    BALL_OFFSET_X, BALL_OFFSET_Y
} from '../core/constants';

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

    constructor(width: number = 105, height: number = 68, resolution: number = 5) {
        this.pitchWidth = width;
        this.pitchHeight = height;
        this.cols = Math.ceil(width / resolution);
        this.rows = Math.ceil(height / resolution);
        // Each cell stores: [Team A Influence, Team B Influence]
        this.grid = new Float32Array(this.cols * this.rows * 2);
    }

    /**
     * Updates the influence map based on player positions and ball location.
     */
    update(playerBuffer: Float32Array, ballBuffer: Float32Array) {
        this.grid.fill(0);
        const cellW = this.pitchWidth / this.cols;
        const cellH = this.pitchHeight / this.rows;

        for (let i = 0; i < PLAYER_COUNT; i++) {
            const offset = i * PLAYER_STRIDE;
            const px = playerBuffer[offset + PLAYER_OFFSET_X];
            const py = playerBuffer[offset + PLAYER_OFFSET_Y];
            const team = i < 11 ? 0 : 1; // Team A (0-10), Team B (11-21)

            // Calculate grid bounds for influence falloff (e.g., 15m radius)
            const radius = 15;
            const minCol = Math.max(0, Math.floor((px - radius) / cellW));
            const maxCol = Math.min(this.cols - 1, Math.floor((px + radius) / cellW));
            const minRow = Math.max(0, Math.floor((py - radius) / cellH));
            const maxRow = Math.min(this.rows - 1, Math.floor((py + radius) / cellH));

            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    const cellX = (c + 0.5) * cellW;
                    const cellY = (r + 0.5) * cellH;
                    const dx = cellX - px;
                    const dy = cellY - py;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < radius * radius) {
                        const influence = 1.0 - (Math.sqrt(distSq) / radius);
                        const gridIdx = (r * this.cols + c) * 2 + team;
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
        const c = Math.max(0, Math.min(this.cols - 1, Math.floor(x / (this.pitchWidth / this.cols))));
        const r = Math.max(0, Math.min(this.rows - 1, Math.floor(y / (this.pitchHeight / this.rows))));
        const idx = (r * this.cols + c) * 2;
        return this.grid[idx] - this.grid[idx + 1];
    }
}
