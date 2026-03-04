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
        <h1 class="flex items-center gap-1">
          {data.manager.name}
          <span class="season-badge">Season {data.currentSeason}</span>
        </h1>
        <p class="text-gray">{data.team.name} Manager</p>
        <form method="POST" action="?/deleteCareer" class="mt-1" onsubmit={(e) => !confirm('Are you sure? All season progress will be lost.') && e.preventDefault()}>
          <button type="submit" class="danger-link">DELETE CAREER & START OVER</button>
        </form>
      </div>
      <div class="week-badge">
        Week {data.week}
      </div>
    </div>

    <div class="grid grid-2 gap-2 mt-2">
      <!-- Next Match Panel -->
      <div class="card match-panel">
        <h2 class="mb-2">Next Fixture</h2>
        {#if data.nextFixture}
          <div class="fixture-display">
            <div class="team">
              <div class="team-shield home-shield"></div>
              <h3>{getTeamName(data.nextFixture.homeTeamId)}</h3>
            </div>
            <div class="vs">VS</div>
            <div class="team">
              <div class="team-shield away-shield"></div>
              <h3>{getTeamName(data.nextFixture.awayTeamId)}</h3>
            </div>
          </div>
          
          <div class="mt-4 text-center flex flex-direction-col gap-1">
            <a href="/match/{data.nextFixture.id}/tactics" class="button primary w-100" style="display:inline-block; padding:1rem; font-size:1.2rem; font-weight:bold;">
              PLAY MATCH
            </a>
            
            {#if data.hasAnalytics}
              <a href="/analytics" class="button secondary w-100" style="display:inline-block; padding:0.75rem; font-weight:bold; border: 1px solid #ddd;">
                📊 VIEW LAST MATCH ANALYTICS
              </a>
            {/if}
          </div>
        {:else}
          <div class="empty-state">
            <p class="mb-2">Season {data.manager.currentSeason || 1} Complete!</p>
            <form method="POST" action="?/advanceSeason">
              <button type="submit" class="button primary w-100" style="padding:1rem; font-weight:bold;">
                PROCEED TO SEASON {(data.manager.currentSeason || 1) + 1}
              </button>
            </form>
          </div>
        {/if}
      </div>

      <!-- League Table -->
      <div class="card league-panel">
        <div class="flex justify-between items-center mb-1">
          <h2 style="margin:0">Standings</h2>
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
  }
  
  .logo { display: flex; justify-content: center; margin-bottom: 1.5rem; }
  .title { font-size: 2.5rem; color: var(--dark); margin-bottom: 0.5rem; }
  .subtitle { color: var(--gray); font-size: 1.1rem; margin-bottom: 2rem; }
  .form-group { text-align: left; margin-bottom: 2rem; }
  .form-group label { font-size: 1.25rem; font-weight: bold; color: var(--dark); }
  .w-100 { width: 100%; padding: 1rem; font-size: 1.1rem; }

  .hub-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    padding: 1.5rem 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
    margin-top: 2rem;
  }
  
  .week-badge {
    background: var(--primary);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: bold;
  }

  .season-badge {
    font-size: 0.8rem;
    background: #e3f2fd;
    color: var(--primary);
    padding: 2px 8px;
    border-radius: 4px;
    vertical-align: middle;
  }

  .match-panel { padding: 2rem; }
  .fixture-display {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #f8f9fa;
    padding: 2rem;
    border-radius: 8px;
  }
  
  .team { text-align: center; flex: 1; }
  .team h3 { margin-top: 1rem; font-size: 1.2rem; }
  
  .team-shield {
    width: 60px;
    height: 70px;
    margin: 0 auto;
    border-radius: 0 0 30px 30px;
  }
  .home-shield { background: var(--primary); }
  .away-shield { background: var(--danger); }
  
  .vs {
    font-size: 1.5rem;
    font-weight: 900;
    color: #ccc;
    padding: 0 1rem;
  }

  .league-panel { padding: 1.5rem; max-height: 600px; display: flex; flex-direction: column; }
  .table-container { overflow-y: auto; flex: 1; }
  
  .league-select {
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    border: 1px solid #ddd;
    background: white;
    font-weight: bold;
    cursor: pointer;
  }

  .toggle-label {
    font-size: 0.75rem;
    font-weight: bold;
    color: #888;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
  }

  .league-table { width: 100%; border-collapse: collapse; text-align: left; }
  .league-table th, .league-table td { padding: 0.75rem 0.5rem; border-bottom: 1px solid #eee; font-size: 0.9rem; }
  .league-table th { color: #888; font-size: 0.75rem; text-transform: uppercase; position: sticky; top: 0; background: white; }
  .league-table .team-name { font-weight: bold; }
  .league-table .pts { font-weight: 900; color: var(--primary); }
  .league-table tr.highlight { background: #e3f2fd; }
  .league-table tr.highlight td { color: var(--primary); }

  .pos-cell { font-weight: bold; position: relative; }
  
  /* Zone Highlighting */
  tr.zone-champ .pos-cell::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #3b82f6; } /* Blue */
  tr.zone-promo .pos-cell::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #10b981; } /* Green */
  tr.zone-playoff .pos-cell::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #f59e0b; } /* Yellow */
  tr.zone-relegation .pos-cell::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #ef4444; } /* Red */
  
  .button {
    text-decoration: none;
    text-align: center;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .danger-link {
    background: none;
    border: none;
    color: var(--danger);
    font-size: 0.7rem;
    font-weight: bold;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    opacity: 0.6;
  }
  .danger-link:hover { opacity: 1; }

  .empty-state { text-align: center; color: #999; font-style: italic; padding: 2rem; }
  .flex { display: flex; }
  .flex-direction-col { flex-direction: column; }
  .justify-between { justify-content: space-between; }
  .items-center { align-items: center; }
  .mb-1 { margin-bottom: 1rem; }
  .mb-2 { margin-bottom: 2rem; }
  .mt-1 { margin-top: 1rem; }
  .mt-2 { margin-top: 2rem; }
  .mt-4 { margin-top: 4rem; }
  .gap-1 { gap: 1rem; }
</style>
