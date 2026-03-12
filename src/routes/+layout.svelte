<script lang="ts">
import "../app.css";
let { data, children } = $props();
</script>

{#if data.hasSave}
  <nav class="bg-dark text-white border-b border-white/5 py-3 px-8 flex justify-between items-center sticky top-0 z-[100]">
    <div class="flex items-center gap-8">
      <a href="/" class="text-lg font-black tracking-tighter flex items-center gap-2 hover:text-primary transition-colors">
        <svg viewBox="0 0 100 100" class="w-6 h-6">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="8"/>
          <path d="M50 5 L75 25 L85 55 L65 80 L35 80 L15 55 L25 25 Z" fill="none" stroke="currentColor" stroke-width="4"/>
        </svg>
        FOOTBALL SIM
      </a>
      <div class="h-4 w-[1px] bg-white/20"></div>
      <div class="flex items-center gap-6 text-[0.65rem] font-black uppercase tracking-widest text-light-subtle">
        <a href="/league" class="hover:text-white transition-colors">Overview</a>
        <a href="/scouting" class="hover:text-white transition-colors">Recruitment Hub</a>
        <a href="/formation" class="hover:text-white transition-colors">Tactics</a>
        <a href="/inbox" class="hover:text-white transition-colors flex items-center gap-2">
          Inbox
          {#if data.unreadInboxCount > 0}
            <span class="bg-primary text-white px-1.5 py-0.5 rounded-full text-[0.55rem]">{data.unreadInboxCount}</span>
          {/if}
        </a>
      </div>
    </div>

    <div class="flex items-center gap-6">
      <div class="flex flex-col items-end leading-none">
        <span class="text-[0.5rem] font-bold text-light-subtle uppercase tracking-widest mb-1">Current Date</span>
        <span class="text-sm font-black text-primary">
          {new Date(data.currentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <div class="h-8 w-[1px] bg-white/10"></div>
      <div class="text-right">
        <div class="text-[0.6rem] font-bold text-light-subtle uppercase tracking-widest leading-none mb-1">{data.manager.name}</div>
        <div class="text-[0.5rem] font-black bg-white/10 px-1.5 py-0.5 rounded uppercase">{data.hasSave ? 'Manager' : ''}</div>
      </div>
    </div>
  </nav>
{/if}

{@render children?.()}
