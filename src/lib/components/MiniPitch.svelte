<script lang="ts">
  import { PITCH_W, PITCH_H } from '../game/constants';
  import { matchState } from '../game/matchState.svelte';
  import { teams } from '../game/teams';

  // Scale down for the lobby view
  const scale = 3; 
  const w = PITCH_W * scale;
  const h = PITCH_H * scale;

  function getKitColor(teamId: string, isHome: boolean) {
    return teams[teamId]?.colors.primary || (isHome ? '#1a5f2a' : '#c9302c');
  }
</script>

<div class="mini-pitch-container">
  <svg viewBox="0 0 {PITCH_W} {PITCH_H}" class="pitch-svg" preserveAspectRatio="xMidYMid meet">
    <!-- Base Pitch -->
    <rect width="{PITCH_W}" height="{PITCH_H}" fill="#2d8a4a" rx="2" />
    
    <!-- Lines -->
    <g fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.3">
      <rect x="0.5" y="0.5" width="{PITCH_W-1}" height="{PITCH_H-1}" />
      <line x1="{PITCH_W/2}" y1="0" x2="{PITCH_W/2}" y2="{PITCH_H}" />
      <circle cx="{PITCH_W/2}" cy="{PITCH_H/2}" r="9.15" />
      
      <!-- Penalty areas -->
      <rect x="0" y="{PITCH_H/2 - 20.15}" width="16.5" height="40.3" />
      <rect x="{PITCH_W - 16.5}" y="{PITCH_H/2 - 20.15}" width="16.5" height="40.3" />
    </g>

    <!-- Players -->
    {#each matchState.players as p}
      <g transform="translate({p.homeX}, {p.homeY})">
        <circle r="2" fill={getKitColor(p.team === 'home' ? matchState.homeTeamId : matchState.awayTeamId, p.team === 'home')} stroke="white" stroke-width="0.5"/>
        <text y="0.5" font-size="1.2" text-anchor="middle" fill="white" font-weight="bold">{p.number}</text>
      </g>
    {/each}
  </svg>
</div>

<style>
  .mini-pitch-container {
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
    border: 4px solid #111;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    background: #2d8a4a;
  }
  
  .pitch-svg {
    width: 100%;
    height: auto;
    display: block;
  }
</style>
