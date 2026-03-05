<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { matchState } from '../game/matchState.svelte';
  import { PixiRenderer } from '../game/renderer';

  let canvasContainer: HTMLDivElement;
  let renderer: PixiRenderer;

  onMount(async () => {
    // 1. Audio logic (remains as is)
    let audioCtx: AudioContext;
    const startAudio = () => {
      if (audioCtx) return;
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bufferSize = 2 * audioCtx.sampleRate;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; 
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer; noise.loop = true;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 400;
      const gain = audioCtx.createGain(); gain.gain.value = 0.05;
      noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
      noise.start();
    };
    window.addEventListener('mousedown', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });

    // 2. PixiJS Initialization
    renderer = new PixiRenderer();
    await renderer.init(canvasContainer);
    
    // Toggle rain based on match state or just for testing
    renderer.isRaining = true;

    // 3. Render Loop
    // Pixi's ticker runs at the monitor's refresh rate (60Hz+)
    renderer.app.ticker.add(() => {
      // Skip rendering if we are in "Skip to End" fast-forward mode
      if (matchState.status === 'FINISHED' || (matchState as any).isSimulating) return;
      renderer.update(matchState);
    });
  });

  onDestroy(() => {
    if (renderer) {
      renderer.destroy();
    }
  });
</script>

<div class="pitch-container">
  <div class="vignette"></div>
  
  <!-- PixiJS Canvas Host -->
  <div bind:this={canvasContainer} class="pixi-canvas-host"></div>
</div>

<style>
  .pitch-container {
    position: relative; 
    width: 100%; 
    max-width: 1200px; 
    aspect-ratio: 105/68; /* Match standard pitch dimensions ratio */
    margin: 0 auto; 
    background: #111;
    border: 4px solid #222; 
    border-radius: 8px; 
    box-shadow: 0 20px 50px rgba(0,0,0,0.6); 
    overflow: hidden;
  }
  
  .pixi-canvas-host {
    width: 100%;
    height: 100%;
    display: block;
  }

  .vignette { 
    position: absolute; 
    inset: 0; 
    background: radial-gradient(circle, transparent 50%, rgba(0,0,0,0.4) 100%); 
    pointer-events: none; 
    z-index: 10; 
  }
</style>
