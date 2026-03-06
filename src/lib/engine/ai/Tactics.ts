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

        for (let i = 0; i < PLAYER_COUNT; i++) {
            const base = baseFormations[i];
            const team = i < 11 ? 0 : 1;
            const isPossession = this.possessionTeam === team;

            let tx = base.x;
            let ty = base.y;

            if (isPossession) {
                // Expansion: Pull towards ball + offensive bias
                tx = base.x + (bx - base.x) * 0.2 + (team === 0 ? 10 : -10);
                ty = base.y + (by - base.y) * 0.1;
            } else {
                // Contraction: Pull towards ball + defensive bias
                tx = base.x + (bx - base.x) * 0.5 + (team === 0 ? -5 : 5);
                ty = base.y + (by - base.y) * 0.3;
            }

            anchors.push({ x: tx, y: ty });
        }

        return anchors;
    }
}
