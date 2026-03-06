<script lang="ts">
  import type { PageData } from './$types';
  import { onMount } from 'svelte';
  import FormationBoard from '$lib/components/FormationBoard.svelte';

  let { data }: { data: PageData } = $props();
  
  const isHome = data.managerTeamId === data.homeTeam.id;
  const myTeam = isHome ? data.homeTeam : data.awayTeam;
  const opponentTeam = isHome ? data.awayTeam : data.homeTeam;
  
  // Tactical State
  let squad = $state([...(isHome ? data.homePlayers : data.awayPlayers)]);
  let currentTeam = $state({ ...myTeam });

  // Overrides tracked from the FormationBoard
  let tacticalPositions = $state<Record<number, {x: number, y: number}>>({});
  let tacticalRoles = $state<Record<number, string>>({});

  onMount(() => {
    window.scrollTo(0, 0);
  });

  function handleSwap(id1: string, id2: string) {
    const idx1 = squad.findIndex(p => p.id === id1);
    const idx2 = squad.findIndex(p => p.id === id2);
    
    if (idx1 !== -1 && idx2 !== -1) {
      const newSquad = [...squad];
      const temp = newSquad[idx1];
      newSquad[idx1] = newSquad[idx2];
      newSquad[idx2] = temp;
      squad = newSquad;
    }
  }

  function handleFormationChange(name: string) {
    currentTeam.formation = name;
  }

  function handleOverridesChange(positions: Record<number, {x: number, y: number}>, roles: Record<number, string>) {
    tacticalPositions = positions;
    tacticalRoles = roles;
  }

  function handleConfirm() {
    const payload = {
      isHome,
      formation: currentTeam.formation,
      style: currentTeam.tacticalStyle,
      mentality: currentTeam.mentality,
      customSquad: squad,
      customRoles: tacticalRoles,
      customPositions: tacticalPositions
    };
    sessionStorage.setItem('tacticalOverrides', JSON.stringify(payload));
    window.location.href = `/match/${data.fixture.id}`;
  }
</script>

<div class="max-w-7xl mx-auto p-4 sm:p-8">
  <div class="mb-4 flex justify-start">
    <a href="/" class="text-xs font-black text-primary hover:underline flex items-center gap-1 uppercase tracking-widest">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      Exit to Hub
    </a>
  </div>

  <div class="bg-white border border-light-border p-8 rounded-xl shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-6">
    <div class="flex-1 text-center md:text-left">
      <p class="text-xs font-black subtle uppercase tracking-widest mb-1">HOME TEAM</p>
      <h1 class="text-3xl font-black mb-3">{data.homeTeam.name}</h1>
      {#if isHome}
        <div class="flex flex-wrap gap-2 justify-center md:justify-start">
          <select bind:value={currentTeam.tacticalStyle} class="bg-light-bg border border-light-border text-sm font-bold px-3 py-2 rounded">
            <option>Tiki-Taka</option>
            <option>Gegenpress</option>
            <option>Route One</option>
            <option>Park the Bus</option>
            <option>Fluid Counter</option>
          </select>
          <select bind:value={currentTeam.mentality} class="bg-light-bg border-l-4 border-l-primary border border-light-border text-sm font-bold px-3 py-2 rounded">
            <option value="ULTRA_DEFENSIVE">Ultra Defensive</option>
            <option value="DEFENSIVE">Defensive</option>
            <option value="BALANCED">Balanced</option>
            <option value="ATTACKING">Attacking</option>
            <option value="ULTRA_ATTACKING">Ultra Attacking</option>
          </select>
        </div>
      {:else}
        <div class="text-sm font-bold mb-1">{data.homeTeam.tacticalStyle} • {data.homeTeam.formation}</div>
        <div class="text-xs subtle uppercase tracking-widest">{data.homeTeam.mentality.replace('_', ' ')}</div>
      {/if}
    </div>

    <div class="px-6 py-2 bg-light-bg border border-light-border rounded-lg font-black subtle shadow-inner">VS</div>

    <div class="flex-1 text-center md:text-right">
      <p class="text-xs font-black subtle uppercase tracking-widest mb-1">AWAY TEAM</p>
      <h1 class="text-3xl font-black mb-3">{data.awayTeam.name}</h1>
      {#if !isHome}
        <div class="flex flex-wrap gap-2 justify-center md:justify-end">
          <select bind:value={currentTeam.mentality} class="bg-light-bg border-l-4 border-l-primary border border-light-border text-sm font-bold px-3 py-2 rounded">
            <option value="ULTRA_DEFENSIVE">Ultra Defensive</option>
            <option value="DEFENSIVE">Defensive</option>
            <option value="BALANCED">Balanced</option>
            <option value="ATTACKING">Attacking</option>
            <option value="ULTRA_ATTACKING">Ultra Attacking</option>
          </select>
          <select bind:value={currentTeam.tacticalStyle} class="bg-light-bg border border-light-border text-sm font-bold px-3 py-2 rounded">
            <option>Tiki-Taka</option>
            <option>Gegenpress</option>
            <option>Route One</option>
            <option>Park the Bus</option>
            <option>Fluid Counter</option>
          </select>
        </div>
      {:else}
        <div class="text-sm font-bold mb-1">{data.awayTeam.tacticalStyle} • {data.awayTeam.formation}</div>
        <div class="text-xs subtle uppercase tracking-widest">{data.awayTeam.mentality.replace('_', ' ')}</div>
      {/if}
    </div>
  </div>

  <div class="card p-6 bg-white border-t-4 border-t-primary shadow-xl">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-2xl font-black mb-0">Pre-Match Setup</h2>
        <p class="text-xs font-bold text-light-subtle uppercase tracking-widest mt-1">Fine-tune roles and shape</p>
      </div>
      <div class="flex gap-4 items-center">
        <button class="btn-primary px-8 py-3 text-sm shadow-lg ring-4 ring-primary/20 font-black tracking-widest uppercase" onclick={handleConfirm}>
          START MATCH
        </button>
      </div>
    </div>

    <FormationBoard 
      team={currentTeam}
      players={squad}
      editable={true}
      allowRoleOverrides={true}
      allowPositionOverrides={true}
      isHome={isHome}
      onSwap={handleSwap}
      onFormationChange={handleFormationChange}
      onOverridesChange={handleOverridesChange}
    />
  </div>
</div>