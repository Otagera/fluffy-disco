import { BALL_OFFSET_X, BALL_OFFSET_Y, PLAYER_COUNT } from '../core/constants';

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
     */
    calculateAnchors(
        ballBuffer: Float32Array, 
        baseFormations: { x: number, y: number }[]
    ): { x: number, y: number }[] {
        const anchors: { x: number, y: number }[] = [];
        const bx = ballBuffer[BALL_OFFSET_X];
        const by = ballBuffer[BALL_OFFSET_Y];

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

            let tx = base.x;
            let ty = base.y;

            // 2. Goalkeeper Logic (Lock to penalty area)
            if (i === 0 || i === 11) {
                // Keep GK close to the goal line, only shifting slightly based on ball Y position
                tx = team === 0 ? 5 : 100; // X position near goal line
                ty = 34 + (by - 34) * 0.2; // 34 is center Y. Move max 20% towards ball Y
                anchors.push({ x: tx, y: ty });
                continue;
            }

            // 3. Pressing Logic
            const isPressing = (team === 0 && i === closestHomeIdx) || (team === 1 && i === closestAwayIdx);

            if (isPressing && !isPossession) {
                // The closest player aggressively presses the ball
                tx = bx;
                ty = by;
            } else if (isPossession) {
                // Possession: Offensive push + better spacing (Expansion)
                // Home team (0) attacks towards X=105, Away team (1) towards X=0
                const attackDir = team === 0 ? 1 : -1;
                const progress = team === 0 ? bx / 105 : (105 - bx) / 105;
                
                // Shift formation based on ball progress
                tx = base.x + (attackDir * 15 * progress);
                
                // Spread out vertically
                const centerY = 34;
                const verticalExpansion = 1.2;
                ty = centerY + (base.y - centerY) * verticalExpansion;
                
                // Slightly pull towards ball Y to stay involved
                ty = ty + (by - ty) * 0.2;
            } else {
                // Defending: Contraction + shift towards ball
                tx = base.x + (bx - base.x) * 0.2 + (team === 0 ? -5 : 5);
                ty = base.y + (by - base.y) * 0.2;
            }

            anchors.push({ x: tx, y: ty });
        }

        return anchors;
    }
}
