<script lang="ts">
  let team = $state({
    id: 1,
    name: 'FC Thunder',
    primary: '#1a5f2a',
    secondary: '#ffd700'
  });
  
  let players = $state([
    { id: 1, name: 'John Smith', position: 'GK', number: 1, zone: 0 },
    { id: 2, name: 'Carlos Rodriguez', position: 'CB', number: 4, zone: 1 },
    { id: 3, name: 'Marcus Johnson', position: 'CB', number: 5, zone: 2 },
    { id: 4, name: 'David Williams', position: 'LB', number: 3, zone: 3 },
    { id: 5, name: 'James Brown', position: 'RB', number: 2, zone: 4 },
    { id: 6, name: 'Michael Davis', position: 'CDM', number: 6, zone: 5 },
    { id: 7, name: 'Robert Miller', position: 'CM', number: 8, zone: 6 },
    { id: 8, name: 'Antonio Garcia', position: 'CAM', number: 10, zone: 7 },
    { id: 9, name: 'Kevin Wilson', position: 'LW', number: 7, zone: 8 },
    { id: 10, name: 'Daniel Taylor', position: 'RW', number: 11, zone: 9 },
    { id: 11, name: 'Chris Anderson', position: 'ST', number: 9, zone: 10 },
  ]);
  
  let formations = $state([
    { name: '4-3-3', zones: [0, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8] },
    { name: '4-4-2', zones: [0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 6] },
    { name: '3-5-2', zones: [0, 1, 1, 1, 2, 2, 3, 4, 5, 6, 6] },
    { name: '4-2-3-1', zones: [0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7] },
    { name: '5-3-2', zones: [0, 1, 1, 1, 2, 2, 3, 4, 5, 6, 6] },
  ]);
  
  let selectedFormation = $state(0);
  let draggedPlayer = $state<number | null>(null);
  let hoveredZone = $state<number | null>(null);
  
  const zonePositions: { x: number; y: number; label: string }[] = [
    { x: 10, y: 50, label: 'GK' },
    { x: 25, y: 25, label: 'CB' },
    { x: 25, y: 75, label: 'CB' },
    { x: 30, y: 15, label: 'LB' },
    { x: 30, y: 85, label: 'RB' },
    { x: 50, y: 30, label: 'CDM' },
    { x: 55, y: 50, label: 'CM' },
    { x: 60, y: 70, label: 'CAM' },
    { x: 75, y: 20, label: 'LW' },
    { x: 75, y: 80, label: 'RW' },
    { x: 85, y: 50, label: 'ST' },
  ];
  
  function getPlayerInZone(zoneIndex: number) {
    return players.find(p => p.zone === zoneIndex);
  }
  
  function handleDragStart(e: DragEvent, playerId: number) {
    draggedPlayer = playerId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }
  
  function handleDragOver(e: DragEvent, zoneIndex: number) {
    e.preventDefault();
    hoveredZone = zoneIndex;
  }
  
  function handleDragLeave() {
    hoveredZone = null;
  }
  
  function handleDrop(e: DragEvent, zoneIndex: number) {
    e.preventDefault();
    if (draggedPlayer === null) return;
    
    const currentPlayer = players.find(p => p.id === draggedPlayer);
    const targetPlayer = players.find(p => p.zone === zoneIndex);
    
    if (currentPlayer) {
      if (targetPlayer) {
        targetPlayer.zone = currentPlayer.zone;
      }
      currentPlayer.zone = zoneIndex;
    }
    
    draggedPlayer = null;
    hoveredZone = null;
  }
  
  function applyFormation(formation: typeof formations[0], index: number) {
    selectedFormation = index;
    players.forEach((player, i) => {
      player.zone = formation.zones[i] || 0;
    });
  }
  
  function resetPositions() {
    players.forEach((player, i) => {
      player.zone = i;
    });
  }
</script>

