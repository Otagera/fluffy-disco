<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { enhance } from '$app/forms';
  import { Match, MatchStatus } from '$lib/engine/Match.svelte.ts';
  import { PLAYER_STRIDE, PLAYER_OFFSET_STAMINA, PLAYER_OFFSET_X, PLAYER_OFFSET_Y, BALL_OFFSET_X, BALL_OFFSET_Y } from '$lib/engine/core/constants';
  import PixiPitch from '$lib/components/PixiPitch.svelte';
  import HUD from '$lib/components/HUD.svelte';
  import FormationBoard from '$lib/components/FormationBoard.svelte';
  import { MatchRecorder } from '$lib/engine/MatchRecorder';
  import { formations } from '$lib/engine/ai/Formations';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const matchIdStr = $derived($page.params.id || '1');
  
  // determine which side we're managing
  const isHome = data.managerTeamId === data.homeTeam.id;

  // New Engine Instance
  const match = new Match();
  match.recorder = new MatchRecorder(matchIdStr, data.homeTeam.id, data.awayTeam.id);
  
  let currentTime = $state(0);
  let playerLabels = $state<string[]>([]);
  let benchPlayers = $state<any[]>([]);
  let showSubs = $state(false);

  let showFinalOverlay = $state(false);
  let isSimulating = $state(false);
  let cinematicUi = $state(false);
  let forceShowControls = $state(false);

  let gameSpeed = $state(1);
  // let gameSpeed = $state(20);
  let isPaused = $state(false);
  let hasKickedOff = $state(false);
  let showTacticsModal = $state(false);

  let finalHomeScore = $state(0);
  let finalAwayScore = $state(0);
  
  // Keep original formations for swapping sides
  let homeStartPositions: {x:number, y:number}[] = [];
  let awayStartPositions: {x:number, y:number}[] = [];
  let playerStats: any[] = [];
  let starterRoles: string[] = [];
  let squad = $state<any[]>([]);

  function normalizeEngineStat(value: number | undefined, fallback: number = 50): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    if (value <= 20) return Math.max(1, Math.min(100, value * 5));
    return Math.max(1, Math.min(100, value));
  }

  function toEngineStats(attributes: any) {
    return {
      passing: normalizeEngineStat(attributes?.passing),
      finishing: normalizeEngineStat(attributes?.finishing),
      tackling: normalizeEngineStat(attributes?.tackling),
      dribbling: normalizeEngineStat(attributes?.dribbling),
      vision: normalizeEngineStat(attributes?.vision),
      composure: normalizeEngineStat(attributes?.composure),
      aggression: normalizeEngineStat(attributes?.aggression, 40),
      reflexes: normalizeEngineStat(attributes?.reflexes, 50),
      handling: normalizeEngineStat(attributes?.handling, 50)
    };
  }

  // New Game Loop using the Match Orchestrator
  let lastFrameTime = 0;
  let syncTimer = 0;

  function gameLoop(time: number) {
    const rawDt = lastFrameTime ? (time - lastFrameTime) / 1000 : 0.016;
    const dt = Math.min(rawDt, 0.05);
    lastFrameTime = time;

    // Pulse the new engine
    if (hasKickedOff && !isPaused && !showTacticsModal && match.status !== MatchStatus.PAUSED && match.status !== MatchStatus.HALF_TIME) {
      
      // Sub-step the physics to prevent Euler integration overshoot at high game speeds
      let simulatedTime = 0;
      const targetTime = dt * gameSpeed;
      const fixedDt = 0.05; // 50ms per step max
      
      while (simulatedTime < targetTime) {
          const step = Math.min(fixedDt, targetTime - simulatedTime);
          match.tick(step);
          simulatedTime += step;
      }
      
      // Periodically sync engine stamina back to the UI squad array
      syncTimer += targetTime;
      if (syncTimer > 2) { // Sync every 2 engine seconds
        syncTimer = 0;
        const teamNum = isHome ? 0 : 1;
        const startIdx = teamNum * 11;
        let changed = false;
        
        // create a shallow copy to trigger Svelte 5 reactivity
        const newSquad = [...squad];
        
        for (let i = 0; i < 11; i++) {
            const engineIdx = startIdx + i;
            const staminaRaw = match.memory.playerBuffer[engineIdx * PLAYER_STRIDE + PLAYER_OFFSET_STAMINA];
            const staminaScaled = Math.round(staminaRaw * 100);
            
            if (newSquad[i] && Math.abs(newSquad[i].condition - staminaScaled) > 1) {
                newSquad[i] = { ...newSquad[i], condition: staminaScaled };
                changed = true;
            }
        }
        
        if (changed) {
            squad = newSquad;
        }
      }
    }
    
    // Sync reactive state
    currentTime = match.currentTime;

    // Auto-show final overlay if time exceeds 90 mins (5400s)
    if (currentTime >= 5400 && !showFinalOverlay && !isSimulating) {
        finalHomeScore = match.homeScore;
        finalAwayScore = match.awayScore;
        showFinalOverlay = true;
        
        // Save Replay
        if (match.recorder) {
            match.recorder.saveToIndexedDB(match.analytics, playerLabels);
        }
    }

    requestAnimationFrame(gameLoop);
  }

  onMount(() => {
    // apply any tactical overrides saved earlier
    let overrides: any = null;
    try {
      const raw = sessionStorage.getItem('tacticalOverrides');
      if (raw) {
        overrides = JSON.parse(raw);
        sessionStorage.removeItem('tacticalOverrides');
      }
    } catch (e) {
      console.error('Failed to parse tactical overrides', e);
    }

    // 1. Get Formations
    const homeForm = formations[data.homeTeam.formation] || formations['4-4-2 Wide'];
    const awayForm = formations[data.awayTeam.formation] || formations['4-4-2 Wide'];

    // 2. Map to Pitch (105m x 68m)
    for (let i = 0; i < 11; i++) {
        let px = homeForm[i].x;
        let py = homeForm[i].y;
        
        // Priority: 1. Session Overrides (Pre-match setup) -> 2. Persistent Overrides (Club Tactics) -> 3. Base Formation
        if (overrides && overrides.isHome && overrides.customPositions?.[i]) {
          px = overrides.customPositions[i].x;
          py = overrides.customPositions[i].y;
        } else if (isHome && data.homeTeam.customPositions?.[i]) {
          px = data.homeTeam.customPositions[i].x;
          py = data.homeTeam.customPositions[i].y;
        }
        homeStartPositions.push({ x: px * 105, y: py * 68 });
    }
    for (let i = 0; i < 11; i++) {
        let px = awayForm[i].x;
        let py = awayForm[i].y;
        
        if (overrides && !overrides.isHome && overrides.customPositions?.[i]) {
          px = overrides.customPositions[i].x;
          py = overrides.customPositions[i].y;
        } else if (!isHome && data.awayTeam.customPositions?.[i]) {
          // Note: if managing away team, we use their DB positions
          px = data.awayTeam.customPositions[i].x;
          py = data.awayTeam.customPositions[i].y;
        }
        awayStartPositions.push({ x: (1 - px) * 105, y: (1 - py) * 68 });
    }

    // Prepare player list (possibly overridden squad)
    const homePlayers = data.homePlayers || [];
    const awayPlayers = data.awayPlayers || [];
    squad = isHome ? homePlayers.slice() : awayPlayers.slice();
    if (overrides && overrides.customSquad) {
      squad = overrides.customSquad;
    }

    // Build full starter arrays for both teams; managed side can still use tactical overrides.
    const managedRoles = squad.map((p: any, idx: number) => {
        if (overrides?.customRoles?.[idx]) return overrides.customRoles[idx];
        const team = isHome ? data.homeTeam : data.awayTeam;
        return team.customRoles?.[idx] || p.role;
    });
    const managedStats = squad.map((p: any) => toEngineStats(p.attributes));
    const opponentSquad = (isHome ? awayPlayers : homePlayers).slice();
    const opponentRoles = opponentSquad.map((p: any) => p.role);
    const opponentStats = opponentSquad.map((p: any) => toEngineStats(p.attributes));

    const starterStats = isHome
      ? [...managedStats.slice(0, 11), ...opponentStats.slice(0, 11)]
      : [...opponentStats.slice(0, 11), ...managedStats.slice(0, 11)];
    starterRoles = isHome
      ? [...managedRoles.slice(0, 11), ...opponentRoles.slice(0, 11)]
      : [...opponentRoles.slice(0, 11), ...managedRoles.slice(0, 11)];
    const benchStatsArr = managedStats.slice(11);
    const benchRolesArr = managedRoles.slice(11);
    benchPlayers = squad.slice(11);

    // assign to match instance after setup
    playerStats = [...starterStats];

    // 3. Labels (Numbers)
    const hL = squad.slice(0, 11).map((p: any) => p.number?.toString() || 'P');
    const aL = (isHome ? awayPlayers : homePlayers).slice(0, 11).map((p: any) => p.number?.toString() || 'P');
    playerLabels = [...hL, ...aL];

    const homeStyle = (overrides && overrides.isHome) ? (overrides.style || data.homeTeam.tacticalStyle) : data.homeTeam.tacticalStyle;
    const awayStyle = (overrides && !overrides.isHome) ? (overrides.style || data.awayTeam.tacticalStyle) : data.awayTeam.tacticalStyle;
    const homeMentality = (overrides && overrides.isHome) ? (overrides.mentality || data.homeTeam.mentality) : data.homeTeam.mentality;
    const awayMentality = (overrides && !overrides.isHome) ? (overrides.mentality || data.awayTeam.mentality) : data.awayTeam.mentality;

    match.setup([...homeStartPositions, ...awayStartPositions], playerStats, starterRoles, [homeStyle, awayStyle], [homeMentality, awayMentality], true);
    
    // Assign managed team so the engine can skip AI auto-subs for the user
    match.managedTeam = isHome ? 0 : 1;

    // attach bench if provided
    match.benchStats = benchStatsArr;
    match.benchRoles = benchRolesArr;

    requestAnimationFrame(gameLoop);
  });

  function startSecondHalf() {
    // Swap sides (mirror across X=52.5)
    const swappedHome = homeStartPositions.map(p => ({ x: 105 - p.x, y: 68 - p.y }));
    const swappedAway = awayStartPositions.map(p => ({ x: 105 - p.x, y: 68 - p.y }));
    
    // Half-time Stamina Recovery (approx +15%)
    for (let i = 0; i < 22; i++) {
        const offset = i * PLAYER_STRIDE + PLAYER_OFFSET_STAMINA;
        const currentStamina = match.memory.playerBuffer[offset];
        match.memory.playerBuffer[offset] = Math.min(1.0, currentStamina + 0.15);
    }

    match.currentHalf = 2;
    // We pass empty arrays for styles/mentalities during half time so they don't overwrite current live states
    match.setup([...swappedHome, ...swappedAway], playerStats, starterRoles, undefined, undefined, false);
    match.status = MatchStatus.KICKOFF;
  }

  function startMatch() {
    // user pressed kickoff – enable ticking and force PLAYING state
    hasKickedOff = true;
    match.status = MatchStatus.PLAYING;
    // The ball is already placed at the center (52.5, 34.0) by match.setup()
    // The closest player (usually the forward) will automatically pick it up.
  }

  function handleTacticsOverrides(o: any, roles: any, style: string, mentality: string) {
      if (isHome) {
          match.homeStyle = style;
          match.homeMentality = mentality;
      } else {
          match.awayStyle = style;
          match.awayMentality = mentality;
      }
      
      // Update engine roles
      const teamIdx = isHome ? 0 : 11;
      for (let i = 0; i < 11; i++) {
          if (roles[i]) {
              match.roles[teamIdx + i] = roles[i];
          }
      }
  }

  function handleTacticsSwap(id1: string, id2: string) {
    const idx1 = squad.findIndex((p: any) => p.id === id1);
    const idx2 = squad.findIndex((p: any) => p.id === id2);
    
    if (idx1 !== -1 && idx2 !== -1) {
      const isSub = (idx1 < 11 && idx2 >= 11) || (idx2 < 11 && idx1 >= 11);
      
      if (isSub) {
        const outIdx = idx1 < 11 ? idx1 : idx2;
        const incomingId = idx1 >= 11 ? id1 : id2;
        
        const benchIdx = benchPlayers.findIndex((p: any) => p.id === incomingId);
        if (benchIdx !== -1) {
           const teamNum = isHome ? 0 : 1;
           const didSub = match.makeSub(teamNum, outIdx, benchIdx);
           if (!didSub) return;
           
           const incomingPlayer = benchPlayers.splice(benchIdx, 1)[0];
           
           const newSquad = [...squad];
           newSquad[outIdx] = incomingPlayer;
           const originalBenchIdx = newSquad.findIndex((p: any) => p.id === incomingId);
           if (originalBenchIdx >= 11) {
               newSquad.splice(originalBenchIdx, 1);
           }
           squad = newSquad;
           benchPlayers = [...benchPlayers]; 
        }
      } else {
        const newSquad = [...squad];
        const temp = newSquad[idx1];
        newSquad[idx1] = newSquad[idx2];
        newSquad[idx2] = temp;
        squad = newSquad;
      }
    }
  }

  function handleSkip() {
    if (isSimulating) return;
    isSimulating = true;
    showTacticsModal = false;
    
    // Use the high-speed batch simulation method
    const results = match.simulateMatch();
    finalHomeScore = results.homeScore;
    finalAwayScore = results.awayScore;
    
    // Save Replay
    if (match.recorder) {
        match.recorder.saveToIndexedDB(match.analytics, playerLabels);
    }
    
    isSimulating = false;
    showFinalOverlay = true;
  }

  function doManualSub(benchIdx: number) {
    const teamNum = isHome ? 0 : 1;
    const incoming = benchPlayers[benchIdx];
    if (!incoming) return;

    // Logic: 
    // 1. Try to find the most tired player in the SAME role
    // 2. Fallback to the most tired player in the same general area (DEF/MID/FWD)
    // 3. Absolute fallback: most tired outfield player
    
    const start = teamNum * 11;
    let candidates = [];
    for (let i = start; i < start + 11; i++) {
      const p = squad[i - start];
      if (p.role === 'GK') continue; // Never auto-sub GK
      candidates.push({
        index: i - start,
        stamina: match.memory.playerBuffer[i * PLAYER_STRIDE + PLAYER_OFFSET_STAMINA],
        role: p.role
      });
    }

    if (candidates.length === 0) return;

    // Filter by role match
    const sameRole = candidates.filter(c => c.role === incoming.role);
    let target;
    
    if (sameRole.length > 0) {
      // Pick most tired of same role
      target = sameRole.sort((a, b) => a.stamina - b.stamina)[0];
    } else {
      // Pick absolute most tired outfielder
      target = candidates.sort((a, b) => a.stamina - b.stamina)[0];
    }

    const outIdx = target.index;
    const didSub = match.makeSub(teamNum, outIdx, benchIdx);
    if (!didSub) return;

    const newSquad = [...squad];
    newSquad[outIdx] = incoming;
    squad = newSquad;

    // also update local benchPlayers list so button disappears
    benchPlayers.splice(benchIdx, 1);
    benchPlayers = [...benchPlayers];
    showSubs = false;
  }
