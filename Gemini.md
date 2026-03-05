# Gemini.md — Deep Simulation Football Match Engine Specification

## Project
2D Football (Soccer) simulation engine. Svelte 5 (Runes) + Inline SVGs. 
**Goal**: Achieve the tactical depth and statistical fidelity of a *Football Manager* (FM) simulation, prioritizing attribute-driven resolution and cognitive AI over arcade physics.

---

## Non-Negotiables
- **Rendering**: Inline SVG only (no Canvas, no WebGL).
- **Reactivity**: Svelte 5 Runes (`$state`, `$derived`, `$effect`) for all reactive logic.
- **Architecture**: Strict decoupling of simulation logic (headless `.svelte.ts`) from the UI layer.
- **Performance**: 60fps target via `requestAnimationFrame` (16.67ms fixed timestep). 
- **GPU Acceleration**: Use CSS `transform: translate()` and `rotate()` only; NO animation of SVG attributes like `cx`, `cy`, `x`, or `y`.
- **Coordinates**: Normalized (0–1) internally for all logic; pixel mapping only at render.
- **AI**: Hybrid Utility AI (decision making) + Behavior Trees (execution).
- **Observation**: Use `pinchtab` for live browser debugging, console logs, and state inspection.

---

## Strategic Roadmap (Execution Phases)

### Phase 1: Architecture & Performance Hardening
1. **Milestone 1: Decoupling via Universal Runes**: Extract all match logic, physics, and AI into headless `.svelte.ts` classes using a centralized `$state` store.
2. **Milestone 2: GPU-Accelerated SVG Refactoring**: Strip dynamic positional attributes from SVG markup; replace with CSS transforms and `will-change: transform`.

### Phase 2: Cognitive AI Foundation & Tactical Baseline
3. **Milestone 3: Utility AI Infrastructure**: Implement a scoring engine for high-level decisions (Pass, Shoot, Dribble, Press) using normalized utility curves (0.0–1.0).
4. **Milestone 4: Behavior Tree Execution**: Bridge abstract decisions to physical movement via hierarchical sequences (e.g., `RotateToTarget -> MoveToTarget -> ExecuteAction`).
5. **Milestone 5: Role-Based Tactical Injection**: Refactor hardcoded behaviors into decoupled `TacticalRole` data objects that inject weight multipliers and positional offsets into Utility AI.

### Phase 3: Advanced Simulation Depth
6. **Milestone 6: Spatial Pressure & Composure** ✅: Calculate real-time pressure using exponential decay; account for defender velocity vectors to penalize the carrier's space dynamically.
7. **Milestone 7: Attribute-Driven Resolution (The "Roll")**: Complete the statistical "roll" for Passing and Shooting to inject predetermined physical error (vector offsets) before trajectory calculation.
8. **Milestone 8: Topological Relationism** ✅: Implement spatial awareness for dynamic shape adjustments (e.g., Midfielders dropping, Offside Trap coordination) beyond static grid coordinates.

### Phase 4: Metagame Immersion & Analytics
9. **Milestone 9: Stamina & Fatigue** ✅: Implement continuous stamina depletion affecting both physical limits (max velocity) and cognitive utility. Added persistent condition tracking across seasons and injury risks.
10. **Milestone 10: xG & Analytics Engine**: Standardize event emitting via a unified `emitMatchEvent` system; generate FM-style post-match analytics (passing networks, heatmaps, xG) from deterministic telemetry.

### Phase 5: The Football Manager Experience (Next Steps)
11. **Milestone 11: The Transfer Market**: Implement a global economy. Allow the manager to buy/sell players, negotiate contracts, and manage a wage budget between seasons.
12. **Milestone 12: Player Development & Youth Academy**: Implement a progression system where young players gain attributes based on their `potential` and match experience, while older players slowly decline.
13. **Milestone 13: Advanced Match Reporting**: Visualize the telemetry data (Decision Audits) captured by the engine into a user-friendly post-match screen showing where things went right or wrong.

---

## Technical Realism Rules

| Situation | Resolution Mechanism |
|---|---|
| **Passing/Shooting** | Statistical "Roll" determines vector accuracy -> Physics engine executes -> Visual SVG renders post-hoc. |
| **Possession** | Determined by intercept radius vs. defender "Tackling" and carrier "Composure" attributes. |
| **Pressure** | Sum of exponential decay from nearby defenders; dampens "Creative" utility scores and increases "Decision Noise". |
| **Tactics** | Role multipliers (+/- %) applied to baseline Utility AI scoring curves. Custom coordinates injected at kick-off. |

---

## Do's and Don'ts

### DO:
- Use `transform-box: fill-box` and `will-change: transform` on all moving entities.
- Store all player/ball/league data in a headless Svelte 5 `$state` object.
- Use `$derived` for mapping normalized coordinates to pixel-based CSS transforms.
- Implement "Decision Noise" in AI to prevent perfect robotic choices by low-stat players.
- Isolate engine math in Headless/Monte Carlo tests before rendering it in the browser.

### DON'T:
- **NEVER** animate `cx`, `cy`, `x`, `y`, or `d` attributes of SVG elements.
- No hardcoded pixel positions; logic must remain coordinate-agnostic (0–1).
- No rigid `if/else` state machines for player behavior; use Utility scores and Behavior Trees.
- **NEVER** use `setTimeout` for critical match state transitions (like scoring or halftime) if it blocks the Headless Batch Simulator.

---

## Success Criteria
- [x] Logic runs at 60fps in a headless state (verified via console logs).
- [x] Players exhibit "Personality" (e.g., a High-Composure player keeps the ball under pressure).
- [x] No layout thrashing (verified via Chrome DevTools Performance tab).
- [x] Passing networks match intended tactical roles (e.g., DLP is the creative hub).
- [x] Statistically-driven mistakes (misplaced passes, skewed shots) emerge naturally from attribute rolls and decision noise.
- [x] Successful CPU vs CPU match simulation with realistic scorelines over a 100-match sample size.
- [x] Persistent League System with automated Promotion, Relegation, and Playoffs.
