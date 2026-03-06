/**
 * Math utilities for simulation precision.
 */
export class MathUtils {
    /**
     * Generates a normally distributed random number using Box-Muller transform.
     * @param mean The average value.
     * @param stdDev The spread of the distribution.
     */
    static nextGaussian(mean: number = 0, stdDev: number = 1): number {
        const u1 = 1.0 - Math.random();
        const u2 = 1.0 - Math.random();
        const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
        return mean + stdDev * randStdNormal;
    }

    /**
     * Clamps a value between min and max.
     */
    static clamp(val: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, val));
    }
}
