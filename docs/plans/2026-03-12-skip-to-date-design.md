# Skip To Date & Delegation System Design

## Goal
Replace the "Fast Forward" mechanic with a more robust "Skip To Date" system via a Modal. This modal will allow the user to select a target date (via calendar or milestones) and choose whether to stop on urgent events or delegate them to an "Assistant Manager".

## 1. Skip To Date Modal UI
A new modal component triggered by the "Skip To Date" button on the home page.

### Features:
- **Target Selection:**
  - **Milestones:** Quick buttons for "Next Match", "End of Week", "Next Transfer Window", "End of Season".
  - **Calendar Picker:** An HTML native `<input type="date">` for precise targeting.
- **Interruption Settings:**
  - A toggle/radio group: 
    - **"Stop Simulation" (Default):** The simulation halts if an `isUrgent` event occurs (e.g., Transfer Bid, Contract Expiry).
    - **"Delegate to Assistant":** The simulation ignores the `mustStop` flag for urgent events and resolves them automatically.
- **Progress UI:** Once started, the modal transforms into a progress screen showing the current simulated date and a "Stop Early" button.

## 2. Delegation Engine (Silent Auto-Resolve)
When the user chooses "Delegate to Assistant", the daily loop needs to suppress hard stops and make automatic decisions.

### Mechanism:
- Update `advanceOneDay(save, skipConfig)` to accept a configuration object detailing the target date and delegation preference.
- If an urgent event occurs (e.g., CPU Transfer Bid):
  - **Stop Mode:** Set `mustStop = true` and break the loop.
  - **Delegate Mode:**
    - The Assistant evaluates the event.
    - *Bids:* Auto-reject unless the bid is > 150% of market value (for example).
    - *Contracts:* Auto-renew key players, let fringe players expire.
    - Generate a standard `InboxMessage` noting the Assistant's action, but mark it as non-urgent so it doesn't stop the flow.

### Reporting:
- **Daily Summaries:** During the skip, the Assistant aggregates actions and sends a brief daily summary to the inbox if they did anything.
- **End-of-Skip Summary:** When the target date is reached, a compiled report of all delegated actions is delivered to the Inbox.

## 3. Data Model & State Updates
- **Skip State:** The home page (`+page.svelte`) will manage the `isSkipping`, `targetDate`, and `delegationMode` state.
- **API Action Update:** The `?/advanceDay` form action will accept the new configuration parameters to pass down to `advanceOneDay`.

## Implementation Phasing
1. **Phase 1: Modal UI & Basic Skip:** Build the modal, milestone logic, date picker, and pass the target date to the advance loop.
2. **Phase 2: Delegation Logic:** Update `advanceOneDay` to handle the "Delegate" flag, implementing basic auto-resolve rules for bids and contracts.
3. **Phase 3: Summary Reporting:** Implement the daily and end-of-skip summary message aggregation.
