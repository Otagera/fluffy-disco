<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const roleOrder = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const;
  const sortedTeams = $derived([...(data.teams ?? [])].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)));

  let selectedTeamId = $state<string | null>(null);
  let selectedPlayerId = $state<string | null>(null);

  $effect(() => {
    if (!selectedTeamId && sortedTeams.length > 0) selectedTeamId = sortedTeams[0].id;
  });

  const selectedTeam = $derived(sortedTeams.find((team) => team.id === selectedTeamId) ?? null);
  const selectedTeamPlayers = $derived(
    selectedTeam
      ? selectedTeam.players
          .map((id) => data.players[id])
          .filter(Boolean)
          .sort((a, b) => {
            const roleDelta = roleOrder[a.role] - roleOrder[b.role];
            if (roleDelta !== 0) return roleDelta;
            return (b.overall ?? 0) - (a.overall ?? 0);
          })
      : []
  );

  const probableXI = $derived(selectedTeamPlayers.slice(0, 11));
  const bench = $derived(selectedTeamPlayers.slice(11, 20));
  const selectedPlayer = $derived(selectedTeamPlayers.find((player) => player.id === selectedPlayerId) ?? null);

  function getOverallColor(overall: number) {
    if (overall >= 16) return 'elite';
    if (overall >= 13) return 'strong';
    if (overall >= 10) return 'average';
    return 'raw';
  }
</script>

<div class="container">
  <div class="header mb-2">
    <div>
      <h1>Squad Hub</h1>
      <p class="subtle">League-stratified squads with matchday XI and realistic bench depth.</p>
    </div>
  </div>

  {#if !data.hasSave}
    <div class="card"><h2>No Career Found</h2><p class="subtle">Start a new career from Home first.</p></div>
  {:else}
    <div class="grid grid-2 gap-2">
      <div class="card light">
        <h2>Clubs by Overall</h2>
        <div class="team-list">
          {#each sortedTeams as team}
            <button class="team-card" class:selected={team.id === selectedTeamId} onclick={() => { selectedTeamId = team.id; selectedPlayerId = null; }}>
              <div>
                <div class="team-name">{team.name}</div>
                <div class="subtle">Rep {team.reputation}</div>
              </div>
              <span class="pill {getOverallColor(team.overall ?? 1)}">OVR {team.overall ?? 1}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="card light">
        {#if selectedTeam}
          <div class="flex justify-between items-center mb-1">
            <h2>{selectedTeam.name}</h2>
            <span class="pill {getOverallColor(selectedTeam.overall ?? 1)}">Team OVR {selectedTeam.overall ?? 1}</span>
          </div>

          <h3 class="section-title">Probable XI</h3>
          <div class="player-list">
            {#each probableXI as player}
              <button class="player-row" class:selected={player.id === selectedPlayerId} onclick={() => selectedPlayerId = player.id === selectedPlayerId ? null : player.id}>
                <span class="player-name">{player.name}</span>
                <span class="player-meta">{player.role} · Age {player.age}</span>
                <span class="pill {getOverallColor(player.overall ?? 1)}">{player.overall ?? 1}</span>
              </button>
            {/each}
          </div>

          <h3 class="section-title mt-2">Bench ({bench.length})</h3>
          <div class="player-list small">
            {#each bench as player}
              <button class="player-row" onclick={() => selectedPlayerId = player.id}>
                <span class="player-name">{player.name}</span>
                <span class="player-meta">{player.role}</span>
                <span class="pill {getOverallColor(player.overall ?? 1)}">{player.overall ?? 1}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#if selectedPlayer}
      <div class="card light mt-2">
        <div class="flex justify-between items-center mb-1">
          <h3>{selectedPlayer.name}</h3>
          <span class="pill {getOverallColor(selectedPlayer.overall ?? 1)}">Overall {selectedPlayer.overall ?? 1}</span>
        </div>
        <p class="subtle">{selectedPlayer.role} · Condition {Math.round(selectedPlayer.condition)}% · Potential {selectedPlayer.potential}</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .subtle { color: #5e6878; }
  .light { background: #f7f9fc; border-color: #dce3ee; color: #1e2430; }
  .team-list, .player-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 40vh; overflow: auto; }
  .player-list.small { max-height: 24vh; }
  .team-card, .player-row {
    width: 100%; display: grid; gap: 0.5rem; align-items: center; text-align: left;
    background: white; border: 1px solid #dce3ee; color: #1e2430;
  }
  .team-card { grid-template-columns: 1fr auto; }
  .player-row { grid-template-columns: 1fr auto auto; }
  .team-card.selected, .player-row.selected { border-color: #2d8a4a; background: #eef9f1; }
  .team-name, .player-name { font-weight: 700; color: #161c27; }
  .player-meta { color: #5e6878; font-size: 0.85rem; }
  .section-title { font-size: 1rem; margin: 0.4rem 0; color: #2c3442; }
  .pill { border-radius: 999px; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.55rem; border: 1px solid transparent; }
  .pill.elite { background: rgba(31, 132, 78, 0.13); color: #1f844e; border-color: rgba(31, 132, 78, 0.25); }
  .pill.strong { background: rgba(0, 95, 184, 0.12); color: #005fb8; border-color: rgba(0, 95, 184, 0.25); }
  .pill.average { background: rgba(179, 114, 0, 0.12); color: #9a5f00; border-color: rgba(179, 114, 0, 0.25); }
  .pill.raw { background: rgba(188, 30, 30, 0.12); color: #a61919; border-color: rgba(188, 30, 30, 0.22); }
</style>