<div class="container">
  <div class="header mb-2">
    <h1>Formation Editor</h1>
    <div class="flex gap-2">
      <button class="secondary" onclick={resetPositions}>Reset</button>
      <button class="primary">Save Formation</button>
    </div>
  </div>
  
  <div class="grid grid-2 gap-2">
    <div>
      <div class="card">
        <h2>Pitch</h2>
        <div class="formation-pitch" style="height: 500px;">
          <svg class="pitch-lines" viewBox="0 0 100 70" preserveAspectRatio="none">
            <rect x="0" y="0" width="100" height="70" fill="none" stroke="white" stroke-width="0.5"/>
            <line x1="50" y1="0" x2="50" y2="70" stroke="white" stroke-width="0.5"/>
            <circle cx="50" cy="35" r="8" fill="none" stroke="white" stroke-width="0.5"/>
            <rect x="0" y="18" width="15" height="34" fill="none" stroke="white" stroke-width="0.5"/>
            <rect x="85" y="18" width="15" height="34" fill="none" stroke="white" stroke-width="0.5"/>
          </svg>
          
          {#each zonePositions as zone, index}
            <div 
              class="zone"
              class:hovered={hoveredZone === index}
              style="left: {zone.x}%; top: {zone.y}%;"
              ondragover={(e) => handleDragOver(e, index)}
              ondragleave={handleDragLeave}
              ondrop={(e) => handleDrop(e, index)}
            >
              <span class="zone-label">{zone.label}</span>
              {#if getPlayerInZone(index)}
                {@const player = getPlayerInZone(index)}
                <div 
                  class="player-marker"
                  style="background: {team.primary};"
                  draggable="true"
                  ondragstart={(e) => handleDragStart(e, player!.id)}
                >
                  {player?.number}
                </div>
              {:else}
                <div class="empty-zone"></div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
    
    <div>
      <div class="card mb-2">
        <h2>Formations</h2>
        <div class="formation-grid">
          {#each formations as formation, index}
            <button 
              class="formation-btn"
              class:active={selectedFormation === index}
              onclick={() => applyFormation(formation, index)}
            >
              {formation.name}
            </button>
          {/each}
        </div>
        
        <button class="primary mt-1" style="width: 100%">
          🤖 Assistant Manager
        </button>
        <p class="text-sm text-gray mt-1">Auto-optimize formation based on player stats</p>
      </div>
      
      <div class="card">
        <h2>Squad</h2>
        <p class="text-sm text-gray mb-1">Drag players to positions on the pitch</p>
        
        <div class="bench">
          {#each players.filter(p => p.zone === -1) as player}
            <div 
              class="bench-player"
              draggable="true"
              ondragstart={(e) => handleDragStart(e, player.id)}
            >
              <span class="number">{player.number}</span>
              <span class="name">{player.name}</span>
              <span class="pos">{player.position}</span>
            </div>
          {/each}
          
          {#if players.filter(p => p.zone === -1).length === 0}
            <p class="text-gray text-sm">All players on pitch</p>
          {/if}
        </div>
        
        <div class="player-list mt-1">
          <h3>All Players</h3>
          {#each players as player}
            <div 
              class="player-item"
              draggable="true"
              ondragstart={(e) => handleDragStart(e, player.id)}
            >
              <span class="player-number" style="background: {team.primary}">{player.number}</span>
              <span class="player-name">{player.name}</span>
              <span class="player-pos">{player.position}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .formation-pitch {
    position: relative;
    background: linear-gradient(to bottom, #2d8a4a 0%, #238b41 50%, #2d8a4a 100%);
    border-radius: 8px;
  }
  
  .pitch-lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0.7;
  }
  
  .zone {
    position: absolute;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    z-index: 2;
  }
  
  .zone.hovered .zone-label {
    color: var(--accent);
  }
  
  .zone-label {
    font-size: 0.6rem;
    color: rgba(255,255,255,0.7);
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .player-marker {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 0.8rem;
    border: 2px solid white;
    cursor: grab;
    transition: transform 0.2s;
  }
  
  .player-marker:hover {
    transform: scale(1.1);
  }
  
  .player-marker:active {
    cursor: grabbing;
  }
  
  .empty-zone {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px dashed rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.1);
  }
  
  .formation-grid {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  
  .formation-btn {
    padding: 0.5rem 1rem;
    background: #f8f9fa;
    border: 2px solid transparent;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
  }
  
  .formation-btn.active {
    background: var(--primary);
    color: white;
  }
  
  .bench {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 6px;
    min-height: 60px;
  }
  
  .bench-player {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: white;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: grab;
  }
  
  .bench-player .number {
    width: 20px;
    height: 20px;
    background: var(--primary);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.7rem;
  }
  
  .player-list {
    max-height: 250px;
    overflow-y: auto;
  }
  
  .player-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-bottom: 1px solid #eee;
    cursor: grab;
  }
  
  .player-item:hover {
    background: #f8f9fa;
  }
  
  .player-number {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 0.75rem;
  }
  
  .player-name {
    flex: 1;
    font-size: 0.875rem;
  }
  
  .player-pos {
    color: var(--gray);
    font-size: 0.75rem;
  }
  
  .text-gray {
    color: var(--gray);
  }
</style>
