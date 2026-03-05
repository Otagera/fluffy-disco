<script lang="ts">
  import { matchState } from '../game/matchState.svelte';
  import { resetMatch } from '../game/rules';
  import type { TeamProfile } from '../data/types';

  let { shotPower = 0, isCharging = false, homeTeam, awayTeam } = $props<{
    shotPower?: number;
    isCharging?: boolean;
    homeTeam?: TeamProfile;
    awayTeam?: TeamProfile;
  }>();

  let commentary = $state("");
  let showCommentary = $state(false);

  // Derive possession based on actual match ticks
  let possessionHome = $derived.by(() => {
    const total = matchState.stats.home.possessionTime + matchState.stats.away.possessionTime;
    if (total === 0) return 50;
    return Math.round((matchState.stats.home.possessionTime / total) * 100);
  });
  let possessionAway = $derived(100 - possessionHome);

  const comments = [
    "WHAT A STRIKE!", "UNBELIEVABLE GOAL!", "HE'S HIT THAT ONE WELL!",
    "ALMOST! SO CLOSE!", "GREAT SAVE BY THE KEEPER!", "DANGER HERE...",
    "THE CROWD IS GOING WILD!"
  ];

  // Clock display: MM:SS
  let clockDisplay = $derived.by(() => {
    const mins = Math.floor(matchState.timer / 60);
    const secs = matchState.timer % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  $effect(() => {
    if (matchState.events.length > 0) {
      const last = matchState.events[matchState.events.length - 1];
      if (last.type === 'goal' || last.type === 'foul') {
        triggerCommentary(last.type === 'goal' ? comments[Math.floor(Math.random()*3)] : comments[3 + Math.floor(Math.random()*4)]);
      }
    }
  });

  function triggerCommentary(text: string) {
    commentary = text;
    showCommentary = true;
    setTimeout(() => { showCommentary = false; }, 3000);
  }
  
  function resumeSecondHalf() {
    resetMatch({ switchSides: true, status: 'PLAYING' });
  }
</script>

<div class="hud-container">
  <!-- Commentator Popup -->
  {#if showCommentary}
    <div class="commentator-popup">
      <div class="comment-text">{commentary}</div>
    </div>
  {/if}

  <!-- Halftime Overlay -->
  {#if matchState.status === 'HALFTIME'}
    <div class="modal-overlay">
      <div class="stats-modal">
        <h2>HALF TIME</h2>
        <div class="stats-grid">
          <div class="stat-row">
            <span class="val">{matchState.homeScore}</span>
            <span class="label">GOALS</span>
            <span class="val">{matchState.awayScore}</span>
          </div>
          <div class="stat-row">
            <span class="val">{possessionHome}%</span>
            <span class="label">POSSESSION</span>
            <span class="val">{possessionAway}%</span>
          </div>
        </div>
        <p class="mt-2 text-gray-400 text-sm">Teams switch sides</p>
        <button class="primary mt-2" onclick={resumeSecondHalf}>START SECOND HALF</button>
      </div>
    </div>
  {/if}

  <!-- Pause Overlay -->
  {#if matchState.status === 'PAUSED'}
    <div class="modal-overlay">
      <div class="stats-modal">
        <h2 style="color: #ffeb3b">GAME PAUSED</h2>
        <p class="mt-2 mb-4 text-gray-400">Press ESC to Resume</p>
        <div class="stats-grid" style="margin-top: 10px; margin-bottom: 20px;">
          <div class="stat-row">
            <span class="val">{matchState.homeScore}</span>
            <span class="label">SCORE</span>
            <span class="val">{matchState.awayScore}</span>
          </div>
        </div>
        <button class="primary" onclick={() => matchState.status = 'PLAYING'}>CONTINUE MATCH</button>
        <button class="secondary mt-2" onclick={() => window.location.href = `/`}>QUIT TO DASHBOARD</button>
      </div>
    </div>
  {/if}

  <div class="formation-badge">
    {matchState.homeFormation} <span class="dot">●</span>
  </div>

  {#if matchState.events.length > 0}
    {@const lastEvent = matchState.events[matchState.events.length - 1]}
    <div class="event-ticker" class:goal-event={lastEvent.type === 'goal'}>
      <span class="ticker-min">{lastEvent.minute}'</span> {lastEvent.desc}
    </div>
  {/if}

  <div class="scoreboard">
    <div class="team-crest home">⚽</div>
    <div class="score-box">
      <span class="score">{matchState.homeScore}</span>
      <span class="clock">{clockDisplay}</span>
      <span class="score">{matchState.awayScore}</span>
    </div>
    <div class="team-crest away">⚽</div>
  </div>

  <div class="bottom-hud">
    <!-- Shot power bar -->
    {#if isCharging}
      <div class="power-bar-container">
        <div class="power-bar" style="width: {shotPower}%"></div>
      </div>
    {/if}
    
    <div class="possession-container">
      <div class="possession-bar home" style="width: {possessionHome}%; background-color: var(--primary)"></div>
      <div class="possession-bar away" style="width: {possessionAway}%; background-color: var(--danger)"></div>
      <div class="possession-labels">
        <span>{homeTeam?.name || 'Home'} {possessionHome}%</span>
        <span>POSSESSION</span>
        <span>{possessionAway}% {awayTeam?.name || 'Away'}</span>
      </div>
    </div>
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

  .commentator-popup {
    position: absolute;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.9);
    padding: 10px 20px;
    border-radius: 20px;
    border: 2px solid #2d8a4a;
    animation: slideUp 0.3s ease-out;
    pointer-events: none;
  }
  .comment-text { font-weight: 900; letter-spacing: 1px; color: #ffeb3b; text-transform: uppercase; }

  @keyframes slideUp {
    from { transform: translate(-50%, 20px); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
  }

  .modal-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  .stats-modal {
    background: #1a1a1a;
    padding: 40px;
    border-radius: 12px;
    text-align: center;
    border: 1px solid #333;
    min-width: 400px;
  }

  .stats-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-top: 30px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #333;
    padding-bottom: 10px;
  }

  .stat-row .label { font-size: 12px; color: #888; font-weight: bold; }
  .stat-row .val { font-size: 24px; font-weight: 900; }

  .formation-badge {
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(0,0,0,0.8);
    padding: 5px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    border-left: 3px solid #2d8a4a;
  }
  .dot { color: #2d8a4a; margin-left: 5px; }

  .event-ticker {
    position: absolute;
    top: 60px;
    left: 20px;
    background: rgba(0,0,0,0.7);
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 11px;
    border-left: 3px solid #fff;
    max-width: 250px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    animation: fadeIn 0.3s ease-in-out;
  }
  .event-ticker.goal-event {
    background: rgba(45, 138, 74, 0.9);
    border-left-color: #ffeb3b;
    font-weight: bold;
  }
  .ticker-min {
    font-weight: 900;
    color: #ffeb3b;
    margin-right: 5px;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .scoreboard {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 15px;
    background: rgba(0,0,0,0.8);
    padding: 8px 25px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  }

  .score-box {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .score { font-size: 24px; font-weight: 900; }
  .clock { font-size: 18px; font-family: monospace; color: #aaa; }
  .team-crest { font-size: 24px; }

  .secondary { 
    background: #333; 
    color: white; 
    border: 1px solid #444; 
    padding: 10px 20px; 
    border-radius: 6px; 
    cursor: pointer; 
    font-weight: bold; 
    width: 100%; 
    font-size: 14px;
    margin-top: 10px;
    display: block;
    pointer-events: auto;
  }
  .secondary:hover { background: #444; }

  .bottom-hud {
    position: absolute;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    width: 300px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .power-bar-container {
    width: 100%;
    height: 8px;
    background: rgba(0,0,0,0.5);
    border-radius: 4px;
    overflow: hidden;
  }
  .power-bar {
    height: 100%;
    background: linear-gradient(to right, #ffeb3b, #ff5722);
    transition: width 0.05s linear;
  }

  .possession-container {
    width: 100%;
    height: 4px;
    display: flex;
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }
  
  .possession-labels {
    position: absolute;
    top: 8px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    opacity: 0.8;
  }
</style>
