<script lang="ts">
  import type { TeamProfile } from '../data/types';
  import type { Match } from '../engine/Match';

  let { match, currentTime, homeTeam, awayTeam } = $props<{
    match: Match;
    currentTime: number;
    homeTeam?: TeamProfile;
    awayTeam?: TeamProfile;
  }>();

  // Reactive formatted time using the passed prop
  let clockDisplay = $derived.by(() => {
    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });
  
  // Scores (Assuming they will be added to match state eventually, using 0 for now)
  let homeScore = $state(0);
  let awayScore = $state(0);

</script>

<div class="hud-container">
  <div class="scoreboard">
    <div class="team-crest home" style="background: {homeTeam?.colors?.primary || 'var(--primary)'}"></div>
    <div class="score-box">
      <div class="team-names">
        <span class="team-name">{homeTeam?.shortName || homeTeam?.name?.substring(0,3).toUpperCase() || 'HOM'}</span>
        <span class="team-name">{awayTeam?.shortName || awayTeam?.name?.substring(0,3).toUpperCase() || 'AWY'}</span>
      </div>
      <div class="score-digits">
        <span class="score">{homeScore}</span>
        <span class="score">{awayScore}</span>
      </div>
      <span class="clock">{clockDisplay}</span>
    </div>
    <div class="team-crest away" style="background: {awayTeam?.colors?.primary || 'var(--danger)'}"></div>
  </div>
</div>

<style>
  .hud-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 100;
    font-family: 'Inter', sans-serif;
    color: white;
  }

  .scoreboard {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: stretch;
    background: rgba(0,0,0,0.95);
    border-radius: 4px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.8);
    overflow: hidden;
    border: 1px solid #333;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .score-box {
    display: flex;
    flex-direction: column;
    padding: 8px 30px;
    min-width: 160px;
    background: linear-gradient(to bottom, #111, #000);
  }
  
  .team-names {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 900;
    color: #aaa;
    letter-spacing: 2px;
    margin-bottom: 2px;
  }

  .score-digits {
    display: flex;
    justify-content: space-between;
    font-size: 32px;
    font-weight: 900;
    line-height: 1;
    margin: 6px 0;
    font-family: 'JetBrains Mono', monospace;
  }

  .clock { 
    font-size: 13px; 
    font-family: 'JetBrains Mono', monospace; 
    color: #ffeb3b; 
    text-align: center;
    border-top: 1px solid #222;
    padding-top: 6px;
    font-weight: bold;
  }

  .team-crest { 
    width: 8px;
    box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
  }
</style>
