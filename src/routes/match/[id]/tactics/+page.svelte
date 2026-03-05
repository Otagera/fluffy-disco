<script lang="ts">
  import type { PageData } from './$types';
  import { PITCH_W, PITCH_H } from '$lib/game/constants';
  import { formations } from '$lib/game/formations';
  import { getTacticalRole } from '$lib/game/rules';
  import { onMount } from 'svelte';

  let { data }: { data: PageData } = $props();
  
  const isHome = data.managerTeamId === data.homeTeam.id;
  const myTeam = isHome ? data.homeTeam : data.awayTeam;
  const opponentTeam = isHome ? data.awayTeam : data.homeTeam;
  
  // Local state for the user's squad (allows pre-match subbing)
  let squad = $state([...(isHome ? data.homePlayers : data.awayPlayers)]);
  let startingXI = $derived(squad.slice(0, 11));
  let bench = $derived(squad.slice(11));
  
  let selectedFormation = $state(myTeam.formation);
  let selectedStyle = $state(myTeam.tacticalStyle);
  let selectedMentality = $state(myTeam.mentality || 'BALANCED');
  
  let customPositions = $state<Record<number, {x: number, y: number}>>({});
  let customRoles = $state<Record<number, string>>({});

  let selectedStarterIndex = $state<number | null>(null);
  let selectedBenchIndex = $state<number | null>(null);
  let detailedPlayer = $state<any>(null);

  let svgElement: SVGSVGElement;
  let draggingIdx = $state<number | null>(null);

  const activePos = $derived(formations[selectedFormation] || formations['4-4-2 Wide']);

  onMount(() => {
    // Scroll to top
    window.scrollTo(0, 0);
  });

  function getStatColor(val: number) {
    if (val >= 15) return '#4caf50';
    if (val >= 10) return '#ffeb3b';
    return '#ff5722';
  }

  function handleSub() {
    if (selectedStarterIndex !== null && selectedBenchIndex !== null) {
      const newSquad = [...squad];
      const starterIdx = selectedStarterIndex;
      const benchIdx = selectedBenchIndex + 11;
      
      const temp = newSquad[starterIdx];
      newSquad[starterIdx] = newSquad[benchIdx];
      newSquad[benchIdx] = temp;
      
      squad = newSquad;
      selectedStarterIndex = null;
      selectedBenchIndex = null;
    }
  }

  function getAvailableRoles(role: string) {
    if (role === 'GK') return ['GK'];
    if (role === 'DEF') return ['CB', 'FB', 'WB', 'BWM'];
    if (role === 'MID') return ['BWM', 'DLP', 'MEZ', 'B2B', 'AM', 'WM'];
    if (role === 'FWD') return ['ST', 'IF', 'W', 'AF', 'TM', 'AM'];
    return [];
  }

  function getAutoRole(idx: number, role: string) {
    const pos = activePos[idx];
    const isWide = pos.y < 0.3 || pos.y > 0.7;
    const isAdvanced = isHome ? pos.x > 0.35 : (1 - pos.x) > 0.35;
    return getTacticalRole(role, idx, isWide, selectedFormation, isAdvanced);
  }

  function getPos(idx: number) {
    if (customPositions[idx]) return customPositions[idx];
    return activePos[idx];
  }

  function handlePointerDown(e: PointerEvent, idx: number) {
    if (activePos[idx].role === 'GK') return;
    draggingIdx = idx;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (draggingIdx === null) return;
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

  const detailedPlayerPoints = $derived.by(() => {
    if (!detailedPlayer) return [];
    return getRadarPoints(detailedPlayer.attributes);
  });

  function getRadarPoints(attr: any, overrideRadius?: number) {
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
      const val = overrideRadius ? 20 : p.value;
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

  function handleConfirm() {
    const payload = {
      isHome,
      formation: selectedFormation,
      style: selectedStyle,
      mentality: selectedMentality,
      customSquad: squad,
      customRoles,
      customPositions
    };
    sessionStorage.setItem('tacticalOverrides', JSON.stringify(payload));
    window.location.href = `/match/${data.fixture.id}`;
  }
</script>

<div class="container">
  <div class="header-card mb-2">
    <div class="flex justify-between items-center">
      <div class="team-info">
        <p class="team-meta">HOME TEAM</p>
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
          <div class="team-meta mt-1">{data.homeTeam.tacticalStyle} • {data.homeTeam.formation}</div>
          <div class="text-xs text-gray uppercase tracking-widest">{data.homeTeam.mentality.replace('_', ' ')}</div>
        {/if}
      </div>

      <div class="vs-container">
        <div class="vs">VS</div>
      </div>

      <div class="team-info text-right">
        <p class="team-meta">AWAY TEAM</p>
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
          <div class="team-meta mt-1">{data.awayTeam.tacticalStyle} • {data.awayTeam.formation}</div>
          <div class="text-xs text-gray uppercase tracking-widest">{data.awayTeam.mentality.replace('_', ' ')}</div>
        {/if}
      </div>
    </div>
  </div>

  <div class="grid grid-2 gap-2">
    <div class="card lineup-panel">
      <div class="flex justify-between items-center mb-2">
        <h2 style="margin: 0;">Matchday Squad</h2>
        <button class="secondary btn-sm" disabled={selectedStarterIndex === null || selectedBenchIndex === null} onclick={handleSub}>
          SWAP PLAYERS
        </button>
      </div>
      
      <h3 class="mb-1 text-gray" style="font-size: 0.8rem; letter-spacing: 1px;">STARTING XI</h3>
      <div class="player-list mb-3">
        {#each startingXI as player, i}
          <div class="player-row {selectedStarterIndex === i ? 'selected' : ''}" onclick={() => selectedStarterIndex = selectedStarterIndex === i ? null : i}>
            <span class="number">{i + 1}</span>
            <div class="cond-bar" style="background: {player.condition > 50 ? '#4caf50' : player.condition > 30 ? '#ffeb3b' : '#f44336'};"></div>
            <select class="role-select" bind:value={customRoles[i]} onclick={(e) => e.stopPropagation()}>
              <option value="">{getAutoRole(i, activePos[i]?.role || 'MID')} (Auto)</option>
              {#each getAvailableRoles(activePos[i]?.role || 'MID') as r}
                <option value={r}>{r}</option>
              {/each}
            </select>
            <span class="name">{player.name}</span>
            <div class="mini-stats">
              <span style="color: {getStatColor(player.attributes.passing)}">PAS {player.attributes.passing}</span>
              <span style="color: {getStatColor(player.attributes.shooting)}">SHO {player.attributes.shooting}</span>
              <span style="color: {getStatColor(player.attributes.pace)}">PAC {player.attributes.pace}</span>
              <button class="info-btn" onclick={(e) => { e.stopPropagation(); openDetailedPlayer(player); }}>ℹ️</button>
            </div>
          </div>
        {/each}
      </div>

      <h3 class="mb-1 text-gray" style="font-size: 0.8rem; letter-spacing: 1px;">BENCH</h3>
      <div class="player-list">
        {#each bench as player, i}
          <div class="player-row {selectedBenchIndex === i ? 'selected' : ''}" onclick={() => selectedBenchIndex = selectedBenchIndex === i ? null : i}>
            <div class="cond-bar" style="background: {player.condition > 50 ? '#4caf50' : player.condition > 30 ? '#ffeb3b' : '#f44336'};"></div>
            <span class="role-badge" style="margin-left: 10px;">{player.role}</span>
            <span class="name">{player.name}</span>
            <div class="mini-stats">
              <span style="color: {getStatColor(player.attributes.passing)}">PAS {player.attributes.passing}</span>
              <span style="color: {getStatColor(player.attributes.shooting)}">SHO {player.attributes.shooting}</span>
              <button class="info-btn" onclick={(e) => { e.stopPropagation(); openDetailedPlayer(player); }}>ℹ️</button>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="pitch-preview">
      <div class="card" style="width: 100%;">
        <h2 class="text-center mb-1">Tactical Board</h2>
        <p class="text-center text-xs text-gray mb-2">Drag icons to customize positional anchors</p>
        <div class="preview-container">
          <svg bind:this={svgElement} viewBox="0 0 {PITCH_W} {PITCH_H}" class="mini-pitch" onpointermove={handlePointerMove} onpointerup={handlePointerUp} onpointercancel={handlePointerUp} onpointerleave={handlePointerUp}>
            <rect width={PITCH_W} height={PITCH_H} fill="#267a41" rx="2" />
            <line x1={PITCH_W/2} y1="0" x2={PITCH_W/2} y2={PITCH_H} stroke="rgba(255,255,255,0.2)" stroke-width="0.5" />
            <circle cx={PITCH_W/2} cy={PITCH_H/2} r="9.15" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="0.5" />
            
            {#each activePos as _, i}
              {@const pos = getPos(i)}
              <g transform="translate({(isHome ? pos.x : 1 - pos.x) * PITCH_W}, {pos.y * PITCH_H})" onpointerdown={(e) => handlePointerDown(e, i)} style="cursor: {activePos[i].role === 'GK' ? 'default' : 'grab'}; touch-action: none;">
                <circle r="3" fill={draggingIdx === i ? 'var(--accent)' : 'var(--primary)'} stroke="white" stroke-width="0.5" />
                <text y="0.5" font-size="1.8" text-anchor="middle" fill={draggingIdx === i ? '#111' : 'white'} font-weight="900" pointer-events="none">{startingXI[i]?.number || i+1}</text>
                <text y="5" font-size="1.2" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-weight="bold" pointer-events="none">{activePos[i].role}</text>
              </g>
            {/each}
          </svg>
        </div>
        
        <button class="kickoff-btn mt-3" onclick={handleConfirm}>
          CONFIRM TACTICS & START
        </button>
      </div>
    </div>
  </div>
</div>

{#if detailedPlayer}
  <div class="modal-overlay" onclick={() => detailedPlayer = null}>
    <div class="player-modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div>
          <h2>{detailedPlayer.name}</h2>
          <p>{detailedPlayer.role} • {detailedPlayer.age} years old</p>
        </div>
        <button class="close-btn" onclick={() => detailedPlayer = null}>&times;</button>
      </div>
      <div class="modal-content">
        <div class="modal-grid">
          <div class="radar-section">
            <div class="radar-container">
              <svg viewBox="0 0 120 120" class="radar-chart">
                {#each [0.2, 0.4, 0.6, 0.8, 1.0] as scale}
                  <polygon points={getRadarPoints({}, 40 * scale).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#333" stroke-width="0.5" />
                {/each}
                {#each detailedPlayerPoints as p}
                  <line x1="60" y1="60" x2={p.outerX} y2={p.outerY} stroke="#444" stroke-width="0.5" />
                  <text x={p.labelX} y={p.labelY} font-size="4.5" text-anchor="middle" fill="#888" font-weight="bold" alignment-baseline="middle">{p.label}</text>
                {/each}
                <polygon points={detailedPlayerPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(45, 138, 74, 0.4)" stroke="var(--primary-light)" stroke-width="2" stroke-linejoin="round" />
              </svg>
            </div>
          </div>
          <div class="attributes-grid">
            {#each Object.entries(detailedPlayer.attributes) as [key, val]}
              {#if typeof val === 'number'}
                <div class="attr-row">
                  <span class="attr-label">{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
                  <span class="attr-value" style="color: {getStatColor(val as number)}">{val}</span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .container { max-width: 1280px; margin: 0 auto; padding: 2rem; }
  
  .header-card {
    background: linear-gradient(135deg, #111 0%, #050505 100%);
    border: 1px solid #222;
    padding: 2.5rem;
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
  }

  .team-info h1 { margin: 0; font-size: 2.5rem; font-weight: 900; letter-spacing: -1.5px; }
  .team-meta { color: var(--gray); font-weight: 900; font-size: 0.7rem; letter-spacing: 2px; text-transform: uppercase; }
  
  .vs-container { display: flex; align-items: center; justify-content: center; padding: 0 3rem; }
  .vs {
    font-size: 1.2rem;
    font-weight: 900;
    color: #888;
    background: #1a1a1a;
    padding: 0.6rem 1.2rem;
    border-radius: 4px;
    border: 1px solid #333;
    box-shadow: var(--shadow-sm);
  }

  .lineup-panel { background: #111; border: 1px solid #222; }
  .player-list { display: flex; flex-direction: column; gap: 0.4rem; }
  .player-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    background: #1a1a1a;
    border-radius: 6px;
    font-size: 0.9rem;
    border: 1px solid #222;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.1s ease;
  }
  .player-row:hover { border-color: #444; background: #222; }
  .player-row.selected { border-color: var(--primary-light); background: rgba(45, 138, 74, 0.15); box-shadow: inset 0 0 10px rgba(45, 138, 74, 0.1); }
  
  .name { font-weight: 800; color: #eee; flex: 1; }
  .number { font-weight: 900; color: var(--primary-light); width: 20px; font-family: monospace; font-size: 1.1rem; }
  
  .cond-bar { width: 4px; height: 100%; position: absolute; left: 0; top: 0; }

  .role-select {
    background: #000;
    color: var(--accent);
    border: 1px solid #333;
    font-size: 0.65rem;
    font-weight: 900;
    padding: 2px 6px;
    border-radius: 3px;
    width: 85px;
    cursor: pointer;
  }

  .role-badge {
    background: #333;
    color: #aaa;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 900;
    width: 35px;
    text-align: center;
  }

  .mini-stats { display: flex; align-items: center; gap: 0.8rem; font-size: 0.7rem; font-weight: 900; }
  
  .info-btn {
    background: #222;
    border: 1px solid #333;
    color: #666;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    cursor: pointer;
  }
  .info-btn:hover { background: #333; color: white; border-color: #555; }

  .preview-container { 
    background: #050505; 
    border: 1px solid #222; 
    border-radius: 8px; 
    padding: 1rem;
    box-shadow: inset 0 0 30px rgba(0,0,0,0.8);
  }
  .mini-pitch { width: 100%; height: auto; display: block; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.5)); }

  .kickoff-btn {
    width: 100%;
    background: var(--primary);
    color: white;
    padding: 1.2rem;
    border-radius: 8px;
    font-size: 1.3rem;
    font-weight: 900;
    border: none;
    cursor: pointer;
    letter-spacing: 2px;
    box-shadow: 0 4px 20px rgba(26, 95, 42, 0.4);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .kickoff-btn:hover { background: var(--primary-light); transform: translateY(-2px); box-shadow: 0 8px 30px rgba(26, 95, 42, 0.5); }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(5px); }
  .player-modal { background: #0a0a0a; width: 850px; border-radius: 12px; border: 1px solid #222; overflow: hidden; }
  .modal-header { padding: 2rem; background: #111; border-bottom: 1px solid #222; display: flex; justify-content: space-between; }
  .attributes-grid { background: #050505; border: 1px solid #111; padding: 1.5rem; border-radius: 12px; }
  .attr-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #111; }
  
  .text-right { text-align: right; }
  .flex { display: flex; }
  .gap-1 { gap: 1rem; }
  .flex-wrap { flex-wrap: wrap; }
  .justify-between { justify-content: space-between; }
  .items-center { align-items: center; }
  .text-gray { color: var(--gray); }
  .text-xs { font-size: 0.75rem; }
  .mt-1 { margin-top: 0.5rem; }
  .mt-2 { margin-top: 1rem; }
  .mt-3 { margin-top: 1.5rem; }
  .mb-1 { margin-bottom: 0.5rem; }
  .mb-2 { margin-bottom: 1rem; }
  .mb-3 { margin-bottom: 1.5rem; }
</style>
