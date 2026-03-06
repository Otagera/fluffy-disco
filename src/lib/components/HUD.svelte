<script lang="ts">
  import type { TeamProfile } from '../data/types';
  import type { Match } from '../engine/Match';

  let { currentTime, homeTeam, awayTeam } = $props<{
    match: Match;
    currentTime: number;
    homeTeam?: TeamProfile;
    awayTeam?: TeamProfile;
  }>();

  let clockDisplay = $derived.by(() => {
    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });
  
  // These should eventually come from the match engine
  let homeScore = $state(0);
  let awayScore = $state(0);
</script>

<div class="hud-container p-4 sm:p-8">
  <div class="flex justify-center">
    <div class="bg-white border border-light-border rounded-xl shadow-xl overflow-hidden flex items-stretch divide-x divide-light-border h-16 sm:h-20">
      <!-- Home Team -->
      <div class="flex items-center gap-4 px-6 sm:px-8 bg-light-bg/30">
        <div class="w-8 h-10 sm:w-10 sm:h-12 bg-primary rounded-b-2xl shadow-sm border-2 border-white"></div>
        <div class="flex flex-col">
          <span class="text-[0.6rem] font-black subtle uppercase tracking-widest leading-none mb-1">HOME</span>
          <span class="text-lg sm:text-xl font-black tracking-tighter leading-none">{homeTeam?.shortName || homeTeam?.name?.substring(0,3).toUpperCase() || 'HOM'}</span>
        </div>
      </div>

      <!-- Score & Clock -->
      <div class="flex flex-col items-center justify-center px-8 sm:px-12 bg-white min-w-[140px] sm:min-w-[180px]">
        <div class="flex items-center gap-4 sm:gap-6 mb-1">
          <span class="text-3xl sm:text-4xl font-black text-primary tracking-tighter">{homeScore}</span>
          <span class="text-lg font-black text-light-subtle opacity-30">VS</span>
          <span class="text-3xl sm:text-4xl font-black text-danger tracking-tighter">{awayScore}</span>
        </div>
        <div class="text-[0.7rem] sm:text-xs font-black text-primary bg-primary/5 px-3 py-0.5 rounded-full tracking-[0.2em]">{clockDisplay}</div>
      </div>

      <!-- Away Team -->
      <div class="flex items-center gap-4 px-6 sm:px-8 bg-light-bg/30">
        <div class="flex flex-col text-right">
          <span class="text-[0.6rem] font-black subtle uppercase tracking-widest leading-none mb-1">AWAY</span>
          <span class="text-lg sm:text-xl font-black tracking-tighter leading-none">{awayTeam?.shortName || awayTeam?.name?.substring(0,3).toUpperCase() || 'AWY'}</span>
        </div>
        <div class="w-8 h-10 sm:w-10 sm:h-12 bg-danger rounded-b-2xl shadow-sm border-2 border-white"></div>
      </div>
    </div>
  </div>
</div>

<style>
  .hud-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    pointer-events: none;
    z-index: 100;
  }
</style>
