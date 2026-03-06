import { 
    PLAYER_COUNT, PLAYER_STRIDE,
    PLAYER_OFFSET_X, PLAYER_OFFSET_Y, PLAYER_OFFSET_VX, PLAYER_OFFSET_VY,
    PLAYER_OFFSET_MAX_SPEED, PLAYER_OFFSET_MAX_FORCE, PLAYER_OFFSET_MASS, PLAYER_OFFSET_STAMINA,
    BALL_OFFSET_X, BALL_OFFSET_Y, BALL_OFFSET_Z, BALL_OFFSET_VX, BALL_OFFSET_VY, BALL_OFFSET_VZ, BALL_OFFSET_FRICTION
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
            let stamina = buffer[offset + PLAYER_OFFSET_STAMINA];

            const toTargetX = target.x - px;
            const toTargetY = target.y - py;
            const distSqToTarget = toTargetX * toTargetX + toTargetY * toTargetY;
            const speedSq = vx * vx + vy * vy;

            // Dead-zone snap: prevents endless tiny circles around a reached anchor/ball.
            if (distSqToTarget < (0.35 * 0.35) && speedSq < (1.2 * 1.2)) {
                buffer[offset + PLAYER_OFFSET_X] = target.x;
                buffer[offset + PLAYER_OFFSET_Y] = target.y;
                buffer[offset + PLAYER_OFFSET_VX] = 0;
                buffer[offset + PLAYER_OFFSET_VY] = 0;
                continue;
            }
            
            // Degrade max speed based on stamina (at 10% stamina, speed is 70% of max)
            const staminaPenalty = 0.7 + (0.3 * stamina);
            const maxS = buffer[offset + PLAYER_OFFSET_MAX_SPEED] * staminaPenalty;
            const maxF = buffer[offset + PLAYER_OFFSET_MAX_FORCE];
            const mass = buffer[offset + PLAYER_OFFSET_MASS];

            // 1. Calculate Force (Arrive instead of Seek to prevent orbiting)
            const slowingRadius = 5.0; // Start braking 5 meters away
            const force = this.calculateArrive(px, py, vx, vy, target.x, target.y, maxS, slowingRadius);

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

            // Mild damping reduces overshoot/orbiting at high simulation speeds.
            const damping = Math.pow(0.98, Math.max(1, dt * 60));
            vx *= damping;
            vy *= damping;

            const dx = vx * dt;
            const dy = vy * dt;
            px += dx;
            py += dy;

            // 5. Stamina Drain
            const distanceMoved = Math.sqrt(dx * dx + dy * dy);
            // Example drain: 0.0001 per meter moved. Sprinting drains more because distance is higher per tick.
            if (stamina > 0.1) {
                stamina -= distanceMoved * 0.00005; // Adjust drain rate as needed
                buffer[offset + PLAYER_OFFSET_STAMINA] = Math.max(0.1, stamina); // Don't let it hit absolute 0
            }

            // 6. Write back
            buffer[offset + PLAYER_OFFSET_X] = px;
            buffer[offset + PLAYER_OFFSET_Y] = py;
            buffer[offset + PLAYER_OFFSET_VX] = vx;
            buffer[offset + PLAYER_OFFSET_VY] = vy;
        }
    }

    /**
     * Updates the ball physics including Z-axis (height) and linear friction.
     */
    static updateBall(buffer: Float32Array, dt: number) {
        let px = buffer[BALL_OFFSET_X];
        let py = buffer[BALL_OFFSET_Y];
        let pz = buffer[BALL_OFFSET_Z];
        let vx = buffer[BALL_OFFSET_VX];
        let vy = buffer[BALL_OFFSET_VY];
        let vz = buffer[BALL_OFFSET_VZ];
        const friction = buffer[BALL_OFFSET_FRICTION]; // Linear deceleration (m/s^2)

        // 1. Apply Gravity to VZ
        const GRAVITY = -9.81;
        vz += GRAVITY * dt;

        // 2. Update Positions
        px += vx * dt;
        py += vy * dt;
        pz += vz * dt;

        // 3. Ground Collision & Bounce
        if (pz <= 0) {
            pz = 0;
            vz *= -0.6; // Bounce coefficient (energy loss)
            
            // Apply Linear Friction when on ground
            const speed = Math.sqrt(vx * vx + vy * vy);
            if (speed > 0.01) {
                const deceleration = friction * dt;
                const newSpeed = Math.max(0, speed - deceleration);
                const ratio = newSpeed / speed;
                vx *= ratio;
                vy *= ratio;
            } else {
                vx = 0;
                vy = 0;
            }

            // Stop bouncing if velocity is negligible
            if (Math.abs(vz) < 0.1) vz = 0;
        }

        // 4. Air Resistance (Simple drag while in air)
        if (pz > 0) {
            vx *= 0.995;
            vy *= 0.995;
        }

        // 5. Write back
        buffer[BALL_OFFSET_X] = px;
        buffer[BALL_OFFSET_Y] = py;
        buffer[BALL_OFFSET_Z] = pz;
        buffer[BALL_OFFSET_VX] = vx;
        buffer[BALL_OFFSET_VY] = vy;
        buffer[BALL_OFFSET_VZ] = vz;
    }
}
