<script lang="ts">
  import { PITCH_W, PITCH_H } from '../game/constants';
  import { matchState } from '../game/matchState.svelte';
  import { onMount } from 'svelte';
  import PlayerComponent from './Player.svelte';
  import BallComponent from './Ball.svelte';

  // Phase 6: Crowd noise via Web Audio API
  onMount(() => {
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
        output[i] *= 3.5; // volume
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;

      const gain = audioCtx.createGain();
      gain.gain.value = 0.05;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noise.start();
    };

    window.addEventListener('mousedown', startAudio, { once: true });
    window.addEventListener('keydown', startAudio, { once: true });
  });

  const rainStreaks = Array.from({ length: 30 }, () => ({
    x: Math.random() * PITCH_W,
    y: Math.random() * PITCH_H,
    len: 0.5 + Math.random() * 1,
    speed: 8 + Math.random() * 4
  }));
</script>

<div class="pitch-container">
  <svg viewBox="-10 -5 {PITCH_W + 20} {PITCH_H + 10}" class="pitch-svg" preserveAspectRatio="xMidYMid meet">
    <defs>
      <g id="player-shape">
        <circle r="2" stroke="white" stroke-width="0.3" />
      </g>
      
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" />
        <feOffset dx="0.2" dy="0.2" result="offsetblur" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.3" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- 0. Run-off area -->
    <rect x="-10" y="-5" width="{PITCH_W + 20}" height="{PITCH_H + 10}" fill="#1a1a1a" />

    <!-- 1. Base green rect -->
    <rect width="{PITCH_W}" height="{PITCH_H}" fill="#2d8a4a" />
    
    <!-- 2. Grass stripes -->
    {#each Array(8) as _, i}
      <rect 
        x="{i * (PITCH_W/8)}" 
        y="0" 
        width="{PITCH_W/8}" 
        height="{PITCH_H}" 
        fill="#267a41" 
        opacity="{i % 2 === 0 ? 0.4 : 0}" 
      />
    {/each}
    
    <!-- 3. Markings -->
    <g fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="0.4">
      <rect x="0" y="0" width="{PITCH_W}" height="{PITCH_H}" />
      <line x1="{PITCH_W/2}" y1="0" x2="{PITCH_W/2}" y2="{PITCH_H}" />
      <circle cx="{PITCH_W/2}" cy="{PITCH_H/2}" r="9.15" />
      <circle cx="{PITCH_W/2}" cy="{PITCH_H/2}" r="0.2" fill="rgba(255,255,255,0.5)" />
      
      <rect x="0" y="{PITCH_H/2 - 20.15}" width="16.5" height="40.3" />
      <rect x="{PITCH_W - 16.5}" y="{PITCH_H/2 - 20.15}" width="16.5" height="40.3" />
      
      <rect x="0" y="{PITCH_H/2 - 9.15}" width="5.5" height="18.3" />
      <rect x="{PITCH_W - 5.5}" y="{PITCH_H/2 - 9.15}" width="5.5" height="18.3" />

      <circle cx="11" cy="{PITCH_H/2}" r="0.2" fill="rgba(255,255,255,0.5)" />
      <circle cx="{PITCH_W - 11}" cy="{PITCH_H/2}" r="0.2" fill="rgba(255,255,255,0.5)" />

      <path d="M 0 1 A 1 1 0 0 0 1 0" />
      <path d="M {PITCH_W-1} 0 A 1 1 0 0 0 {PITCH_W} 1" />
      <path d="M {PITCH_W} {PITCH_H-1} A 1 1 0 0 0 {PITCH_W-1} {PITCH_H}" />
      <path d="M 1 {PITCH_H} A 1 1 0 0 0 0 {PITCH_H-1}" />
    </g>

    <!-- 4. Goal nets and Posts -->
    <g stroke="white" stroke-width="0.1" opacity="0.6">
      <!-- Left Goal Net -->
      <path d="M 0 {PITCH_H/2 - 3.66} L -3 {PITCH_H/2 - 3.66} L -3 {PITCH_H/2 + 3.66} L 0 {PITCH_H/2 + 3.66} Z" fill="rgba(255,255,255,0.05)" />
      {#each Array(8) as _, i}
        <line x1="0" y1="{PITCH_H/2 - 3.66 + i * 1.04}" x2="-3" y2="{PITCH_H/2 - 3.66 + i * 1.04}" stroke-width="0.05" />
        <line x1="{-i * 0.4}" y1="{PITCH_H/2 - 3.66}" x2="{-i * 0.4}" y2="{PITCH_H/2 + 3.66}" stroke-width="0.05" />
      {/each}

      <!-- Right Goal Net -->
      <path d="M {PITCH_W} {PITCH_H/2 - 3.66} L {PITCH_W+3} {PITCH_H/2 - 3.66} L {PITCH_W+3} {PITCH_H/2 + 3.66} L {PITCH_W} {PITCH_H/2 + 3.66} Z" fill="rgba(255,255,255,0.05)" />
      {#each Array(8) as _, i}
        <line x1="{PITCH_W}" y1="{PITCH_H/2 - 3.66 + i * 1.04}" x2="{PITCH_W+3}" y2="{PITCH_H/2 - 3.66 + i * 1.04}" stroke-width="0.05" />
        <line x1="{PITCH_W + i * 0.4}" y1="{PITCH_H/2 - 3.66}" x2="{PITCH_W + i * 0.4}" y2="{PITCH_H/2 + 3.66}" stroke-width="0.05" />
      {/each}
    </g>

    <!-- Goal Posts (White, thick) -->
    <g stroke="#fff" stroke-width="0.6" stroke-linecap="round">
      <!-- Left Goal -->
      <line x1="0" y1="{PITCH_H/2 - 3.66}" x2="0" y2="{PITCH_H/2 + 3.66}" />
      <circle cx="0" cy="{PITCH_H/2 - 3.66}" r="0.3" fill="white" />
      <circle cx="0" cy="{PITCH_H/2 + 3.66}" r="0.3" fill="white" />
      
      <!-- Right Goal -->
      <line x1="{PITCH_W}" y1="{PITCH_H/2 - 3.66}" x2="{PITCH_W}" y2="{PITCH_H/2 + 3.66}" />
      <circle cx="{PITCH_W}" cy="{PITCH_H/2 - 3.66}" r="0.3" fill="white" />
      <circle cx="{PITCH_W}" cy="{PITCH_H/2 + 3.66}" r="0.3" fill="white" />
    </g>

    <!-- 5. Players layer -->
    {#each matchState.players as p (p.id)}
      <PlayerComponent player={p} />
    {/each}

    <!-- 6. Ball layer -->
    <BallComponent ball={matchState.ball} />

    <!-- 7. Rain Layer -->
    <g class="rain-layer" pointer-events="none">
      {#each rainStreaks as streak}
        <line 
          x1={streak.x} 
          y1={streak.y} 
          x2={streak.x - 0.2} 
          y2={streak.y + streak.len} 
          stroke="white" 
          stroke-width="0.05" 
          opacity="0.15"
        >
          <animate 
            attributeName="y1" 
            from={streak.y} 
            to={PITCH_H + streak.len} 
            dur="{streak.speed/15}s" 
            repeatCount="indefinite" 
          />
          <animate 
            attributeName="y2" 
            from={streak.y + streak.len} 
            to={PITCH_H + streak.len * 2} 
            dur="{streak.speed/15}s" 
            repeatCount="indefinite" 
          />
        </line>
      {/each}
    </g>
  </svg>
</div>

<style>
  .pitch-container {
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
    background: #1a1a1a;
    border: 10px solid #1a1a1a;
    border-radius: 4px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    overflow: hidden;
  }
  .pitch-svg {
    width: 100%;
    height: auto;
    display: block;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
  }
</style>