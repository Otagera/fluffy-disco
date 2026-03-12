<script lang="ts">
import { enhance } from "$app/forms";
import PlayerModal from "$lib/components/PlayerModal.svelte";
import { calculateAge } from "$lib/data/ratings";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

const shortlist = $derived((data.shortlist as string[]) || []);
const currentPage = $derived(Number(data.currentPage) || 1);
const totalPages = $derived(Number(data.totalPages) || 1);

let activeTab = $state<"search" | "shortlist">("search");
let selectedPlayerId = $state<string | null>(null);
const selectedPlayer = $derived(
	selectedPlayerId
		? data.players.find((p: any) => p.id === selectedPlayerId) ||
				data.shortlistedPlayers.find((p: any) => p.id === selectedPlayerId)
		: null,
);

function getKnowledgeLevel(playerId: string) {
	const report = (data.scoutingReports || []).find(
		(r: any) => r.playerId === playerId && r.teamId === data.managerTeamId,
	);
	const player =
		data.players.find((p: any) => p.id === playerId) ||
		data.shortlistedPlayers.find((p: any) => p.id === playerId);
	if (player?.teamId === data.managerTeamId) return 2;
	return report?.level || 0;
}

const priorityScouts = $derived(
	(data.scoutingReports || []).filter((r: any) => r.isPriority),
);
const activeSlotsCount = $derived(priorityScouts.length);

function getTeamName(teamId: string | null) {
	if (!teamId) return "Free Agent";
	return (data.teams as any)[teamId]?.name || teamId;
}
</script>

