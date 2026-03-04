<script lang="ts">
  let teams = $state([
    { 
      id: 1, 
      name: 'FC Thunder', 
      primary: '#1a5f2a', 
      secondary: '#ffd700',
      players: [
        { id: 1, name: 'John Smith', position: 'GK', number: 1, stats: { speed: 45, skill: 55, passing: 60, shooting: 40, defending: 50, stamina: 70 } },
        { id: 2, name: 'Carlos Rodriguez', position: 'CB', number: 4, stats: { speed: 55, skill: 60, passing: 65, shooting: 45, defending: 80, stamina: 75 } },
        { id: 3, name: 'Marcus Johnson', position: 'CB', number: 5, stats: { speed: 50, skill: 55, passing: 60, shooting: 40, defending: 85, stamina: 70 } },
        { id: 4, name: 'David Williams', position: 'LB', number: 3, stats: { speed: 70, skill: 65, passing: 70, shooting: 50, defending: 72, stamina: 80 } },
        { id: 5, name: 'James Brown', position: 'RB', number: 2, stats: { speed: 72, skill: 63, passing: 68, shooting: 48, defending: 70, stamina: 78 } },
        { id: 6, name: 'Michael Davis', position: 'CDM', number: 6, stats: { speed: 58, skill: 70, passing: 82, shooting: 55, defending: 75, stamina: 85 } },
        { id: 7, name: 'Robert Miller', position: 'CM', number: 8, stats: { speed: 62, skill: 78, passing: 80, shooting: 65, defending: 60, stamina: 82 } },
        { id: 8, name: 'Antonio Garcia', position: 'CAM', number: 10, stats: { speed: 68, skill: 88, passing: 85, shooting: 78, defending: 45, stamina: 75 } },
        { id: 9, name: 'Kevin Wilson', position: 'LW', number: 7, stats: { speed: 85, skill: 80, passing: 72, shooting: 70, defending: 40, stamina: 72 } },
        { id: 10, name: 'Daniel Taylor', position: 'RW', number: 11, stats: { speed: 83, skill: 78, passing: 70, shooting: 72, defending: 42, stamina: 70 } },
        { id: 11, name: 'Chris Anderson', position: 'ST', number: 9, stats: { speed: 75, skill: 82, passing: 60, shooting: 88, defending: 35, stamina: 68 } },
      ]
    },
  ]);
  
  let selectedTeam = $state(teams[0]);
  let selectedPlayer = $state<number | null>(null);
  
  function getStatColor(value: number): string {
    if (value >= 80) return '#28a745';
    if (value >= 60) return '#ffc107';
    return '#dc3545';
  }
</script>

<div class="container">
  <div class="header mb-2">
    <h1>Team Management</h1>
    <button class="primary">+ Create New Team</button>
  </div>
  
  <div class="grid grid-2 gap-2">
    <div>
      <div class="card">
        <h2>Your Teams</h2>
        <div class="team-list">
          {#each teams as team}
            <button 
              class="team-card"
              class:selected={selectedTeam?.id === team.id}
              onclick={() => selectedTeam = team}
            >
              <span class="team-color" style="background: {team.primary}"></span>
              <span class="team-name">{team.name}</span>
              <span class="player-count">{team.players.length} players</span>
            </button>
          {/each}
        </div>
      </div>
      
      <div class="card mt-2">
        <h2>Generate Players</h2>
        <p class="text-sm text-gray mb-1">Auto-generate 11 players with random names and stats</p>
        <button class="primary" style="width: 100%">🎲 Generate Players</button>
      </div>
    </div>
    
    <div>
      {#if selectedTeam}
        <div class="card">
          <div class="team-header flex items-center gap-2 mb-2">
            <span class="team-badge" style="background: {selectedTeam.primary}; color: {selectedTeam.secondary};">
              {selectedTeam.name}
            </span>
          </div>
          
          <h3>Squad</h3>
          <div class="player-list">
            {#each selectedTeam.players as player}
              <button 
                class="player-row"
                class:selected={selectedPlayer === player.id}
                onclick={() => selectedPlayer = selectedPlayer === player.id ? null : player.id}
              >
                <span class="player-number" style="background: {selectedTeam.primary}">{player.number}</span>
                <span class="player-info">
                  <span class="player-name">{player.name}</span>
                  <span class="player-position">{player.position}</span>
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  {#if selectedPlayer}
    {@const player = selectedTeam.players.find(p => p.id === selectedPlayer)}
    {#if player}
      <div class="card mt-2">
        <h3>{player.name} - #{player.number} ({player.position})</h3>
        
        <div class="stats-grid">
          <div class="stat">
            <span class="stat-label">Speed</span>
            <div class="stat-bar">
              <div class="stat-fill" style="width: {player.stats.speed}%; background: {getStatColor(player.stats.speed)}"></div>
            </div>
            <span class="stat-value">{player.stats.speed}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Skill</span>
            <div class="stat-bar">
              <div class="stat-fill" style="width: {player.stats.skill}%; background: {getStatColor(player.stats.skill)}"></div>
            </div>
            <span class="stat-value">{player.stats.skill}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Passing</span>
            <div class="stat-bar">
              <div class="stat-fill" style="width: {player.stats.passing}%; background: {getStatColor(player.stats.passing)}"></div>
            </div>
            <span class="stat-value">{player.stats.passing}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Shooting</span>
            <div class="stat-bar">
              <div class="stat-fill" style="width: {player.stats.shooting}%; background: {getStatColor(player.stats.shooting)}"></div>
            </div>
            <span class="stat-value">{player.stats.shooting}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Defending</span>
            <div class="stat-bar">
              <div class="stat-fill" style="width: {player.stats.defending}%; background: {getStatColor(player.stats.defending)}"></div>
            </div>
            <span class="stat-value">{player.stats.defending}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Stamina</span>
            <div class="stat-bar">
              <div class="stat-fill" style="width: {player.stats.stamina}%; background: {getStatColor(player.stats.stamina)}"></div>
            </div>
            <span class="stat-value">{player.stats.stamina}</span>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .team-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .team-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f8f9fa;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
  }
  
  .team-card.selected {
    border-color: var(--primary);
    background: #e8f5e9;
  }
  
  .team-color {
    width: 32px;
    height: 32px;
    border-radius: 6px;
  }
  
  .team-name {
    flex: 1;
    font-weight: 500;
  }
  
  .player-count {
    color: var(--gray);
    font-size: 0.875rem;
  }
  
  .team-badge {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-weight: bold;
  }
  
  .player-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .player-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem;
    background: #f8f9fa;
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }
  
  .player-row:hover {
    background: #e9ecef;
  }
  
  .player-row.selected {
    border-color: var(--primary);
    background: #e8f5e9;
  }
  
  .player-number {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 0.8rem;
  }
  
  .player-info {
    flex: 1;
    display: flex;
    justify-content: space-between;
  }
  
  .player-name {
    font-weight: 500;
  }
  
  .player-position {
    color: var(--gray);
    font-size: 0.875rem;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  
  .stat {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .stat-label {
    width: 80px;
    font-size: 0.875rem;
  }
  
  .stat-bar {
    flex: 1;
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .stat-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s;
  }
  
  .stat-value {
    width: 30px;
    text-align: right;
    font-weight: bold;
    font-size: 0.875rem;
  }
  
  .text-gray {
    color: var(--gray);
  }
</style>
