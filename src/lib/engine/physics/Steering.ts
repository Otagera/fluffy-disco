import { 
    PLAYER_COUNT, PLAYER_STRIDE,
    PLAYER_OFFSET_X, PLAYER_OFFSET_Y, PLAYER_OFFSET_VX, PLAYER_OFFSET_VY,
    PLAYER_OFFSET_MAX_SPEED, PLAYER_OFFSET_MAX_FORCE, PLAYER_OFFSET_MASS,
    BALL_OFFSET_X, BALL_OFFSET_Y, BALL_OFFSET_VX, BALL_OFFSET_VY, BALL_OFFSET_FRICTION
} from '../core/constants';

/**
 * PhysicsEngine provides the core kinematics and steering behaviors.
 * Designed to operate on Float32Array buffers directly.
 */
export class PhysicsEngine {
    
    /**
     * Calculates a 'Seek' steering force.
     * Force = DesiredVelocity - CurrentVelocity
     */
    static calculateSeek(
        px: number, py: number, vx: number, vy: number,
        tx: number, ty: number, maxSpeed: number
    ): { fx: number, fy: number } {
        let dx = tx - px;
        let dy = ty - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.01) return { fx: -vx, fy: -vy };

        // Desired velocity is straight to target at max speed
        const desiredX = (dx / dist) * maxSpeed;
        const desiredY = (dy / dist) * maxSpeed;

        return {
            fx: desiredX - vx,
            fy: desiredY - vy
        };
    }

    /**
     * Calculates an 'Arrive' steering force (decelerates when close).
     */
    static calculateArrive(
        px: number, py: number, vx: number, vy: number,
        tx: number, ty: number, maxSpeed: number, slowingRadius: number = 50
    ): { fx: number, fy: number } {
        let dx = tx - px;
        let dy = ty - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.01) return { fx: -vx, fy: -vy };

        let speed = maxSpeed;
        if (dist < slowingRadius) {
            speed = maxSpeed * (dist / slowingRadius);
        }

        const desiredX = (dx / dist) * speed;
        const desiredY = (dy / dist) * speed;

        return {
            fx: desiredX - vx,
            fy: desiredY - vy
        };
    }

    /**
     * Updates the physical state of all players based on targets.
     * @param buffer The player Float32Array
     * @param targets Array of {x, y} coordinates for each player
     * @param dt Timestep in seconds
     */
    static updatePlayers(buffer: Float32Array, targets: {x: number, y: number}[], dt: number) {
        for (let i = 0; i < PLAYER_COUNT; i++) {
            const offset = i * PLAYER_STRIDE;
            const target = targets[i];

            let px = buffer[offset + PLAYER_OFFSET_X];
            let py = buffer[offset + PLAYER_OFFSET_Y];
            let vx = buffer[offset + PLAYER_OFFSET_VX];
            let vy = buffer[offset + PLAYER_OFFSET_VY];
            const maxS = buffer[offset + PLAYER_OFFSET_MAX_SPEED];
            const maxF = buffer[offset + PLAYER_OFFSET_MAX_FORCE];
            const mass = buffer[offset + PLAYER_OFFSET_MASS];

            // 1. Calculate Force (Seek)
            const force = this.calculateSeek(px, py, vx, vy, target.x, target.y, maxS);

            // 2. Clamp Force (Biomechanics)
            const forceMag = Math.sqrt(force.fx * force.fx + force.fy * force.fy);
            if (forceMag > maxF) {
                force.fx = (force.fx / forceMag) * maxF;
                force.fy = (force.fy / forceMag) * maxF;
            }

            // 3. Acceleration = Force / Mass
            const ax = force.fx / mass;
            const ay = force.fy / mass;

            // 4. Integrate (Euler)
            vx += ax * dt;
            vy += ay * dt;
            px += vx * dt;
            py += vy * dt;

            // 5. Write back
            buffer[offset + PLAYER_OFFSET_X] = px;
            buffer[offset + PLAYER_OFFSET_Y] = py;
            buffer[offset + PLAYER_OFFSET_VX] = vx;
            buffer[offset + PLAYER_OFFSET_VY] = vy;
        }
    }

    /**
     * Updates the ball physics.
     */
    static updateBall(buffer: Float32Array, dt: number) {
        let px = buffer[BALL_OFFSET_X];
        let py = buffer[BALL_OFFSET_Y];
        let vx = buffer[BALL_OFFSET_VX];
        let vy = buffer[BALL_OFFSET_VY];
        const friction = buffer[BALL_OFFSET_FRICTION];

        // 1. Apply Integration
        px += vx * dt;
        py += vy * dt;

        // 2. Apply Friction (Exponential Decay)
        vx *= friction;
        vy *= friction;

        // 3. Stop if velocity is negligible
        if (Math.abs(vx) < 0.01) vx = 0;
        if (Math.abs(vy) < 0.01) vy = 0;

        // 4. Write back
        buffer[BALL_OFFSET_X] = px;
        buffer[BALL_OFFSET_Y] = py;
        buffer[BALL_OFFSET_VX] = vx;
        buffer[BALL_OFFSET_VY] = vy;
    }
}
