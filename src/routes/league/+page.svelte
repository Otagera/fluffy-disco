<script lang="ts">
  import type { PageData } from './$types';
  import { browserDB } from '$lib/data/dexie';
  import { onMount } from 'svelte';

  let { data }: { data: PageData } = $props();

  let activeTab = $state<'table' | 'fixtures' | 'stats' | 'news'>('table');
  let selectedWeek = $state(data.currentWeek > 0 ? data.currentWeek : 1);
  let availableReplays = $state<Set<string>>(new Set());

  // Top 3 news for the snippet
  let topNews = $derived((data.activeLeague.news || []).slice(0, 3));

  function getPlayerName(playerId: string) {
    return data.save.players?.[playerId]?.name || 'Unknown Player';
  }

  function getNewsIcon(type: string) {
    switch (type) {
      case 'BIG_RESULT': return '🔥';
      case 'HAT_TRICK': return '⚽️';
      case 'GOLDEN_BOOT': return '🏆';
      case 'TOP_CLASH': return '⚔️';
      default: return '📰';
    }
  }

  // Check for local replays on mount
  onMount(async () => {
    try {
      const replays = await browserDB.replays.toArray();
      const replayIds = replays.map(r => r.matchId);
      availableReplays = new Set(replayIds);
    } catch (e) {
      console.error('Failed to load replays from DB', e);
    }
  });

  let sortedStandings = $derived([...data.activeLeague.standings].sort((a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    return gdB - gdA;
  }));

  let currentWeekFixtures = $derived(
    data.leagueFixtures.filter((f: any) => f.week === selectedWeek)
  );

  let totalWeeks = $derived(
    Math.max(...data.leagueFixtures.map((f: any) => f.week), 1)
  );
  
  let weeksArray = $derived(Array.from({ length: totalWeeks }, (_, i) => i + 1));

  function getTeamName(teamId: string) {
    return data.save.teams?.[teamId]?.name || teamId;
  }

  function getTopPerformers(statKey: 'goals' | 'assists' | 'cleanSheets', limit: number = 5, roleFilter?: string) {
    const players = Object.values(data.save.players) as any[];
    return players
      .filter(p => {
        // Only include players from teams in the active league
        const isInLeague = data.activeLeague.teams.some((tid: string) => data.save.teams[tid]?.players.includes(p.id));
        if (!isInLeague) return false;
        if (roleFilter && p.role !== roleFilter) return false;
        return p.seasonStats && p.seasonStats[statKey] > 0;
      })
      .map(p => {
        const teamId = data.activeLeague.teams.find((tid: string) => data.save.teams[tid]?.players.includes(p.id)) || '';
        return {
          id: p.id,
          name: p.name,
          teamId,
          stat: p.seasonStats[statKey]
        };
      })
      .sort((a, b) => b.stat - a.stat)
      .slice(0, limit);
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

<div class="min-h-screen bg-light-bg p-4 sm:p-8">
  <div class="max-w-6xl mx-auto">
    <!-- Header & Navigation -->
    <div class="flex justify-between items-end mb-8">
      <div>
        <a href="/" class="text-xs font-black subtle uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1 mb-4">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Hub
        </a>
        <h1 class="text-4xl font-black tracking-tighter mb-2">{data.activeLeague.name}</h1>
      </div>
      
      <div class="flex gap-2">
        {#each data.leagues as league}
          <a 
            href="/league?id={league.id}" 
            class="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all {data.activeLeagueId === league.id ? 'bg-primary text-white border-primary' : 'bg-white border-light-border text-light-text hover:border-primary'}"
          >
            {league.name}
          </a>
        {/each}
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-4 mb-6 border-b border-light-border pb-px">
      <button 
        class="px-4 py-3 text-sm font-black uppercase tracking-widest border-b-4 transition-all {activeTab === 'table' ? 'border-primary text-primary' : 'border-transparent subtle hover:border-light-border'}"
        onclick={() => activeTab = 'table'}
      >
        Table
      </button>
      <button 
        class="px-4 py-3 text-sm font-black uppercase tracking-widest border-b-4 transition-all {activeTab === 'fixtures' ? 'border-primary text-primary' : 'border-transparent subtle hover:border-light-border'}"
        onclick={() => activeTab = 'fixtures'}
      >
        Fixtures & Results
      </button>
      <button 
        class="px-4 py-3 text-sm font-black uppercase tracking-widest border-b-4 transition-all {activeTab === 'news' ? 'border-primary text-primary' : 'border-transparent subtle hover:border-light-border'}"
        onclick={() => activeTab = 'news'}
      >
        News Feed
      </button>
      <button 
        class="px-4 py-3 text-sm font-black uppercase tracking-widest border-b-4 transition-all {activeTab === 'stats' ? 'border-primary text-primary' : 'border-transparent subtle hover:border-light-border'}"
        onclick={() => activeTab = 'stats'}
      >
        Stats
      </button>
    </div>

    <!-- Tab Content -->
    <div class="bg-white rounded-3xl shadow-xl border border-light-border overflow-hidden">
      
      {#if activeTab === 'table'}
        {#if topNews.length > 0}
          <!-- News Snippet Ticker -->
          <div class="bg-black text-white px-6 py-3 flex items-center gap-4 overflow-hidden border-b border-white/10 relative">
            <div class="flex-shrink-0 bg-yellow-400 text-black px-2 py-0.5 rounded text-[0.65rem] font-black uppercase tracking-widest flex items-center gap-1 z-10 shadow-lg">
              <span class="animate-pulse text-red-600">●</span> BREAKING
            </div>
            <div class="flex gap-12 whitespace-nowrap animate-ticker py-1">
              {#each [...topNews, ...topNews] as news}
                <div class="flex items-center gap-2 text-sm font-bold tracking-tight">
                  <span class="text-yellow-400">{getNewsIcon(news.type)}</span>
                  {news.headline}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="p-6 overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead class="bg-white">
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
                <tr class="hover:bg-light-bg {row.teamId === data.managerTeamId ? 'bg-primary/5' : ''} {getZoneClass(data.activeLeague.level, i)}">
                  <td class="p-4 font-black text-light-subtle">{i + 1}</td>
                  <td class="p-4 font-black">
                    <a href="/teams/{row.teamId}" class="{row.teamId === data.managerTeamId ? 'text-primary' : 'text-light-text'} hover:underline text-lg">{getTeamName(row.teamId)}</a>
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
      {/if}

      {#if activeTab === 'news'}
        <div class="flex flex-col h-[70vh] bg-light-bg">
          <div class="flex-1 overflow-y-auto p-6 sm:p-12">
            <div class="max-w-3xl mx-auto space-y-8">
              {#if !data.activeLeague.news || data.activeLeague.news.length === 0}
                <div class="p-12 text-center subtle font-bold italic bg-white rounded-3xl border border-light-border shadow-lg">
                  <div class="text-4xl mb-4">📭</div>
                  The season has just begun. No news reports yet.
                </div>
              {:else}
                {@const newsByWeek = Object.entries(
                  (data.activeLeague.news || []).reduce((acc: any, n: any) => {
                    if (!acc[n.week]) acc[n.week] = [];
                    acc[n.week].push(n);
                    return acc;
                  }, {})
                ).sort((a, b) => Number(b[0]) - Number(a[0]))}

                {#each newsByWeek as [week, items]}
                  <div class="relative">
                    <div class="flex items-center gap-4 mb-6">
                      <div class="h-px flex-1 bg-light-border"></div>
                      <span class="text-[0.65rem] font-black subtle uppercase tracking-[0.2em] bg-white px-4 py-1 rounded-full border border-light-border shadow-sm">Matchweek {week}</span>
                      <div class="h-px flex-1 bg-light-border"></div>
                    </div>
                    <div class="space-y-4">
                      {#each items as news}
                        <div class="bg-white p-6 rounded-2xl border border-light-border shadow-sm flex gap-6 hover:shadow-md transition-all hover:-translate-y-0.5 group">
                          <div class="text-3xl flex-shrink-0 bg-light-bg w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-primary/5 transition-colors">
                            {getNewsIcon(news.type)}
                          </div>
                          <div class="flex-1">
                            <div class="flex justify-between items-start mb-1">
                              <div class="text-[0.6rem] font-black text-primary uppercase tracking-widest">{news.type.replace('_', ' ')}</div>
                            </div>
                            <h3 class="text-xl font-black tracking-tight leading-tight group-hover:text-primary transition-colors">{news.headline}</h3>
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        </div>
      {/if}

      {#if activeTab === 'fixtures'}
        <div class="flex flex-col h-[70vh]">
          <!-- Week Selector -->
          <div class="bg-light-bg p-4 border-b border-light-border flex items-center justify-between shadow-inner">
            <button 
              class="w-10 h-10 rounded-full bg-white border border-light-border flex items-center justify-center hover:text-primary transition-colors disabled:opacity-50"
              disabled={selectedWeek <= 1}
              onclick={() => selectedWeek--}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            
            <div class="flex-1 overflow-x-auto mx-4 flex gap-2 no-scrollbar" style="scroll-snap-type: x mandatory;">
              {#each weeksArray as week}
                <button 
                  class="flex-shrink-0 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all {selectedWeek === week ? 'bg-primary text-white shadow-md' : 'bg-white border border-light-border text-light-text hover:border-primary'}"
                  style="scroll-snap-align: center;"
                  onclick={() => selectedWeek = week}
                >
                  Week {week}
                </button>
              {/each}
            </div>

            <button 
              class="w-10 h-10 rounded-full bg-white border border-light-border flex items-center justify-center hover:text-primary transition-colors disabled:opacity-50"
              disabled={selectedWeek >= totalWeeks}
              onclick={() => selectedWeek++}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

          <!-- Matches List -->
          <div class="flex-1 overflow-y-auto p-6 bg-white">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {#each currentWeekFixtures as fixture}
                {@const isManagerMatch = fixture.homeTeamId === data.managerTeamId || fixture.awayTeamId === data.managerTeamId}
                {@const hasReplay = availableReplays.has(fixture.id)}
                
                <div class="border {isManagerMatch ? 'border-primary ring-1 ring-primary/20' : 'border-light-border'} rounded-2xl p-4 flex flex-col justify-center relative {isManagerMatch ? 'bg-primary/5' : 'bg-white'}">
                  
                  {#if isManagerMatch}
                    <div class="absolute -top-2.5 left-4 bg-primary text-white text-[0.6rem] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-sm">Your Match</div>
                  {/if}

                  <div class="flex justify-between items-center mb-2">
                    <span class="text-[0.6rem] font-black subtle uppercase tracking-widest">
                      {fixture.played ? 'Full Time' : 'Upcoming'}
                    </span>
                    {#if fixture.played && hasReplay}
                      <a 
                        href="/replay/{fixture.id}" 
                        class="text-[0.65rem] font-black bg-secondary text-white px-2 py-1 rounded flex items-center gap-1 hover:bg-black transition-colors"
                      >
                        <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        REPLAY
                      </a>
                    {/if}
                  </div>

                  <div class="flex justify-between items-center text-lg font-black tracking-tight">
                    <div class="flex-1 text-right {fixture.homeTeamId === data.managerTeamId ? 'text-primary' : ''}">
                      {getTeamName(fixture.homeTeamId)}
                    </div>
                    
                    <div class="w-20 text-center flex-shrink-0 flex justify-center gap-2 px-2">
                      {#if fixture.played}
                        <span class="bg-light-bg border border-light-border px-3 py-1 rounded-lg text-primary">{fixture.homeScore}</span>
                        <span class="subtle">-</span>
                        <span class="bg-light-bg border border-light-border px-3 py-1 rounded-lg text-danger">{fixture.awayScore}</span>
                      {:else}
                        <span class="text-sm subtle bg-light-bg px-3 py-1 rounded-lg border border-light-border">VS</span>
                      {/if}
                    </div>

                    <div class="flex-1 text-left {fixture.awayTeamId === data.managerTeamId ? 'text-primary' : ''}">
                      {getTeamName(fixture.awayTeamId)}
                    </div>
                  </div>

                  {#if fixture.played && fixture.goalEvents && fixture.goalEvents.length > 0}
                    <div class="mt-4 pt-4 border-t border-dashed border-light-border grid grid-cols-2 gap-4">
                      <div class="text-right space-y-0.5">
                        {#each fixture.goalEvents.filter((g: any) => g.teamId === fixture.homeTeamId).sort((a: any, b: any) => a.minute - b.minute) as goal}
                          <div class="text-[0.65rem] font-bold text-light-text flex items-center justify-end gap-1">
                            <span class="subtle font-medium">{goal.minute}'</span>
                            {getPlayerName(goal.playerId)}
                          </div>
                        {/each}
                      </div>
                      <div class="text-left space-y-0.5">
                        {#each fixture.goalEvents.filter((g: any) => g.teamId === fixture.awayTeamId).sort((a: any, b: any) => a.minute - b.minute) as goal}
                          <div class="text-[0.65rem] font-bold text-light-text flex items-center gap-1">
                            {getPlayerName(goal.playerId)}
                            <span class="subtle font-medium">{goal.minute}'</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
              
              {#if currentWeekFixtures.length === 0}
                <div class="col-span-full p-12 text-center subtle font-bold italic">
                  No fixtures scheduled for this week.
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      {#if activeTab === 'stats'}
        <div class="p-6">
          <h2 class="text-xl font-black uppercase tracking-widest mb-6 border-b border-light-border pb-4">League Leaders</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Top Scorers -->
            <div class="card p-4">
              <h3 class="text-sm font-black subtle uppercase tracking-widest mb-4 flex justify-between items-center">
                Top Scorers
                <span class="text-xl">⚽️</span>
              </h3>
              <div class="flex flex-col gap-2">
                {#each getTopPerformers('goals', 5) as p, i}
                  <div class="flex justify-between items-center p-2 rounded-lg {i === 0 ? 'bg-primary/10 border border-primary/20' : 'hover:bg-light-bg'}">
                    <div class="flex items-center gap-3">
                      <span class="text-xs font-black subtle w-4">{i + 1}</span>
                      <div>
                        <div class="font-bold text-sm leading-tight">{p.name}</div>
                        <div class="text-[0.6rem] uppercase tracking-widest subtle">{getTeamName(p.teamId)}</div>
                      </div>
                    </div>
                    <div class="font-black text-lg text-primary">{p.stat}</div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Top Assists -->
            <div class="card p-4">
              <h3 class="text-sm font-black subtle uppercase tracking-widest mb-4 flex justify-between items-center">
                Most Assists
                <span class="text-xl">👟</span>
              </h3>
              <div class="flex flex-col gap-2">
                {#each getTopPerformers('assists', 5) as p, i}
                  <div class="flex justify-between items-center p-2 rounded-lg {i === 0 ? 'bg-primary/10 border border-primary/20' : 'hover:bg-light-bg'}">
                    <div class="flex items-center gap-3">
                      <span class="text-xs font-black subtle w-4">{i + 1}</span>
                      <div>
                        <div class="font-bold text-sm leading-tight">{p.name}</div>
                        <div class="text-[0.6rem] uppercase tracking-widest subtle">{getTeamName(p.teamId)}</div>
                      </div>
                    </div>
                    <div class="font-black text-lg text-primary">{p.stat}</div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- Clean Sheets -->
            <div class="card p-4">
              <h3 class="text-sm font-black subtle uppercase tracking-widest mb-4 flex justify-between items-center">
                Clean Sheets
                <span class="text-xl">🧤</span>
              </h3>
              <div class="flex flex-col gap-2">
                {#each getTopPerformers('cleanSheets', 5, 'GK') as p, i}
                  <div class="flex justify-between items-center p-2 rounded-lg {i === 0 ? 'bg-primary/10 border border-primary/20' : 'hover:bg-light-bg'}">
                    <div class="flex items-center gap-3">
                      <span class="text-xs font-black subtle w-4">{i + 1}</span>
                      <div>
                        <div class="font-bold text-sm leading-tight">{p.name}</div>
                        <div class="text-[0.6rem] uppercase tracking-widest subtle">{getTeamName(p.teamId)}</div>
                      </div>
                    </div>
                    <div class="font-black text-lg text-primary">{p.stat}</div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {/if}

    </div>
  </div>
</div>

<style>
  /* Hide scrollbar for the week selector but keep functionality */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .animate-ticker {
    display: flex;
    animation: ticker 30s linear infinite;
  }

  .animate-ticker:hover {
    animation-play-state: paused;
  }

  @keyframes ticker {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }
</style>