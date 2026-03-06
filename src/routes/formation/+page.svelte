<script lang="ts">
  import type { PageData } from './$types';
  import FormationBoard from '$lib/components/FormationBoard.svelte';
  import { enhance } from '$app/forms';

  let { data }: { data: PageData } = $props();

  let currentTeam = $state({ ...data.team });
  let currentPlayers = $state([...data.players]);
  let currentPositions = $state(data.team.customPositions || {});
  let currentRoles = $state(data.team.customRoles || {});

  function handleSwap(id1: string, id2: string) {
    const idx1 = currentPlayers.findIndex(p => p.id === id1);
    const idx2 = currentPlayers.findIndex(p => p.id === id2);
    
    if (idx1 !== -1 && idx2 !== -1) {
      const newPlayers = [...currentPlayers];
      const temp = newPlayers[idx1];
      newPlayers[idx1] = newPlayers[idx2];
      newPlayers[idx2] = temp;
      currentPlayers = newPlayers;
    }
  }

  function handleFormationChange(name: string) {
    currentTeam.formation = name;
    // Clearing overrides when base formation changes is handled by the board component
    // but we should sync it here if we want to save the cleared state.
  }

  function handleOverridesChange(positions: Record<number, {x: number, y: number}>, roles: Record<number, string>) {
    currentPositions = positions;
    currentRoles = roles;
  }

  function resetPositions() {
    currentTeam.formation = data.team.formation;
    currentPlayers = [...data.players];
    currentPositions = data.team.customPositions || {};
    currentRoles = data.team.customRoles || {};
  }
</script>

<div class="max-w-6xl mx-auto p-4 sm:p-8">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
    <div>
      <a href="/" class="text-[0.6rem] font-black text-primary hover:underline mb-2 flex items-center gap-1 uppercase tracking-tighter">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to Hub
      </a>
      <h1 class="mb-1 text-4xl font-black tracking-tighter">Club Tactics</h1>
      <p class="subtle font-bold text-sm">Define your default tactical shape and starting XI for {data.team.name}.</p>
    </div>
    
    <div class="flex gap-3">
      <button class="btn-secondary px-6" onclick={resetPositions}>Discard Changes</button>
      <form method="POST" action="?/saveTactics" use:enhance>
        <input type="hidden" name="formation" value={currentTeam.formation} />
        <input type="hidden" name="playerIds" value={JSON.stringify(currentPlayers.map(p => p.id))} />
        <input type="hidden" name="customPositions" value={JSON.stringify(currentPositions)} />
        <input type="hidden" name="customRoles" value={JSON.stringify(currentRoles)} />
        <button type="submit" class="btn-primary px-8 shadow-lg ring-4 ring-primary/10 font-black">SAVE TACTICS</button>
      </form>
    </div>
  </div>

  <div class="card bg-white border-t-4 border-t-primary shadow-xl">
    <div class="mb-6 border-b border-light-border pb-4 flex justify-between items-center">
      <h2 class="text-xl font-black mb-0">Master Team Strategy</h2>
      <div class="flex items-center gap-2">
        <span class="text-[0.6rem] font-black subtle uppercase tracking-widest">Active System:</span>
        <span class="bg-primary text-white text-[0.7rem] px-2 py-0.5 rounded font-black">{currentTeam.formation}</span>
      </div>
    </div>

    <FormationBoard 
      team={currentTeam} 
      players={currentPlayers} 
      editable={true} 
      allowPositionOverrides={true}
      allowRoleOverrides={true}
      onSwap={handleSwap}
      onFormationChange={handleFormationChange}
      onOverridesChange={handleOverridesChange}
    />
  </div>

  <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="card p-6 bg-light-bg/50 border-dashed">
      <h3 class="text-xs font-black uppercase tracking-widest mb-3">Dragging Tip</h3>
      <p class="text-xs subtle leading-relaxed">Drag player icons on the pitch to swap or fine-tune positions. The top 11 in the squad list are your matchday starters.</p>
    </div>
    <div class="card p-6 bg-light-bg/50 border-dashed">
      <h3 class="text-xs font-black uppercase tracking-widest mb-3">System Overrides</h3>
      <p class="text-xs subtle leading-relaxed">Custom positions and roles saved here will become your team's new default for every match.</p>
    </div>
    <div class="card p-6 bg-light-bg/50 border-dashed">
      <h3 class="text-xs font-black uppercase tracking-widest mb-3">Squad Numbers</h3>
      <p class="text-xs subtle leading-relaxed">Players now have fixed squad numbers. Swapping positions on the pitch or in the list will correctly move the player and their number.</p>
    </div>
  </div>
</div>
