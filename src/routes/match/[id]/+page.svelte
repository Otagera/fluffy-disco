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

  let showFinalOverlay = $state(false);
  let isSimulating = $state(false);
  let cinematicUi = $state(false);
  let forceShowControls = $state(false);

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

    // 3. Labels (Numbers)
    const hL = (data.homePlayers || []).slice(0, 11).map(p => p.number?.toString() || 'P');
    const aL = (data.awayPlayers || []).slice(0, 11).map(p => p.number?.toString() || 'P');
    playerLabels = [...hL, ...aL];
    
    match.setup(startPositions);
    requestAnimationFrame(gameLoop);
  });

  function handleSkip() {
    if (isSimulating) return;
    isSimulating = true;
    
    // Use the high-speed batch simulation method
    const results = match.simulateMatch();
    
    isSimulating = false;
    showFinalOverlay = true;
  }
</script>

<div class="match-wrapper min-h-screen bg-light-bg flex flex-col relative overflow-hidden">
  <!-- Top HUD -->
  <HUD {match} {currentTime} homeTeam={data.homeTeam} awayTeam={data.awayTeam} />
  
  <!-- Main Pitch Area -->
  <main class="flex-1 flex items-center justify-center pt-24 pb-20">
    <PixiPitch {match} labels={playerLabels} />
  </main>

  <!-- Invisible Hover Zone at the bottom to reveal controls in Cinematic mode -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed bottom-0 inset-x-0 h-24 z-[40]"
    onmouseenter={() => forceShowControls = true}
    onmouseleave={() => forceShowControls = false}
  ></div>

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
              <span class="text-5xl font-black text-primary">0</span>
              <span class="text-3xl font-black text-light-subtle mx-4">-</span>
              <span class="text-5xl font-black text-danger">0</span>
            </div>
          </div>

          <button 
            class="btn-primary w-full py-5 text-xl font-black tracking-widest shadow-2xl ring-8 ring-primary/10 rounded-3xl uppercase transition-transform hover:scale-[1.02] active:scale-[0.98]" 
            onclick={() => window.location.href = '/'}
          >
            Return to Dashboard
          </button>
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