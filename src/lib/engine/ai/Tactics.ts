import { 
    BALL_OFFSET_X, BALL_OFFSET_Y, BALL_OFFSET_VX, BALL_OFFSET_VY, PLAYER_COUNT,
    PLAYER_STRIDE, PLAYER_OFFSET_X, PLAYER_OFFSET_Y
} from '../core/constants';

export enum PlayPhase {
    POSSESSION = 'POSSESSION',
    OUT_OF_POSSESSION = 'OUT_OF_POSSESSION',
    TRANSITION = 'TRANSITION'
}

/**
 * Tactics manager handles the dynamic shifting of player anchors.
 * Instead of static (x,y), players move to targets based on play phase.
 */
export class TacticalManager {
    public phase: PlayPhase = PlayPhase.TRANSITION;
    public possessionTeam: number | null = null; // 0 or 1

    /**
     * Determines the current play phase based on who has the ball.
     */
    updatePhase(ballBuffer: Float32Array, possessionPlayerIdx: number | null) {
        if (possessionPlayerIdx === null) {
            this.phase = PlayPhase.TRANSITION;
            // Do not clear this.possessionTeam so the attacking team doesn't instantly retreat when a pass is in the air.
        } else {
            const team = possessionPlayerIdx < 11 ? 0 : 1;
            if (team !== this.possessionTeam) {
                this.phase = PlayPhase.TRANSITION; // Could trigger a "Counter Attack" state
                this.possessionTeam = team;
            } else {
                this.phase = PlayPhase.POSSESSION;
            }
        }
    }

    /**
     * Calculates dynamic anchors for all players.
     * @param ballBuffer Flat ball memory
     * @param baseFormations Standard 4-4-2 or similar grid anchors
     * @param roles Array of tactical roles for each player
     * @param styles Array of tactical styles [homeStyle, awayStyle]
     * @param offsideLineTeam0 Current offside line for home
     * @param offsideLineTeam1 Current offside line for away
     * @param playerStats Individual player attributes
     * @param playerBuffer Actual real-time player coordinates
     * @param isBallLoose True if no one currently has possession
     */
    calculateAnchors(
        ballBuffer: Float32Array, 
        baseFormations: { x: number, y: number }[],
        roles?: string[],
        styles?: string[],
        offsideLineTeam0: number = 52.5,
        offsideLineTeam1: number = 52.5,
        playerStats?: any[],
        playerBuffer?: Float32Array,
        isBallLoose: boolean = true
    ): { x: number, y: number }[] {
        const anchors: { x: number, y: number }[] = [];
        const bx = ballBuffer[BALL_OFFSET_X];
        const by = ballBuffer[BALL_OFFSET_Y];
        const bvx = ballBuffer[BALL_OFFSET_VX];
        const bvy = ballBuffer[BALL_OFFSET_VY];

        // 1. Identify distances to ball for pressing logic
        const homeDistances: { idx: number, distSq: number }[] = [];
        const awayDistances: { idx: number, distSq: number }[] = [];

        for (let i = 0; i < PLAYER_COUNT; i++) {
            if (i === 0 || i === 11) continue; // Skip GKs
            
            // Use real player positions if available, otherwise fallback to formation anchors
            let px, py;
            if (playerBuffer) {
                px = playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_X];
                py = playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_Y];
            } else {
                px = baseFormations[i].x;
                py = baseFormations[i].y;
            }

            const distSq = (px - bx) * (px - bx) + (py - by) * (py - by);
            
