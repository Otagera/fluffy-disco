<script lang="ts">
  import type { PageData } from './$types';
  import PlayerModal from '$lib/components/PlayerModal.svelte';

  let { data }: { data: PageData } = $props();

  const roleOrder = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const;
  const sortedTeams = $derived([...(data.teams ?? [])].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)));

  let selectedTeamId = $state<string | null>(null);
  let selectedPlayerId = $state<string | null>(null);

  $effect(() => {
    if (!selectedTeamId && sortedTeams.length > 0) selectedTeamId = sortedTeams[0].id;
  });

  const selectedTeam = $derived(sortedTeams.find((team) => team.id === selectedTeamId) ?? null);
  const allPlayers = $derived(
    selectedTeam
      ? selectedTeam.players
          .map((id) => data.players[id])
          .filter(Boolean)
          .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
      : []
  );

  const probableXI = $derived.by(() => {
    if (!allPlayers.length) return [];
    
    // Balanced selection logic: 1 GK, 4 DEF, 3 MID, 3 FWD
    const gks = allPlayers.filter(p => p.role === 'GK').slice(0, 1);
    const defs = allPlayers.filter(p => p.role === 'DEF').slice(0, 4);
    const mids = allPlayers.filter(p => p.role === 'MID').slice(0, 3);
    const fwds = allPlayers.filter(p => p.role === 'FWD').slice(0, 3);
    
    const xi = [...gks, ...defs, ...mids, ...fwds];
    
    // Fallback if we don't have enough in each role
    if (xi.length < 11) {
      const remaining = allPlayers.filter(p => !xi.includes(p)).slice(0, 11 - xi.length);
      return [...xi, ...remaining].sort((a, b) => roleOrder[a.role as keyof typeof roleOrder] - roleOrder[b.role as keyof typeof roleOrder]);
    }
    
    return xi.sort((a, b) => roleOrder[a.role as keyof typeof roleOrder] - roleOrder[b.role as keyof typeof roleOrder]);
  });

  const bench = $derived(allPlayers.filter(p => !probableXI.includes(p)).slice(0, 9));
  
  const selectedPlayer = $derived(allPlayers.find((player) => player.id === selectedPlayerId) ?? null);

  function getOverallColor(overall: number) {
    if (overall >= 16) return 'bg-green-100 text-green-800 border-green-200';
    if (overall >= 13) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (overall >= 10) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-red-100 text-red-800 border-red-200';
  }
</script>

<div class="max-w-6xl mx-auto p-4 sm:p-8">
  <div class="mb-6">
    <h1>Squad Hub</h1>
    <p class="subtle">Global scouting of every club's depth and tactical shape.</p>
  </div>

  {#if !data.hasSave}
    <div class="card text-center py-12">
      <h2 class="mb-2">No Career Found</h2>
      <p class="subtle">Start a new career from Home first.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card flex flex-col h-[70vh]">
        <h2 class="text-xs font-black subtle uppercase tracking-widest mb-4 border-b border-light-border pb-2">Clubs by Reputation</h2>
        <div class="flex-1 overflow-y-auto space-y-2 pr-2">
          {#each sortedTeams as team}
            <button 
              class="w-full text-left flex items-center justify-between p-3 rounded-lg border transition-all {team.id === selectedTeamId ? 'bg-primary/5 border-primary shadow-sm ring-2 ring-primary/5' : 'bg-white border-light-border hover:bg-light-bg'}" 
              onclick={() => { selectedTeamId = team.id; selectedPlayerId = null; }}
            >
              <div>
                <div class="font-black text-sm">{team.name}</div>
                <div class="text-[0.6rem] subtle uppercase font-black tracking-widest">Reputation {team.reputation}</div>
              </div>
              <span class="px-2 py-1 text-xs font-black rounded border {getOverallColor(team.overall ?? 1)}">OVR {team.overall ?? 1}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="card flex flex-col h-[70vh]">
        {#if selectedTeam}
          <div class="flex justify-between items-center mb-6 border-b border-light-border pb-4">
            <div>
              <h2 class="mb-0 text-xl font-black">{selectedTeam.name}</h2>
              <a href="/teams/{selectedTeam.id}" class="text-[0.65rem] font-black text-primary hover:underline uppercase tracking-tighter">View Full Club Page →</a>
            </div>
            <div class="text-right">
              <span class="px-3 py-1 text-xs font-black rounded-full border {getOverallColor(selectedTeam.overall ?? 1)}">TEAM {selectedTeam.overall ?? 1}</span>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto pr-2 space-y-6">
            <div>
              <h3 class="text-[0.6rem] font-black subtle uppercase tracking-widest mb-3 flex items-center gap-2">
                Probable XI
                <span class="h-px bg-light-border flex-1"></span>
              </h3>
              <div class="space-y-1.5">
                {#each probableXI as player}
                  <button 
                    class="w-full text-left flex items-center gap-3 p-2.5 rounded-lg border border-transparent bg-white shadow-sm hover:border-primary transition-colors group" 
                    onclick={() => selectedPlayerId = player.id}
                  >
                    <span class="font-black text-[0.6rem] w-6 text-center text-light-subtle group-hover:text-primary transition-colors">{player.role}</span>
                    <span class="font-bold flex-1 text-sm">{player.name}</span>
                    <span class="px-1.5 py-0.5 text-[0.6rem] font-black rounded border {getOverallColor(player.overall ?? 1)}">{player.overall ?? 1}</span>
                  </button>
                {/each}
              </div>
            </div>

            <div>
              <h3 class="text-[0.6rem] font-black subtle uppercase tracking-widest mb-3 flex items-center gap-2">
                Primary Bench
                <span class="h-px bg-light-border flex-1"></span>
              </h3>
              <div class="space-y-1.5 pb-4">
                {#each bench as player}
                  <button 
                    class="w-full text-left flex items-center gap-3 p-2 bg-light-bg rounded-lg border border-transparent hover:border-gray-300 transition-colors group" 
                    onclick={() => selectedPlayerId = player.id}
                  >
                    <span class="font-black text-[0.6rem] w-6 text-center text-light-subtle">{player.role}</span>
                    <span class="font-bold flex-1 text-xs opacity-80">{player.name}</span>
                    <span class="px-1 py-0.5 text-[0.6rem] font-black rounded border {getOverallColor(player.overall ?? 1)}">{player.overall ?? 1}</span>
                  </button>
                {/each}
              </div>
            </div>
          </div>
        {:else}
          <div class="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div class="w-16 h-16 bg-light-bg rounded-full flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" class="text-light-subtle opacity-30"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 class="subtle font-black text-sm uppercase">Select a club</h3>
            <p class="text-xs subtle">Select a club from the left to view their current squad depth.</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if selectedPlayer}
  <PlayerModal player={selectedPlayer} onclose={() => selectedPlayerId = null} />
{/if}