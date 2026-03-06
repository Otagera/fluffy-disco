import { 
    PLAYER_COUNT, PLAYER_STRIDE, 
    BALL_STRIDE, BALL_OFFSET_FRICTION 
} from './constants';

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
        
        // Default Ball Friction
        this.ballBuffer[BALL_OFFSET_FRICTION] = 0.99; // Velocity decay per tick
    }

    /**
     * Utility to reset player positions to a center point or formation.
     */
    public initialize(startingPositions: { x: number, y: number }[]) {
        for (let i = 0; i < PLAYER_COUNT; i++) {
            const offset = i * PLAYER_STRIDE;
            const pos = startingPositions[i] || { x: 0, y: 0 };
            
            this.playerBuffer[offset + 0] = pos.x; // X
            this.playerBuffer[offset + 1] = pos.y; // Y
            this.playerBuffer[offset + 4] = 10.5;   // Max Speed 10.5m/s (~38km/h)
            this.playerBuffer[offset + 5] = 850.0;  // High acceleration force (increased for maneuverability/braking)
            this.playerBuffer[offset + 6] = 75.0;   // Mass
            this.playerBuffer[offset + 7] = 1.0;   // 100% stamina
        }
    }
}
