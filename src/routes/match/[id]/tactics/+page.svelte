<script lang="ts">
  import type { PageData } from './$types';
  import { PITCH_W, PITCH_H } from '$lib/game/constants';
  import { formations } from '$lib/game/formations';
  import { getTacticalRole } from '$lib/game/rules';

  let { data }: { data: PageData } = $props();
  
  const isHome = data.managerTeamId === data.homeTeam.id;
  const myTeam = isHome ? data.homeTeam : data.awayTeam;
  const opponentTeam = isHome ? data.awayTeam : data.homeTeam;
  
  // Local state for the user's squad (allows pre-match subbing)
  let squad = $state([...(isHome ? data.homePlayers : data.awayPlayers)]);
  let startingXI = $derived(squad.slice(0, 11));
  let bench = $derived(squad.slice(11));

  // Tactical State
  let selectedFormation = $state(myTeam.formation);
  let selectedStyle = $state(myTeam.tacticalStyle);
  let selectedMentality = $state(myTeam.mentality || 'BALANCED');
  let customRoles = $state<Record<number, string>>({});
  
  // Drag-and-drop Custom Positions
  let customPositions = $state<Record<number, {x: number, y: number}>>({});
  let svgElement = $state<SVGSVGElement | null>(null);
  let draggingIdx = $state<number | null>(null);

  // Detailed View State
  let detailedPlayer = $state<any | null>(null);
  let detailedPlayerPoints = $derived(detailedPlayer ? getRadarPoints(detailedPlayer.attributes) : []);

  // Derive positions based on selected formation
  let activePos = $derived(formations[selectedFormation] || formations['4-4-2 Wide']);

  // Clear custom positions when formation changes
  $effect(() => {
    const f = selectedFormation; // Track dependency
    customPositions = {};
  });

  function getAvailableRoles(baseRole: string) {
    const midRoles = ['DLP', 'BWM', 'MEZ', 'B2B', 'AM', 'WM'];
    const fwdRoles = ['ST', 'AF', 'TM', 'W', 'IF'];
    const defRoles = ['CB', 'FB', 'WB', 'BPD'];
    if (baseRole === 'GK') return ['GK'];
    if (baseRole === 'DEF') return defRoles;
    if (baseRole === 'MID') return midRoles;
    if (baseRole === 'FWD') return fwdRoles;
    return [];
  }

  function getPos(i: number) {
    if (customPositions[i]) return customPositions[i];
    return activePos[i] || { x: 0, y: 0 };
  }

  function getAutoRole(i: number, role: string) {
    const pos = getPos(i);
    if (!pos) return role;
    const isWide = pos.y < 0.3 || pos.y > 0.7;
    const isAdvanced = pos.x > 0.35;
    return getTacticalRole(role, i, isWide, selectedFormation, isAdvanced);
  }

  let selectedStarterIndex = $state<number | null>(null);
  let selectedBenchIndex = $state<number | null>(null);

  function handleSub() {
    if (selectedStarterIndex !== null && selectedBenchIndex !== null) {
      const globalStarterIdx = selectedStarterIndex;
      const globalBenchIdx = selectedBenchIndex + 11;
      
      const temp = squad[globalStarterIdx];
      squad[globalStarterIdx] = squad[globalBenchIdx];
      squad[globalBenchIdx] = temp;
      
      selectedStarterIndex = null;
      selectedBenchIndex = null;
      delete customRoles[globalStarterIdx];
    }
  }

  function getStatColor(val: number) {
    if (val >= 15) return '#4caf50';
    if (val >= 10) return '#ffeb3b';
    return '#ff5722';
  }

  // DRAG LOGIC
  function handlePointerDown(e: PointerEvent, i: number) {
    if (activePos[i].role === 'GK') return; 
    draggingIdx = i;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (draggingIdx === null || !svgElement) return;
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const screenCTM = svgElement.getScreenCTM();
    if (!screenCTM) return;
    const svgP = pt.matrixTransform(screenCTM.inverse());
    let nx = svgP.x / PITCH_W; let ny = svgP.y / PITCH_H;
    nx = Math.max(0.05, Math.min(0.95, nx));
    ny = Math.max(0.05, Math.min(0.95, ny));
    const realX = isHome ? nx : 1 - nx;
    customPositions[draggingIdx] = { x: realX, y: ny };
  }

  function handlePointerUp() { draggingIdx = null; }

  function openDetailedPlayer(p: any) { detailedPlayer = p; }

  // RADAR CHART LOGIC
  function getRadarPoints(attr: any, overrideRadius?: number) {
    // DEBUG: track calls and attribute values to ensure we're getting the correct player
    console.log('getRadarPoints called', {attr, overrideRadius});
    const pillars = [
      { label: 'ATTACK', value: ((attr.finishing || 0) + (attr.composure || 0) + (attr.anticipation || 0)) / 3 },
      { label: 'DEFENSE', value: ((attr.tackling || 0) + (attr.marking || 0) + (attr.positioning || 0)) / 3 },
      { label: 'SPEED', value: ((attr.pace || 0) + (attr.acceleration || 0)) / 2 },
      { label: 'CREATIVITY', value: ((attr.passing || 0) + (attr.vision || 0) + (attr.decisions || 0)) / 3 },
      { label: 'PHYSICAL', value: ((attr.strength || 0) + (attr.stamina || 0) + (attr.workRate || 0)) / 3 },
      { label: 'CONTROL', value: ((attr.dribbling || 0) + (attr.concentration || 0)) / 2 }
    ];

    const centerX = 60;
    const centerY = 60;
    const baseRadius = overrideRadius || 40;

    return pillars.map((p, i) => {
      const angle = (Math.PI * 2 * i) / pillars.length - Math.PI / 2;
      const val = overrideRadius ? 20 : p.value; // For background grid, max out the value
      const r = (val / 20) * baseRadius;
      return {
        x: centerX + Math.cos(angle) * r,
        y: centerY + Math.sin(angle) * r,
        outerX: centerX + Math.cos(angle) * baseRadius,
        outerY: centerY + Math.sin(angle) * baseRadius,
        label: p.label,
        labelX: centerX + Math.cos(angle) * (baseRadius + 14),
        labelY: centerY + Math.sin(angle) * (baseRadius + 14)
      };
    });
  }
