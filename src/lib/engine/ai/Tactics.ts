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
            this.possessionTeam = null;
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
     */
    calculateAnchors(
        ballBuffer: Float32Array, 
        baseFormations: { x: number, y: number }[],
        roles?: string[]
    ): { x: number, y: number }[] {
        const anchors: { x: number, y: number }[] = [];
        const bx = ballBuffer[BALL_OFFSET_X];
        const by = ballBuffer[BALL_OFFSET_Y];
        const bvx = ballBuffer[BALL_OFFSET_VX];
        const bvy = ballBuffer[BALL_OFFSET_VY];

        // 1. Identify which defender is closest to the ball for each team
        let closestHomeIdx = -1;
        let closestAwayIdx = -1;
        let minHomeDistSq = Infinity;
        let minAwayDistSq = Infinity;

        for (let i = 0; i < PLAYER_COUNT; i++) {
            // GKs shouldn't press the ball into the outfield
            if (i === 0 || i === 11) continue;

            const base = baseFormations[i];
            const distSq = (base.x - bx) * (base.x - bx) + (base.y - by) * (base.y - by);
            
            if (i < 11) {
                if (distSq < minHomeDistSq) {
                    minHomeDistSq = distSq;
                    closestHomeIdx = i;
                }
            } else {
                if (distSq < minAwayDistSq) {
                    minAwayDistSq = distSq;
                    closestAwayIdx = i;
                }
            }
        }

        for (let i = 0; i < PLAYER_COUNT; i++) {
            const base = baseFormations[i];
            const team = i < 11 ? 0 : 1;
            const isPossession = this.possessionTeam === team;
            const role = roles ? roles[i] : '';

            let tx = base.x;
            let ty = base.y;

            // 2. Goalkeeper Logic (Lock to penalty area)
            if (i === 0 || i === 11 || role === 'GK') {
                // Keep GK close to their specific goal line based on their base formation anchor
                // The base.x handles which side of the pitch they are on (swaps at half time)
                tx = base.x; 
                ty = 34 + (by - 34) * 0.2; // 34 is center Y. Move max 20% towards ball Y
                anchors.push({ x: tx, y: ty });
                continue;
            }

            // 3. Pressing Logic
            let isPressing = (team === 0 && i === closestHomeIdx) || (team === 1 && i === closestAwayIdx);
            
            // Ball-Winning Midfielder (BWM) has an increased pressing range/aggressiveness
            if (role === 'BWM' && !isPossession && !isPressing) {
                const distToBallSq = (base.x - bx) * (base.x - bx) + (base.y - by) * (base.y - by);
                if (distToBallSq < 400) { // Within 20m, BWM joins the press
                    isPressing = true;
                }
            }

            if (isPressing && !isPossession) {
                // Predictive Interception (Pursuit)
                // Calculate distance to ball using the pre-calculated minDistSq
                const distToBallSq = (team === 0 && i === closestHomeIdx) ? minHomeDistSq : 
                                     (team === 1 && i === closestAwayIdx) ? minAwayDistSq :
                                     ((base.x - bx) * (base.x - bx) + (base.y - by) * (base.y - by));
                
                const distToBall = Math.sqrt(distToBallSq);
                
                // Estimate time to reach ball assuming ~8m/s sprint. Cap at 1.5 seconds.
                const lookaheadTime = Math.min(distToBall / 8.0, 1.5);
                
                tx = bx + (bvx * lookaheadTime);
                ty = by + (bvy * lookaheadTime);
            } else if (isPossession) {
                // Possession: Offensive push + better spacing (Expansion)
                // Home team (0) attacks towards X=105, Away team (1) towards X=0
                const attackDir = team === 0 ? 1 : -1;
                const progress = team === 0 ? bx / 105 : (105 - bx) / 105;
                const inFinalThird = team === 0 ? bx > 70 : bx < 35;
                
                // Shift formation based on ball progress
                let forwardPush = 40 * progress;
                
                // BWM stays deeper in attack
                if (role === 'BWM') forwardPush *= 0.3;
                
                tx = base.x + (attackDir * forwardPush);
                
                // Spread out vertically
                const centerY = 34;
                let verticalExpansion = 1.2;
                
                if (role === 'W') {
                    // Wingers hug the touchline
                    verticalExpansion = 1.5;
                }
                
                ty = centerY + (base.y - centerY) * verticalExpansion;
                
                if (role === 'IF' && inFinalThird) {
                    // Inverted Forwards cut inside in the final third
                    ty = centerY + (ty - centerY) * 0.4; // Squeeze towards center
                    tx += attackDir * 5; // Push a bit further up into the box
                } else if (role !== 'W') {
                    // Standard players pull slightly towards ball Y to stay involved
                    ty = ty + (by - ty) * 0.2;
                }
                
                // Target Man pushes high and central
                if (role === 'TM') {
                    ty = centerY + (by - centerY) * 0.3;
                }
                
            } else {
                // Defending: Contraction + shift towards ball
                tx = base.x + (bx - base.x) * 0.2 + (team === 0 ? -5 : 5);
                ty = base.y + (by - base.y) * 0.2;
                
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
