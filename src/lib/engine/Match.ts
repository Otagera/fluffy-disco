import { MatchMemory } from './core/MatchMemory';
import { PhysicsEngine } from './physics/Steering';
import { SpatialMap } from './ai/SpatialMap';
import { TacticalManager } from './ai/Tactics';
import { 
    PLAYER_COUNT, PLAYER_STRIDE, PLAYER_OFFSET_X, PLAYER_OFFSET_Y,
    PLAYER_OFFSET_VX, PLAYER_OFFSET_VY,
    BALL_OFFSET_X, BALL_OFFSET_Y, BALL_OFFSET_VX, BALL_OFFSET_VY
} from './core/constants';

export enum MatchStatus {
    KICKOFF = 'KICKOFF',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED'
}

/**
 * Match is the central orchestrator that links memory, physics, and AI.
 */
export class Match {
    public memory: MatchMemory;
    public spatialMap: SpatialMap;
    public tactics: TacticalManager;
    public status: MatchStatus = MatchStatus.KICKOFF;
    
    private initialAnchors: { x: number, y: number }[] = [];
    
    public currentTime: number = 0;
    private maxDuration: number = 90 * 60; // 90 minutes in seconds

    get formattedTime(): string {
        const minutes = Math.floor(this.currentTime / 60);
        const seconds = Math.floor(this.currentTime % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    constructor() {
        this.memory = new MatchMemory();
        this.spatialMap = new SpatialMap();
        this.tactics = new TacticalManager();
    }

    /**
     * Initializes the match with starting positions (e.g., Kick-off).
     */
    public setup(startingPositions: { x: number, y: number }[]) {
        this.initialAnchors = startingPositions;
        this.memory.initialize(startingPositions);
        // Place ball at center
        this.memory.ballBuffer[BALL_OFFSET_X] = 52.5;
        this.memory.ballBuffer[BALL_OFFSET_Y] = 34.0;
        this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
        this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
        
        // Match starts in KICKOFF, but we want it to transition to PLAYING 
        // as soon as the clock starts if we want immediate movement.
    }

    /**
     * Executes a single simulation step.
     * @param dt Timestep in seconds.
     */
    public tick(dt: number) {
        if (this.status === MatchStatus.PAUSED) return;

        // 1. Update AI Spatial Awareness (Influence Map)
        this.spatialMap.update(this.memory.playerBuffer, this.memory.ballBuffer);

        // 2. Identify Possession
        const possessionIdx = this.resolvePossession();

        // Auto-start play if ball moves or someone grabs it, 
        // or just start after a tiny delay to get players moving
        if (this.status === MatchStatus.KICKOFF && (possessionIdx !== null || this.currentTime > 0.1)) {
            this.status = MatchStatus.PLAYING;
        }

        this.tactics.updatePhase(this.memory.ballBuffer, possessionIdx);

        // 3. Calculate Tactical Anchors
        // Deadlock Fix: Always use tactical anchors unless match is explicitly paused/waiting
        const targets = this.status === MatchStatus.KICKOFF 
            ? this.initialAnchors 
            : this.tactics.calculateAnchors(this.memory.ballBuffer, this.initialAnchors);

        // 4. Basic Ball Interaction (Dribbling)
        if (possessionIdx !== null) {
            const offset = possessionIdx * PLAYER_STRIDE;
            const px = this.memory.playerBuffer[offset + PLAYER_OFFSET_X];
            const py = this.memory.playerBuffer[offset + PLAYER_OFFSET_Y];
            const vx = this.memory.playerBuffer[offset + PLAYER_OFFSET_VX];
            const vy = this.memory.playerBuffer[offset + PLAYER_OFFSET_VY];

            const speed = Math.sqrt(vx * vx + vy * vy);
            const lead = 0.6; // Slightly tighter ball control
            
            // Apply a "stick" force to the ball to keep it near the player
            // Use velocity-based lead if moving, otherwise default forward lead
            const dirX = speed > 0.1 ? vx / speed : 1.0;
            const dirY = speed > 0.1 ? vy / speed : 0.0;

            this.memory.ballBuffer[BALL_OFFSET_X] = px + dirX * lead;
            this.memory.ballBuffer[BALL_OFFSET_Y] = py + dirY * lead;
            
            // Match velocity
            this.memory.ballBuffer[BALL_OFFSET_VX] = vx;
            this.memory.ballBuffer[BALL_OFFSET_VY] = vy;
        }

        // 5. Update Physics
        PhysicsEngine.updatePlayers(this.memory.playerBuffer, targets, dt);
        PhysicsEngine.updateBall(this.memory.ballBuffer, dt);

        this.currentTime += dt;
    }

    /**
     * Runs a full match simulation at maximum CPU speed.
     */
    public simulateMatch(): { homeScore: number, awayScore: number, duration: number } {
        const step = 0.1; 
        const totalSteps = this.maxDuration / step;

        for (let i = 0; i < totalSteps; i++) {
            this.tick(step);
        }

        return { homeScore: 0, awayScore: 0, duration: this.currentTime };
    }

    /**
     * Identifies which player (if any) is in possession of the ball.
     */
    private resolvePossession(): number | null {
        const bx = this.memory.ballBuffer[BALL_OFFSET_X];
        const by = this.memory.ballBuffer[BALL_OFFSET_Y];
        const reach = 2.0; // Reach in meters

        let closestIdx = -1;
        let minDistSq = reach * reach;

        for (let i = 0; i < PLAYER_COUNT; i++) {
            const offset = i * PLAYER_STRIDE;
            const px = this.memory.playerBuffer[offset + PLAYER_OFFSET_X];
            const py = this.memory.playerBuffer[offset + PLAYER_OFFSET_Y];

            const dx = px - bx;
            const dy = py - by;
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closestIdx = i;
            }
        }
        return closestIdx === -1 ? null : closestIdx;
    }
}