            if (i < 11) {
                homeDistances.push({ idx: i, distSq });
            } else {
                awayDistances.push({ idx: i, distSq });
            }
        }

        homeDistances.sort((a, b) => a.distSq - b.distSq);
        awayDistances.sort((a, b) => a.distSq - b.distSq);

        const homeStyle = styles ? styles[0] : 'Balanced';
        const awayStyle = styles ? styles[1] : 'Balanced';

        const getPressingCount = (style: string, inDefensiveThird: boolean) => {
            if (style === 'Gegenpress') return 3;
            if (style === 'Park the Bus') return inDefensiveThird ? 2 : 0;
            return 1;
        };

        const homeInDefensiveThird = bx < 35;
        const awayInDefensiveThird = bx > 70;
        
        const homePressCount = getPressingCount(homeStyle, homeInDefensiveThird);
        const awayPressCount = getPressingCount(awayStyle, awayInDefensiveThird);

        const homePressers = new Set(homeDistances.slice(0, homePressCount).map(d => d.idx));
        const awayPressers = new Set(awayDistances.slice(0, awayPressCount).map(d => d.idx));

        // If the ball is loose, the closest player from BOTH teams MUST press (recover)
        // regardless of who nominally has possession, to prevent dead zones.
        if (isBallLoose) {
            if (homeDistances.length > 0) homePressers.add(homeDistances[0].idx);
            if (awayDistances.length > 0) awayPressers.add(awayDistances[0].idx);
        }

        for (let i = 0; i < PLAYER_COUNT; i++) {
            const base = baseFormations[i];
            const team = i < 11 ? 0 : 1;
            const isPossession = this.possessionTeam === team;
            const role = roles ? roles[i] : '';
            const style = team === 0 ? homeStyle : awayStyle;
            const stats = playerStats && playerStats[i] ? playerStats[i] : {};
            const anticipation = stats.anticipation ?? 50;
            const positioning = stats.positioning ?? 50;
            const marking = stats.marking ?? 50;

            let tx = base.x;
            let ty = base.y;

            // 2. Goalkeeper Logic (Lock to penalty area)
            if (i === 0 || i === 11 || role === 'GK') {
                tx = base.x; 
                ty = 34 + (by - 34) * 0.2;
                anchors.push({ x: tx, y: ty });
                continue;
            }

            // 3. Pressing & Defending Logic
            let isPressing = (team === 0 && homePressers.has(i)) || (team === 1 && awayPressers.has(i));
            
            if (role === 'BWM' && !isPossession && !isPressing) {
                const px = playerBuffer ? playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_X] : base.x;
                const py = playerBuffer ? playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_Y] : base.y;
                const distToBallSq = (px - bx) * (px - bx) + (py - by) * (py - by);
                if (distToBallSq < 400) { 
                    isPressing = true;
                }
            }

            if (isPressing && (!isPossession || isBallLoose)) {
                // Predictive Interception (Pursuit)
                const px = playerBuffer ? playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_X] : base.x;
                const py = playerBuffer ? playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_Y] : base.y;
                const distToBallSq = (px - bx) * (px - bx) + (py - by) * (py - by);
                const distToBall = Math.sqrt(distToBallSq);
                
                // Anticipation affects pursuit tracking
                const pursuitAggression = 1.0 + (anticipation / 100) * 0.5;
                const lookaheadTime = Math.min(distToBall / (8.0 * pursuitAggression), 1.5);
                
                tx = bx + (bvx * lookaheadTime);
                ty = by + (bvy * lookaheadTime);
            } else if (isPossession) {
                // Possession: Penetration, Support, and Overlaps
                const attackDir = team === 0 ? 1 : -1;
                const progress = team === 0 ? bx / 105 : (105 - bx) / 105;
                const inFinalThird = team === 0 ? bx > 70 : bx < 35;
                
                let forwardPushMultiplier = 40;
                if (style === 'Route One') forwardPushMultiplier = 60;
                if (style === 'Park the Bus') forwardPushMultiplier = 20;
                
                let forwardPush = forwardPushMultiplier * progress;
                tx = base.x + (attackDir * forwardPush);
                
                const centerY = 34;
                let verticalExpansion = 1.2;
                
                if (style === 'Tiki-Taka' || style === 'Fluid Counter') {
                    verticalExpansion = 1.0; 
                    ty = base.y + (by - base.y) * 0.4;
                } else {
                    ty = centerY + (base.y - centerY) * verticalExpansion;
                }

                // DYNAMIC ROLES & INTUITION
                const activeOffsideLine = team === 0 ? offsideLineTeam1 : offsideLineTeam0;
                
                // PENETRATION RUNS (Runners)
                if (['W', 'IF', 'ST', 'AF'].includes(role)) {
                    // Push the offside line based on Anticipation and Positioning
                    const offsideBuffer = 1.0 + (1.0 - anticipation / 100) * 2.0; // High ant = run closer to line
                    const potentialRunX = activeOffsideLine - (attackDir * offsideBuffer);
                    
                    // Only make the run if we are in the opponent's half
                    const inOpponentHalf = team === 0 ? bx > 52.5 : bx < 52.5;
                    
                    if (inOpponentHalf) {
                        // Blend between base position and the deep run smoothly
                        const runCommitment = (positioning / 100) * (0.5 + (anticipation / 200));
                        tx = tx + (potentialRunX - tx) * runCommitment;
                    }
                }

                // WING & INVERTED FORWARD SPECIFICS
                if (role === 'W') {
                    verticalExpansion = 1.5;
                    ty = centerY + (base.y - centerY) * verticalExpansion; 
                } else if (role === 'IF' && inFinalThird) {
                    ty = centerY + (ty - centerY) * 0.4; 
                    tx += attackDir * 5; 
                } 

                // OVERLAPS (Fullbacks / Box-to-Box)
                if (['FB', 'WB'].includes(role) && inFinalThird) {
                    // Overlap if winger cuts inside or ball is central
                    ty = centerY + (base.y - centerY) * 1.6; // Hug touchline
                    tx += attackDir * 15; // Push past midfield
                } else if (role === 'B2B' && inFinalThird) {
                    // Late box arrival
                    if (Math.abs(by - 34) > 15) { // If ball is wide
                        tx += attackDir * 10;
                        ty = centerY + (by - centerY) * 0.2; // Move central
                    }
                }

                // SUPPORT DROPS (Connectors)
                if (['AM', 'DLP', 'B2B', 'WM'].includes(role)) {
                    // Move towards the ball Y to offer a passing lane
                    const supportDrift = (positioning / 100) * 0.8;
                    ty = ty + (by - ty) * supportDrift;

                    // Drop into pocket if too close to defenders
                    const distToLine = Math.abs(activeOffsideLine - tx);
                    if (distToLine < 15) {
                        tx -= attackDir * 5; // Drop back slightly to find space
                    }
                }

                // COVER (Rest-Defense)
                if (role === 'BWM' || role === 'CB') {
                    forwardPush *= 0.3; // Barely move up
                    tx = base.x + (attackDir * forwardPush);
                    if (role === 'BWM') {
                        ty = centerY + (by - centerY) * 0.5; // Shift centrally to cover
                    }
                }
                
                if (role === 'TM') {
                    ty = centerY + (by - centerY) * 0.3;
                }
                
            } else {
                // Defending: Contraction + shift towards ball
                let dropBack = (bx - base.x) * 0.2;
                let contractY = (by - base.y) * 0.2;

                if (style === 'Park the Bus') {
                    dropBack = (team === 0 ? -15 : 15);
                    contractY = 0;
                }

                tx = base.x + dropBack + (team === 0 ? -5 : 5);
                ty = base.y + contractY;
                
                if (role === 'BWM') {
                    tx += (team === 0 ? -3 : 3);
                }
            }

            // Keep within pitch bounds
            tx = Math.max(0.5, Math.min(104.5, tx));
            ty = Math.max(0.5, Math.min(67.5, ty));

            anchors.push({ x: tx, y: ty });
        }

        return anchors;
    }
}
