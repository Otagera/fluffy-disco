import { MatchMemory } from './core/MatchMemory';
import { PhysicsEngine } from './physics/Steering';
import { SpatialMap } from './ai/SpatialMap';
import { TacticalManager } from './ai/Tactics';
import { MathUtils } from './core/MathUtils';
import { 
    PLAYER_COUNT, PLAYER_STRIDE, PLAYER_OFFSET_X, PLAYER_OFFSET_Y,
    PLAYER_OFFSET_VX, PLAYER_OFFSET_VY, PLAYER_OFFSET_STAMINA,
    BALL_OFFSET_X, BALL_OFFSET_Y, BALL_OFFSET_Z, BALL_OFFSET_VX, BALL_OFFSET_VY, BALL_OFFSET_VZ
} from './core/constants';

export enum MatchStatus {
    KICKOFF = 'KICKOFF',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED',
    HALF_TIME = 'HALF_TIME',
    SET_PIECE = 'SET_PIECE',
    FREE_KICK = 'FREE_KICK'
}

export interface MatchEvent {
    type: 'pass' | 'shot' | 'foul' | 'goal';
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
    public homeScore: number = $state(0);
    public awayScore: number = $state(0);
    public status: MatchStatus = $state(MatchStatus.KICKOFF);
    public currentHalf: number = $state(1);
    
    // Analytics
    public analytics = {
        possessionTime: [0, 0], // [Home, Away]
        events: [] as MatchEvent[],
        heatmapSamples: [] as { x: number, y: number, team: number }[]
    };
    
    private initialAnchors: { x: number, y: number }[] = [];
    private playerStats: any[] = [];
    private playerRoles: string[] = [];           // corresponding roles for each stat index

    // bench storage (also index-aligned)
    public benchStats: any[] = [];
    public benchRoles: string[] = [];
    public subsUsed: [number, number] = [0, 0];
    private lastSubCheckMinute: number = -1;
    
    private analyticsSampleTimer: number = 0;
    
    public currentTime: number = $state(0);
    private maxDuration: number = 90 * 60; // 90 minutes in seconds
    private possessionCooldown: number = 0; // Cooldown after a kick/shot
    private lastPossessorIdx: number | null = null;
    
    private setPieceTimer: number = 0;
    private setPieceTakerIdx: number | null = null;
    
    private offsideLineTeam0: number = 52.5;
    private offsideLineTeam1: number = 52.5;

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
    /**
     * Initializes the match with starting positions (e.g., Kick-off).
     * Optionally supply parallel roles array that aligns with stats.
     */
    public setup(startingPositions: { x: number, y: number }[], stats?: any[], roles?: string[]) {
        this.initialAnchors = startingPositions;
        if (stats && stats.length > 0) {
            this.playerStats = stats;
        } else if (this.playerStats.length === 0) {
            // Fallback default stats
            for (let i = 0; i < PLAYER_COUNT; i++) {
                this.playerStats.push({ passing: 50, finishing: 50, tackling: 50, dribbling: 50, vision: 50, composure: 50 });
            }
        }
        if (roles && roles.length === this.playerStats.length) {
            this.playerRoles = roles;
        } else if (this.playerRoles.length === 0) {
            this.playerRoles = new Array(this.playerStats.length).fill('');
        }
        
        this.memory.initialize(startingPositions);
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
        if (this.status === MatchStatus.PAUSED || this.status === MatchStatus.HALF_TIME) return;

        // Check for Half Time
        if (this.currentHalf === 1 && this.currentTime >= 2700) {
            this.status = MatchStatus.HALF_TIME;
            return;
        }

        // Calculate Offside Lines
        let homeDefendersX: number[] = [];
        let awayDefendersX: number[] = [];
        for (let i = 0; i < 11; i++) {
            homeDefendersX.push(this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_X]);
            awayDefendersX.push(this.memory.playerBuffer[(i + 11) * PLAYER_STRIDE + PLAYER_OFFSET_X]);
        }
        
        // Sort to find the second last defender (including GK)
        homeDefendersX.sort((a, b) => a - b);
        awayDefendersX.sort((a, b) => b - a); // Reverse sort for away team defending right-to-left
        
        // Team 0 attacks 105 (checks against awayDefendersX[1])
        // Team 1 attacks 0 (checks against homeDefendersX[1])
        const offsideLineTeam1 = awayDefendersX[1] ?? 52.5; // Line Team 0 must not cross
        const offsideLineTeam0 = homeDefendersX[1] ?? 52.5; // Line Team 1 must not cross

        this.offsideLineTeam0 = offsideLineTeam0;
        this.offsideLineTeam1 = offsideLineTeam1;

        // continue CPU subs below

        // 1. Update AI Spatial Awareness (Influence Map)
        this.spatialMap.update(this.memory.playerBuffer, this.memory.ballBuffer);

