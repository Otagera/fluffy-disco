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

<div class="pitch-container">
    <canvas bind:this={canvas}></canvas>
</div>

<style>
    .pitch-container {
        width: 1150px;
        height: 780px;
        margin: 0 auto;
        background: #1a3c1a;
        border: 4px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        border-radius: 8px;
        overflow: hidden;
    }

    canvas {
        display: block;
        width: 100%;
        height: 100%;
    }
</style>
