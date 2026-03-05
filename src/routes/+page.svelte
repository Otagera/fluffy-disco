<script lang="ts">
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  // Initialize with the manager's current league
  let selectedLeagueId = $state(data.activeLeagueId);
  let expandedView = $state(false);
  
  // Reactive derivation for the currently viewing league
  let selectedLeague = $derived(data.leagues?.find(l => l.id === selectedLeagueId));

  // Sort standings by points descending, then GD descending
  let sortedStandings = $derived.by(() => {
    if (!selectedLeague) return [];
    return [...selectedLeague.standings].sort((a, b) => {
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
    if (level === 1) { // Premier League
      if (pos < 4) return 'zone-champ'; // UCL
      if (pos >= 17) return 'zone-relegation'; // Relegation
    } else if (level === 2) { // Championship
      if (pos < 2) return 'zone-promo'; // Auto Promo
      if (pos >= 2 && pos < 6) return 'zone-playoff'; // Playoff
      if (pos >= 21) return 'zone-relegation'; // Relegation
    } else if (level === 3) { // League One
      if (pos < 2) return 'zone-promo'; // Auto Promo
      if (pos >= 2 && pos < 6) return 'zone-playoff'; // Playoff
      if (pos >= 20) return 'zone-relegation'; // Relegation
    } else if (level === 4) { // League Two
      if (pos < 3) return 'zone-promo'; // Auto Promo
      if (pos >= 3 && pos < 7) return 'zone-playoff'; // Playoff
    }
    return '';
  }
</script>

<div class="container">
  {#if !data.hasSave}
    <div class="card login-card">
      <div class="logo">
        <svg viewBox="0 0 100 100" width="80" height="80">
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--primary)" stroke-width="8"/>
          <path d="M50 5 L75 25 L85 55 L65 80 L35 80 L15 55 L25 25 Z" fill="none" stroke="var(--primary)" stroke-width="4"/>
          <line x1="50" y1="5" x2="50" y2="40" stroke="var(--primary)" stroke-width="4"/>
          <line x1="75" y1="25" x2="50" y2="40" stroke="var(--primary)" stroke-width="4"/>
          <line x1="25" y1="25" x2="50" y2="40" stroke="var(--primary)" stroke-width="4"/>
        </svg>
      </div>
      
      <h1 class="title">Football Sim Career</h1>
      <p class="subtitle">Start your managerial journey</p>
      
      <form method="POST" action="?/startCareer" class="form-group mt-2">
        <label for="managerName">Manager Name</label>
        <p class="text-sm text-gray mb-1">Enter your name to begin a new career</p>
        <input 
          id="managerName"
          name="managerName"
          type="text" 
          placeholder="The Gaffer"
          required
        />
        <button type="submit" class="primary w-100 mt-2">Start Career</button>
      </form>
    </div>
  {:else}
    <div class="hub-header">
      <div>
        <h1 class="flex items-center gap-1 font-black tracking-tighter">
          {data.manager.name}
          <span class="season-badge">Season {data.currentSeason}</span>
        </h1>
        <p class="text-gray uppercase tracking-widest font-bold" style="font-size: 0.7rem;">{data.team.name} Manager</p>
        <form method="POST" action="?/deleteCareer" class="mt-1" onsubmit={(e) => !confirm('Are you sure? All season progress will be lost.') && e.preventDefault()}>
          <button type="submit" class="danger-link">RESET CAREER & RESTART UNIVERSE</button>
        </form>
      </div>
      <div class="week-badge">
        Week {data.week}
      </div>
    </div>

    <div class="grid grid-2 gap-2 mt-2">
      <!-- Next Match Panel -->
      <div class="card match-panel">
        <h2 class="mb-2 uppercase tracking-widest text-gray" style="font-size: 0.8rem;">Next Fixture</h2>
        {#if data.nextFixture}
          <div class="fixture-display">
            <div class="team">
              <div class="team-shield home-shield"></div>
              <h3>{getTeamName(data.nextFixture.homeTeamId)}</h3>
            </div>
            <div class="vs-badge">VS</div>
            <div class="team">
              <div class="team-shield away-shield"></div>
              <h3>{getTeamName(data.nextFixture.awayTeamId)}</h3>
            </div>
          </div>
          
          <div class="mt-3 flex flex-col gap-1">
            <a href="/match/{data.nextFixture.id}/tactics" class="btn primary btn-lg w-100">
              PLAY MATCH
            </a>
            
            {#if data.hasAnalytics}
              <a href="/analytics" class="btn secondary w-100 font-bold" style="padding: 0.75rem;">
                📊 VIEW LAST MATCH ANALYTICS
              </a>
            {/if}
          </div>
        {:else}
          <div class="empty-state">
            <p class="mb-2 text-lg font-black">Season {data.manager.currentSeason || 1} Complete!</p>
            <form method="POST" action="?/advanceSeason">
              <button type="submit" class="primary btn-lg w-100">
                PROCEED TO SEASON {(data.manager.currentSeason || 1) + 1}
              </button>
            </form>
          </div>
        {/if}
      </div>

      <!-- League Table -->
      <div class="card league-panel">
        <div class="flex justify-between items-center mb-2">
          <h2 class="uppercase tracking-widest text-gray" style="font-size: 0.8rem;">Standings</h2>
          <div class="flex gap-1 items-center">
            <label class="toggle-label">
              <input type="checkbox" bind:checked={expandedView} />
              Expanded
            </label>
            <select bind:value={selectedLeagueId} class="league-select">
              {#each data.leagues as league}
                <option value={league.id}>{league.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="table-container">
          <table class="league-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Club</th>
                <th title="Played">P</th>
                {#if expandedView}
                  <th title="Won">W</th>
                  <th title="Drawn">D</th>
                  <th title="Lost">L</th>
                  <th title="Goals For">GF</th>
                  <th title="Goals Against">GA</th>
                {/if}
                <th title="Goal Difference">GD</th>
                <th title="Points">Pts</th>
              </tr>
            </thead>
            <tbody>
              {#each sortedStandings as row, i}
                <tr class="{row.teamId === data.team.id ? 'highlight' : ''} {getZoneClass(selectedLeague?.level || 1, i)}">
                  <td class="pos-cell">{i + 1}</td>
                  <td class="team-name">{getTeamName(row.teamId)}</td>
                  <td>{row.played}</td>
                  {#if expandedView}
                    <td>{row.won}</td>
                    <td>{row.drawn}</td>
                    <td>{row.lost}</td>
                    <td>{row.goalsFor}</td>
                    <td>{row.goalsAgainst}</td>
                  {/if}
                  <td>{row.goalsFor - row.goalsAgainst}</td>
                  <td class="pts">{row.points}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .login-card {
    max-width: 500px;
    margin: 4rem auto 0;
    padding: 3rem 2rem;
    text-align: center;
    background: #111;
    border: 1px solid #222;
  }
  
  .logo { display: flex; justify-content: center; margin-bottom: 1.5rem; }
  .title { font-size: 2.5rem; color: white; font-weight: 900; letter-spacing: -1.5px; margin-bottom: 0.5rem; }
  .subtitle { color: var(--gray); font-size: 1.1rem; margin-bottom: 2rem; }
  .form-group { text-align: left; margin-bottom: 2rem; }
  .form-group label { font-size: 1.25rem; font-weight: bold; color: white; }
  .w-100 { width: 100%; }

  .hub-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(to right, #111, #0a0a0a);
    padding: 2rem 2.5rem;
    border-radius: 12px;
    border: 1px solid #222;
    box-shadow: var(--shadow-lg);
    margin-top: 2rem;
  }
  
  .week-badge {
    background: #1a1a1a;
    color: var(--accent);
    padding: 0.6rem 1.2rem;
    border-radius: 4px;
    font-weight: 900;
    border: 1px solid #333;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 0.8rem;
  }

  .season-badge {
    font-size: 0.7rem;
    background: var(--primary);
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    vertical-align: middle;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 900;
  }

  .match-panel { padding: 2.5rem; border: 1px solid #222; background: linear-gradient(180deg, #111 0%, #0a0a0a 100%); }
  .fixture-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #000;
    padding: 2.5rem;
    border-radius: 12px;
    border: 1px solid #1a1a1a;
    box-shadow: inset 0 0 40px rgba(0,0,0,0.8);
    margin-bottom: 1.5rem;
  }
  
  .team { text-align: center; flex: 1; }
  .team h3 { margin-top: 1rem; font-size: 1.1rem; font-weight: 900; color: white; }
  
  .team-shield {
    width: 60px;
    height: 70px;
    margin: 0 auto;
    border-radius: 0 0 30px 30px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  }
  .home-shield { background: var(--primary); }
  .away-shield { background: var(--danger); }
  
  .vs-badge {
    font-size: 0.9rem;
    font-weight: 900;
    color: #444;
    background: #111;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    border: 1px solid #222;
  }

  .league-panel { padding: 1.5rem; max-height: 600px; display: flex; flex-direction: column; border: 1px solid #222; }
  .table-container { overflow-y: auto; flex: 1; margin-top: 0.5rem; }
  
  .league-select {
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    border: 1px solid #333;
    background: #111;
    color: white;
    font-weight: bold;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .toggle-label {
    font-size: 0.75rem;
    font-weight: bold;
    color: #666;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
  }

  .league-table { width: 100%; border-collapse: collapse; text-align: left; }
  .league-table th, .league-table td { padding: 0.8rem 0.5rem; border-bottom: 1px solid #1a1a1a; font-size: 0.9rem; }
  .league-table th { color: #555; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; position: sticky; top: 0; background: #1a1a1a; z-index: 10; font-weight: 900; }
  .league-table .team-name { font-weight: 800; color: #ccc; }
  .league-table .pts { font-weight: 900; color: var(--accent); }
  .league-table tr.highlight { background: rgba(255, 235, 59, 0.05); }
  .league-table tr.highlight .team-name { color: var(--accent); }

  .pos-cell { font-weight: 900; position: relative; color: #444; }
  
  /* Zone Highlighting */
  tr.zone-champ .pos-cell::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #3b82f6; } 
  tr.zone-promo .pos-cell::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #10b981; } 
  tr.zone-playoff .pos-cell::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #f59e0b; } 
  tr.zone-relegation .pos-cell::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #ef4444; } 
  
  .btn {
    text-decoration: none;
    text-align: center;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: inline-block;
    transition: all 0.2s;
  }

  .danger-link {
    background: none;
    border: none;
    color: var(--danger);
    font-size: 0.65rem;
    font-weight: 900;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    opacity: 0.5;
    letter-spacing: 1px;
  }
  .danger-link:hover { opacity: 1; }

  .empty-state { text-align: center; color: #666; font-style: italic; padding: 2rem; background: #050505; border-radius: 8px; }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .justify-between { justify-content: space-between; }
  .items-center { align-items: center; }
  .mb-1 { margin-bottom: 1rem; }
  .mb-2 { margin-bottom: 2rem; }
  .mt-1 { margin-top: 1rem; }
  .mt-2 { margin-top: 2rem; }
  .mt-3 { margin-top: 3rem; }
  .gap-1 { gap: 1rem; }
  .font-black { font-weight: 900; }
  .tracking-tighter { letter-spacing: -0.05em; }
</style>

