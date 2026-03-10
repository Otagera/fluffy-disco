<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browserDB } from '$lib/data/dexie';
    import { MatchMemory } from '$lib/engine/core/MatchMemory';
    import { 
        PLAYER_COUNT, PLAYER_STRIDE, PLAYER_OFFSET_X, PLAYER_OFFSET_Y, 
        BALL_OFFSET_X, BALL_OFFSET_Y, BALL_OFFSET_Z 
    } from '$lib/engine/core/constants';
    import PixiPitch from '$lib/components/PixiPitch.svelte';
    import type { PageData } from './$types';
let { data }: { data: PageData } = $props();

let memory = new MatchMemory();
memory.initialize([]); // setup buffers

let combined: Float32Array | null = null;
let totalFrames = $state(0);
let currentFrame = $state(0);
let isPlaying = $state(false);
let fps = 10;

let loading = $state(true);
let errorMsg = $state('');

let labels = Array.from({length: 22}, (_, i) => ((i%11)+1).toString());
let currentLabels = [...labels]; // To track what is currently rendered
let analytics: any = null;
let pitchComponent: any = $state(null);

onMount(async () => {
    try {
        const replay = await browserDB.replays.where({ matchId: data.id }).first();
        if (!replay) {
            errorMsg = 'Replay not found in local database.';
            loading = false;
            return;
        }

        fps = replay.fps;
        const arrayBuffer = await replay.blob.arrayBuffer();
        combined = new Float32Array(arrayBuffer);
        totalFrames = replay.frameCount;

        if (replay.startingLabels) {
            labels = [...replay.startingLabels];
            currentLabels = [...labels];
        }
        if (replay.analytics) {
            analytics = replay.analytics;
        }

        applyFrame(0);
        loading = false;
    } catch (e: any) {
        errorMsg = e.message;
        loading = false;
    }
});

let animationId: number;
let lastTime = 0;
let startTime = 0;

