<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { MatchRenderer } from '$lib/renderer/PixiApp';
    import type { Match } from '$lib/engine/Match';

    let { match, labels }: { match: Match, labels: string[] } = $props();
    
    let canvas: HTMLCanvasElement;
    let renderer: MatchRenderer;

    onMount(() => {
        if (canvas && match) {
            renderer = new MatchRenderer(canvas, match.memory, labels);
        }
    });

    onDestroy(() => {
        if (renderer) {
            renderer.destroy();
        }
    });
</script>

<div class="pitch-outer flex items-center justify-center p-4">
    <div class="pitch-container shadow-2xl border-4 border-white/20 rounded-2xl overflow-hidden">
        <canvas bind:this={canvas}></canvas>
    </div>
</div>

<style>
    .pitch-outer {
        width: 100%;
        min-height: calc(100vh - 160px);
    }

    .pitch-container {
        width: 1150px;
        height: 780px;
        background: #2d8a4a;
    }

    canvas {
        display: block;
        width: 100%;
        height: 100%;
    }
</style>