<div class="max-w-7xl mx-auto p-4 sm:p-8">
  <div class="flex justify-between items-end mb-8">
    <div>
      <h1 class="text-4xl font-black tracking-tighter mb-2">Recruitment Hub</h1>
      <p class="subtle uppercase tracking-widest font-black text-xs">Find and track the next generation of talent</p>
    </div>
    
    <div class="flex bg-light-bg p-1 rounded-xl border border-light-border shadow-inner">
      <button 
        class="px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all {activeTab === 'search' ? 'bg-white text-primary shadow-sm' : 'subtle hover:text-primary'}"
        onclick={() => activeTab = 'search'}
      >
        Global Search
      </button>
      <button 
        class="px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all {activeTab === 'shortlist' ? 'bg-white text-primary shadow-sm' : 'subtle hover:text-primary'}"
        onclick={() => activeTab = 'shortlist'}
      >
        Shortlist
      </button>
    </div>
  </div>

  {#if activeTab === 'search'}
    <!-- Search Filters -->
    <div class="card p-6 mb-8 bg-white border-t-4 border-t-primary shadow-lg">
      <form method="GET" class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label class="block text-[0.65rem] font-black uppercase tracking-widest subtle mb-2">Player Name</label>
          <input type="text" name="search" placeholder="Search..." class="input-field py-2 text-sm" />
        </div>
        <div>
          <label class="block text-[0.65rem] font-black uppercase tracking-widest subtle mb-2">Position</label>
          <select name="role" class="input-field py-2 text-sm appearance-none">
            <option value="">All Positions</option>
            <option value="GK">GK</option>
            <option value="DEF">DEF</option>
            <option value="MID">MID</option>
            <option value="FWD">FWD</option>
          </select>
        </div>
        <div>
          <label class="block text-[0.65rem] font-black uppercase tracking-widest subtle mb-2">Knowledge</label>
          <select name="knowledge" class="input-field py-2 text-sm appearance-none">
            <option value="">Any Knowledge</option>
            <option value="0">Unscouted (?)</option>
            <option value="1">Partial (Ranges)</option>
            <option value="2">Full (Exact)</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="btn-primary flex-1 py-2 text-xs font-black uppercase tracking-widest">Search</button>
          <a href="/scouting" class="btn-secondary py-2 px-4 text-xs font-black uppercase tracking-widest">Clear</a>
        </div>
      </form>
    </div>

    <!-- Search Results -->
    <div class="card overflow-hidden bg-white shadow-xl">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="bg-light-bg border-b border-light-border text-[0.65rem] font-black uppercase tracking-widest subtle">
              <th class="py-4 px-6">Player</th>
              <th class="py-4 px-2">Team</th>
              <th class="py-4 px-2">Pos</th>
              <th class="py-4 px-2 text-center">Age</th>
              <th class="py-4 px-2 text-center">OVR</th>
              <th class="py-4 px-2 text-center">Goals</th>
              <th class="py-4 px-2 text-center">Asst</th>
              <th class="py-4 px-6 text-center">Watch</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-light-border">
            {#each data.players as player}
              {@const knowledge = getKnowledgeLevel(player.id)}
              <tr class="hover:bg-primary/5 transition-colors group">
                <td class="py-4 px-6">
                  <button onclick={() => selectedPlayerId = player.id} class="text-left">
                    <div class="font-black text-sm group-hover:text-primary transition-colors">{player.name}</div>
                    <div class="text-[0.6rem] font-bold subtle uppercase">{player.role} • {player.preferredFoot} Foot</div>
                  </button>
                </td>
                <td class="py-4 px-2">
                  <span class="text-xs font-bold">{getTeamName(player.teamId)}</span>
                </td>
                <td class="py-4 px-2">
                  <span class="text-[0.65rem] font-black bg-light-bg px-2 py-1 rounded uppercase">{player.role}</span>
                </td>
                <td class="py-4 px-2 text-xs font-bold text-center">
                  {calculateAge(player.birthDate, data.currentDate)}
                </td>
                <td class="py-4 px-2 text-center">
                  {#if knowledge === 2}
                    <span class="text-xs font-black text-primary">{player.overall}</span>
                  {:else}
                    <span class="text-xs font-black subtle opacity-30">?</span>
                  {/if}
                </td>
                <td class="py-4 px-2 text-xs font-bold text-center">{player.seasonStats?.goals || 0}</td>
                <td class="py-4 px-2 text-xs font-bold text-center">{player.seasonStats?.assists || 0}</td>
                <td class="py-4 px-6 text-center">
                  <form method="POST" action="?/toggleShortlist" use:enhance>
                    <input type="hidden" name="playerId" value={player.id} />
                    <button type="submit" class="text-xl transition-transform hover:scale-125 {shortlist.includes(player.id) ? 'text-amber-400' : 'text-light-subtle opacity-30 hover:opacity-100'}">
                      {shortlist.includes(player.id) ? '★' : '☆'}
                    </button>
                  </form>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      {#if totalPages > 1}
        <div class="p-6 bg-light-bg border-t border-light-border flex justify-between items-center">
          <div class="text-xs font-bold subtle uppercase tracking-widest">Page {currentPage} of {totalPages}</div>
          <div class="flex gap-2">
            <a href="?page={currentPage - 1}" class="btn-secondary py-2 px-4 text-[0.65rem] font-black uppercase tracking-widest {currentPage === 1 ? 'opacity-50 pointer-events-none' : ''}">Prev</a>
            <a href="?page={currentPage + 1}" class="btn-secondary py-2 px-4 text-[0.65rem] font-black uppercase tracking-widest {currentPage === totalPages ? 'opacity-50 pointer-events-none' : ''}">Next</a>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Shortlist Tab -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 space-y-4">
        {#each data.shortlistedPlayers as player (player.id)}
          {@const report = (data.scoutingReports || []).find((r: any) => r.playerId === player.id && r.teamId === data.managerTeamId)}
          {@const knowledge = getKnowledgeLevel(player.id)}
          
          <div class="card p-6 bg-white flex justify-between items-center hover:border-primary transition-all border-l-4 {report?.isPriority ? 'border-l-primary' : 'border-l-transparent'}">
            <div class="flex gap-6 items-center">
              <div class="text-center w-12">
                <div class="text-2xl font-black text-primary">{knowledge === 2 ? player.overall : '?'}</div>
                <div class="text-[0.5rem] font-black uppercase subtle tracking-tighter">OVR</div>
              </div>
              <div>
                <button onclick={() => selectedPlayerId = player.id} class="text-left">
                  <h3 class="text-lg font-black leading-tight hover:text-primary transition-colors">{player.name}</h3>
                  <p class="text-xs font-bold subtle uppercase">{player.role} • {getTeamName(player.teamId)}</p>
                </button>
              </div>
            </div>

            <div class="flex gap-6 items-center">
              {#if knowledge < 2}
                <div class="text-right hidden sm:block">
                  <div class="text-[0.6rem] font-black uppercase tracking-widest subtle mb-1">Knowledge</div>
                  <div class="w-24 h-1.5 bg-light-bg rounded-full overflow-hidden border border-light-border">
                    <div class="h-full bg-primary transition-all" style="width: {((report?.progressDays || 0) / 7) * 100}%"></div>
                  </div>
                </div>
                
                <form method="POST" action="?/togglePriority" use:enhance>
                  <input type="hidden" name="playerId" value={player.id} />
                  <button type="submit" class="btn-secondary py-2 px-4 text-[0.6rem] font-black uppercase tracking-widest flex items-center gap-2 {report?.isPriority ? 'bg-primary/10 border-primary text-primary' : ''}">
                    {#if report?.isPriority}
                      <span class="w-2 h-2 bg-primary rounded-full animate-pulse"></span> Active
                    {:else}
                      Scout
                    {/if}
                  </button>
                </form>
              {:else}
                <div class="text-right">
                  <div class="text-[0.6rem] font-black uppercase tracking-widest text-green-600 mb-1">Fully Scouted</div>
                  <div class="text-xs font-bold">Evaluation Complete</div>
                </div>
              {/if}

              <form method="POST" action="?/toggleShortlist" use:enhance>
                <input type="hidden" name="playerId" value={player.id} />
                <button type="submit" class="subtle hover:text-danger p-2 text-xl opacity-30 hover:opacity-100 transition-all">×</button>
              </form>
            </div>
          </div>
        {:else}
          <div class="card p-12 text-center bg-white border-dashed">
            <p class="subtle italic font-medium">Your shortlist is empty. Use the Global Search to find potential signings.</p>
          </div>
        {/each}
      </div>

      <div class="space-y-6">
        <!-- Scout Capacity -->
        <div class="card p-6 bg-dark text-white border-t-4 border-t-primary shadow-2xl">
          <h2 class="text-sm font-black uppercase tracking-widest mb-4 flex justify-between items-center">
            Scouting Capacity
            <span class="bg-primary text-white text-[0.6rem] px-2 py-1 rounded">{activeSlotsCount} / 5</span>
          </h2>
          <div class="space-y-3">
            {#each Array(5) as _, i}
              <div class="flex items-center gap-3 p-2 rounded-lg {i < activeSlotsCount ? 'bg-white/10 border border-white/10' : 'bg-white/5 border border-white/5 border-dashed'}">
                {#if i < activeSlotsCount}
                  <div class="w-8 h-8 rounded bg-primary flex items-center justify-center font-black text-xs text-white">#{i+1}</div>
                  <div class="text-[0.65rem] font-bold truncate flex-1">
                    {data.players.find((p: any) => p.id === priorityScouts[i].playerId)?.name || priorityScouts[i].playerId}
                  </div>
                {:else}
                  <div class="w-8 h-8 rounded bg-white/10 flex items-center justify-center font-black text-xs text-white/20">?</div>
                  <div class="text-[0.65rem] font-bold text-white/20 uppercase tracking-widest italic">Empty Slot</div>
                {/if}
              </div>
            {/each}
          </div>
          <p class="text-[0.6rem] subtle mt-4 leading-relaxed opacity-60">Priority targets gain scouting knowledge every day. Assign scouts to reveal hidden attributes and market values.</p>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if selectedPlayer}
  <PlayerModal 
    player={selectedPlayer} 
    currentDate={data.currentDate}
    managerTeamId={data.managerTeamId}
    scoutingLevel={getKnowledgeLevel(selectedPlayer.id)}
    isShortlisted={shortlist.includes(selectedPlayer.id)}
    onclose={() => selectedPlayerId = null} 
  />
{/if}
