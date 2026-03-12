<script lang="ts">
import type { ActionResult } from "@sveltejs/kit";
import { onMount } from "svelte";
import { deserialize } from "$app/forms";

let {
	currentDate,
	onclose,
	oncomplete,
}: {
	currentDate: string;
	onclose: () => void;
	oncomplete: () => void;
} = $props();

let targetDate = $state("");
let delegationMode = $state<"stop" | "delegate">("stop");
let isSkipping = $state(false);
let processingDate = $state(currentDate);
let stopRequested = $state(false);
let aggregatedActions = $state<string[]>([]);

onMount(() => {
	// Default target: tomorrow
	const tomorrow = new Date(currentDate);
	tomorrow.setDate(tomorrow.getDate() + 1);
	targetDate = tomorrow.toISOString().split("T")[0];
});

function setMilestone(type: "next_match" | "end_of_week" | "end_of_season") {
	const date = new Date(currentDate);
	if (type === "end_of_week") {
		const day = date.getDay();
		const diff = 7 - day;
		date.setDate(date.getDate() + (diff === 0 ? 7 : diff));
	} else if (type === "next_match") {
		// Just set a far date, the loop will stop on Match Day anyway
		date.setDate(date.getDate() + 30);
	} else if (type === "end_of_season") {
		const year = date.getFullYear();
		const month = date.getMonth();
		// If we're already past May, end of next season
		const targetYear = month >= 5 ? year + 1 : year;
		targetDate = `${targetYear}-05-31`;
		return;
	}
	targetDate = date.toISOString().split("T")[0];
}

async function startSkip() {
	isSkipping = true;
	stopRequested = false;
	aggregatedActions = [];

	while (!stopRequested && processingDate < targetDate) {
		const formData = new FormData();
		formData.append("delegate", (delegationMode === "delegate").toString());

		const response = await fetch("?/advanceDay", {
			method: "POST",
			body: formData,
			headers: {
				"x-sveltekit-action": "true",
			},
		});

		const text = await response.text();
		const result: ActionResult = deserialize(text);

		if (result.type !== "success" || !result.data) {
			console.error("Server action failed:", result);
			break;
		}

		const actualData = result.data as any;

		processingDate = actualData.currentDate;
		if (Array.isArray(actualData.delegatedActions)) {
			aggregatedActions = [
				...aggregatedActions,
				...actualData.delegatedActions,
			];
		}

		if (actualData.mustStop) {
			console.log("Stopping skip due to:", actualData.reason);
			break;
		}

		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	isSkipping = false;

	if (aggregatedActions.length > 0) {
		const summaryData = new FormData();
		summaryData.append("actions", aggregatedActions.join(","));
		await fetch("?/sendSkipSummary", {
			method: "POST",
			body: summaryData,
			headers: {
				"x-sveltekit-action": "true",
			},
		});
	}

	window.location.reload();
}
</script>

<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div class="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
    <div class="p-6 border-b border-light-border bg-light-bg flex justify-between items-center">
      <h2 class="text-2xl font-black uppercase tracking-tighter mb-0">Skip To Date</h2>
      {#if !isSkipping}
        <button class="w-8 h-8 rounded-full bg-white border border-light-border flex items-center justify-center font-bold hover:bg-gray-100 transition-colors" onclick={onclose}>&times;</button>
      {/if}
    </div>

    <div class="p-6">
      {#if !isSkipping}
        <div class="space-y-6">
          <!-- Milestone Selection -->
          <div>
            <label class="text-[0.65rem] font-black uppercase tracking-widest subtle block mb-3">Quick Milestones</label>
            <div class="grid grid-cols-2 gap-2">
              <button class="btn-secondary py-2 text-xs" onclick={() => setMilestone('next_match')}>Next Match</button>
              <button class="btn-secondary py-2 text-xs" onclick={() => setMilestone('end_of_week')}>End of Week</button>
              <button class="btn-secondary py-2 text-xs" onclick={() => setMilestone('end_of_season')}>End of Season</button>
              <button class="btn-secondary py-2 text-xs" onclick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() + 30);
                targetDate = d.toISOString().split('T')[0];
              }}>+30 Days</button>
            </div>
          </div>

          <!-- Custom Date Picker -->
          <div>
            <label class="text-[0.65rem] font-black uppercase tracking-widest subtle block mb-2" for="targetDate">Target Date</label>
            <input 
              type="date" 
              id="targetDate"
              bind:value={targetDate}
              min={new Date(new Date(currentDate).getTime() + 86400000).toISOString().split('T')[0]}
              class="w-full p-3 rounded-xl border border-light-border font-bold"
            />
          </div>

          <!-- Delegation Settings -->
          <div class="bg-light-bg p-4 rounded-xl border border-light-border">
            <label class="text-[0.65rem] font-black uppercase tracking-widest subtle block mb-3">Interruption Mode</label>
            <div class="space-y-2">
              <label class="flex items-center gap-3 cursor-pointer group">
                <input type="radio" name="mode" value="stop" bind:group={delegationMode} class="w-4 h-4 text-primary focus:ring-primary" />
                <div>
                  <span class="font-bold text-sm group-hover:text-primary transition-colors">Stop on Urgent Issues</span>
                  <p class="text-[0.65rem] subtle">Simulation halts for transfer bids, contract expirations, etc.</p>
                </div>
              </label>
              <label class="flex items-center gap-3 cursor-pointer group">
                <input type="radio" name="mode" value="delegate" bind:group={delegationMode} class="w-4 h-4 text-primary focus:ring-primary" />
                <div>
                  <span class="font-bold text-sm group-hover:text-primary transition-colors">Delegate to Assistant</span>
                  <p class="text-[0.65rem] subtle">Assistant Manager auto-resolves minor issues silently.</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      {:else}
        <!-- Progress View -->
        <div class="text-center py-8 space-y-6">
          <div class="relative w-32 h-32 mx-auto">
            <div class="absolute inset-0 border-4 border-primary/10 rounded-full"></div>
            <div class="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-[0.6rem] font-black uppercase tracking-widest subtle">Simulating</span>
              <span class="text-xl font-black italic">FAST</span>
            </div>
          </div>

          <div>
            <div class="text-2xl font-black tracking-tight text-primary mb-1">
              {new Date(processingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <p class="text-xs font-bold subtle uppercase tracking-widest">Target: {new Date(targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
          </div>

          {#if aggregatedActions.length > 0}
            <div class="max-h-32 overflow-y-auto bg-light-bg rounded-xl p-4 border border-light-border text-left">
              <p class="text-[0.6rem] font-black uppercase tracking-widest subtle mb-2">Delegated Actions</p>
              <ul class="space-y-1">
                {#each aggregatedActions.slice(-3).reverse() as action}
                  <li class="text-[0.7rem] font-medium text-light-text flex gap-2">
                    <span class="text-primary">✓</span> {action}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          <button 
            class="btn-secondary w-full py-3 text-xs font-black uppercase tracking-widest text-danger border-danger/20 hover:bg-danger/5"
            onclick={() => stopRequested = true}
          >
            Stop Simulation
          </button>
        </div>
      {/if}
    </div>

    {#if !isSkipping}
      <div class="p-6 bg-light-bg border-t border-light-border flex gap-3">
        <button class="btn-primary flex-1 py-4 font-black uppercase tracking-widest" onclick={startSkip}>Start Simulation</button>
        <button class="btn-secondary px-8" onclick={onclose}>Cancel</button>
      </div>
    {/if}
  </div>
</div>
