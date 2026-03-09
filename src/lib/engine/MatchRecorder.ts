import { MatchMemory } from './core/MatchMemory';
import { PLAYER_COUNT, PLAYER_STRIDE, PLAYER_OFFSET_X, PLAYER_OFFSET_Y, BALL_OFFSET_X, BALL_OFFSET_Y, BALL_OFFSET_Z } from './core/constants';
import { browserDB } from '../data/dexie';

/**
 * Binary format structure per frame:
 * [Time (1 float)]
 * [Ball X, Ball Y, Ball Z (3 floats)]
 * [Player0 X, Player0 Y ... Player21 X, Player21 Y (44 floats)]
 * Total = 48 floats per frame (192 bytes)
 */
const FLOATS_PER_FRAME = 48;
const FPS_TARGET = 10; 

export class MatchRecorder {
    private frames: Float32Array[] = [];
    private lastRecordedSecond: number = -1;
    private matchId: string;
    private homeTeamId: string;
    private awayTeamId: string;

    constructor(matchId: string, homeTeamId: string, awayTeamId: string) {
        this.matchId = matchId;
        this.homeTeamId = homeTeamId;
        this.awayTeamId = awayTeamId;
    }

    public captureFrame(memory: MatchMemory, currentTime: number) {
        // Only record at the target FPS
        const currentSecond = Math.floor(currentTime * FPS_TARGET) / FPS_TARGET;
        if (currentSecond <= this.lastRecordedSecond) return;
        this.lastRecordedSecond = currentSecond;

        const frameData = new Float32Array(FLOATS_PER_FRAME);
        
        // Time
        frameData[0] = currentTime;
        
        // Ball
        frameData[1] = memory.ballBuffer[BALL_OFFSET_X];
        frameData[2] = memory.ballBuffer[BALL_OFFSET_Y];
        frameData[3] = memory.ballBuffer[BALL_OFFSET_Z];

        // Players
        for (let i = 0; i < PLAYER_COUNT; i++) {
            const memOffset = i * PLAYER_STRIDE;
            const frameOffset = 4 + (i * 2);
            frameData[frameOffset] = memory.playerBuffer[memOffset + PLAYER_OFFSET_X];
            frameData[frameOffset + 1] = memory.playerBuffer[memOffset + PLAYER_OFFSET_Y];
        }

        this.frames.push(frameData);
    }

    public async saveToIndexedDB() {
        if (this.frames.length === 0) return;

        // Concatenate all frames into one giant ArrayBuffer
        const totalFloats = this.frames.length * FLOATS_PER_FRAME;
        const combined = new Float32Array(totalFloats);
        
        let offset = 0;
        for (const frame of this.frames) {
            combined.set(frame, offset);
            offset += FLOATS_PER_FRAME;
        }

        const blob = new Blob([combined.buffer], { type: 'application/octet-stream' });

        try {
            await browserDB.replays.add({
                matchId: this.matchId,
                homeTeamId: this.homeTeamId,
                awayTeamId: this.awayTeamId,
                timestamp: new Date().toISOString(),
                frameCount: this.frames.length,
                fps: FPS_TARGET,
                blob: blob
            });
            console.log(`Saved replay for match ${this.matchId} (${this.frames.length} frames, ${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
        } catch (e) {
            console.error('Failed to save replay to IndexedDB', e);
        }
    }
}

export async function downloadReplay(matchId: string) {
    try {
        const replay = await browserDB.replays.where({ matchId }).first();
        if (!replay) {
            console.error('No replay found for match:', matchId);
            return;
        }

        const url = URL.createObjectURL(replay.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `replay-${matchId}.bin`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Failed to download replay', e);
    }
}
