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
</script>

<g 
  style="transform: translate({player.x * PITCH_W}px, {player.y * PITCH_H}px); will-change: transform; filter: url(#shadow);"
>
  <use href="#player-shape" fill={kitColor} />
  
  <text y="0.5" font-size="1.5" text-anchor="middle" fill="white" font-weight="bold" style="user-select: none;">
    {player.number}
  </text>
  
  {#if matchState.status !== 'PLAYING'}
    <text y="3.5" font-size="1" text-anchor="middle" fill="rgba(255,255,255,0.6)" style="user-select: none;">
      {player.tacticalRole || player.role}
    </text>
  {/if}

  <!-- Stamina Bar -->
  {#if player.currentStamina < 100}
    <g transform="translate(-1.5, 4.5)">
      <rect width="3" height="0.4" fill="rgba(0,0,0,0.5)" rx="0.2" />
      <rect width={3 * (player.currentStamina / 100)} height="0.4" 
        fill={player.currentStamina > 50 ? '#4caf50' : player.currentStamina > 30 ? '#ffeb3b' : '#f44336'} rx="0.2" />
    </g>
  {/if}
</g>
