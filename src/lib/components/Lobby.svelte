<script lang="ts">
  import { matchState } from '../game/matchState.svelte';
  import { formations } from '../game/formations';
  import { teams } from '../game/teams';
  import { resetMatch } from '../game/rules';
  import MiniPitch from './MiniPitch.svelte';

  const formationList = Object.keys(formations);
  const teamList = Object.keys(teams);
  const mentalities = ['ULTRA_DEFENSIVE', 'DEFENSIVE', 'BALANCED', 'ATTACKING', 'ULTRA_ATTACKING'];

  const roleOptions: Record<string, string[]> = {
    'GK': ['GK'],
    'DEF': ['CB', 'FB', 'WB'],
    'MID': ['DLP', 'BWM', 'MEZ', 'B2B', 'AM', 'WM'],
    'FWD': ['ST', 'AF', 'TM', 'IF', 'W']
  };

  function handleGlobalChange(team: 'home' | 'away' | 'global', field: string, e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    
    if (team === 'global' && field === 'matchType') {
      if (val === 'PvC') {
        matchState.homeControl = 'HUMAN';
        matchState.awayControl = 'CPU';
      } else if (val === 'CvC') {
        matchState.homeControl = 'CPU';
        matchState.awayControl = 'CPU';
      } else if (val === 'PvP') {
        matchState.homeControl = 'HUMAN';
        matchState.awayControl = 'HUMAN';
      }
      return;
    }

    if (team === 'home') {
      if (field === 'team') matchState.homeTeamId = val;
      if (field === 'formation') matchState.homeFormation = val;
      if (field === 'mentality') matchState.homeMentality = val as any;
    } else {
      if (field === 'team') matchState.awayTeamId = val;
      if (field === 'formation') matchState.awayFormation = val;
      if (field === 'mentality') matchState.awayMentality = val as any;
    }

    if (field === 'formation' || field === 'team') {
      resetMatch(false, 'LOBBY');
    }
  }

  let matchType = $derived(
    matchState.homeControl === 'HUMAN' && matchState.awayControl === 'CPU' ? 'PvC' :
    matchState.homeControl === 'CPU' && matchState.awayControl === 'CPU' ? 'CvC' : 'PvP'
  );
</script>

<div class="lobby-dashboard">
  
  <div class="match-type-header">
    <label>MATCH TYPE:</label>
    <select value={matchType} onchange={(e) => handleGlobalChange('global', 'matchType', e)}>
      <option value="PvC">Player vs CPU</option>
      <option value="CvC">CPU vs CPU</option>
      <option value="PvP">Player vs Player</option>
    </select>
  </div>

  <div class="main-content">
    <!-- HOME PANEL -->
    <div class="lobby-panel" class:cpu-dim={matchState.homeControl === 'CPU'}>
      <h2>HOME TEAM {matchState.homeControl === 'CPU' ? '(CPU)' : '(P1)'}</h2>
      
      <div class="global-controls">
        <select value={matchState.homeTeamId} onchange={(e) => handleGlobalChange('home', 'team', e)} disabled={matchState.homeControl === 'CPU'}>
          {#each teamList as tid}
            <option value={tid}>{teams[tid].name}</option>
          {/each}
        </select>

        <select value={matchState.homeFormation} onchange={(e) => handleGlobalChange('home', 'formation', e)} disabled={matchState.homeControl === 'CPU'}>
          {#each formationList as f}
            <option value={f}>{f}</option>
          {/each}
        </select>

        <select value={matchState.homeMentality} onchange={(e) => handleGlobalChange('home', 'mentality', e)} disabled={matchState.homeControl === 'CPU'}>
          {#each mentalities as m}
            <option value={m}>{m.replace('_', ' ')}</option>
          {/each}
        </select>
      </div>

      <div class="squad-list">
        {#each matchState.players.filter(p => p.team === 'home') as player (player.id)}
          <div class="player-row">
            <span class="p-num">{player.number}</span>
            <span class="p-pos">{player.role}</span>
            <select bind:value={player.tacticalRole} class="role-select" disabled={matchState.homeControl === 'CPU'}>
              {#each roleOptions[player.role] || [player.role] as r}
                <option value={r}>{r}</option>
              {/each}
            </select>
          </div>
        {/each}
      </div>
    </div>

    <!-- MINI PITCH VISUALIZER -->
    <div class="pitch-preview">
      <MiniPitch />
      <p class="preview-text">TACTICAL SHAPE</p>
    </div>

    <!-- AWAY PANEL -->
    <div class="lobby-panel" class:cpu-dim={matchState.awayControl === 'CPU'}>
      <h2>AWAY TEAM {matchState.awayControl === 'CPU' ? '(CPU)' : '(P2)'}</h2>
      
      <div class="global-controls">
        <select value={matchState.awayTeamId} onchange={(e) => handleGlobalChange('away', 'team', e)} disabled={matchState.awayControl === 'CPU'}>
          {#each teamList as tid}
            <option value={tid}>{teams[tid].name}</option>
          {/each}
        </select>

        <select value={matchState.awayFormation} onchange={(e) => handleGlobalChange('away', 'formation', e)} disabled={matchState.awayControl === 'CPU'}>
          {#each formationList as f}
            <option value={f}>{f}</option>
          {/each}
        </select>

        <select value={matchState.awayMentality} onchange={(e) => handleGlobalChange('away', 'mentality', e)} disabled={matchState.awayControl === 'CPU'}>
          {#each mentalities as m}
            <option value={m}>{m.replace('_', ' ')}</option>
          {/each}
        </select>
      </div>

      <div class="squad-list">
        {#each matchState.players.filter(p => p.team === 'away') as player (player.id)}
          <div class="player-row">
            <span class="p-num">{player.number}</span>
            <span class="p-pos">{player.role}</span>
            <select bind:value={player.tacticalRole} class="role-select" disabled={matchState.awayControl === 'CPU'}>
              {#each roleOptions[player.role] || [player.role] as r}
                <option value={r}>{r}</option>
              {/each}
            </select>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .lobby-dashboard {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    color: white;
    font-family: 'Inter', sans-serif;
  }

  .match-type-header {
    background: #222;
    padding: 10px 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid #444;
  }
  
  .match-type-header label { font-weight: bold; color: #aaa; font-size: 12px; }
  .match-type-header select { font-size: 16px; padding: 5px 10px; }

  .main-content {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 2rem;
    width: 100%;
    max-width: 1200px;
  }

  .pitch-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 40px;
  }

  .preview-text {
    margin-top: 10px;
    font-weight: bold;
    color: #666;
    letter-spacing: 2px;
    font-size: 12px;
  }

  .lobby-panel {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 1.5rem;
    width: 350px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    transition: opacity 0.3s;
  }

  .lobby-panel.cpu-dim {
    opacity: 0.8;
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
    text-align: center;
    color: #4caf50;
    letter-spacing: 2px;
  }

  .global-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #333;
  }

  select {
    background: #2a2a2a;
    color: white;
    border: 1px solid #444;
    padding: 0.5rem;
    border-radius: 6px;
    font-weight: bold;
    outline: none;
    cursor: pointer;
  }

  .squad-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .player-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #222;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .p-num {
    width: 24px;
    height: 24px;
    background: #444;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: bold;
  }

  .p-pos {
    width: 40px;
    font-size: 0.8rem;
    color: #888;
    font-weight: bold;
  }

  .role-select {
    flex: 1;
    padding: 0.2rem;
    font-size: 0.8rem;
    background: #111;
  }
</style>
