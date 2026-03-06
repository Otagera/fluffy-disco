<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { Match } from '$lib/engine/Match';
  import { formations } from '$lib/game/formations';
  import PixiPitch from '$lib/components/PixiPitch.svelte';
  import HUD from '$lib/components/HUD.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const matchIdStr = $derived($page.params.id || '1');
  
  // New Engine Instance
  const match = new Match();
  
  let currentTime = $state(0);
  let playerLabels = $state<string[]>([]);

  let shake = $state(false);
  let showFinalOverlay = $state(false);
  let isSimulating = $state(false);
  let cinematicUi = $state(true);

  // New Game Loop using the Match Orchestrator
  let lastFrameTime = 0;
  function gameLoop(time: number) {
    const dt = lastFrameTime ? (time - lastFrameTime) / 1000 : 0.016;
    lastFrameTime = time;

    // Pulse the new engine
    match.tick(dt);
    
    // Sync reactive state
    currentTime = match.currentTime;

    requestAnimationFrame(gameLoop);
  }

  onMount(() => {
    // 1. Get Formations
    const homeForm = formations[data.homeTeam.formation] || formations['4-4-2 Wide'];
    const awayForm = formations[data.awayTeam.formation] || formations['4-4-2 Wide'];

    // 2. Map to Pitch (105m x 68m)
    const startPositions = [];
    for (let i = 0; i < 11; i++) {
        startPositions.push({ x: homeForm[i].x * 105, y: homeForm[i].y * 68 });
    }
    for (let i = 0; i < 11; i++) {
        startPositions.push({ x: (1 - awayForm[i].x) * 105, y: (1 - awayForm[i].y) * 68 });
    }

    // 3. Labels
    const hL = (data.homePlayers || []).slice(0, 11).map(p => p.number?.toString() || p.name?.substring(0,2) || 'P1');
    const aL = (data.awayPlayers || []).slice(0, 11).map(p => p.number?.toString() || p.name?.substring(0,2) || 'P2');
    playerLabels = [...hL, ...aL];
    
    match.setup(startPositions);
    requestAnimationFrame(gameLoop);
  });

  function handleSkip() {
    if (isSimulating) return;
    isSimulating = true;
    
    // Use the high-speed batch simulation method
    const results = match.simulateMatch();
    console.log("Match Sim Results:", results);
    
    isSimulating = false;
    showFinalOverlay = true;
  }
</script>

