/**
 * Statistical Utilities for the Match Engine.
 */
export class RNG {
    private static spare: number | null = null;

    /**
     * Box-Muller transform to generate normally distributed (Gaussian) numbers.
     * @param mean The center of the distribution.
     * @param stdDev The spread of the distribution (Standard Deviation).
     */
    static randomGaussian(mean: number = 0, stdDev: number = 1): number {
        if (this.spare !== null) {
            const val = this.spare * stdDev + mean;
            this.spare = null;
            return val;
        }

        let u = 0, v = 0, s = 0;
        do {
            u = Math.random() * 2 - 1;
            v = Math.random() * 2 - 1;
            s = u * u + v * v;
        } while (s >= 1 || s === 0);

        const mul = Math.sqrt(-2.0 * Math.log(s) / s);
        this.spare = v * mul;
        return u * mul * stdDev + mean;
    }

    /**
     * Resolves an action outcome using Gaussian distribution.
     * @param rating Base player rating (0-100).
     * @param consistency Attribute (0-1) where 1.0 is minimal variance.
     */
    static resolveAction(rating: number, consistency: number): number {
        // High consistency (1.0) -> stdDev of 2
        // Low consistency (0.0) -> stdDev of 12 (highly volatile)
        const stdDev = 12 - (consistency * 10);
        const result = this.randomGaussian(rating, stdDev);
        return Math.max(1, Math.min(100, Math.round(result)));
    }
}
