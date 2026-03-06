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
    PAUSED = 'PAUSED',
    HALF_TIME = 'HALF_TIME'
}

/**
 * Match is the central orchestrator that links memory, physics, and AI.
 */
export class Match {
    public memory: MatchMemory;
    public spatialMap: SpatialMap;
    public tactics: TacticalManager;
    public homeScore: number = $state(0);
    public awayScore: number = $state(0);
    public status: MatchStatus = $state(MatchStatus.KICKOFF);
    public currentHalf: number = $state(1);
    
    private initialAnchors: { x: number, y: number }[] = [];
    
    public currentTime: number = $state(0);
    private maxDuration: number = 90 * 60; // 90 minutes in seconds
    private possessionCooldown: number = 0; // Cooldown after a kick/shot
    private lastPossessorIdx: number | null = null;

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
        if (this.status === MatchStatus.PAUSED || this.status === MatchStatus.HALF_TIME) return;

        // Check for Half Time
        if (this.currentHalf === 1 && this.currentTime >= 2700) {
            this.status = MatchStatus.HALF_TIME;
            return;
        }

        // 1. Update AI Spatial Awareness (Influence Map)
        this.spatialMap.update(this.memory.playerBuffer, this.memory.ballBuffer);

        // 2. Identify Possession
        if (this.possessionCooldown > 0) {
            this.possessionCooldown -= dt;
        }
        const possessionIdx = this.resolvePossession();

        // Auto-start play if ball moves or someone grabs it, 
        // or just start after a tiny delay to get players moving
        if (this.status === MatchStatus.KICKOFF && (possessionIdx !== null || this.currentTime > 0.1)) {
            this.status = MatchStatus.PLAYING;
        }

        this.tactics.updatePhase(this.memory.ballBuffer, possessionIdx);

        // 3. Calculate Tactical Anchors
        const targets = this.status === MatchStatus.KICKOFF 
            ? this.initialAnchors 
            : this.tactics.calculateAnchors(this.memory.ballBuffer, this.initialAnchors);

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
            
            // AI Action Decisions
            const inFinalThird = team === 0 ? px > 85 : px < 20;
            // Use dt-scaled probabilities so decisions remain stable across render speeds.
            const randomPassChance = this.rollChancePerSecond(0.9, dt);
            const randomShotChance = this.rollChancePerSecond(0.55, dt);

