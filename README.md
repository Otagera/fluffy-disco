# Football Sim

> The beautiful game, simulated. A persistent, deep-tactical Manager Career Mode.

A high-fidelity football simulation engine built with **Svelte 5 (Runes)** and **Inline SVGs**. The project prioritizes tactical depth and statistical fidelity, subordinating physics to attribute-driven resolution.

## Core Features

### 🏆 Manager Career Mode
- **Persistent 4-Tier League System**: Battle through 4 divisions (92 teams total) with automated Promotion, Relegation, and Playoffs at the end of every season.
- **Procedural Universe**: Starts with over 2,000 unique players generated using real-world locales (UK, Brazil, Japan, Nigeria, etc.) with fully randomized, role-appropriate attributes.
- **Season Progression**: Your actions, injuries, and match results are persistently saved (`data/savegame.json`). As you finish your matches, the engine simulates the rest of the league contextually.

### 🧠 The Cognitive Match Engine
The simulation runs on a decoupled, headless logic engine operating at 60fps, driven by attributes rather than pure physics:
- **Utility AI**: Players evaluate potential actions (Pass, Shoot, Dribble, Press) every frame using normalized utility curves.
- **Attribute-Driven Resolution**: The engine performs statistical "rolls" (weighing Passing, Vision, Composure) to inject error into ball vectors *before* the physics engine executes the trajectory.
- **Dynamic Spatial Pressure**: Pressure is calculated using exponential decay, accounting for defender velocity vectors and momentum to penalize the ball carrier's space in real-time.
- **Decision Noise**: Simulates human error and panic; players with low *Decisions* stats occasionally pick suboptimal actions under pressure.

### 📋 Deep Tactical Customization
- **Decoupled Tactical Roles**: Behavior is driven by FM-style role objects (e.g., Mezzala, DLP) that inject specific utility multipliers and positional anchor offsets.
- **Formation & Mentality**: Set complex formations and team mentalities that dynamically shift the engine's cognitive priorities.
- **In-Game Management**: Real-time substitutions and tactical shifts allow you to react to the match flow.

### 🏃 Physical Fatigue & Injuries
- **Tactical Depletion**: High-intensity styles (like Gegenpress) drain player stamina significantly faster.
- **The Fatigue Cliff**: Stamina below 30% triggers severe penalties to physical and technical attributes.
- **Persistent Condition**: Injuries and fatigue carry over between matches, requiring careful squad rotation.

### 🧪 AAA Testing Infrastructure
- **Headless Batch Simulator**: Run thousands of matches in seconds to statistically validate tactical balance.
- **Monte Carlo Balancing**: Isolate the resolution engine for 10,000+ rolls to ensure realistic outcome distributions.
- **BDD Testing**: Plain-English scenarios verify that the AI executes complex tactical concepts like overlapping runs.

---

## Tech Stack

- **Frontend / Engine**: Svelte 5 (Runes) + TypeScript + Vite
- **Rendering**: GPU-Accelerated Inline SVG (using CSS `transform`)
- **Architecture**: Headless Logic Engine with a centralized `$state` store
- **Persistence**: Local JSON Storage (Node `fs`)
- **Testing**: Vitest + JSDOM

## Game Architecture

The project maintains a strict separation of concerns:
- `matchState.svelte.ts`: The global source of truth.
- `utilityAI.ts`: The "Brain" - scores potential actions based on situational utility.
- `resolution.ts`: The "Dice" - calculates success/failure and vector error based on attributes.
- `behaviorTree.ts`: The "Body" - executes movement sequences and physical actions.
- `physics.ts`: The "World" - handles spatial constraints, stamina, and ball motion.
- `Pitch.svelte`: The "Camera" - renders the SVG positions based on `matchState`.
- **Standardized Events**: All match events (Goals, Passes, Interceptions) are emitted via a unified telemetry system for deterministic analytics and replay.

## License

MIT