<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { matchState } from '$lib/game/matchState.svelte';
  import { resetMatch, loadMatchState, updateTeamTactics } from '$lib/game/rules';
  import { formations } from '$lib/game/formations';
  import { startEngine, startClock, stopClock, tick as engineTick } from '$lib/game/engine.svelte';
  import { handleInput } from '$lib/game/input';
  import { downloadReplay, clearReplay } from '$lib/game/recorder';
  import Pitch from '$lib/components/Pitch.svelte';
  import HUD from '$lib/components/HUD.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const matchIdStr = $derived($page.params.id || '1');
  let shake = $state(false);
  let showFinalOverlay = $state(false);
  let showTacticsOverlay = $state(false);
  let isSimulating = $state(false);
  let cinematicUi = $state(true);
  let selectedSubOut = $state<number | null>(null);
  let selectedSubIn = $state<number | null>(null);
  let isHomeManager = $derived(data.managerTeamId === data.homeTeam.id);
  
  let currentFormation = $state(data.homeTeam.formation);
  let currentStyle = $state(data.homeTeam.tacticalStyle);
  let currentMentality = $state(data.homeTeam.mentality || 'BALANCED');
  
  let fileInput: HTMLInputElement;
  let resultForm: HTMLFormElement;

  onMount(() => {
    isHomeManager ? currentFormation = data.homeTeam.formation : currentFormation = data.awayTeam.formation;
    isHomeManager ? currentStyle = data.homeTeam.tacticalStyle : currentStyle = data.awayTeam.tacticalStyle;
    isHomeManager ? currentMentality = data.homeTeam.mentality : currentMentality = data.awayTeam.mentality;
    // Read any tactical overrides (formation, style, roles) set on the tactics page
    let homeTeam = data.homeTeam;
    let awayTeam = data.awayTeam;
    let homePlayers = data.homePlayers;
    let awayPlayers = data.awayPlayers;
    let customRoles = {};
    let homeCustomPositions = {};
    let awayCustomPositions = {};
    
    const savedOverrides = sessionStorage.getItem('tacticalOverrides');
    if (savedOverrides) {
      try {
        const overrides = JSON.parse(savedOverrides);
        if (overrides.isHome) {
          homeTeam = { ...homeTeam, formation: overrides.formation, tacticalStyle: overrides.style, mentality: overrides.mentality };
          if (overrides.customSquad) homePlayers = overrides.customSquad;
          homeCustomPositions = overrides.customPositions || {};
        } else {
          awayTeam = { ...awayTeam, formation: overrides.formation, tacticalStyle: overrides.style, mentality: overrides.mentality };
          if (overrides.customSquad) awayPlayers = overrides.customSquad;
          awayCustomPositions = overrides.customPositions || {};
        }
        customRoles = overrides.customRoles || {};
      } catch (e) {
        console.error("Failed to parse tactical overrides", e);
      }
    }

    resetMatch({ 
      status: 'PLAYING', 
      resetStats: true,
      homeTeam,
      awayTeam,
      homePlayers,
      awayPlayers,
      customRoles,
      homeCustomPositions,
      awayCustomPositions
    });
    
    startEngine();
    startClock();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      stopClock();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  $effect(() => {
    if (matchState.events.length > 0) {
      const last = matchState.events[matchState.events.length - 1];
      if (last.type === 'goal') {
        triggerShake();
      }
    }
  });

  function triggerShake() {
    shake = true;
    setTimeout(() => { shake = false; }, 400);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key.toLowerCase() === 'h') {
      cinematicUi = !cinematicUi;
      return;
    }
    handleInput(e, 'keydown');
  }
  function onKeyUp(e: KeyboardEvent) { handleInput(e, 'keyup'); }

  function handleStart() {
    clearReplay();
    matchState.replay.isRecording = true;
    
    // Use saved overrides even on restart
    let homeTeam = data.homeTeam;
    let awayTeam = data.awayTeam;
    let homePlayers = data.homePlayers;
    let awayPlayers = data.awayPlayers;
    let customRoles = {};
    let homeCustomPositions = {};
    let awayCustomPositions = {};
    const savedOverrides = sessionStorage.getItem('tacticalOverrides');
    if (savedOverrides) {
      try {
        const overrides = JSON.parse(savedOverrides);
        if (overrides.isHome) {
          homeTeam = { ...homeTeam, formation: overrides.formation, tacticalStyle: overrides.style, mentality: overrides.mentality };
          if (overrides.customSquad) homePlayers = overrides.customSquad;
          homeCustomPositions = overrides.customPositions || {};
        } else {
          awayTeam = { ...awayTeam, formation: overrides.formation, tacticalStyle: overrides.style, mentality: overrides.mentality };
          if (overrides.customSquad) awayPlayers = overrides.customSquad;
          awayCustomPositions = overrides.customPositions || {};
        }
        customRoles = overrides.customRoles || {};
      } catch (e) {
        console.error("Failed to parse tactical overrides", e);
      }
    }

    resetMatch({ 
      status: 'PLAYING', 
      resetStats: true,
      homeTeam,
      awayTeam,
      homePlayers,
      awayPlayers,
      customRoles,
      homeCustomPositions,
      awayCustomPositions
    });
  }

  function handleDownload() {
    matchState.replay.isRecording = false;
    downloadReplay(matchIdStr);
  }

  function handleSkip() {
    if (isSimulating) return;
    isSimulating = true;
    
    const wasRecording = matchState.replay.isRecording;
    matchState.replay.isRecording = false;

    // Use a recursive batch function to yield to the browser periodically
    const runBatch = () => {
      // Simulate 5 minutes of game time per batch
      const batchEndTime = Math.min(5400, matchState.timer + 300); 
      
      while (matchState.timer < batchEndTime) {
        matchState.timer += 10;
        for (let i = 0; i < 600; i++) {
          engineTick();
        }

        if (matchState.timer === 2700) {
          matchState.status = 'HALFTIME';
          matchState.events.push({ minute: 45, type: 'whistle', desc: 'Half time!' });
          matchState.status = 'PLAYING';
        }
      }

      if (matchState.timer < 5400) {
        // Yield to browser, then run next batch
        requestAnimationFrame(runBatch);
      } else {
        // Simulation finished
        matchState.status = 'FINISHED';
        matchState.replay.isRecording = wasRecording;
        isSimulating = false;
        showFinalOverlay = true;
      }
    };

    // Kick off the first batch
    requestAnimationFrame(runBatch);
  }

  function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        loadMatchState(data);
      } catch (err) {
        console.error("Failed to parse replay file", err);
      }
    };
    reader.readAsText(file);
  }

  function toggleTactics() {
    if (matchState.status === 'PLAYING') {
      matchState.status = 'PAUSED';
      // Initialize with current state just in case
      currentFormation = isHomeManager ? matchState.homeFormation : matchState.awayFormation;
      currentStyle = isHomeManager ? matchState.homeTacticalStyle : matchState.awayTacticalStyle;
      currentMentality = isHomeManager ? matchState.homeMentality : matchState.awayMentality;
    } else if (matchState.status === 'PAUSED') {
      // Apply tactical changes on resume
      updateTeamTactics(isHomeManager ? 'home' : 'away', currentFormation, currentStyle, currentMentality);
      matchState.status = 'PLAYING';
    }
    showTacticsOverlay = !showTacticsOverlay;
    selectedSubOut = null;
    selectedSubIn = null;
  }

  function handleSub() {
    if (selectedSubOut === null || selectedSubIn === null) return;
    if (matchState.homeSubsUsed >= 5) {
      alert("No substitutions remaining.");
      return;
    }

    const outIndex = matchState.players.findIndex(p => p.id === selectedSubOut);
    const inIndex = matchState.homeBench.findIndex(p => p.id === selectedSubIn);

    if (outIndex !== -1 && inIndex !== -1) {
      const pOut = matchState.players[outIndex];
      const pIn = matchState.homeBench[inIndex];

      // Swap physical representation but keep roles/positions
      const newPlayer = {
        ...pIn,
        x: pOut.x,
        y: pOut.y,
        homeX: pOut.homeX,
        homeY: pOut.homeY,
        role: pOut.role,
        tacticalRole: pOut.tacticalRole,
        anchorX: pOut.anchorX,
        anchorY: pOut.anchorY,
        vx: 0, vy: 0,
        aiState: 'POSITION' as any,
        pressure: 0,
        currentStamina: 100, // Fresh legs!
        possessionStrength: 1.0,
        currentAction: null,
        actionTimer: 0,
        btState: {}
      };

      matchState.players[outIndex] = newPlayer;
      matchState.homeBench.splice(inIndex, 1);
      matchState.homeSubsUsed++;

      // Log sub event
      const minute = Math.floor(matchState.timer / 60);
      matchState.events.push({ minute, type: 'sub', desc: `SUB: ${pIn.name} ON for ${pOut.name}` });

      selectedSubOut = null;
      selectedSubIn = null;
    }
  }

  function getStatColor(val: number) {
    if (val >= 15) return '#4caf50';
    if (val >= 10) return '#ffeb3b';
    return '#ff5722';
  }
