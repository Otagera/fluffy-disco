/**
 * Memory Strides for the Match Engine.
 * Using a Data-Oriented Design (DOD) with Float32Array.
 */

export const PLAYER_COUNT = 22;

// Memory Stride: [x, y, vx, vy, maxSpeed, maxForce, mass, stamina]
export const PLAYER_STRIDE = 8;
export const PLAYER_OFFSET_X = 0;
export const PLAYER_OFFSET_Y = 1;
export const PLAYER_OFFSET_VX = 2;
export const PLAYER_OFFSET_VY = 3;
export const PLAYER_OFFSET_MAX_SPEED = 4;
export const PLAYER_OFFSET_MAX_FORCE = 5;
export const PLAYER_OFFSET_MASS = 6;
export const PLAYER_OFFSET_STAMINA = 7;

// Ball Memory: [x, y, z, vx, vy, vz, mass, friction]
export const BALL_STRIDE = 8;
export const BALL_OFFSET_X = 0;
export const BALL_OFFSET_Y = 1;
export const BALL_OFFSET_Z = 2;
export const BALL_OFFSET_VX = 3;
export const BALL_OFFSET_VY = 4;
export const BALL_OFFSET_VZ = 5;
export const BALL_OFFSET_MASS = 6;
export const BALL_OFFSET_FRICTION = 7;
