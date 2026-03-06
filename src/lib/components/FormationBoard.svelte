<script lang="ts">
  import { formations } from '$lib/game/formations';
  import { getTacticalRole } from '$lib/game/rules';
  import type { PlayerProfile, TeamProfile } from '$lib/data/types';
  import PlayerModal from '$lib/components/PlayerModal.svelte';

  let { 
    team, 
    players, 
    editable = false,
    allowRoleOverrides = false,
    allowPositionOverrides = false,
    isHome = true, 
    onSwap = () => {},
    onFormationChange = () => {},
    onOverridesChange = () => {}
  }: { 
    team: TeamProfile, 
    players: PlayerProfile[], 
    editable?: boolean,
    allowRoleOverrides?: boolean,
    allowPositionOverrides?: boolean,
    isHome?: boolean,
    onSwap?: (id1: string, id2: string) => void,
    onFormationChange?: (name: string) => void,
    onOverridesChange?: (positions: Record<number, {x: number, y: number}>, roles: Record<number, string>) => void
  } = $props();

  const startingXI = $derived(players.slice(0, 11));
  const bench = $derived(players.slice(11));

  const baseFormationPositions = $derived(formations[team.formation] || formations['4-4-2 Wide']);

  let customPositions = $state<Record<number, {x: number, y: number}>>({});
  let customRoles = $state<Record<number, string>>({});

  // Unified Pitch Player State for reactivity
  const pitchPlayers = $derived(baseFormationPositions.map((basePos, i) => ({
    basePos,
    player: startingXI[i],
    displayedRole: customRoles[i] || getAutoRole(i, basePos.role)
  })));
  
  // HTML5 Drag State (List)
  let draggedPlayerId = $state<string | null>(null);
  
  // Pointer Drag State (Pitch)
  let svgElement: SVGSVGElement | null = $state(null);
  let pitchDraggingIdx = $state<number | null>(null);
  let dragX = $state<number | null>(null);
  let dragY = $state<number | null>(null);
  let dragOffsetX = $state(0);
  let dragOffsetY = $state(0);
  
  // Hover state for both HTML5 and Pointer drags
  let hoveredSlotIndex = $state<number | null>(null);

  let selectedPlayerForModal = $state<PlayerProfile | null>(null);

  $effect(() => {
    onOverridesChange(customPositions, customRoles);
  });

  function getAvailableRoles(baseRole: string) {
    if (baseRole === 'GK') return ['GK'];
    if (baseRole === 'DEF') return ['CB', 'FB', 'WB', 'BWM'];
    if (baseRole === 'MID') return ['BWM', 'DLP', 'MEZ', 'B2B', 'AM', 'WM'];
    if (baseRole === 'FWD') return ['ST', 'IF', 'W', 'AF', 'TM', 'AM'];
    return [];
  }

  function getAutoRole(idx: number, baseRole: string) {
    const pos = getPos(idx);
    const isWide = pos.y < 0.3 || pos.y > 0.7;
    const isAdvanced = isHome ? pos.x > 0.35 : (1 - pos.x) > 0.35;
    return getTacticalRole(baseRole, idx, isWide, team.formation, isAdvanced);
  }

  function getPos(idx: number) {
    if (customPositions[idx] && allowPositionOverrides) return customPositions[idx];
    return baseFormationPositions[idx] || { x: 0.5, y: 0.5, role: 'MID' };
  }

  function resetOverrides() {
    customPositions = {};
    customRoles = {};
  }

  // --- HTML5 Native Drag & Drop (Squad List <-> Pitch) ---
  function handleListDragStart(e: DragEvent, id: string) {
    if (!editable) return;
    draggedPlayerId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDropOnPlayer(e: DragEvent, targetId: string) {
    if (!editable || !draggedPlayerId) return;
    e.preventDefault();
    if (draggedPlayerId !== targetId) {
      onSwap(draggedPlayerId, targetId);
    }
    draggedPlayerId = null;
    hoveredSlotIndex = null;
  }

  function handleSvgDragOver(e: DragEvent) {
    if (!editable || !draggedPlayerId || !svgElement) return;
    e.preventDefault();
    
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const screenCTM = svgElement.getScreenCTM();
    if (!screenCTM) return;
    const svgP = pt.matrixTransform(screenCTM.inverse());
    
    const nx = svgP.x / 105;
    const ny = svgP.y / 68;

    let closestIdx = -1;
    let minDist = Infinity;

    for (let i = 0; i < 11; i++) {
      const pos = getPos(i);
      const dx = pos.x - nx;
      const dy = pos.y - ny;
      const aspectDist = Math.sqrt(dx*dx + (dy*dy*(68/105)*(68/105))); 
      if (aspectDist < minDist) {
        minDist = aspectDist;
        closestIdx = i;
      }
    }

    if (minDist < 0.1) {
      hoveredSlotIndex = closestIdx;
    } else {
      hoveredSlotIndex = null;
    }
  }

  function handleSvgDrop(e: DragEvent) {
    if (!editable || !draggedPlayerId) return;
    e.preventDefault();
    if (hoveredSlotIndex !== null) {
      const targetPlayer = startingXI[hoveredSlotIndex];
      if (targetPlayer && draggedPlayerId !== targetPlayer.id) {
        onSwap(draggedPlayerId, targetPlayer.id);
      }
    }
    draggedPlayerId = null;
    hoveredSlotIndex = null;
  }

  // --- Pure Pointer Events (Pitch Dots) ---
  function handlePointerDown(e: PointerEvent, idx: number) {
    if (!editable) return;
    if (baseFormationPositions[idx]?.role === 'GK') return; 
    
    pitchDraggingIdx = idx;
    const pos = getPos(idx);
    
    // Explicitly set these BEFORE calculating offsets to ensure reactive coherence
    dragX = pos.x;
    dragY = pos.y;
    dragOffsetX = 0;
    dragOffsetY = 0;
    
    if (svgElement) {
      const pt = svgElement.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const screenCTM = svgElement.getScreenCTM();
      if (screenCTM) {
        const svgP = pt.matrixTransform(screenCTM.inverse());
        dragOffsetX = pos.x - (svgP.x / 105);
        dragOffsetY = pos.y - (svgP.y / 68);
      }
    }
    
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (pitchDraggingIdx === null || !svgElement) return;
    
    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const screenCTM = svgElement.getScreenCTM();
    if (!screenCTM) return;
    const svgP = pt.matrixTransform(screenCTM.inverse());
    
    let nx = (svgP.x / 105) + dragOffsetX; 
    let ny = (svgP.y / 68) + dragOffsetY;
    nx = Math.max(0.05, Math.min(0.95, nx));
    ny = Math.max(0.05, Math.min(0.95, ny));
    
    dragX = nx;
    dragY = ny;

    let closestIdx = -1;
    let minDist = Infinity;
    for (let i = 0; i < 11; i++) {
      if (i === pitchDraggingIdx) continue;
      const pos = getPos(i);
      const dx = pos.x - nx;
      const dy = pos.y - ny;
      const aspectDist = Math.sqrt(dx*dx + (dy*dy*(68/105)*(68/105))); 
      if (aspectDist < minDist) {
        minDist = aspectDist;
        closestIdx = i;
      }
    }

    if (minDist < 0.05) { 
      hoveredSlotIndex = closestIdx;
    } else {
      hoveredSlotIndex = null;
    }
  }

  function handlePointerUp() { 
    if (pitchDraggingIdx === null) return;

    if (hoveredSlotIndex !== null) {
      const p1 = startingXI[pitchDraggingIdx];
      const p2 = startingXI[hoveredSlotIndex];
      if (p1 && p2) {
        onSwap(p1.id, p2.id);
      }
    } else if (allowPositionOverrides && dragX !== null && dragY !== null) {
      customPositions[pitchDraggingIdx] = { x: dragX, y: dragY };
    }
    
    pitchDraggingIdx = null;
    hoveredSlotIndex = null;
    dragX = null;
    dragY = null;
    dragOffsetX = 0;
    dragOffsetY = 0;
  }

  function getStatColor(val: number) {
    if (val >= 16) return 'text-green-600';
    if (val >= 12) return 'text-amber-600';
    return 'text-red-600';
  }
</script>

<div class="flex flex-col gap-6">
  {#if editable}
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div class="flex flex-wrap gap-2">
        {#each Object.keys(formations) as fName}
          <button 
            class="px-3 py-1.5 rounded-lg text-xs font-black transition-all border {team.formation === fName ? 'bg-primary text-white border-primary shadow-md scale-105' : 'bg-white text-light-subtle border-light-border hover:bg-light-bg'}"
            onclick={() => {
              resetOverrides();
              onFormationChange(fName);
            }}
          >
            {fName}
          </button>
        {/each}
      </div>
      {#if allowPositionOverrides || allowRoleOverrides}
        <button class="text-xs font-black text-danger hover:underline px-3 py-1" onclick={resetOverrides}>
          Reset Overrides
        </button>
      {/if}
    </div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Pitch Column (Absolute 105x68 Aspect Ratio) -->
    <div class="lg:col-span-2 relative bg-gradient-to-b from-primary to-primary-light rounded-2xl border border-light-border shadow-inner overflow-hidden p-4" style="aspect-ratio: 105 / 68;">
      <!-- Pitch Lines -->
      <svg 
        bind:this={svgElement} 
        class="absolute inset-0 w-full h-full" 
        viewBox="0 0 105 68" 
        onpointermove={handlePointerMove} 
        onpointerup={handlePointerUp} 
        onpointercancel={handlePointerUp} 
        onpointerleave={handlePointerUp}
        ondragover={handleSvgDragOver}
        ondrop={handleSvgDrop}
      >
        <rect x="0" y="0" width="105" height="68" fill="transparent" />
        <g stroke="white" stroke-width="0.3" opacity="0.4">
          <rect x="0" y="0" width="105" height="68" fill="none" />
          <line x1="52.5" y1="0" x2="52.5" y2="68" />
          <circle cx="52.5" cy="34" r="9.15" fill="none" />
          <rect x="0" y="13.84" width="16.5" height="40.32" fill="none" />
          <rect x="88.5" y="13.84" width="16.5" height="40.32" fill="none" />
          <rect x="0" y="24.84" width="5.5" height="18.32" fill="none" />
          <rect x="99.5" y="24.84" width="5.5" height="18.32" fill="none" />
        </g>

        <!-- Player Dots -->
        {#each pitchPlayers as { basePos, player, displayedRole }, i}
          {@const isDraggingThis = pitchDraggingIdx === i}
          {@const pos = isDraggingThis ? { x: dragX!, y: dragY! } : getPos(i)}
          {@const isHoveredSlot = hoveredSlotIndex === i}
          
          <g 
            transform="translate({pos.x * 105}, {pos.y * 68})" 
            onpointerdown={(e) => handlePointerDown(e, i)}
            style="cursor: {!editable ? 'default' : basePos.role !== 'GK' ? 'grab' : 'pointer'}; touch-action: none;"
          >
            <!-- Invisible hit target to make pointer grabbing easier without missing the dot -->
            <circle r="4" fill="transparent" />

            <circle 
              r={isHoveredSlot ? 3.2 : isDraggingThis ? 2.8 : 2.2} 
              cx="0" cy="0"
              fill={isHoveredSlot ? 'var(--accent)' : isDraggingThis ? '#e2e8f0' : 'white'} 
              stroke="var(--primary)" 
              stroke-width="0.5" 
              opacity={isDraggingThis ? 0.8 : 1}
              class="transition-all duration-100"
            />
            <text y="0.8" font-size="2" font-weight="900" fill="var(--primary)" text-anchor="middle" pointer-events="none">
              {player?.role === 'GK' ? 'GK' : (player?.number || i + 1)}
            </text>
            
            <!-- Dark background for text to ensure readability -->
            <rect x="-8" y="2.5" width="16" height="4" fill="rgba(0,0,0,0.4)" rx="1" pointer-events="none" />
            <text y="4.5" font-size="1.8" font-weight="900" fill="white" text-anchor="middle" pointer-events="none">
              {player?.name.split(' ').pop()}
            </text>
            <text y="6" font-size="1.2" font-weight="bold" fill="#ffeb3b" text-anchor="middle" pointer-events="none uppercase tracking-widest">
              {displayedRole}
            </text>

            {#if player && player.condition < 60}
              <circle cx="1.5" cy="-1.5" r="0.6" fill="#ef4444" stroke="white" stroke-width="0.2" pointer-events="none" />
            {/if}
          </g>
        {/each}
      </svg>
    </div>

    <!-- Squad List Column -->
    <div class="flex flex-col gap-4">
      <div class="bg-white border border-light-border rounded-xl p-4 shadow-sm flex-1 flex flex-col max-h-[750px] overflow-hidden">
        <h3 class="text-xs font-black subtle uppercase tracking-widest border-b border-light-border pb-2 mb-3">Starting XI</h3>
        <div class="space-y-1.5 overflow-y-auto pr-1 flex-1">
          {#each startingXI as player, i}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
              class="flex items-center gap-3 p-2.5 rounded-lg border border-transparent transition-colors cursor-pointer hover:bg-light-bg group {draggedPlayerId === player.id ? 'opacity-40 grayscale border-dashed border-gray-300' : ''} {hoveredSlotIndex === i && draggedPlayerId ? 'bg-primary/10 border-primary' : ''}"
              draggable={editable}
              ondragstart={(e) => handleListDragStart(e, player.id)}
              ondragover={(e) => { e.preventDefault(); hoveredSlotIndex = i; }}
              ondragleave={() => { if (hoveredSlotIndex === i) hoveredSlotIndex = null; }}
              ondrop={(e) => handleDropOnPlayer(e, player.id)}
              onclick={() => selectedPlayerForModal = player}
            >
              <span class="w-5 text-center font-black text-[0.65rem] text-primary">{player.number || (i + 1)}</span>
              
              <div class="w-1 h-7 rounded-full" class:bg-green-500={player.condition > 60} class:bg-amber-500={player.condition <= 60 && player.condition > 40} class:bg-red-500={player.condition <= 40}></div>
              
              {#if allowRoleOverrides}
                <select 
                  class="text-[0.6rem] font-black bg-white border border-light-border text-light-text rounded px-1 py-0.5 w-16 uppercase hover:border-primary" 
                  bind:value={customRoles[i]} 
                  onclick={(e) => e.stopPropagation()}
                >
                  <option value="">{getAutoRole(i, baseFormationPositions[i]?.role || 'MID')}</option>
                  {#each getAvailableRoles(baseFormationPositions[i]?.role || 'MID') as r}
                    <option value={r}>{r}</option>
                  {/each}
                </select>
              {:else}
                <span class="text-[0.6rem] font-black text-light-subtle w-8 text-center">{player.role}</span>
              {/if}

              <span class="font-bold text-xs flex-1 truncate">{player.name}</span>
              
              <span class="text-[0.6rem] font-black {getStatColor(player.overall || 0)}">OVR {player.overall}</span>
            </div>
          {/each}
        </div>

        <h3 class="text-xs font-black subtle uppercase tracking-widest border-b border-light-border pb-2 mt-6 mb-3">Bench</h3>
        <div class="space-y-1 overflow-y-auto pr-1 flex-1">
          {#each bench as player, i}
            {@const benchIdx = i + 11}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
              class="flex items-center gap-3 p-2 rounded-lg border border-transparent transition-colors cursor-pointer hover:bg-light-bg group {draggedPlayerId === player.id ? 'opacity-40 grayscale border-dashed border-gray-300' : ''} {hoveredSlotIndex === benchIdx && draggedPlayerId ? 'bg-primary/10 border-primary' : ''}"
              draggable={editable}
              ondragstart={(e) => handleListDragStart(e, player.id)}
              ondragover={(e) => { e.preventDefault(); hoveredSlotIndex = benchIdx; }}
              ondragleave={() => { if (hoveredSlotIndex === benchIdx) hoveredSlotIndex = null; }}
              ondrop={(e) => handleDropOnPlayer(e, player.id)}
              onclick={() => selectedPlayerForModal = player}
            >
              <span class="w-5 text-center font-black text-[0.65rem] subtle">{player.number || (benchIdx + 1)}</span>
              
              <div class="w-1 h-6 rounded-full ml-5" class:bg-green-500={player.condition > 60} class:bg-amber-500={player.condition <= 60 && player.condition > 40} class:bg-red-500={player.condition <= 40}></div>
              
              <span class="text-[0.6rem] font-black text-light-subtle w-8 text-center">{player.role}</span>
              
              <span class="font-bold text-xs flex-1 truncate opacity-80 group-hover:opacity-100">{player.name}</span>
              
              <span class="text-[0.6rem] font-black {getStatColor(player.overall || 0)} opacity-80 group-hover:opacity-100">OVR {player.overall}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

{#if selectedPlayerForModal}
  <PlayerModal player={selectedPlayerForModal} onclose={() => selectedPlayerForModal = null} />
{/if}