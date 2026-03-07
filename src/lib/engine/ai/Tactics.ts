import { BALL_OFFSET_X, BALL_OFFSET_Y, BALL_OFFSET_VX, BALL_OFFSET_VY, PLAYER_COUNT } from '../core/constants';

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
     */
    calculateAnchors(
        ballBuffer: Float32Array, 
        baseFormations: { x: number, y: number }[],
        roles?: string[],
        styles?: string[]
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
            const base = baseFormations[i];
            // Use actual player positions if available in a real system, but base formation anchors work for structural pressing
            const distSq = (base.x - bx) * (base.x - bx) + (base.y - by) * (base.y - by);
            
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

        // Determine how many players should press based on tactical style
        const getPressingCount = (style: string, inDefensiveThird: boolean) => {
            if (style === 'Gegenpress') return 3;
            if (style === 'Park the Bus') return inDefensiveThird ? 2 : 0;
            return 1; // Default
        };

        const homeInDefensiveThird = bx < 35;
        const awayInDefensiveThird = bx > 70;
        
        const homePressCount = getPressingCount(homeStyle, homeInDefensiveThird);
        const awayPressCount = getPressingCount(awayStyle, awayInDefensiveThird);

        const homePressers = new Set(homeDistances.slice(0, homePressCount).map(d => d.idx));
        const awayPressers = new Set(awayDistances.slice(0, awayPressCount).map(d => d.idx));

        for (let i = 0; i < PLAYER_COUNT; i++) {
            const base = baseFormations[i];
            const team = i < 11 ? 0 : 1;
            const isPossession = this.possessionTeam === team;
            const role = roles ? roles[i] : '';
            const style = team === 0 ? homeStyle : awayStyle;

            let tx = base.x;
            let ty = base.y;

            // 2. Goalkeeper Logic (Lock to penalty area)
            if (i === 0 || i === 11 || role === 'GK') {
                tx = base.x; 
                ty = 34 + (by - 34) * 0.2;
                anchors.push({ x: tx, y: ty });
                continue;
            }

            // 3. Pressing Logic
            let isPressing = (team === 0 && homePressers.has(i)) || (team === 1 && awayPressers.has(i));
            
            // Ball-Winning Midfielder (BWM) has an increased pressing range
            if (role === 'BWM' && !isPossession && !isPressing) {
                const distToBallSq = (base.x - bx) * (base.x - bx) + (base.y - by) * (base.y - by);
                if (distToBallSq < 400) { // Within 20m, BWM joins the press
                    isPressing = true;
                }
            }

            if (isPressing && !isPossession) {
                // Predictive Interception (Pursuit)
                const distToBallSq = (base.x - bx) * (base.x - bx) + (base.y - by) * (base.y - by);
                const distToBall = Math.sqrt(distToBallSq);
                
                // Estimate time to reach ball assuming ~8m/s sprint. Cap at 1.5 seconds.
                const lookaheadTime = Math.min(distToBall / 8.0, 1.5);
                
                tx = bx + (bvx * lookaheadTime);
                ty = by + (bvy * lookaheadTime);
            } else if (isPossession) {
                // Possession: Offensive push + better spacing (Expansion)
                const attackDir = team === 0 ? 1 : -1;
                const progress = team === 0 ? bx / 105 : (105 - bx) / 105;
                const inFinalThird = team === 0 ? bx > 70 : bx < 35;
                
                // Shift formation based on ball progress
                let forwardPushMultiplier = 40;
                if (style === 'Route One') forwardPushMultiplier = 60; // Push extremely high immediately
                if (style === 'Park the Bus') forwardPushMultiplier = 20; // Hesitant to commit forward
                
                let forwardPush = forwardPushMultiplier * progress;
                
                // BWM stays deeper in attack
                if (role === 'BWM') forwardPush *= 0.3;
                
                tx = base.x + (attackDir * forwardPush);
                
                // Spread out vertically
                const centerY = 34;
                let verticalExpansion = 1.2;
                
                if (style === 'Tiki-Taka' || style === 'Fluid Counter') {
                    // Fluidity: Allow players to drift towards the ball's Y to offer short passes
                    verticalExpansion = 1.0; 
                    ty = base.y + (by - base.y) * 0.4;
                } else {
                    ty = centerY + (base.y - centerY) * verticalExpansion;
                }
                
                if (role === 'W') {
                    verticalExpansion = 1.5;
                    ty = centerY + (base.y - centerY) * verticalExpansion; // Wingers always stay wide
                }
                
                if (role === 'IF' && inFinalThird) {
                    // Inverted Forwards cut inside in the final third
                    ty = centerY + (ty - centerY) * 0.4; // Squeeze towards center
                    tx += attackDir * 5; // Push a bit further up into the box
                } else if (role !== 'W' && style !== 'Tiki-Taka' && style !== 'Fluid Counter') {
                    // Standard players pull slightly towards ball Y to stay involved
                    ty = ty + (by - ty) * 0.2;
                }
                
                // Target Man pushes high and central
                if (role === 'TM') {
                    ty = centerY + (by - centerY) * 0.3;
                }
                
            } else {
                // Defending: Contraction + shift towards ball
                let dropBack = (bx - base.x) * 0.2;
                let contractY = (by - base.y) * 0.2;

                if (style === 'Park the Bus') {
                    dropBack = (team === 0 ? -15 : 15); // Drop deep rigidly
                    contractY = 0; // Maintain rigid horizontal lines
                }

                tx = base.x + dropBack + (team === 0 ? -5 : 5);
                ty = base.y + contractY;
                
                if (role === 'BWM') {
                    // BWM drops back slightly more to protect backline
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