        // 1.5 AI Substitutions (CPU)
        this.handleCPUSubs();

        // Analytics: Heatmap Sampling (every 5 seconds)
        this.analyticsSampleTimer += dt;
        if (this.analyticsSampleTimer >= 5.0) {
            this.analyticsSampleTimer = 0;
            const bx = this.memory.ballBuffer[BALL_OFFSET_X];
            const by = this.memory.ballBuffer[BALL_OFFSET_Y];
            const lastPossessorTeam = this.lastPossessorIdx !== null ? (this.lastPossessorIdx < 11 ? 0 : 1) : null;
            if (lastPossessorTeam !== null) {
                this.analytics.heatmapSamples.push({ 
                    x: bx / 105, 
                    y: by / 68, 
                    team: lastPossessorTeam 
                });
            }
        }

        // Set Piece / Free Kick Logic
        if (this.status === MatchStatus.SET_PIECE || this.status === MatchStatus.FREE_KICK) {
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
                } else if (this.status === MatchStatus.FREE_KICK) {
                    // Free Kick logic: Defensive Wall
                    const attackDir = this.getAttackDir(takerTeam);
                    const goalX = attackDir === 1 ? 105 : 0;
                    const goalY = 34;
                    const distToGoal = Math.sqrt((goalX - bx)**2 + (goalY - by)**2);
                    
                    if (distToGoal < 30) {
                        // Assemble a wall 9.15m away
                        const wallDist = 9.15;
                        const wx = bx + ((goalX - bx) / distToGoal) * wallDist;
                        const wy = by + ((goalY - by) / distToGoal) * wallDist;
                        
                        const oppStart = takerTeam === 0 ? 11 : 0;
                        const oppEnd = takerTeam === 0 ? 22 : 11;
                        
                        // Pick 3 opponents for the wall
                        let wallBuilders = [];
                        for (let j = oppStart; j < oppEnd; j++) {
                            if (j === 0 || j === 11) continue;
                            wallBuilders.push({ idx: j, dist: Math.abs(targets[j].x - wx) + Math.abs(targets[j].y - wy) });
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
                const team = this.setPieceTakerIdx < 11 ? 0 : 1;
                const attackDir = this.getAttackDir(team);
                const stats = this.playerStats[this.setPieceTakerIdx] || { passing: 50, finishing: 50 };
                const bx = this.memory.ballBuffer[BALL_OFFSET_X];
                const by = this.memory.ballBuffer[BALL_OFFSET_Y];
                
                const goalX = attackDir === 1 ? 105 : 0;
                const distToGoal = Math.sqrt((goalX - bx)**2 + (34 - by)**2);

                if (this.status === MatchStatus.FREE_KICK && distToGoal < 30) {
                    // Direct shot on goal
                    const dx = goalX - bx;
                    const dy = 34 - by;
                    
                    const errorSpread = MathUtils.clamp(2.0 * (1.0 - stats.finishing / 100), 0.1, 2.0);
                    const ty = 34 + MathUtils.nextGaussian(0, errorSpread);
                    const targetedDy = ty - by;

                    const shotPower = 20.0 + (stats.finishing / 100) * 10.0;
                    this.memory.ballBuffer[BALL_OFFSET_VX] = (dx / distToGoal) * shotPower;
                    this.memory.ballBuffer[BALL_OFFSET_VY] = (targetedDy / distToGoal) * shotPower;
                    this.memory.ballBuffer[BALL_OFFSET_VZ] = 4.0; // Loft it over the wall
                } else {
                    // Execute pass to resume play
                    const passTarget = this.findPassTarget(this.setPieceTakerIdx, team, this.status === MatchStatus.SET_PIECE);
                    if (passTarget) {
                        const dx = passTarget.x - bx;
                        const dy = passTarget.y - by;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        const passPower = 12.0;
                        this.memory.ballBuffer[BALL_OFFSET_VX] = (dx / dist) * passPower;
                        this.memory.ballBuffer[BALL_OFFSET_VY] = (dy / dist) * passPower;
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

        // kickoff transition is handled later in the normal flow below (possession check) – no early return here

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
        if (this.status === MatchStatus.KICKOFF && (possessionIdx !== null || this.currentTime + dt > 0.1)) {
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
            const stats = this.playerStats[possessionIdx] || { passing: 50, finishing: 50, tackling: 50, dribbling: 50, vision: 50, composure: 50 };
            
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
                
                // Add Gaussian error based on finishing rating
                const errorSpread = MathUtils.clamp(2.0 * (1.0 - stats.finishing / 100), 0.1, 2.0);
                const ty = targetGoalY + MathUtils.nextGaussian(0, errorSpread);
                
                const dx = targetGoalX - px;
                const dy = ty - py;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Variable shot power based on finishing rating (15.0 to 30.0)
                const shotPower = 15.0 + (stats.finishing / 100) * 15.0;
                this.memory.ballBuffer[BALL_OFFSET_VX] = (dx / dist) * shotPower;
                this.memory.ballBuffer[BALL_OFFSET_VY] = (dy / dist) * shotPower;
                // Add some height to shots
                this.memory.ballBuffer[BALL_OFFSET_VZ] = 2.0 + Math.random() * 4.0;
                
                this.analytics.events.push({ type: 'shot', team, playerId: possessionIdx, x: px, y: py, time: this.currentTime });
                
                this.possessionCooldown = 1.0;
                this.lastPossessorIdx = possessionIdx;
            } else if (randomPassChance) {
                // Passing
                const passTarget = this.findPassTarget(possessionIdx, team);
                if (passTarget) {
                    // Add Gaussian error based on passing rating
                    const errorSpread = MathUtils.clamp(3.0 * (1.0 - stats.passing / 100), 0.2, 3.0);
                    const tx = passTarget.x + MathUtils.nextGaussian(0, errorSpread);
                    const ty = passTarget.y + MathUtils.nextGaussian(0, errorSpread);

                    const dx = tx - px;
                    const dy = ty - py;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // Variable pass power based on passing rating (10.0 to 20.0)
                    const passPower = 10.0 + (stats.passing / 100) * 10.0;
                    this.memory.ballBuffer[BALL_OFFSET_VX] = (dx / dist) * passPower;
                    this.memory.ballBuffer[BALL_OFFSET_VY] = (dy / dist) * passPower;
                    
                    this.analytics.events.push({ type: 'pass', team, playerId: possessionIdx, x: px, y: py, endX: tx, endY: ty, time: this.currentTime });
                    
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
        this.memory.ballBuffer[BALL_OFFSET_Z] = 0; // Stick to ground
        
        this.memory.ballBuffer[BALL_OFFSET_VX] = vx;
        this.memory.ballBuffer[BALL_OFFSET_VY] = vy;
        this.memory.ballBuffer[BALL_OFFSET_VZ] = 0;
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
     * Handles automatic CPU substitutions for both teams.
     * Called each tick but only acts once per minute starting after 60'.
     */
    private handleCPUSubs() {
        const minute = Math.floor(this.currentTime / 60);
        if (minute < 60 || minute === this.lastSubCheckMinute) return;
        this.lastSubCheckMinute = minute;

        for (let team = 0; team < 2; team++) {
            if (this.subsUsed[team] >= 5) continue;
            const startIdx = team === 0 ? 0 : 11;
            const endIdx = team === 0 ? 11 : 22;

            // find tired non-GK player
            let tiredIdx = -1;
            let minStam = 999;
            for (let i = startIdx; i < endIdx; i++) {
                const stam = this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_STAMINA];
                const role = this.playerRoles[i] || '';
                if (role === 'GK') continue;
                if (stam < minStam) { minStam = stam; tiredIdx = i; }
            }

            // stamina is stored 0..1 so threshold around 0.6 corresponds to 60%
            if (tiredIdx !== -1 && minStam < 0.6 && this.benchStats.length > 0) {
                const tiredRole = this.playerRoles[tiredIdx] || '';
                const benchIdx = this.benchRoles.findIndex(r => r === tiredRole);
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
        if (this.subsUsed[team] >= 5) return false;
        if (benchIdx < 0 || benchIdx >= this.benchStats.length) return false;
        const incomingStats = this.benchStats.splice(benchIdx, 1)[0];
        const incomingRole = this.benchRoles.splice(benchIdx, 1)[0];

        // replace starter stats/role
        this.playerStats[globalIdx] = incomingStats;
        this.playerRoles[globalIdx] = incomingRole;

        // restore stamina for new player (scale 0..1)
        this.memory.playerBuffer[globalIdx * PLAYER_STRIDE + PLAYER_OFFSET_STAMINA] = 1.0;

        this.subsUsed[team]++;
        return true;
    }

    /**
     * Finds a valid passing target for the current possessor.
     */
    private findPassTarget(possessorIdx: number, team: number, safeShortPass: boolean = false): { x: number, y: number } | null {
        const startIdx = team === 0 ? 0 : 11;
        const endIdx = team === 0 ? 11 : 22;
        const attackDir = this.getAttackDir(team);
        
        const px = this.memory.playerBuffer[possessorIdx * PLAYER_STRIDE + PLAYER_OFFSET_X];
        const py = this.memory.playerBuffer[possessorIdx * PLAYER_STRIDE + PLAYER_OFFSET_Y];

        const vision = this.playerStats[possessorIdx]?.vision || 50;
        const visionRange = 10.0 + (vision / 100) * 40.0; // 10m to 50m

        let bestTarget = null;
        let bestScore = -Infinity;

        // Use appropriate offside line depending on team and half direction
        let activeOffsideLine: number | null = null;
        if (attackDir === 1) {
            activeOffsideLine = team === 0 ? this.offsideLineTeam1 : this.offsideLineTeam0;
        } else {
            activeOffsideLine = team === 0 ? this.offsideLineTeam1 : this.offsideLineTeam0;
        }

        for (let i = startIdx; i < endIdx; i++) {
            if (i === possessorIdx) continue;

            const targetX = this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_X];
            const targetY = this.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_Y];
            
            // Offside Check
            // A player is offside if they are in the opponent's half, ahead of the ball, AND ahead of the offside line
            const inOpponentHalf = attackDir === 1 ? targetX > 52.5 : targetX < 52.5;
            const aheadOfBall = attackDir === 1 ? targetX > px : targetX < px;
            const aheadOfLine = attackDir === 1 ? targetX > activeOffsideLine : targetX < activeOffsideLine;
            
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
                const control = this.spatialMap.getControlAt(sampleX, sampleY);
                laneSafety += (team === 0 ? control : -control);
            }
            laneSafety /= steps;

            // Final score calculation
            let score = 0;
            if (safeShortPass) {
                score = -dist; // Just prefer closest
            } else {
                // Heuristic: Weighted progression, lane safety, and distance penalty
                score = (progression * 2.0) + (laneSafety * 10.0) - (dist * 0.1);
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
        let bx = this.memory.ballBuffer[BALL_OFFSET_X];
        let by = this.memory.ballBuffer[BALL_OFFSET_Y];
        let bz = this.memory.ballBuffer[BALL_OFFSET_Z];
        
        // Check Goal Lines
        if (bx < 0 || bx > 105) {
            // Goal posts Y range roughly 30.34 to 37.66
            // Must also be below crossbar height (roughly 2.44m)
            const isGoal = by > 30.34 && by < 37.66 && bz < 2.44;
            
            if (isGoal) {
                const scoringTeam = bx < 0 ? 1 : 0;
                if (bx < 0) this.awayScore++; // Ball crossed left line
                else this.homeScore++;        // Ball crossed right line
                
                this.analytics.events.push({ 
                    type: 'goal', 
                    team: scoringTeam, 
                    playerId: this.lastPossessorIdx !== null ? this.lastPossessorIdx : undefined,
                    x: bx, 
                    y: by, 
                    time: this.currentTime 
                });

                // Reset positions
                this.setup(this.initialAnchors, this.playerStats);
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
                
                this.memory.ballBuffer[BALL_OFFSET_Z] = 0;
                this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
                this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
                this.memory.ballBuffer[BALL_OFFSET_VZ] = 0;
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
        const bz = this.memory.ballBuffer[BALL_OFFSET_Z];
        const reach = 2.0; // Reach in meters
        const reachSq = reach * reach;

        // Ball must be low enough to control
        if (bz > 1.5) return null;

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
                    // Gaussian Tackling Duel!
                    const attackerStats = this.playerStats[this.lastPossessorIdx] || { dribbling: 50, composure: 50 };
                    const defenderStats = this.playerStats[closest] || { tackling: 50, aggression: 50 };
                    
                    // Mean is based on attribute, spread is based on composure/concentration
                    const tackleScore = MathUtils.nextGaussian(defenderStats.tackling, 15);
                    const dribbleScore = MathUtils.nextGaussian(attackerStats.dribbling, 15);
                    
                    if (tackleScore < dribbleScore) {
                        // Check for Foul (Critical Failure + High Aggression)
                        if (dribbleScore - tackleScore > 25 && Math.random() < (defenderStats.aggression / 100)) {
                            this.triggerFoul(this.lastPossessorIdx);
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

    private triggerFoul(fouledIdx: number) {
        this.status = MatchStatus.FREE_KICK;
        this.setPieceTimer = 3.0;
        this.setPieceTakerIdx = fouledIdx;
        
        const fouledTeam = fouledIdx < 11 ? 0 : 1;
        const fx = this.memory.playerBuffer[fouledIdx * PLAYER_STRIDE + PLAYER_OFFSET_X];
        const fy = this.memory.playerBuffer[fouledIdx * PLAYER_STRIDE + PLAYER_OFFSET_Y];
        
        this.analytics.events.push({
            type: 'foul',
            team: fouledTeam,
            playerId: fouledIdx,
            x: fx,
            y: fy,
            time: this.currentTime
        });

        // Stop the ball dead
        this.memory.ballBuffer[BALL_OFFSET_VX] = 0;
        this.memory.ballBuffer[BALL_OFFSET_VY] = 0;
        this.memory.ballBuffer[BALL_OFFSET_VZ] = 0;
    }
}
