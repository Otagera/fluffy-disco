<script lang="ts">
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  let selectedLeagueId = $state(data.activeLeagueId);
  let showExpandedTable = $state(false);
  let showTerminateModal = $state(false);
  
  let selectedLeague = $derived(data.leagues?.find((l: any) => l.id === selectedLeagueId));

  let sortedStandings = $derived.by(() => {
    if (!selectedLeague) return [];
    return [...selectedLeague.standings].sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      return gdB - gdA;
    });
  });

  function getTeamName(teamId: string) {
    return data.teams?.[teamId]?.name || teamId;
  }

  function getZoneClass(level: number, pos: number) {
    if (!level) return '';
    if (level === 1) {
      if (pos < 4) return 'border-l-4 border-blue-500 bg-blue-50/50';
      if (pos >= 17) return 'border-l-4 border-red-500 bg-red-50/50';
    } else if (level === 2) {
      if (pos < 2) return 'border-l-4 border-green-500 bg-green-50/50';
      if (pos >= 2 && pos < 6) return 'border-l-4 border-amber-500 bg-amber-50/50';
      if (pos >= 21) return 'border-l-4 border-red-500 bg-red-50/50';
    }
    return '';
  }
</script>

<div class="max-w-6xl mx-auto p-4 sm:p-8">
  {#if !data.hasSave}
    <!-- Save Game Creation Form -->
    <div class="max-w-md mx-auto mt-16 text-center card">
      <div class="flex justify-center mb-6">
        <svg viewBox="0 0 100 100" class="w-20 h-20">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" class="text-primary" stroke-width="8"/>
          <path d="M50 5 L75 25 L85 55 L65 80 L35 80 L15 55 L25 25 Z" fill="none" stroke="currentColor" class="text-primary" stroke-width="4"/>
          <line x1="50" y1="5" x2="50" y2="40" stroke="currentColor" class="text-primary" stroke-width="4"/>
          <line x1="75" y1="25" x2="50" y2="40" stroke="currentColor" class="text-primary" stroke-width="4"/>
          <line x1="25" y1="25" x2="50" y2="40" stroke="currentColor" class="text-primary" stroke-width="4"/>
        </svg>
      </div>
      
      <h1>Football Sim</h1>
      <p class="subtle mb-8">Start your managerial journey</p>
      
      <form method="POST" action="?/startCareer" class="text-left">
        <label for="managerName" class="block font-bold mb-1 text-sm uppercase tracking-wider">Manager Name</label>
        <p class="text-xs subtle mb-3 italic">Choose the name you will be known by in the dugout.</p>
        <input 
          id="managerName"
          name="managerName"
          type="text" 
          placeholder="The Gaffer"
          class="input-field mb-4"
          required
        />
        <button type="submit" class="btn-primary w-full py-4 uppercase tracking-widest text-sm">Create Career</button>
      </form>
    </div>
  {:else}
    <!-- Active Career Hub -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-light-border p-6 rounded-xl shadow-sm mb-8 gap-4">
      <div>
        <h1 class="mb-1 flex items-center gap-3">
          {data.manager.name}
          <span class="bg-primary text-white text-[0.65rem] px-2 py-1 rounded uppercase font-black tracking-widest">Season {data.currentSeason}</span>
        </h1>
        <p class="subtle uppercase tracking-widest font-black text-xs">{data.team.name} Manager</p>
        <button 
          type="button" 
          class="mt-2 text-danger text-[0.65rem] font-black underline opacity-40 hover:opacity-100 transition-opacity uppercase tracking-tighter"
          onclick={() => showTerminateModal = true}
        >
          TERMINATE CAREER
        </button>
      </div>
      <div class="bg-light-bg text-primary px-6 py-3 rounded-xl font-black border border-light-border shadow-inner flex flex-col items-center leading-none">
        <span class="text-[0.6rem] subtle uppercase mb-1">Current Week</span>
        <span class="text-2xl">{data.week}</span>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <!-- Next Match Panel -->
      <div class="card flex flex-col border-t-4 border-t-primary">
        <h2 class="text-xs font-black subtle uppercase tracking-widest mb-6 flex justify-between">
          Next Fixture
          <span class="text-primary">MATCHDAY {data.week}</span>
        </h2>
        
        {#if data.nextFixture}
          <div class="flex items-center justify-between bg-light-bg p-8 rounded-2xl border border-light-border mb-8 shadow-inner relative overflow-hidden">
            <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50 opacity-20"></div>
            
            <div class="text-center flex-1 z-10">
              <div class="w-16 h-20 mx-auto bg-primary rounded-b-3xl shadow-lg mb-4 ring-4 ring-white"></div>
              <a href="/teams/{data.nextFixture.homeTeamId}" class="font-black text-lg hover:text-primary transition-colors block leading-tight">{getTeamName(data.nextFixture.homeTeamId)}</a>
              <span class="text-[0.6rem] font-bold bg-white px-2 py-0.5 rounded border border-light-border mt-1 inline-block">HOME</span>
            </div>
            
            <div class="flex flex-col items-center gap-1 z-10 px-4">
              <div class="font-black text-light-subtle bg-white w-10 h-10 flex items-center justify-center rounded-full border-2 border-light-border shadow-sm text-xs">VS</div>
            </div>
            
            <div class="text-center flex-1 z-10">
              <div class="w-16 h-20 mx-auto bg-danger rounded-b-3xl shadow-lg mb-4 ring-4 ring-white"></div>
              <a href="/teams/{data.nextFixture.awayTeamId}" class="font-black text-lg hover:text-primary transition-colors block leading-tight">{getTeamName(data.nextFixture.awayTeamId)}</a>
              <span class="text-[0.6rem] font-bold bg-white px-2 py-0.5 rounded border border-light-border mt-1 inline-block">AWAY</span>
            </div>
          </div>
          
          <div class="mt-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a href="/match/{data.nextFixture.id}/tactics" class="btn-primary flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              PLAY MATCH
            </a>
            
            <a href="/formation" class="btn-secondary flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
              TEAM TACTICS
            </a>

            {#if data.hasAnalytics}
              <a href="/analytics" class="btn-secondary sm:col-span-2 py-2 text-xs flex items-center justify-center gap-2">
                📊 POST-MATCH ANALYTICS
              </a>
            {/if}
          </div>
        {:else}
          <div class="text-center p-12 bg-light-bg rounded-2xl border border-light-border mb-6 flex-1 flex flex-col justify-center shadow-inner">
            <p class="text-2xl font-black mb-6 text-primary">🏆 SEASON COMPLETE!</p>
            <p class="subtle mb-8 italic">You've finished your matches for this year. Ready for the next challenge?</p>
            <form method="POST" action="?/advanceSeason">
              <button type="submit" class="btn-primary w-full py-4 text-lg">
                ADVANCE TO SEASON {(data.manager.currentSeason || 1) + 1}
              </button>
            </form>
          </div>
        {/if}
      </div>

      <!-- Compact League Table -->
      <div class="card flex flex-col h-[520px]">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xs font-black subtle uppercase tracking-widest mb-0">Live Standings</h2>
          <div class="flex gap-4 items-center">
            <button 
              class="text-xs font-black text-primary hover:underline flex items-center gap-1"
              onclick={() => showExpandedTable = true}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              EXPAND
            </button>
            <select bind:value={selectedLeagueId} class="text-xs font-black bg-light-bg border border-light-border rounded px-2 py-1 focus:ring-2 focus:ring-primary focus:outline-none appearance-none cursor-pointer pr-6 relative">
              {#each data.leagues as league}
                <option value={league.id}>{league.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto pr-1">
          <table class="w-full text-left border-collapse text-xs">
            <thead class="sticky top-0 bg-white z-10">
              <tr>
                <th class="pb-3 subtle font-black border-b border-light-border uppercase">#</th>
                <th class="pb-3 subtle font-black border-b border-light-border uppercase">Club</th>
                <th class="pb-3 subtle font-black border-b border-light-border uppercase text-center">P</th>
                <th class="pb-3 subtle font-black border-b border-light-border uppercase text-center">GD</th>
                <th class="pb-3 font-black border-b border-light-border uppercase text-center text-primary">Pts</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              {#each sortedStandings as row, i}
                <tr class="hover:bg-light-bg group {row.teamId === data.team.id ? 'bg-primary/5' : ''} {getZoneClass(selectedLeague?.level || 1, i)}">
                  <td class="py-3 px-1 font-black subtle opacity-50">{i + 1}</td>
                  <td class="py-3 font-bold">
                    <a href="/teams/{row.teamId}" class="{row.teamId === data.team.id ? 'text-primary' : 'text-light-text'} hover:underline truncate block max-w-[150px]">{getTeamName(row.teamId)}</a>
                  </td>
                  <td class="py-3 text-center">{row.played}</td>
                  <td class="py-3 text-center font-bold {row.goalsFor - row.goalsAgainst >= 0 ? 'text-green-600' : 'text-red-600'}">
                    {(row.goalsFor - row.goalsAgainst) > 0 ? '+' : ''}{row.goalsFor - row.goalsAgainst}
                  </td>
                  <td class="py-3 text-center font-black text-primary text-sm">{row.points}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Terminate Career Confirmation Modal -->
{#if showTerminateModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4" onclick={() => showTerminateModal = false}>
    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col p-8 border-t-8 border-t-danger" onclick={(e) => e.stopPropagation()}>
      <div class="text-center mb-8">
        <div class="w-20 h-20 bg-red-50 text-danger rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg ring-4 ring-red-50/50">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h2 class="text-2xl font-black mb-2">Resign & Terminate?</h2>
        <p class="subtle font-bold italic leading-relaxed">Warning: This action is permanent. Your entire managerial legacy and season progress will be wiped from existence.</p>
      </div>

      <div class="flex flex-col gap-3">
        <form method="POST" action="?/deleteCareer" class="w-full">
          <button type="submit" class="btn-primary bg-danger hover:bg-red-700 border-none w-full py-4 uppercase font-black tracking-widest shadow-xl ring-4 ring-red-500/20">
            CONFIRM TERMINATION
          </button>
        </form>
        <button 
          class="btn-secondary w-full py-3 uppercase font-black tracking-widest text-xs border-2 border-light-border" 
          onclick={() => showTerminateModal = false}
        >
          STAY IN THE DUGOUT
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Expanded League Modal -->
{#if showExpandedTable && selectedLeague}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-8" onclick={() => showExpandedTable = false}>
    <div class="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onclick={(e) => e.stopPropagation()}>
      <div class="p-6 border-b border-light-border bg-light-bg flex justify-between items-center">
        <div>
          <h2 class="mb-0 text-2xl font-black">{selectedLeague.name}</h2>
          <p class="text-xs font-black subtle uppercase tracking-widest mt-1">Full Season Standings • Week {data.week}</p>
        </div>
        <button class="w-12 h-12 rounded-full bg-white border border-light-border flex items-center justify-center font-bold hover:bg-gray-100 transition-colors shadow-sm" onclick={() => showExpandedTable = false}>&times;</button>
      </div>

      <div class="flex-1 overflow-auto p-4 sm:p-8">
        <table class="w-full text-left border-collapse text-sm">
          <thead class="sticky top-0 bg-white z-10 shadow-sm">
            <tr>
              <th class="p-4 text-xs font-black subtle border-b border-light-border uppercase">Pos</th>
              <th class="p-4 text-xs font-black subtle border-b border-light-border uppercase">Club</th>
              <th class="p-4 text-xs font-black subtle border-b border-light-border uppercase text-center">P</th>
              <th class="p-4 text-xs font-black subtle border-b border-light-border uppercase text-center">W</th>
              <th class="p-4 text-xs font-black subtle border-b border-light-border uppercase text-center">D</th>
              <th class="p-4 text-xs font-black subtle border-b border-light-border uppercase text-center">L</th>
              <th class="p-4 text-xs font-black subtle border-b border-light-border uppercase text-center">GF</th>
              <th class="p-4 text-xs font-black subtle border-b border-light-border uppercase text-center">GA</th>
              <th class="p-4 text-xs font-black subtle border-b border-light-border uppercase text-center">GD</th>
              <th class="p-4 text-sm font-black text-primary border-b border-light-border uppercase text-center">Pts</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each sortedStandings as row, i}
              <tr class="hover:bg-light-bg {row.teamId === data.team.id ? 'bg-primary/5' : ''} {getZoneClass(selectedLeague?.level || 1, i)}">
                <td class="p-4 font-black text-light-subtle">{i + 1}</td>
                <td class="p-4 font-black">
                  <a href="/teams/{row.teamId}" class="{row.teamId === data.team.id ? 'text-primary' : 'text-light-text'} hover:underline text-lg">{getTeamName(row.teamId)}</a>
                </td>
                <td class="p-4 text-center font-bold">{row.played}</td>
                <td class="p-4 text-center">{row.won}</td>
                <td class="p-4 text-center">{row.drawn}</td>
                <td class="p-4 text-center">{row.lost}</td>
                <td class="p-4 text-center">{row.goalsFor}</td>
                <td class="p-4 text-center">{row.goalsAgainst}</td>
                <td class="p-4 text-center font-black {row.goalsFor - row.goalsAgainst >= 0 ? 'text-green-600' : 'text-red-600'}">
                  {(row.goalsFor - row.goalsAgainst) > 0 ? '+' : ''}{row.goalsFor - row.goalsAgainst}
                </td>
                <td class="p-4 text-center font-black text-primary text-xl">{row.points}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="p-6 bg-light-bg border-t border-light-border flex justify-end">
        <button class="btn-secondary py-3 px-12 uppercase tracking-widest text-xs font-black" onclick={() => showExpandedTable = false}>Close Standings</button>
      </div>
    </div>
  </div>
{/if}