<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';
  import PlayerModal from '$lib/components/PlayerModal.svelte';

  let { data }: { data: PageData } = $props();

  let selectedId = $state(data.messages.length > 0 ? data.messages[0].id : null);
  let selectedMessage = $derived(data.messages.find(m => m.id === selectedId));
  
  let selectedPlayerId = $state<string | null>(null);
  const selectedPlayer = $derived(selectedPlayerId ? data.players[selectedPlayerId] : null);

  const selectedPlayerScoutingLevel = $derived.by(() => {
    if (!selectedPlayerId) return 0;
    const report = (data.scoutingReports || []).find((r: any) => r.playerId === selectedPlayerId && r.teamId === data.managerTeamId);
    return report ? report.level : 0;
  });

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getPlayerIdFromMessage(msg: any) {
    if (!msg || !msg.relatedEntityId) return null;
    if (msg.relatedEntityId.startsWith('offer_') || msg.relatedEntityId.startsWith('cpuoffer_')) {
      const parts = msg.relatedEntityId.split('_');
      return parts.length > 1 ? parts[1] : null;
    }
    return null;
  }
</script>

<div class="max-w-6xl mx-auto p-4 sm:p-8 h-[calc(100vh-100px)] flex flex-col">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
      Inbox
      {#if data.messages.filter(m => !m.isRead).length > 0}
        <span class="bg-primary text-white text-xs px-2 py-1 rounded-full font-black">
          {data.messages.filter(m => !m.isRead).length} New
        </span>
      {/if}
    </h1>
    <a href="/" class="btn-secondary py-2 px-6 uppercase tracking-widest text-xs font-bold">Back to Hub</a>
  </div>

  <div class="flex-1 flex gap-6 min-h-0">
    <!-- Message List -->
    <div class="w-1/3 bg-white border border-light-border rounded-2xl shadow-sm flex flex-col overflow-hidden">
      <div class="p-4 bg-light-bg border-b border-light-border font-black text-[0.65rem] uppercase tracking-widest subtle">
        All Messages
      </div>
      <div class="flex-1 overflow-y-auto">
        {#if data.messages.length === 0}
          <div class="p-12 text-center subtle italic text-sm">Your inbox is empty.</div>
        {:else}
          {#each data.messages as msg}
            <button 
              class="w-full text-left p-4 border-b border-gray-50 transition-colors hover:bg-light-bg/50 relative {selectedId === msg.id ? 'bg-primary/5 ring-inset ring-2 ring-primary/20' : ''}"
              onclick={() => selectedId = msg.id}
            >
              {#if !msg.isRead}
                <div class="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full"></div>
              {/if}
              <div class="flex justify-between items-start mb-1 gap-2">
                <span class="text-[0.6rem] font-black uppercase tracking-widest {msg.isRead ? 'subtle' : 'text-primary'}">{msg.sender}</span>
                <span class="text-[0.6rem] subtle font-bold whitespace-nowrap">{formatDate(msg.date)}</span>
              </div>
              <div class="font-bold text-sm truncate {msg.isRead ? 'text-light-text' : 'text-dark'}">{msg.subject}</div>
              <div class="text-[0.7rem] text-light-subtle truncate mt-0.5">{msg.body}</div>
            </button>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Message Detail -->
    <div class="flex-1 bg-white border border-light-border rounded-2xl shadow-sm flex flex-col overflow-hidden">
      {#if selectedMessage}
        <div class="p-6 border-b border-light-border flex justify-between items-start bg-light-bg/30">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <span class="bg-white border border-light-border px-2 py-0.5 rounded text-[0.6rem] font-black uppercase tracking-widest subtle">{selectedMessage.type}</span>
              <span class="text-xs font-bold subtle">{formatDate(selectedMessage.date)}</span>
            </div>
            <h2 class="text-2xl font-black leading-tight mb-1">{selectedMessage.subject}</h2>
            <p class="text-sm font-bold subtle">From: <span class="text-dark">{selectedMessage.sender}</span></p>
          </div>
          
          <div class="flex gap-2">
            {#if !selectedMessage.isRead}
              <form method="POST" action="?/markRead" use:enhance>
                <input type="hidden" name="id" value={selectedMessage.id} />
                <button class="btn-primary py-2 px-4 text-[0.65rem] uppercase font-black">Mark Read</button>
              </form>
            {/if}
            <form method="POST" action="?/deleteMessage" use:enhance={() => {
              return async ({ result }) => {
                if (result.type === 'success') {
                  const idx = data.messages.findIndex(m => m.id === selectedId);
                  if (idx !== -1) {
                    data.messages.splice(idx, 1);
                    selectedId = data.messages.length > 0 ? data.messages[0].id : null;
                  }
                }
              };
            }}>
              <input type="hidden" name="id" value={selectedMessage.id} />
              <button class="btn-secondary py-2 px-4 text-[0.65rem] uppercase font-black text-danger border-danger/20 hover:bg-danger/5">Delete</button>
            </form>
          </div>
        </div>
        
        <div class="flex-1 p-8 overflow-y-auto">
          <div class="max-w-2xl text-lg leading-relaxed text-light-text font-medium whitespace-pre-wrap">
            {selectedMessage.body}
          </div>

          {#if selectedMessage.type === 'BIRTHDAY' && selectedMessage.relatedEntityId}
            <div class="mt-12 p-6 bg-primary/5 border border-primary/10 rounded-2xl flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white text-xl">🎂</div>
                <div>
                  <div class="font-black text-primary uppercase tracking-widest text-xs mb-1">Birthday Boy</div>
                  <div class="font-bold">Check on training progress</div>
                </div>
              </div>
              <a href="/teams/{selectedMessage.teamId}" class="btn-primary py-2 px-6 text-xs uppercase font-black">View Squad</a>
            </div>
          {/if}

          {#if selectedMessage.type === 'TRANSFER' && selectedMessage.relatedEntityId?.startsWith('offer_')}
            <div class="mt-12 p-6 bg-green-50 border border-green-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white text-xl">🤝</div>
                <div>
                  <div class="font-black text-green-700 uppercase tracking-widest text-xs mb-1">Offer Accepted</div>
                  <div class="font-bold text-green-900">Proceed with signing the player</div>
                </div>
              </div>
              <form method="POST" action="?/completeTransfer" use:enhance={() => {
                return async ({ update }) => {
                  await update();
                  window.location.reload();
                };
              }}>
                <input type="hidden" name="messageId" value={selectedMessage.id} />
                <input type="hidden" name="relatedEntityId" value={selectedMessage.relatedEntityId} />
                <div class="flex gap-2">
                  <button type="button" class="bg-white border-2 border-green-200 text-green-700 hover:bg-green-50 py-3 px-6 rounded-xl text-xs uppercase font-black tracking-widest transition-all active:scale-95" onclick={() => selectedPlayerId = getPlayerIdFromMessage(selectedMessage)}>View Player</button>
                  <button type="submit" class="bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-xl text-xs uppercase font-black tracking-widest shadow-md transition-all active:scale-95">Complete Transfer</button>
                </div>
              </form>
            </div>
          {/if}

          {#if selectedMessage.type === 'TRANSFER' && selectedMessage.relatedEntityId?.startsWith('cpuoffer_')}
            <div class="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl">💰</div>
                <div>
                  <div class="font-black text-blue-700 uppercase tracking-widest text-xs mb-1">Incoming Bid</div>
                  <div class="font-bold text-blue-900">Do you accept this offer?</div>
                </div>
              </div>
              <div class="flex gap-2">
                <button type="button" class="bg-white border-2 border-blue-200 text-blue-700 hover:bg-blue-50 py-3 px-6 rounded-xl text-xs uppercase font-black tracking-widest transition-all active:scale-95" onclick={() => selectedPlayerId = getPlayerIdFromMessage(selectedMessage)}>View Player</button>
                <form method="POST" action="?/acceptCpuOffer" use:enhance={() => {
                  return async ({ update }) => {
                    await update();
                    window.location.reload();
                  };
                }}>
                  <input type="hidden" name="messageId" value={selectedMessage.id} />
                  <input type="hidden" name="relatedEntityId" value={selectedMessage.relatedEntityId} />
                  <button class="bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl text-xs uppercase font-black tracking-widest shadow-md transition-all active:scale-95">Accept</button>
                </form>
                <form method="POST" action="?/rejectCpuOffer" use:enhance={() => {
                  return async ({ update }) => {
                    await update();
                    window.location.reload();
                  };
                }}>
                  <input type="hidden" name="messageId" value={selectedMessage.id} />
                  <button class="bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 py-3 px-6 rounded-xl text-xs uppercase font-black tracking-widest transition-all active:scale-95">Reject</button>
                </form>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="flex-1 flex flex-col items-center justify-center subtle opacity-50 p-12 text-center">
          <div class="text-6xl mb-4">✉️</div>
          <p class="font-bold">Select a message from the list to read it.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if selectedPlayer}
  <PlayerModal 
    player={selectedPlayer} 
    currentDate={data.currentDate}
    managerTeamId={data.managerTeamId}
    scoutingLevel={selectedPlayerScoutingLevel}
    onclose={() => selectedPlayerId = null} 
  />
{/if}