function loop(time: number) {
        if (!isPlaying) return;
        if (!startTime) startTime = time - (currentFrame / fps) * 1000;
        
        const elapsed = time - startTime;
        const exactFrame = (elapsed / 1000) * fps;
        
        if (exactFrame < totalFrames - 1) {
            currentFrame = exactFrame;
            applyInterpolatedFrame(currentFrame);
            animationId = requestAnimationFrame(loop);
        } else {
            currentFrame = totalFrames - 1;
            applyFrame(totalFrames - 1);
            isPlaying = false;
        }
    }

    $effect(() => {
        if (isPlaying) {
            startTime = 0; // will be set in loop
            animationId = requestAnimationFrame(loop);
        } else {
            if (animationId) cancelAnimationFrame(animationId);
        }
    });

    onDestroy(() => {
        if (animationId) cancelAnimationFrame(animationId);
    });

    function applyFrame(idx: number) {
        if (!combined) return;
        const i = Math.floor(idx);
        const offset = i * 48;
        
        const time = combined[offset];
        syncLabels(time);

        memory.ballBuffer[BALL_OFFSET_X] = combined[offset + 1];
        memory.ballBuffer[BALL_OFFSET_Y] = combined[offset + 2];
        memory.ballBuffer[BALL_OFFSET_Z] = combined[offset + 3];

        for (let i = 0; i < PLAYER_COUNT; i++) {
            const memOffset = i * PLAYER_STRIDE;
            const fOffset = offset + 4 + (i * 2);
            memory.playerBuffer[memOffset + PLAYER_OFFSET_X] = combined[fOffset];
            memory.playerBuffer[memOffset + PLAYER_OFFSET_Y] = combined[fOffset + 1];
        }
    }

    function applyInterpolatedFrame(exactIdx: number) {
        if (!combined) return;
        const i1 = Math.floor(exactIdx);
        const i2 = Math.min(i1 + 1, totalFrames - 1);
        const t = exactIdx - i1;

        const off1 = i1 * 48;
        const off2 = i2 * 48;

        const time = combined[off1];
        syncLabels(time);

        // Ball Interpolation
        memory.ballBuffer[BALL_OFFSET_X] = combined[off1 + 1] + (combined[off2 + 1] - combined[off1 + 1]) * t;
        memory.ballBuffer[BALL_OFFSET_Y] = combined[off1 + 2] + (combined[off2 + 2] - combined[off1 + 2]) * t;
        memory.ballBuffer[BALL_OFFSET_Z] = combined[off1 + 3] + (combined[off2 + 3] - combined[off1 + 3]) * t;

        // Player Interpolation
        for (let p = 0; p < PLAYER_COUNT; p++) {
            const memOffset = p * PLAYER_STRIDE;
            const fOff1 = off1 + 4 + (p * 2);
            const fOff2 = off2 + 4 + (p * 2);
            memory.playerBuffer[memOffset + PLAYER_OFFSET_X] = combined[fOff1] + (combined[fOff2] - combined[fOff1]) * t;
            memory.playerBuffer[memOffset + PLAYER_OFFSET_Y] = combined[fOff1 + 1] + (combined[fOff2 + 1] - combined[fOff1 + 1]) * t;
        }
    }

    function syncLabels(time: number) {
        if (!analytics || !analytics.events || !pitchComponent) return;

        // Start from base labels
        const calculatedLabels = [...labels];

        // Apply all sub events that happened before or exactly at current time
        for (const event of analytics.events) {
            if (event.type === 'sub' && event.time <= time && event.playerId !== undefined && event.incomingPlayerNumber !== undefined) {
                calculatedLabels[event.playerId] = event.incomingPlayerNumber.toString();
            }
        }

        // Apply changes to renderer
        for (let i = 0; i < calculatedLabels.length; i++) {
            if (calculatedLabels[i] !== currentLabels[i]) {
                currentLabels[i] = calculatedLabels[i];
                pitchComponent.updateLabel(i, currentLabels[i]);
            }
        }
    }

    function handleSeek(e: Event) {
        const val = parseFloat((e.target as HTMLInputElement).value);
        currentFrame = val;
        isPlaying = false;
        applyInterpolatedFrame(currentFrame);
    }
</script>

<div class="min-h-screen bg-light-bg flex flex-col items-center p-8">
    <div class="w-full max-w-5xl mb-6 flex justify-between items-center">
        <h1 class="text-3xl font-black uppercase tracking-tighter">Match Replay</h1>
        <a href="/" class="btn-secondary py-2 px-6 uppercase tracking-widest text-xs font-bold">Back to Hub</a>
    </div>

    {#if loading}
        <div class="flex-1 flex items-center justify-center">
            <div class="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    {:else if errorMsg}
        <div class="card p-8 text-center text-danger">
            <h2 class="text-xl font-bold">Failed to Load Replay</h2>
            <p>{errorMsg}</p>
        </div>
    {:else}
        <div class="w-full flex-1 flex flex-col">
            <!-- Pitch -->
            <div class="flex-1 w-full flex items-center justify-center">
                <PixiPitch bind:this={pitchComponent} {memory} {labels} />
            </div>

            <!-- Controls -->
            <div class="bg-white border border-light-border p-6 rounded-2xl shadow-xl w-full max-w-5xl mx-auto mt-6 flex flex-col gap-4">
                <div class="flex items-center gap-4">
                    <button 
                        class="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                        onclick={() => isPlaying = !isPlaying}
                    >
                        {#if isPlaying}
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        {:else}
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        {/if}
                    </button>

                    <div class="flex-1 flex flex-col">
                        <div class="flex justify-between text-xs font-black subtle uppercase tracking-widest mb-2">
                            <span>Frame {Math.floor(currentFrame)}</span>
                            <span>{Math.floor((currentFrame / fps) / 60)}:{(Math.floor(currentFrame / fps) % 60).toString().padStart(2, '0')}</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max={totalFrames - 1} 
                            step="0.01"
                            value={currentFrame} 
                            oninput={handleSeek}
                            class="w-full accent-primary"
                        />
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
