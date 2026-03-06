<script lang="ts">
  import { onMount } from 'svelte';

  let { player, onclose }: { player: any; onclose: () => void } = $props();

  function getStatColor(val: number) {
    if (val >= 15) return 'text-green-600';
    if (val >= 10) return 'text-amber-600';
    return 'text-red-600';
  }

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

  const playerPoints = $derived(getRadarPoints(player.attributes));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onclick={onclose}>
  <div class="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onclick={(e) => e.stopPropagation()}>
    <div class="p-4 sm:p-6 border-b border-light-border bg-light-bg flex justify-between items-center">
      <div>
        <h2 class="mb-0 text-xl sm:text-2xl font-black">{player.name}</h2>
        <p class="text-sm font-bold text-light-subtle uppercase tracking-widest">
          {player.role} • {player.age} yrs • {player.nationality || 'Local'}
        </p>
      </div>
      <button class="w-8 h-8 rounded-full bg-white border border-light-border flex items-center justify-center font-bold hover:bg-gray-100 transition-colors" onclick={onclose}>&times;</button>
    </div>
    
    <div class="p-4 sm:p-6 overflow-y-auto">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div class="bg-light-bg rounded-xl border border-light-border p-2 sm:p-4 flex items-center justify-center aspect-square">
          <svg viewBox="0 0 120 120" class="w-full h-full max-w-[240px]">
            {#each [0.2, 0.4, 0.6, 0.8, 1.0] as scale}
              <polygon points={getRadarPoints({}, 40 * scale).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#dce3ee" stroke-width="0.5" />
            {/each}
            {#each playerPoints as p}
              <line x1="60" y1="60" x2={p.outerX} y2={p.outerY} stroke="#cbd5e1" stroke-width="0.5" />
              <text x={p.labelX} y={p.labelY} font-size="4" text-anchor="middle" class="fill-light-subtle font-black" alignment-baseline="middle">{p.label}</text>
            {/each}
            <polygon points={playerPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(26, 95, 42, 0.2)" stroke="#1a5f2a" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
        </div>
        
        <div class="space-y-4">
          <div class="flex justify-between items-center bg-white p-3 rounded-lg border border-light-border">
            <span class="text-xs font-black subtle uppercase tracking-wider">Condition</span>
            <span class="font-black {player.condition > 80 ? 'text-green-600' : player.condition > 50 ? 'text-amber-600' : 'text-red-600'}">{Math.round(player.condition)}%</span>
          </div>
          
          <div class="bg-white border border-light-border rounded-xl p-4 shadow-sm">
            <h3 class="text-xs uppercase tracking-widest subtle font-black mb-3 border-b border-light-border pb-1">Attributes</h3>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2">
              {#each Object.entries(player.attributes) as [key, val]}
                {#if typeof val === 'number'}
                  <div class="flex justify-between items-center pb-1 border-b border-gray-50 last:border-0">
                    <span class="font-bold text-light-text capitalize text-[0.7rem]">{key.replace(/([A-Z])/g, ' $1').replace('Attributes', '')}</span>
                    <span class="font-black text-xs {getStatColor(val as number)}">{val}</span>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="p-4 sm:p-6 bg-light-bg border-t border-light-border flex justify-end">
      <button class="btn-secondary py-2 px-8" onclick={onclose}>Close</button>
    </div>
  </div>
</div>