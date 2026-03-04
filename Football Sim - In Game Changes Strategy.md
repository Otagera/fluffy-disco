# Football Sim: In-Game Changes & Substitutions Strategy

To evolve the simulation into a fully-fledged management game, users need the ability to react to the match flow, make substitutions, and tweak tactical mentalities mid-game.

## 1. Architectural Approach
Currently, all simulation state lives inside `matchState.svelte.ts`. This Svelte 5 `$state` rune provides a deeply reactive, global source of truth.
Because Svelte 5 runes can be updated from anywhere and the UI will automatically re-render without interrupting the headless `requestAnimationFrame` loop, we can safely mutate `matchState` while the game is paused.

## 2. The "Pause State"
We already have a `matchState.status` that includes `'PAUSED'`. 
To facilitate in-game changes, we need:
- A user-facing "Pause" button (or spacebar hotkey) that toggles `matchState.status` between `'PLAYING'` and `'PAUSED'`.
- When `status === 'PAUSED'`, an overlay component (e.g., `InGameMenu.svelte`) will render over the pitch.

## 3. In-Game Menu Features
The `InGameMenu.svelte` component will reuse the `Lobby.svelte` dashboard logic:
- **Mentality Tweaks**: The user can change `matchState.homeMentality` (if they are controlling the home team) on the fly. As soon as the match resumes, the AI's `updateTacticalAnchors()` will automatically push the defensive line up or down based on the new mentality.
- **Role Changes**: The user can view their 11 players and swap their `tacticalRole` (e.g., changing a tiring 'BWM' to a more stationary 'DLP').

## 4. Substitutions Implementation
To handle substitutions:
1. **Bench Roster**: `MatchState` needs to be updated to include a `homeBench: Player[]` and `awayBench: Player[]`.
2. **The Swap Logic**: When a user selects a player on the pitch and a player on the bench to swap:
   - The engine captures the active player's `x`, `y`, `homeX`, `homeY`, `role`, and `id`.
   - It replaces that object in the `matchState.players` array with the bench player's object, injecting the outgoing player's coordinates so the sub appears exactly where the previous player was standing.
   - The outgoing player is moved to a `subbedOff` array so they cannot be reused.
3. **Fatigue Reset**: The newly injected player starts with 100 `currentStamina`, providing an immediate physical and cognitive boost to the team.

## 5. Implementation Status
- [x] Global `matchState` with Mentality and Roles.
- [x] Comprehensive Lobby UI for pre-match customization.
- [ ] In-game Pause toggle.
- [ ] `InGameMenu.svelte` overlay reusing Lobby logic.
- [ ] Sub-bench data structures and swap logic.