</script>

<div class="container relative" class:shake={shake}>
  <HUD shotPower={matchState.shotPower} isCharging={matchState.isCharging} homeTeam={data.homeTeam} awayTeam={data.awayTeam} />
  
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
  {#if showFinalOverlay || matchState.status === 'FINISHED'}
    <div class="modal-overlay" style="z-index: 1000; pointer-events: auto; position: fixed;">
      <div class="stats-modal" style="background: #1a1a1a; border: 2px solid var(--primary); min-width: 500px;">
        <h1 style="color: #888; font-size: 0.8rem; letter-spacing: 2px; margin-bottom: 1rem;">FULL TIME RESULT</h1>
        <div style="display: flex; align-items: center; justify-content: center; gap: 2rem; margin: 2rem 0;">
          <div style="text-align: center; flex: 1;">
            <div style="width: 60px; height: 70px; background: var(--primary); margin: 0 auto; border-radius: 0 0 30px 30px;"></div>
            <h2 style="font-size: 1.4rem; margin-top: 1rem;">{data.homeTeam.name}</h2>
          </div>
          <div style="font-size: 5rem; font-weight: 900; letter-spacing: 5px; font-family: monospace;">
            {matchState.homeScore} - {matchState.awayScore}
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="width: 60px; height: 70px; background: var(--danger); margin: 0 auto; border-radius: 0 0 30px 30px;"></div>
            <h2 style="font-size: 1.4rem; margin-top: 1rem;">{data.awayTeam.name}</h2>
          </div>
        </div>

        <div class="final-stats-grid">
          <div class="stat-item">
            <span>{matchState.stats.home.shots}</span>
            <span class="stat-label">SHOTS</span>
            <span>{matchState.stats.away.shots}</span>
          </div>
          <div class="stat-item">
            <span>{matchState.stats.home.dangerousEntries}</span>
            <span class="stat-label">DANGEROUS ENTRIES</span>
            <span>{matchState.stats.away.dangerousEntries}</span>
          </div>
          <div class="stat-item">
            <span>{matchState.stats.home.passesCompleted} / {matchState.stats.home.passesAttempted}</span>
            <span class="stat-label">PASSES</span>
            <span>{matchState.stats.away.passesCompleted} / {matchState.stats.away.passesAttempted}</span>
          </div>
        </div>
        
        <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #333;">
          <button class="primary btn-lg" style="width: 100%; padding: 1.5rem; font-size: 1.2rem;" onclick={() => resultForm.submit()}>
            CONFIRM & RETURN TO DASHBOARD
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- In-Game Management Overlay -->
  {#if showTacticsOverlay}
    <div class="modal-overlay" style="z-index: 900; pointer-events: auto; position: fixed;">
      <div class="stats-modal" style="background: #111; border: 2px solid var(--primary); min-width: 800px; max-height: 80vh; overflow-y: auto;">
        <div class="flex justify-between items-center mb-2">
          <h1 style="color: white; margin: 0;">In-Game Management</h1>
          <button class="secondary btn-lg" style="padding: 0.5rem 1rem;" onclick={toggleTactics}>RESUME MATCH</button>
        </div>
        
        <!-- TACTICAL CHANGES -->
        <div class="flex gap-1 mb-2" style="background: #222; padding: 1rem; border-radius: 8px;">
          <div style="flex: 1;">
            <h3 style="color: #888; margin-bottom: 0.5rem;">Your Tactics</h3>
            <div class="flex gap-1 flex-wrap">
              <select bind:value={currentFormation} class="tactic-select" title="Formation">
                {#each Object.keys(formations) as f}
                  <option value={f}>{f}</option>
                {/each}
              </select>
              <select bind:value={currentStyle} class="tactic-select" title="Tactical Style">
                <option>Tiki-Taka</option>
                <option>Gegenpress</option>
                <option>Route One</option>
                <option>Park the Bus</option>
                <option>Fluid Counter</option>
              </select>
              <select bind:value={currentMentality} class="tactic-select mentality-select" title="Mentality">
                <option value="ULTRA_DEFENSIVE">Ultra Defensive</option>
                <option value="DEFENSIVE">Defensive</option>
                <option value="BALANCED">Balanced</option>
                <option value="ATTACKING">Attacking</option>
                <option value="ULTRA_ATTACKING">Ultra Attacking</option>
              </select>
            </div>
          </div>
          <div style="flex: 1; border-left: 1px solid #333; padding-left: 1rem;">
            <h3 style="color: #888; margin-bottom: 0.5rem;">Opponent Tactics</h3>
            <p style="color: white; font-weight: bold;">
              {isHomeManager ? matchState.awayFormation : matchState.homeFormation} • 
              {isHomeManager ? matchState.awayTacticalStyle : matchState.homeTacticalStyle}
            </p>
            <p style="color: var(--danger); font-size: 0.8rem; font-weight: bold;">
              {(isHomeManager ? matchState.awayMentality : matchState.homeMentality).replace('_', ' ')}
            </p>
          </div>
        </div>

        <p style="color: #ccc; margin-bottom: 1rem; text-align: left;">Subs Remaining: {5 - (isHomeManager ? matchState.homeSubsUsed : matchState.awaySubsUsed)}/5</p>

        <div class="grid grid-2 gap-2" style="text-align: left;">
          <div>
            <h3 style="color: #888; border-bottom: 1px solid #333; padding-bottom: 0.5rem;">On Pitch</h3>
            <div class="player-list mt-1">
              {#each matchState.players.filter(p => p.team === 'home') as p}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="player-row {selectedSubOut === p.id ? 'selected' : ''}" onclick={() => selectedSubOut = p.id} style="position: relative; overflow: hidden; cursor: pointer;">
                  <div class="stam-bar" style="width: 5px; height: 100%; background: {p.currentStamina > 50 ? '#4caf50' : p.currentStamina > 30 ? '#ffeb3b' : '#f44336'}; position: absolute; left: 0; top: 0;"></div>
                  <span class="number" style="margin-left: 10px;">{p.number}</span>
                  <span class="role-badge">{p.tacticalRole}</span>
                  <span class="name" style="color: white;">{p.name}</span>
                  <span style="color: #aaa; font-size: 0.8rem;">{Math.round(p.currentStamina)}%</span>
                </div>
              {/each}
            </div>
          </div>
          <div>
            <h3 style="color: #888; border-bottom: 1px solid #333; padding-bottom: 0.5rem;">Bench</h3>
            <div class="player-list mt-1">
              {#each matchState.homeBench as p}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="player-row {selectedSubIn === p.id ? 'selected' : ''}" onclick={() => selectedSubIn = p.id} style="cursor: pointer;">
                  <span class="role-badge" style="margin-left: 10px;">{p.role}</span>
                  <span class="name" style="color: white;">{p.name}</span>
                  <div class="mini-stats">
                    <span style="color: {getStatColor(p.attributes.passing)}">PAS {p.attributes.passing}</span>
                    <span style="color: {getStatColor(p.attributes.shooting)}">SHO {p.attributes.shooting}</span>
                    <span style="color: {getStatColor(p.attributes.pace)}">PAC {p.attributes.pace}</span>
                  </div>
                </div>
              {/each}
              {#if matchState.homeBench.length === 0}
                <p style="color: #666; font-style: italic;">No players remaining on bench.</p>
              {/if}
            </div>
            
            <div style="margin-top: 2rem;">
              <button 
                class="primary btn-lg w-100" 
                disabled={selectedSubOut === null || selectedSubIn === null || matchState.homeSubsUsed >= 5}
                onclick={handleSub}
                style={selectedSubOut === null || selectedSubIn === null || matchState.homeSubsUsed >= 5 ? 'opacity: 0.5; cursor: not-allowed;' : ''}
              >
                CONFIRM SUBSTITUTION
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Result Form (Hidden) -->
  <form bind:this={resultForm} method="POST" action="?/processMatch" style="display:none">
    <input type="hidden" name="homeScore" value={matchState.homeScore} />
    <input type="hidden" name="awayScore" value={matchState.awayScore} />
    <input type="hidden" name="playerStamina" value={JSON.stringify(
      Object.fromEntries(matchState.players.filter(p => p.originalId).map(p => [p.originalId, Math.round(p.currentStamina)]))
    )} />
    <input type="hidden" name="matchAnalytics" value={JSON.stringify(matchState.analytics)} />
  </form>

  <div class="replay-status" class:hidden-live={matchState.status === 'PLAYING' && cinematicUi}>
    {#if matchState.replay.isRecording}
      <div class="flex items-center gap-1">
        <div class="recording-dot"></div>
        <span class="text-xs font-bold text-white">REC ({matchState.replay.frames.length})</span>
      </div>
    {/if}
    {#if matchState.replay.frames.length > 0}
      <button class="save-btn" onclick={handleDownload}>💾 SAVE JSON</button>
    {/if}
    <input type="file" accept=".json" bind:this={fileInput} onchange={handleFileChange} style="display: none;" />
    <button class="save-btn" onclick={() => fileInput.click()}>📂 RESUME MATCH</button>
  </div>

  <Pitch />

  <div class="controls mt-1 flex justify-center gap-1" class:hidden-live={matchState.status === 'PLAYING' && cinematicUi}>
    <button class="save-btn" onclick={() => window.location.href = `/`}>
      ⚙️ DASHBOARD
    </button>
    <button class="save-btn" onclick={() => cinematicUi = !cinematicUi}>
      {cinematicUi ? '🎬 SHOW UI' : '🎬 HIDE UI'}
    </button>
    
    {#if matchState.status === 'FINISHED'}
      <button class="primary btn-lg" onclick={() => showFinalOverlay = true}>
        VIEW FULL TIME SCORE
      </button>
    {:else if matchState.status === 'PLAYING' || matchState.status === 'PAUSED'}
      <button class="primary btn-lg" style="background: #f59e0b;" onclick={toggleTactics}>
        TACTICS & SUBS
      </button>
      <button class="secondary btn-lg" onclick={handleSkip}>
        SKIP TO END
      </button>
    {/if}
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

  .container:hover .hidden-live {
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