            if (inFinalThird && randomShotChance) {
                // Shooting
                const targetGoalX = team === 0 ? 105 : 0;
                const targetGoalY = 34; // Goal center
                
                const dx = targetGoalX - px;
                const dy = targetGoalY - py;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // High-power kick toward goal
                const shotPower = 22.0;
                this.memory.ballBuffer[BALL_OFFSET_VX] = (dx / dist) * shotPower;
                this.memory.ballBuffer[BALL_OFFSET_VY] = (dy / dist) * shotPower;
                
                this.possessionCooldown = 1.0;
                this.lastPossessorIdx = possessionIdx;
            } else if (randomPassChance) {
                // Passing
                const passTarget = this.findPassTarget(possessionIdx, team);
                if (passTarget) {
                    const dx = passTarget.x - px;
                    const dy = passTarget.y - py;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    const passPower = 15.0; // Moderate power for a pass
                    this.memory.ballBuffer[BALL_OFFSET_VX] = (dx / dist) * passPower;
                    this.memory.ballBuffer[BALL_OFFSET_VY] = (dy / dist) * passPower;
                    
                    this.possessionCooldown = 0.5; // Short cooldown for passes
                    this.lastPossessorIdx = possessionIdx;
                } else {
                    // Dribble if no pass available
                    this.dribbleBall(px, py, vx, vy, speed, lead, team);
                }
            } else {
                // Dribble
                this.dribbleBall(px, py, vx, vy, speed, lead, team);
            }
        }

        // 5. Update Physics
        PhysicsEngine.updatePlayers(this.memory.playerBuffer, targets, dt);
        PhysicsEngine.updateBall(this.memory.ballBuffer, dt);

        this.checkBoundariesAndGoals();

        this.currentTime += dt;
    }

    private dribbleBall(px: number, py: number, vx: number, vy: number, speed: number, lead: number, team: number) {
        const dirX = speed > 0.1 ? vx / speed : (team === 0 ? 1.0 : -1.0);
        const dirY = speed > 0.1 ? vy / speed : 0.0;

        this.memory.ballBuffer[BALL_OFFSET_X] = px + dirX * lead;
        this.memory.ballBuffer[BALL_OFFSET_Y] = py + dirY * lead;
        
        this.memory.ballBuffer[BALL_OFFSET_VX] = vx;
        this.memory.ballBuffer[BALL_OFFSET_VY] = vy;
    }

    private rollChancePerSecond(ratePerSecond: number, dt: number): boolean {
        if (ratePerSecond <= 0 || dt <= 0) return false;
        const p = 1 - Math.exp(-ratePerSecond * dt);
        return Math.random() < p;
    }

    /**
     * Finds a valid passing target for the current possessor.
     */
    private findPassTarget(possessorIdx: number, team: number): { x: number, y: number } | null {
        const startIdx = team === 0 ? 0 : 11;
        const endIdx = team === 0 ? 11 : 22;
        const forwardDir = team === 0 ? 1 : -1;
        
        const px = this.memory.playerBuffer[possessorIdx * PLAYER_STRIDE + PLAYER_OFFSET_X];
        const py = this.memory.playerBuffer[possessorIdx * PLAYER_STRIDE + PLAYER_OFFSET_Y];

        let bestTarget = null;
        let maxForwardDistance = 0;

        for (let i = startIdx; i < endIdx; i++) {
            if (i === possessorIdx) continue;

            const targetX = this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_X];
            const targetY = this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_Y];
            
            // Is the teammate ahead of the ball carrier?
            const isAhead = (targetX - px) * forwardDir > 0;
            
            if (isAhead) {
                const distanceX = Math.abs(targetX - px);
                // Prefer passes that move the ball forward significantly, but not too far (max 30m)
                if (distanceX > maxForwardDistance && distanceX < 30) {
                    maxForwardDistance = distanceX;
                    bestTarget = { x: targetX, y: targetY };
                }
            }
        }

        return bestTarget;
    }

    /**
     * Checks if the ball crossed any pitch boundaries and updates scores if a goal was scored.
     */
    private checkBoundariesAndGoals() {
        let bx = this.memory.ballBuffer[BALL_OFFSET_X];
        let by = this.memory.ballBuffer[BALL_OFFSET_Y];
        
        // Pitch dimensions are approximately 105 x 68 based on start positions / multipliers
        // Check Goal Lines
        if (bx < 0 || bx > 105) {
            // Goal posts Y range roughly 30.34 to 37.66
            const isGoal = by > 30.34 && by < 37.66;
            
            if (isGoal) {
                if (bx < 0) this.awayScore++; // Ball crossed left line
                else this.homeScore++;        // Ball crossed right line
                
                // Reset positions
                this.setup(this.initialAnchors);
            } else {
                // Out of bounds - Goal Kick / Corner
                this.memory.ballBuffer[BALL_OFFSET_X] = 52.5;
                this.memory.ballBuffer[BALL_OFFSET_Y] = 34.0;
                this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
                this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
            }
        }
        
        // Check Sidelines
        if (by < 0 || by > 68) {
            this.memory.ballBuffer[BALL_OFFSET_Y] = by < 0 ? 1.0 : 67.0;
            this.memory.ballBuffer[BALL_OFFSET_VX] *= 0.5;
            this.memory.ballBuffer[BALL_OFFSET_VY] *= -0.5;
        }
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

        return { homeScore: this.homeScore, awayScore: this.awayScore, duration: this.currentTime };
    }

    /**
     * Identifies which player (if any) is in possession of the ball.
     */
    private resolvePossession(): number | null {
        if (this.possessionCooldown > 0) return null;

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
