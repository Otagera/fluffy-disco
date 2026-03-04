<script lang="ts">
  import { PITCH_W, PITCH_H } from '../game/constants';

  interface Props {
    ball: { x: number, y: number, z: number, spin: number };
  }

  let { ball }: Props = $props();
  
  let shadowRX = $derived(Math.max(0.1, 1.2 * (1 - ball.z * 0.3)));
</script>

<!-- Ball Shadow (Using transform for GPU acceleration) -->
<ellipse 
  style="transform: translate({ball.x * PITCH_W}px, {ball.y * PITCH_H}px); will-change: transform;"
  cx="0" 
  cy="0" 
  rx={shadowRX} 
  ry={shadowRX * 0.4} 
  fill="black" 
  opacity="0.2" 
/>

<!-- Ball SVG (Using transform for GPU acceleration) -->
<g style="transform: translate({ball.x * PITCH_W}px, {ball.y * PITCH_H - (ball.z * 5)}px) rotate({ball.spin}deg); will-change: transform;">
  <circle r="0.8" fill="white" stroke="#333" stroke-width="0.2"/>
  <path d="M0,-0.8 L0.4,-0.2 L-0.4,-0.2 Z" fill="#222" opacity="0.7"/>
</g>