</script>

<div class="container">
  <div class="pre-match-header">
    <div class="team-info" style="flex: 1;">
      <h1>{data.homeTeam.name}</h1>
      {#if isHome}
        <div class="flex gap-1 mt-1 flex-wrap">
          <select bind:value={selectedFormation} class="tactic-select" title="Formation">
            {#each Object.keys(formations) as f}
              <option value={f}>{f}</option>
            {/each}
          </select>
          <select bind:value={selectedStyle} class="tactic-select" title="Tactical Style">
            <option>Tiki-Taka</option>
            <option>Gegenpress</option>
            <option>Route One</option>
            <option>Park the Bus</option>
            <option>Fluid Counter</option>
          </select>
          <select bind:value={selectedMentality} class="tactic-select mentality-select" title="Mentality">
            <option value="ULTRA_DEFENSIVE">Ultra Defensive</option>
            <option value="DEFENSIVE">Defensive</option>
            <option value="BALANCED">Balanced</option>
            <option value="ATTACKING">Attacking</option>
            <option value="ULTRA_ATTACKING">Ultra Attacking</option>
          </select>
        </div>
      {:else}
        <p>{data.homeTeam.tacticalStyle} • {data.homeTeam.formation}</p>
        <p class="text-xs text-gray">{data.homeTeam.mentality.replace('_', ' ')}</p>
      {/if}
    </div>

    <div class="vs">VS</div>

    <div class="team-info text-right" style="flex: 1;">
      <h1>{data.awayTeam.name}</h1>
      {#if !isHome}
        <div class="flex gap-1 mt-1 flex-wrap" style="justify-content: flex-end;">
          <select bind:value={selectedMentality} class="tactic-select mentality-select" title="Mentality">
            <option value="ULTRA_DEFENSIVE">Ultra Defensive</option>
            <option value="DEFENSIVE">Defensive</option>
            <option value="BALANCED">Balanced</option>
            <option value="ATTACKING">Attacking</option>
            <option value="ULTRA_ATTACKING">Ultra Attacking</option>
          </select>
          <select bind:value={selectedStyle} class="tactic-select" title="Tactical Style">
            <option>Tiki-Taka</option>
            <option>Gegenpress</option>
            <option>Route One</option>
            <option>Park the Bus</option>
            <option>Fluid Counter</option>
          </select>
          <select bind:value={selectedFormation} class="tactic-select" title="Formation">
            {#each Object.keys(formations) as f}
              <option value={f}>{f}</option>
            {/each}
          </select>
        </div>
      {:else}
        <p>{data.awayTeam.tacticalStyle} • {data.awayTeam.formation}</p>
        <p class="text-xs text-gray">{data.awayTeam.mentality.replace('_', ' ')}</p>
      {/if}
    </div>
  </div>

  <div class="grid grid-2 gap-2 mt-2">
    <div class="card lineup-panel" style="max-height: 800px; overflow-y: auto;">
      <div class="flex justify-between items-center mb-1">
        <h2 style="margin: 0;">Starting XI</h2>
        <button class="secondary-btn" style="padding: 0.25rem 1rem; width: auto;" disabled={selectedStarterIndex === null || selectedBenchIndex === null} onclick={handleSub}>SWAP</button>
      </div>
      <div class="player-list">
        {#each startingXI as player, i}
          <div class="player-row {selectedStarterIndex === i ? 'selected' : ''}" onclick={() => selectedStarterIndex = selectedStarterIndex === i ? null : i} style="cursor: pointer;">
            <span class="number">{i + 1}</span>
            <div class="cond-bar" style="width: 5px; height: 100%; background: {player.condition > 50 ? '#4caf50' : player.condition > 30 ? '#ffeb3b' : '#f44336'}; position: absolute; left: 0; top: 0; border-radius: 6px 0 0 6px;"></div>
            <select class="role-select" bind:value={customRoles[i]} onclick={(e) => e.stopPropagation()}>
              <option value="">{getAutoRole(i, activePos[i]?.role || 'MID')} (Auto)</option>
              {#each getAvailableRoles(activePos[i]?.role || 'MID') as r}
                <option value={r}>{r}</option>
              {/each}
            </select>
            <span class="name">{player.name}{#if player.injury}<span style="color: red; font-size: 0.7rem; margin-left: 0.5rem;">({player.injury.type})</span>{/if}</span>
            <div class="mini-stats">
              <span style="color: {getStatColor(player.attributes.passing)}">PAS {player.attributes.passing}</span>
              <span style="color: {getStatColor(player.attributes.shooting)}">SHO {player.attributes.shooting}</span>
              <span style="color: {getStatColor(player.attributes.pace)}">PAC {player.attributes.pace}</span>
              <button class="info-btn" onclick={(e) => { e.stopPropagation(); openDetailedPlayer(player); }}>ℹ️</button>
            </div>
          </div>
        {/each}
      </div>
      <h2 class="mt-2 mb-1">Bench</h2>
      <div class="player-list">
        {#each bench as player, i}
          <div class="player-row {selectedBenchIndex === i ? 'selected' : ''}" onclick={() => selectedBenchIndex = selectedBenchIndex === i ? null : i} style="cursor: pointer;">
            <div class="cond-bar" style="width: 5px; height: 100%; background: {player.condition > 50 ? '#4caf50' : player.condition > 30 ? '#ffeb3b' : '#f44336'}; position: absolute; left: 0; top: 0; border-radius: 6px 0 0 6px;"></div>
            <span class="role-badge" style="margin-left: 10px;">{player.role}</span>
            <span class="name">{player.name}{#if player.injury}<span style="color: red; font-size: 0.7rem; margin-left: 0.5rem;">({player.injury.type})</span>{/if}</span>
            <div class="mini-stats">
              <span style="color: {getStatColor(player.attributes.passing)}">PAS {player.attributes.passing}</span>
              <span style="color: {getStatColor(player.attributes.shooting)}">SHO {player.attributes.shooting}</span>
              <span style="color: {getStatColor(player.attributes.pace)}">PAC {player.attributes.pace}</span>
              <button class="info-btn" onclick={(e) => { e.stopPropagation(); openDetailedPlayer(player); }}>ℹ️</button>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="card pitch-preview" style="justify-content: flex-start;">
      <p class="text-xs text-gray mb-1">Drag players to customize formation</p>
      <div class="preview-container">
        <svg bind:this={svgElement} viewBox="0 0 {PITCH_W} {PITCH_H}" class="mini-pitch" onpointermove={handlePointerMove} onpointerup={handlePointerUp} onpointercancel={handlePointerUp} onpointerleave={handlePointerUp}>
          <rect width={PITCH_W} height={PITCH_H} fill="#2d8a4a" rx="2" />
          <line x1={PITCH_W/2} y1="0" x2={PITCH_W/2} y2={PITCH_H} stroke="white" stroke-width="0.5" />
          <circle cx={PITCH_W/2} cy={PITCH_H/2} r="9.15" fill="none" stroke="white" stroke-width="0.5" />
          {#each activePos as _, i}
            {@const pos = getPos(i)}
            <g transform="translate({(isHome ? pos.x : 1 - pos.x) * PITCH_W}, {pos.y * PITCH_H})" onpointerdown={(e) => handlePointerDown(e, i)} style="cursor: {activePos[i].role === 'GK' ? 'default' : 'grab'}; touch-action: none;">
              <circle r="2.5" fill={draggingIdx === i ? '#ffeb3b' : 'var(--primary)'} stroke="white" stroke-width="0.4" />
              <text y="0.5" font-size="1.5" text-anchor="middle" fill={draggingIdx === i ? '#111' : 'white'} font-weight="bold" pointer-events="none">{i+1}</text>
              <text y="4" font-size="1.5" text-anchor="middle" fill="rgba(255,255,255,0.9)" pointer-events="none">{customRoles[i] || getAutoRole(i, activePos[i].role)}</text>
            </g>
          {/each}
        </svg>
      </div>
      <div class="actions mt-2" style="width: 100%;">
        <button class="kickoff-btn" onclick={() => {
          const overrides = { formation: selectedFormation, style: selectedStyle, mentality: selectedMentality, customRoles: $state.snapshot(customRoles), customPositions: $state.snapshot(customPositions), customSquad: $state.snapshot(squad), isHome };
          sessionStorage.setItem('tacticalOverrides', JSON.stringify(overrides));
          window.location.href = `/match/${data.fixture.id}`;
        }}>KICK OFF</button>
        <button class="secondary-btn mt-1" onclick={() => window.location.href = '/'}>BACK TO DASHBOARD</button>
      </div>
    </div>
  </div>
</div>

{#if detailedPlayer}
  <div class="modal-overlay" onclick={() => detailedPlayer = null}>
    <div class="player-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div><h2>{detailedPlayer.name}</h2><p>{detailedPlayer.age} years old • {detailedPlayer.role}</p></div>
        <button class="close-btn" onclick={() => detailedPlayer = null}>×</button>
      </div>
      <div class="modal-content">
        <div class="modal-grid">
          <div class="radar-section">
            <div class="radar-container">
              <svg viewBox="0 0 120 120" class="radar-chart">
                <!-- Background Hexagonal Grid -->
                {#each [0.2, 0.4, 0.6, 0.8, 1.0] as scale}
                  <polygon 
                    points={getRadarPoints({}, 40 * scale).map(p => `${p.x},${p.y}`).join(' ')} 
                    fill="none" 
                    stroke="#333" 
                    stroke-width="0.5"
                  />
                {/each}

                {#if detailedPlayer}
                  <!-- Spokes -->
                  {#each detailedPlayerPoints as p}
                    <line x1="60" y1="60" x2={p.outerX} y2={p.outerY} stroke="#444" stroke-width="0.5" />
                  {/each}
                  
                  <!-- Attribute Polygon -->
                  <polygon 
                    points={detailedPlayerPoints.map(p => `${p.x},${p.y}`).join(' ')} 
                    fill="rgba(59, 130, 246, 0.4)" 
                    stroke="#3b82f6" 
                    stroke-width="2"
                    stroke-linejoin="round"
                  />

                  <!-- Labels -->
                  {#each detailedPlayerPoints as p}
                    <text x={p.labelX} y={p.labelY} font-size="4.5" text-anchor="middle" fill="#ccc" font-weight="bold" alignment-baseline="middle">{p.label}</text>
                  {/each}
                {/if}
              </svg>
            </div>
          </div>
          <div class="attributes-grid">
            {#each Object.entries(detailedPlayer.attributes) as [key, val]}
              {#if typeof val === 'number'}
                <div class="attr-row"><span class="attr-label">{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</span><span class="attr-value" style="color: {getStatColor(val as number)}">{val}</span></div>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .pre-match-header { display: flex; justify-content: space-between; align-items: center; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-top: 2rem; }
  .tactic-select { padding: 0.5rem; border-radius: 4px; border: 1px solid #ddd; font-weight: bold; font-size: 0.8rem; }
  .mentality-select { border-left: 4px solid var(--primary); }
  .vs { font-size: 2rem; font-weight: 900; color: #ccc; margin: 0 2rem; }
  .text-right { text-align: right; }
  .lineup-panel { padding: 1.5rem; }
  .player-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .player-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: #f8f9fa; border-radius: 6px; font-size: 0.9rem; border: 2px solid transparent; position: relative; overflow: hidden; }
  .player-row.selected { border-color: var(--primary); background: #e3f2fd; }
  .number { font-weight: 900; color: var(--primary); width: 20px; margin-left: 10px; }
  .role-select { background: #fff; border: 1px solid #ddd; padding: 2px 4px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; width: 80px; }
  .role-badge { background: #ccc; color: #333; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; width: 35px; text-align: center; }
  .name { font-weight: bold; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mini-stats { display: flex; gap: 0.5rem; font-size: 0.7rem; font-weight: 900; align-items: center; }
  .info-btn { background: none; border: none; cursor: pointer; font-size: 1rem; filter: grayscale(1); opacity: 0.5; }
  .info-btn:hover { filter: none; opacity: 1; transform: scale(1.2); }
  .pitch-preview { padding: 1.5rem; display: flex; flex-direction: column; align-items: center; }
  .preview-container { width: 100%; aspect-ratio: 3/2; }
  .mini-pitch { width: 100%; height: 100%; border-radius: 8px; }
  .kickoff-btn { display: block; width: 100%; background: var(--primary); color: white; text-align: center; padding: 1.5rem; border-radius: 8px; font-size: 1.5rem; font-weight: 900; border: none; cursor: pointer; letter-spacing: 2px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); transition: transform 0.1s; }
  .kickoff-btn:active { transform: scale(0.98); }
  .secondary-btn { width: 100%; background: #eee; border: none; padding: 0.75rem; border-radius: 6px; cursor: pointer; font-weight: bold; color: #666; }
  .secondary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .player-modal { background: #1a1a1a; width: 900px; max-width: 95vw; border-radius: 12px; border: 1px solid #333; overflow: hidden; color: white; }
  .modal-header { background: #222; padding: 1.5rem 2rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }
  .modal-header h2 { margin: 0; font-size: 1.8rem; }
  .modal-header p { margin: 0; color: #888; }
  .close-btn { background: none; border: none; color: white; font-size: 2rem; cursor: pointer; }
  
  .modal-content { padding: 2.5rem; }
  .modal-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 3rem; align-items: start; }
  
  .radar-section { background: #111; border-radius: 16px; padding: 2.5rem; border: 1px solid #222; }
  .radar-container { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; }
  .radar-chart { width: 100%; height: 100%; overflow: visible; }
  
  .attributes-grid { display: flex; flex-direction: column; gap: 0.2rem; background: #111; padding: 1.5rem; border-radius: 16px; max-height: 500px; overflow-y: auto; border: 1px solid #222; }
  .attr-row { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #222; font-size: 0.8rem; font-weight: bold; }
  .attr-label { color: #888; }
  
  .flex { display: flex; }
  .gap-1 { gap: 1rem; }
  .mt-1 { margin-top: 1rem; }
  .mt-2 { margin-top: 2rem; }
  .mb-1 { margin-bottom: 1rem; }
  .flex-wrap { flex-wrap: wrap; }
  .text-xs { font-size: 0.75rem; }
  .text-gray { color: #888; }
</style>