</script>

<div class="match-wrapper min-h-screen bg-light-bg flex flex-col relative overflow-hidden">
  <!-- Top HUD -->
  <HUD {match} {currentTime} homeTeam={data.homeTeam} awayTeam={data.awayTeam} {cinematicUi} {forceShowControls} />
  
  <!-- Main Pitch Area -->
  <main class="flex-1 flex items-center justify-center">
    <PixiPitch memory={match.memory} labels={playerLabels} />
  </main>

  <!-- Invisible Hover Zones to reveal controls in Cinematic mode -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-x-0 top-0 h-24 z-[40]"
    onmouseenter={() => forceShowControls = true}
    onmouseleave={() => forceShowControls = false}
  ></div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-x-0 bottom-0 h-24 z-[40]"
    onmouseenter={() => forceShowControls = true}
    onmouseleave={() => forceShowControls = false}
  ></div>

  <!-- Persistent subtle exit-cinematic trigger in corner -->
  {#if cinematicUi}
    <button 
      class="fixed bottom-4 right-4 z-[60] w-10 h-10 rounded-full bg-black/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/40 hover:text-white/100 hover:bg-black/30 transition-all"
      onclick={() => cinematicUi = false}
      title="Exit Cinematic Mode"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>
  {/if}

  <!-- Bottom Controls -->
  <div 
    class="fixed bottom-0 inset-x-0 p-6 flex justify-center items-center gap-4 transition-all duration-500 z-50 bg-gradient-to-t from-black/20 to-transparent"
    class:translate-y-full={cinematicUi && !forceShowControls}
  >
    <div class="bg-white/90 backdrop-blur-md border border-light-border p-2 rounded-2xl shadow-2xl flex items-center gap-2 pointer-events-auto">
      <button 
        class="btn-secondary px-6 py-2 text-xs uppercase font-black tracking-widest flex items-center gap-2"
        onclick={() => window.location.href = `/`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Quit
      </button>
      {#if benchPlayers.length && !isSimulating}
        <div class="relative">
          <button
            class="btn-secondary px-4 py-2 text-xs uppercase font-black tracking-widest"
            onclick={() => showSubs = !showSubs}
          >Subs</button>
          {#if showSubs}
            <div class="absolute bottom-12 bg-white p-2 rounded-lg shadow-xl flex flex-col gap-1">
              {#each benchPlayers as bp, idx}
                <button
                  class="btn-secondary text-xs px-4 py-1"
                  onclick={() => doManualSub(idx)}
                >{bp.name || `Player ${idx+1}`}</button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <div class="w-px h-8 bg-light-border mx-1"></div>

      <!-- Game Speed Controls -->
      <div class="flex items-center gap-2 px-2">
        <button 
          class="btn-secondary w-8 h-8 p-0 flex items-center justify-center rounded-full {isPaused ? 'bg-primary text-white border-primary' : ''}"
          onclick={() => { isPaused = !isPaused; }}
          title={isPaused ? "Resume" : "Pause"}
        >
          {#if isPaused}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          {:else}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          {/if}
        </button>

        <span class="text-xs font-black tracking-widest uppercase subtle ml-2 w-10 text-center">{gameSpeed}x</span>
        <input 
          type="range" 
          min="1" max="100" 
          bind:value={gameSpeed} 
          class="w-24 accent-primary" 
        />
      </div>
      
      <div class="w-px h-8 bg-light-border mx-1"></div>
      
      <button 
        class="btn-secondary px-6 py-2 text-xs uppercase font-black tracking-widest flex items-center gap-2"
        onclick={() => showTacticsModal = true}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        Tactics
      </button>

      <div class="w-px h-8 bg-light-border mx-1"></div>

      <button 
        class="btn-secondary px-6 py-2 text-xs uppercase font-black tracking-widest flex items-center gap-2"
        onclick={() => cinematicUi = !cinematicUi}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        {cinematicUi ? 'Disable Cinematic' : 'Cinematic'}
      </button>

      <button 
        class="btn-primary px-8 py-2 text-xs uppercase font-black tracking-widest flex items-center gap-2 shadow-lg ring-4 ring-primary/10"
        onclick={handleSkip}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
        Skip to End
      </button>
    </div>
  </div>

  <!-- Tactics Modal Overlay -->
  {#if showTacticsModal}
    <div class="fixed inset-0 bg-black/80 backdrop-blur-xl z-[300] flex flex-col p-8">
      <div class="flex justify-between items-center mb-8">
        <div class="flex items-center gap-6">
          <h2 class="text-3xl font-black text-white uppercase tracking-tighter">In-Match Tactics</h2>
          <div class="bg-primary/20 border border-primary text-primary px-3 py-1 rounded-lg text-sm font-black tracking-widest uppercase flex items-center gap-2">
            Subs Made: <span class="bg-primary text-white px-2 rounded">{match.subsUsed[isHome ? 0 : 1]} / 5</span>
          </div>
        </div>
        <button
          class="btn-primary px-8 py-3 uppercase tracking-widest text-sm font-black"
          onclick={() => showTacticsModal = false}
        >
          Resume Match
        </button>
      </div>      
      <div class="flex-1 bg-white rounded-3xl overflow-y-auto shadow-2xl">
        <div class="w-full max-w-4xl mx-auto py-8 px-4">
          <FormationBoard 
            team={isHome ? data.homeTeam : data.awayTeam} 
            players={squad} 
            editable={true}
            allowSubs={true}
            allowRoleOverrides={true}
            allowPositionOverrides={true}
            isHome={isHome}
            onSwap={handleTacticsSwap}
            onFormationChange={(f) => console.log('Formation', $state.snapshot(f))}
            onOverridesChange={handleTacticsOverrides}
          />
        </div>
      </div>
    </div>
  {/if}

  <!-- Half Time Overlay -->
  {#if match.status === MatchStatus.HALF_TIME}
    <div class="fixed inset-0 bg-black/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
      <div class="bg-white p-12 rounded-[40px] shadow-2xl text-center max-w-lg w-full border-t-8 border-t-primary">
        <h2 class="text-3xl font-black mb-2 tracking-tighter">HALF TIME</h2>
        <div class="text-5xl font-black mb-8 my-4 flex justify-center gap-4">
           <span class="text-primary">{match.homeScore}</span>
           <span class="text-light-subtle">-</span>
           <span class="text-danger">{match.awayScore}</span>
        </div>
        <button 
          class="btn-primary w-full py-5 text-xl font-black tracking-widest shadow-2xl ring-8 ring-primary/10 rounded-3xl uppercase transition-transform hover:scale-[1.02] active:scale-[0.98]"
          onclick={startSecondHalf}
        >
          START 2ND HALF
        </button>
      </div>
    </div>
  {/if}

  <!-- Pre-Match Kick Off Overlay -->
  {#if !hasKickedOff}
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div class="bg-white p-12 rounded-[40px] shadow-2xl text-center max-w-lg w-full border-t-8 border-t-primary">
        <h2 class="text-3xl font-black mb-2 tracking-tighter">PRE-MATCH</h2>
        <p class="subtle font-bold italic mb-8">The teams are on the pitch. Ready when you are.</p>
        <button 
          class="btn-primary w-full py-5 text-xl font-black tracking-widest shadow-2xl ring-8 ring-primary/10 rounded-3xl uppercase transition-transform hover:scale-[1.02] active:scale-[0.98]"
          onclick={startMatch}
        >
          KICK OFF
        </button>
      </div>
    </div>
  {/if}

  <!-- Simulation Overlay -->
  {#if isSimulating}
    <div class="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center">
      <div class="card max-w-sm w-full text-center p-12 border-t-8 border-t-primary shadow-2xl">
        <div class="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <h2 class="text-2xl font-black mb-2 uppercase tracking-tighter">Simulating</h2>
        <p class="subtle font-bold italic">Calculating 22 brains and physical outcomes...</p>
      </div>
    </div>
  {/if}

  <!-- Final Result Overlay -->
  {#if showFinalOverlay}
    <div class="fixed inset-0 bg-black/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col border-t-[12px] border-t-primary">
        <div class="p-12 text-center">
          <h1 class="text-xs font-black subtle uppercase tracking-[0.3em] mb-12">MATCH CONCLUDED</h1>
          
          <div class="flex items-center justify-between gap-4 mb-12">
            <div class="flex-1">
              <div class="w-24 h-32 mx-auto bg-primary rounded-b-[48px] shadow-xl mb-6 ring-8 ring-white"></div>
              <h2 class="text-3xl font-black tracking-tighter leading-tight">{data.homeTeam.name}</h2>
            </div>
            
            <div class="text-6xl font-black text-light-subtle opacity-20 tracking-tighter">VS</div>
            
            <div class="flex-1">
              <div class="w-24 h-32 mx-auto bg-danger rounded-b-[48px] shadow-xl mb-6 ring-8 ring-white"></div>
              <h2 class="text-3xl font-black tracking-tighter leading-tight">{data.awayTeam.name}</h2>
            </div>
          </div>

          <div class="flex justify-center mb-12">
            <div class="bg-light-bg px-8 py-4 rounded-3xl border border-light-border shadow-inner">
              <span class="text-5xl font-black text-primary">{finalHomeScore}</span>
              <span class="text-3xl font-black text-light-subtle mx-4">-</span>
              <span class="text-5xl font-black text-danger">{finalAwayScore}</span>
            </div>
          </div>

          <!-- Form submission to process match results -->
          <form method="POST" action="?/processMatch" use:enhance class="flex flex-col gap-3">
            <input type="hidden" name="homeScore" value={finalHomeScore} />
            <input type="hidden" name="awayScore" value={finalAwayScore} />
            <input type="hidden" name="matchAnalytics" value={JSON.stringify(match.analytics)} />
            
            <button 
              type="submit"
              class="btn-primary w-full py-5 text-xl font-black tracking-widest shadow-2xl ring-8 ring-primary/10 rounded-3xl uppercase transition-transform hover:scale-[1.02] active:scale-[0.98]" 
            >
              Return to Dashboard
            </button>
            
            <div class="grid grid-cols-2 gap-3 mt-4">
              <button 
                type="button"
                class="btn-secondary py-3 text-xs font-black uppercase tracking-widest"
                onclick={() => window.location.href = `/replay/${matchIdStr}`}
              >
                Watch Replay
              </button>
              <button 
                type="button"
                class="btn-secondary py-3 text-xs font-black uppercase tracking-widest"
                onclick={async () => {
                  const { downloadReplay } = await import('$lib/engine/MatchRecorder');
                  downloadReplay(matchIdStr);
                }}
              >
                Export for AI
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .match-wrapper {
    user-select: none;
  }
</style>
