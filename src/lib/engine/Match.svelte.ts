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
    HALF_TIME = 'HALF_TIME',
    SET_PIECE = 'SET_PIECE'
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
    private playerStats: any[] = [];
    
    public currentTime: number = $state(0);
    private maxDuration: number = 90 * 60; // 90 minutes in seconds
    private possessionCooldown: number = 0; // Cooldown after a kick/shot
    private lastPossessorIdx: number | null = null;
    
    private setPieceTimer: number = 0;
    private setPieceTakerIdx: number | null = null;

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
    public setup(startingPositions: { x: number, y: number }[], stats?: any[]) {
        this.initialAnchors = startingPositions;
        if (stats && stats.length > 0) {
            this.playerStats = stats;
        } else if (this.playerStats.length === 0) {
            // Fallback default stats
            for (let i = 0; i < PLAYER_COUNT; i++) {
                this.playerStats.push({ passing: 50, finishing: 50, tackling: 50, dribbling: 50 });
            }
        }
        
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

        // Set Piece Logic
        if (this.status === MatchStatus.SET_PIECE) {
            this.setPieceTimer -= dt;
            
            // Calculate Tactical Anchors for everyone to settle
            this.tactics.updatePhase(this.memory.ballBuffer, this.setPieceTakerIdx);
            const targets = this.tactics.calculateAnchors(this.memory.ballBuffer, this.initialAnchors);
            
            // Override taker's target to be exactly the ball's position
            if (this.setPieceTakerIdx !== null) {
                const bx = this.memory.ballBuffer[BALL_OFFSET_X];
                const by = this.memory.ballBuffer[BALL_OFFSET_Y];
                targets[this.setPieceTakerIdx] = { x: bx, y: by };
                
                const takerTeam = this.setPieceTakerIdx < 11 ? 0 : 1;
                
                // Dynamic Set Piece Targets: Pull a teammate close
                let closestTeammate = -1;
                let minTeammateDistSq = Infinity;
                const startIdx = takerTeam === 0 ? 0 : 11;
                const endIdx = takerTeam === 0 ? 11 : 22;

                for (let i = startIdx; i < endIdx; i++) {
                    if (i === this.setPieceTakerIdx || i === 0 || i === 11) continue;
                    const target = targets[i];
                    const distSq = (target.x - bx)**2 + (target.y - by)**2;
                    if (distSq < minTeammateDistSq) {
                        minTeammateDistSq = distSq;
                        closestTeammate = i;
                    }
                }

                if (closestTeammate !== -1) {
                    // Pull teammate 70% of the way towards the thrower
                    targets[closestTeammate].x = bx + (targets[closestTeammate].x - bx) * 0.3;
                    targets[closestTeammate].y = by + (targets[closestTeammate].y - by) * 0.3;

                    // Find closest opponent to mark them
                    const oppStart = takerTeam === 0 ? 11 : 0;
                    const oppEnd = takerTeam === 0 ? 22 : 11;
                    let closestOpp = -1;
                    let minOppDistSq = Infinity;
                    
                    for (let j = oppStart; j < oppEnd; j++) {
                        if (j === 0 || j === 11) continue;
                        const target = targets[j];
                        const teammateTarget = targets[closestTeammate];
                        const distSq = (target.x - teammateTarget.x)**2 + (target.y - teammateTarget.y)**2;
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
            }

            // Update players to move into position
            PhysicsEngine.updatePlayers(this.memory.playerBuffer, targets, dt);

            // Check if taker has arrived at the ball
            let hasArrived = false;
            if (this.setPieceTakerIdx !== null) {
                const offset = this.setPieceTakerIdx * PLAYER_STRIDE;
                const px = this.memory.playerBuffer[offset + PLAYER_OFFSET_X];
                const py = this.memory.playerBuffer[offset + PLAYER_OFFSET_Y];
                const bx = this.memory.ballBuffer[BALL_OFFSET_X];
                const by = this.memory.ballBuffer[BALL_OFFSET_Y];
                const distSq = (px - bx)**2 + (py - by)**2;
                
                if (distSq < 2.25) { // within 1.5m
                    hasArrived = true;
                    // Snap the taker exactly to the ball to prevent orbiting
                    this.memory.playerBuffer[offset + PLAYER_OFFSET_X] = bx;
                    this.memory.playerBuffer[offset + PLAYER_OFFSET_Y] = by;
                    this.memory.playerBuffer[offset + PLAYER_OFFSET_VX] = 0;
                    this.memory.playerBuffer[offset + PLAYER_OFFSET_VY] = 0;
                }
            }

            // Resume play only after timer expires AND taker has arrived
            if (this.setPieceTimer <= 0 && hasArrived && this.setPieceTakerIdx !== null) {
                // Execute pass to resume play
                const team = this.setPieceTakerIdx < 11 ? 0 : 1;
                const passTarget = this.findPassTarget(this.setPieceTakerIdx, team, true);
                
                if (passTarget) {
                    const bx = this.memory.ballBuffer[BALL_OFFSET_X];
                    const by = this.memory.ballBuffer[BALL_OFFSET_Y];
                    const dx = passTarget.x - bx;
                    const dy = passTarget.y - by;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    const passPower = 12.0;
                    this.memory.ballBuffer[BALL_OFFSET_VX] = (dx / dist) * passPower;
                    this.memory.ballBuffer[BALL_OFFSET_VY] = (dy / dist) * passPower;
                } else {
                    // Just kick it slightly into the pitch if no target
                    const attackDir = this.getAttackDir(team);
                    this.memory.ballBuffer[BALL_OFFSET_VX] = attackDir * 5.0;
                    this.memory.ballBuffer[BALL_OFFSET_VY] = this.memory.ballBuffer[BALL_OFFSET_Y] < 34 ? 5.0 : -5.0;
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
            const stats = this.playerStats[possessionIdx] || { passing: 50, finishing: 50, tackling: 50, dribbling: 50 };
            
            // AI Action Decisions
            const attackDir = this.getAttackDir(team);
            const inFinalThird = attackDir === 1 ? px > 85 : px < 20;
            // Use dt-scaled probabilities so decisions remain stable across render speeds.
            const randomPassChance = this.rollChancePerSecond(0.9, dt);
            const randomShotChance = this.rollChancePerSecond(0.55, dt);

            if (inFinalThird && randomShotChance) {
                // Shooting
                const targetGoalX = attackDir === 1 ? 105 : 0;
                const targetGoalY = 34; // Goal center
                
                const dx = targetGoalX - px;
                const dy = targetGoalY - py;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Variable shot power based on finishing rating (15.0 to 30.0)
                const shotPower = 15.0 + (stats.finishing / 100) * 15.0;
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
                    
                    // Variable pass power based on passing rating (10.0 to 20.0)
                    const passPower = 10.0 + (stats.passing / 100) * 10.0;
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
        const attackDir = this.getAttackDir(team);
        const dirX = speed > 0.1 ? vx / speed : attackDir;
        const dirY = speed > 0.1 ? vy / speed : 0.0;

        this.memory.ballBuffer[BALL_OFFSET_X] = px + dirX * lead;
        this.memory.ballBuffer[BALL_OFFSET_Y] = py + dirY * lead;
        
        this.memory.ballBuffer[BALL_OFFSET_VX] = vx;
        this.memory.ballBuffer[BALL_OFFSET_VY] = vy;
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

    /**
     * Finds a valid passing target for the current possessor.
     */
    private findPassTarget(possessorIdx: number, team: number, safeShortPass: boolean = false): { x: number, y: number } | null {
        const startIdx = team === 0 ? 0 : 11;
        const endIdx = team === 0 ? 11 : 22;
        const forwardDir = this.getAttackDir(team);
        
        const px = this.memory.playerBuffer[possessorIdx * PLAYER_STRIDE + PLAYER_OFFSET_X];
        const py = this.memory.playerBuffer[possessorIdx * PLAYER_STRIDE + PLAYER_OFFSET_Y];

        let bestTarget = null;
        let bestDistanceMetric = safeShortPass ? Infinity : 0;

        for (let i = startIdx; i < endIdx; i++) {
            if (i === possessorIdx) continue;

            const targetX = this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_X];
            const targetY = this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_Y];
            
            const distance = Math.sqrt((targetX - px)**2 + (targetY - py)**2);

            if (safeShortPass) {
                // Look for the closest teammate (e.g. for a throw-in)
                if (distance < bestDistanceMetric && distance > 2.0) {
                    bestDistanceMetric = distance;
                    bestTarget = { x: targetX, y: targetY };
                }
            } else {
                // Look for forward passes
                const isAhead = (targetX - px) * forwardDir > 0;
                if (isAhead) {
                    const distanceX = Math.abs(targetX - px);
                    // Prefer passes that move the ball forward significantly, but not too far (max 30m)
                    if (distanceX > bestDistanceMetric && distanceX < 30) {
                        bestDistanceMetric = distanceX;
                        bestTarget = { x: targetX, y: targetY };
                    }
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
                this.status = MatchStatus.KICKOFF;
            } else {
                // Out of bounds - Goal Kick / Corner
                const lastTeam = this.lastPossessorIdx !== null ? (this.lastPossessorIdx < 11 ? 0 : 1) : 0;
                const defendingSide = bx < 0 ? 0 : 1; // 0 = Home side, 1 = Away side
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
                
                this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
                this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
                this.triggerSetPiece(attackingTeam);
            }
        }
        
        // Check Sidelines
        else if (by < 0 || by > 68) {
            // Throw-in
            this.memory.ballBuffer[BALL_OFFSET_Y] = by < 0 ? 0.5 : 67.5;
            this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
            this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
            
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
            
            const distSq = (px - bx)**2 + (py - by)**2;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                closest = i;
            }
        }
        
        this.setPieceTakerIdx = closest;
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
        const reachSq = reach * reach;

        let contenders: { idx: number, distSq: number }[] = [];

        for (let i = 0; i < PLAYER_COUNT; i++) {
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
                const lastPossessorContending = contenders.find(c => c.idx === this.lastPossessorIdx);
                
                if (lastPossessorContending) {
                    // Tackling Roll!
                    const attackerStats = this.playerStats[this.lastPossessorIdx] || { dribbling: 50 };
                    const defenderStats = this.playerStats[closest] || { tackling: 50 };
                    
                    const tackleScore = defenderStats.tackling * Math.random();
                    const dribbleScore = attackerStats.dribbling * Math.random();
                    
                    if (tackleScore < dribbleScore) {
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
}
