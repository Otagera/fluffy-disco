<script lang="ts">
  import type { PageData } from './$types';
  import PlayerModal from '$lib/components/PlayerModal.svelte';
  import FormationBoard from '$lib/components/FormationBoard.svelte';
  import { enhance } from '$app/forms';

  let { data }: { data: PageData } = $props();

  const isMyTeam = data.managerTeamId === data.team.id;

  // Local state for editing if it's my team
  let currentTeam = $state({ ...data.team });
  let currentPlayers = $state([...(data.players ?? [])]);

  // If it's NOT my team, we show a "Probable XI" based on OVR
  // If it IS my team, we show the actual squad order (Starting XI = first 11)
  const displayPlayers = $derived.by(() => {
    if (isMyTeam) return currentPlayers;
    
    // Balanced selection logic for other teams
    const all = [...(data.players ?? [])].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
    const gks = all.filter(p => p.role === 'GK').slice(0, 1);
    const defs = all.filter(p => p.role === 'DEF').slice(0, 4);
    const mids = all.filter(p => p.role === 'MID').slice(0, 3);
    const fwds = all.filter(p => p.role === 'FWD').slice(0, 3);
    const xi = [...gks, ...defs, ...mids, ...fwds];
    const bench = all.filter(p => !xi.includes(p));
    return [...xi, ...bench];
  });

  let selectedPlayerId = $state<string | null>(null);
  const selectedPlayer = $derived(currentPlayers.find((player) => player.id === selectedPlayerId) ?? null);

  function handleSwap(id1: string, id2: string) {
    if (!isMyTeam) return;
    const idx1 = currentPlayers.findIndex(p => p.id === id1);
    const idx2 = currentPlayers.findIndex(p => p.id === id2);
    if (idx1 !== -1 && idx2 !== -1) {
      const newPlayers = [...currentPlayers];
      const temp = newPlayers[idx1];
      newPlayers[idx1] = newPlayers[idx2];
      newPlayers[idx2] = temp;
      currentPlayers = newPlayers;
    }
  }

  function handleFormationChange(name: string) {
    if (!isMyTeam) return;
    currentTeam.formation = name;
  }

  function getStatColor(val: number) {
    if (val >= 16) return 'text-green-600';
    if (val >= 12) return 'text-amber-600';
    return 'text-red-600';
  }
</script>

<div class="max-w-6xl mx-auto p-4 sm:p-8">
  {#if !data.hasSave || !data.team}
    <div class="card text-center py-12">
      <h2 class="mb-2 text-2xl font-black">No Career Found</h2>
      <p class="subtle italic font-bold">Please establish a career path from the dashboard.</p>
    </div>
  {:else}
    <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between border-b-2 border-primary/10 pb-6 gap-4">
      <div>
        <a href="/" class="text-[0.6rem] font-black text-primary hover:underline mb-2 flex items-center gap-1 uppercase tracking-tighter transition-all hover:gap-2">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to Hub
        </a>
        <h1 class="mb-1 text-5xl font-black tracking-tighter">{data.team.name}</h1>
        <div class="flex gap-2 text-[0.6rem] font-black subtle uppercase tracking-widest mt-2">
          <span class="bg-light-bg px-2 py-1 rounded border border-light-border shadow-sm">Reputation {data.team.reputation}</span>
          {#if isMyTeam}
            <span class="bg-primary text-white px-2 py-1 rounded shadow-md ring-2 ring-primary/20 animate-pulse">Under Your Control</span>
          {/if}
        </div>
      </div>

      <div class="flex items-center gap-4">
        {#if isMyTeam}
          <form method="POST" action="/formation?/saveTactics" use:enhance>
            <input type="hidden" name="formation" value={currentTeam.formation} />
            <input type="hidden" name="playerIds" value={JSON.stringify(currentPlayers.map(p => p.id))} />
            <button type="submit" class="btn-primary px-6 shadow-lg font-black text-xs">SAVE CHANGES</button>
          </form>
        {/if}
        <div class="text-right bg-white p-4 rounded-2xl border border-light-border shadow-sm">
          <div class="text-4xl font-black text-primary leading-none">{data.team.overall ?? 1}</div>
          <div class="text-[0.6rem] font-black subtle uppercase tracking-widest mt-1">Club OVR</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-12">
      <!-- Formation & Squad Section -->
      <section>
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-black tracking-tighter mb-0">Tactical Setup</h2>
          <div class="flex items-center gap-2">
            <span class="text-[0.6rem] font-black subtle uppercase tracking-widest">Formation:</span>
            <span class="bg-light-bg border border-light-border text-dark text-[0.7rem] px-2 py-0.5 rounded font-black uppercase tracking-widest">{currentTeam.formation}</span>
          </div>
        </div>
        
        <div class="card bg-white shadow-xl p-6 sm:p-8">
          <FormationBoard 
            team={currentTeam} 
            players={isMyTeam ? currentPlayers : displayPlayers} 
            editable={isMyTeam}
            onSwap={handleSwap}
            onFormationChange={handleFormationChange}
          />
        </div>
      </section>

      <!-- Full Squad Roster -->
      <section>
        <h2 class="text-2xl font-black tracking-tighter mb-6">Full Squad Roster</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {#each currentPlayers as player}
            <button 
              class="text-left bg-white border border-light-border p-3 rounded-xl hover:border-primary transition-all group flex items-center gap-4 shadow-sm"
              onclick={() => selectedPlayerId = player.id}
            >
              <div class="w-10 h-10 rounded-full bg-light-bg flex items-center justify-center font-black text-xs subtle group-hover:bg-primary group-hover:text-white transition-colors">
                {player.role}
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-sm truncate">{player.name}</div>
                <div class="text-[0.6rem] subtle font-black uppercase tracking-widest">{player.age} yrs • {Math.round(player.condition)}% Fitness</div>
              </div>
              <div class="text-right">
                <div class="text-lg font-black leading-none {getStatColor(player.overall || 0)}">{player.overall}</div>
                <div class="text-[0.5rem] font-bold subtle uppercase">OVR</div>
              </div>
            </button>
          {/each}
        </div>
      </section>
    </div>
  {/if}
</div>

{#if selectedPlayer}
  <PlayerModal player={selectedPlayer} onclose={() => selectedPlayerId = null} />
{/if}