<div class="container relative" class:shake={shake}>
  <HUD {match} {currentTime} homeTeam={data.homeTeam} awayTeam={data.awayTeam} />
  
  <!-- Simulating Overlay -->
  {#if isSimulating}
    <div class="modal-overlay" style="z-index: 2000; pointer-events: auto; position: fixed;">
      <div class="stats-modal" style="background: rgba(0,0,0,0.9); border: 2px solid var(--primary); min-width: 300px;">
        <div class="recording-dot mb-2" style="width: 20px; height: 20px; margin: 0 auto;"></div>
        <h2 style="letter-spacing: 2px; color: white;">SIMULATING...</h2>
        <p style="color: #888;">Calculating full match analytics</p>
      </div>
    </div>
  {/if}

  <!-- Final Score Overlay -->
  {#if showFinalOverlay}
    <div class="modal-overlay" style="z-index: 1000; pointer-events: auto; position: fixed;">
      <div class="stats-modal" style="background: #1a1a1a; border: 2px solid var(--primary); min-width: 500px;">
        <h1 style="color: #888; font-size: 0.8rem; letter-spacing: 2px; margin-bottom: 1rem;">FULL TIME RESULT</h1>
        <div style="display: flex; align-items: center; justify-content: center; gap: 2rem; margin: 2rem 0;">
          <div style="text-align: center; flex: 1;">
            <div style="width: 60px; height: 70px; background: var(--primary); margin: 0 auto; border-radius: 0 0 30px 30px;"></div>
            <h2 style="font-size: 1.4rem; margin-top: 1rem;">{data.homeTeam.name}</h2>
          </div>
          <div style="font-size: 5rem; font-weight: 900; letter-spacing: 5px; font-family: monospace;">
             SIM COMPLETE
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="width: 60px; height: 70px; background: var(--danger); margin: 0 auto; border-radius: 0 0 30px 30px;"></div>
            <h2 style="font-size: 1.4rem; margin-top: 1rem;">{data.awayTeam.name}</h2>
          </div>
        </div>
        
        <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #333;">
          <button class="primary btn-lg" style="width: 100%; padding: 1.5rem; font-size: 1.2rem;" onclick={() => window.location.href = '/'}>
            RETURN TO DASHBOARD
          </button>
        </div>
      </div>
    </div>
  {/if}

  <PixiPitch {match} labels={playerLabels} />

  <div class="controls mt-1 flex justify-center gap-1" class:hidden-live={cinematicUi}>
    <button class="save-btn" onclick={() => window.location.href = `/`}>
      ⚙️ DASHBOARD
    </button>
    <button class="save-btn" onclick={() => cinematicUi = !cinematicUi}>
      {cinematicUi ? '🎬 SHOW UI' : '🎬 HIDE UI'}
    </button>
    
    <button class="secondary btn-lg" onclick={handleSkip}>
        SKIP TO END
    </button>
  </div>
</div>

<style>
  .container {
    position: relative;
    user-select: none;
    transition: transform 0.05s;
  }
  
  .hidden-live {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  /* Only reveal when mouse is at the top/bottom 15% of screen */
  .container:hover .replay-status.hidden-live,
  .container:hover .controls.hidden-live {
    opacity: 1;
    pointer-events: auto;
  }
  
  .replay-status {
    position: absolute;
    top: 80px;
    right: 20px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    z-index: 110;
  }

  .recording-dot {
    width: 10px;
    height: 10px;
    background: #ff5252;
    border-radius: 50%;
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0% { opacity: 1; }
    50% { opacity: 0.3; }
    100% { opacity: 1; }
  }

  .save-btn {
    background: rgba(0,0,0,0.8);
    color: white;
    border: 1px solid #444;
    padding: 5px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    font-weight: bold;
  }

  .shake {
    animation: shake-anim 0.4s infinite;
  }

  @keyframes shake-anim {
    0% { transform: translate(3px, 3px); }
    25% { transform: translate(-3px, -3px); }
    50% { transform: translate(3px, -3px); }
    75% { transform: translate(-3px, 3px); }
    100% { transform: translate(0, 0); }
  }

  .commentary-card { background: #fdfdfd; }
  .events-list { max-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; }
  .event { display: flex; gap: 1rem; padding: 0.5rem; border-radius: 6px; background: #f0f0f0; border-left: 4px solid #ccc; }
  .event.goal { background: #e8f5e9; border-left-color: #4caf50; font-weight: bold; }
  .event.sub { background: #fff3e0; border-left-color: #ff9800; font-style: italic; }
  .ev-min { color: #666; font-family: monospace; font-weight: bold; width: 30px; }

  .btn-lg { padding: 1rem 2rem; font-size: 1rem; font-weight: 900; letter-spacing: 1px; border-radius: 8px; cursor: pointer; border: none; }
  .primary { background: var(--primary); color: white; }
  .secondary { background: #eee; color: #444; }
  
  .empty-state { text-align: center; color: #999; font-style: italic; padding: 1rem; }

  .modal-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.85);
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
    color: white;
  }

  .final-stats-grid {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-top: 20px;
  }
  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #222;
    padding-bottom: 8px;
    font-size: 1.2rem;
    font-weight: bold;
  }
  .stat-label {
    font-size: 0.7rem;
    color: #888;
    letter-spacing: 1px;
  }

  .player-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .player-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: #222;
    border-radius: 6px;
    font-size: 0.9rem;
    border: 1px solid #333;
    transition: all 0.1s;
  }
  .player-row:hover { border-color: #555; }
  .player-row.selected { border-color: var(--primary); background: rgba(59, 130, 246, 0.2); }

  .number { font-weight: 900; color: var(--primary); width: 20px; }
  .role-badge { 
    background: #444; 
    color: white;
    padding: 2px 6px; 
    border-radius: 4px; 
    font-size: 0.7rem; 
    font-weight: bold;
    width: 35px;
    text-align: center;
  }
  .name { font-weight: bold; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mini-stats { display: flex; gap: 0.5rem; font-size: 0.7rem; font-weight: 900; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  .items-center { align-items: center; }
  .mb-1 { margin-bottom: 1rem; }
  .mb-2 { margin-bottom: 2rem; }
  .mt-1 { margin-top: 1rem; }
  .mt-2 { margin-top: 2rem; }
  .w-100 { width: 100%; }
</style>


