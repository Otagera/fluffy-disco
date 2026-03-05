<script lang="ts">
  import { PITCH_W, PITCH_H } from '../game/constants';
  import type { Player } from '../game/types';
  import { matchState } from '../game/matchState.svelte';
  import { teams } from '../game/teams';

  interface Props {
    player: Player;
  }

  let { player }: Props = $props();

  let kitColor = $derived.by(() => {
    const tid = player.team === 'home' ? matchState.homeTeamId : matchState.awayTeamId;
    return teams[tid]?.colors.primary || (player.team === 'home' ? '#1a5f2a' : '#c9302c');
  });

  // Phase 2: Dynamic scaling based on camera zoom
  // markerScale counteracts the camera zoom so players don't become massive
  const markerScale = $derived(1 / Math.pow(matchState.camera.zoom, 0.6));
  const labelScale = $derived(1 / Math.sqrt(matchState.camera.zoom));
  </script>

  <g 
  style="transform: translate({player.x * PITCH_W}px, {player.y * PITCH_H}px); will-change: transform; filter: url(#shadow);"
  >
  <!-- Scale the marker and text separately to keep readability high -->
  <g style="transform: scale({markerScale}); transition: transform 0.2s ease-out;">
    <use href="#player-shape" fill={kitColor} />

    <text y="0.5" font-size="1.5" text-anchor="middle" fill="white" font-weight="bold" style="user-select: none;">
      {player.number}
    </text>
  </g>
  
  {#if matchState.status !== 'PLAYING' || matchState.camera.zoom > 1.8}
    <text 
      y="3.5" 
      font-size={1 * labelScale} 
      text-anchor="middle" 
      fill="rgba(255,255,255,0.8)" 
      font-weight="bold"
      style="user-select: none; text-shadow: 0 1px 2px rgba(0,0,0,0.8); transition: font-size 0.2s;"
    >
      {player.tacticalRole || player.role}
    </text>
  {/if}

  <!-- Stamina Bar -->
  {#if player.currentStamina < 100}
    {@const barW = 3 * labelScale}
    {@const barH = 0.4 * labelScale}
    <g transform="translate({-barW / 2}, {4.5 * labelScale})">
      <rect width={barW} height={barH} fill="rgba(0,0,0,0.5)" rx={0.2 * labelScale} />
      <rect width={barW * (player.currentStamina / 100)} height={barH} 
        fill={player.currentStamina > 50 ? '#4caf50' : player.currentStamina > 30 ? '#ffeb3b' : '#f44336'} rx={0.2 * labelScale} />
    </g>
  {/if}
</g>
