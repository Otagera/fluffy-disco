# Football Sim

> The beautiful game, simulated. A persistent, deep-tactical Manager Career Mode.

A high-fidelity football simulation engine built with **Svelte 5 (Runes)** and **Inline SVGs**. The project has evolved from a multiplayer lobby into a deep, single-player **Manager Career Mode** inspired by the tactical depth of *Football Manager*.

## Core Features

### 🏆 Manager Career Mode
- **Persistent 4-Tier League System**: Battle through 4 divisions (92 teams total) with automated Promotion, Relegation, and Playoffs at the end of every season.
- **Procedural Universe**: Starts with over 2,000 unique players generated using real-world locales (UK, Brazil, Japan, Nigeria, etc.) with fully randomized, role-appropriate attributes.
- **Season Progression**: Your actions, injuries, and match results are persistently saved (`data/savegame.json`). As you finish your matches, the engine simulates the rest of the league contextually.

### 🧠 The Cognitive Match Engine
The simulation runs on a decoupled, headless logic engine operating at 60fps, driven by attributes rather than pure physics:
- **Utility AI**: Players don't follow rigid scripts. Every frame, they score potential actions (Pass, Shoot, Dribble, Press) based on their attributes, spatial pressure, and tactical role.
- **Decision Noise**: Players with low *Decisions* stats will occasionally pick suboptimal actions, simulating human error and panic.
- **Composure Dampening**: Spatial pressure exponentially decays a player's ability to act, but high *Composure* mitigates this effect.
- **Attribute-Driven Resolution**: Passes and shots are resolved via a "Monte Carlo" style dice roll weighing the attacker's skills (Passing, Vision) against the defender's (Positioning, Tackling).

### 📋 Deep Tactical Customization
- **Pre-Match Tactics**: Set your Formation, Tactical Style (e.g., Tiki-Taka, Gegenpress), and Team Mentality (Ultra Defensive to Ultra Attacking).
- **Custom Formations**: Drag and drop players on the pre-match pitch to create bespoke, asymmetrical formations.
- **Player Roles**: Assign specific tactical roles (e.g., Deep Lying Playmaker, Ball Winning Midfielder) that dynamically alter a player's Utility AI priorities.
- **In-Game Management**: Pause the match to make substitutions from your bench.

### 🏃 Physical Fatigue & Injuries
- **Tactical Depletion**: High-intensity styles (like Gegenpress) drain player stamina significantly faster than conservative styles.
- **The Fatigue Cliff**: If stamina drops below 30% during a match, players suffer severe penalties to their physical and technical attributes.
- **Persistent Condition**: Players carry fatigue between matches. Overplaying tired players leads to a higher risk of multi-week **Injuries**.

### 🧪 AAA Testing Infrastructure
- **Headless Batch Simulator**: Run thousands of matches in seconds without the UI to statistically validate tactical balance and attribute weights.
- **Monte Carlo Balancing**: Automated scripts isolate and roll the resolution engine 10,000 times to ensure pass/shoot probabilities form realistic bell curves.
- **Behavior-Driven Development (BDD)**: Plain-English test scenarios ensure the AI logically executes complex football concepts (like overlapping runs and offside traps).

---

## Tech Stack

- **Frontend / Engine**: Svelte 5 (Runes: `$state`, `$derived`, `$effect`) + TypeScript + Vite
- **Rendering**: GPU-Accelerated Inline SVG (using `transform: translate`)
- **Data Persistence**: Local JSON Storage (Node `fs`)
- **Testing**: Vitest + JSDOM

## Getting Started

### Prerequisites
- Node.js 18+

### Installation & Running

```bash
# Install dependencies
npm install

# Start the Svelte dev server
npm run dev
```

Navigate to `http://localhost:5173`. Enter your Manager Name to bootstrap a new procedural universe and start your career!

### Testing Commands

```bash
# Run standard unit and integration tests
npm run test

# Run the Behavior-Driven tactical logic tests
npm run bdd

# Run the 50,000-tick stability smoke test
npm run smoke

# Run the headless 100-match batch simulator for statistical analysis
npm run sim
```

## Game Architecture

The project strictly decouples the simulation logic from the UI layer:
- `matchState.svelte.ts`: The global source of truth.
- `utilityAI.ts`: The "Brain" - evaluates what action a player *wants* to do.
- `resolution.ts`: The "Dice" - calculates how *successful* that action is based on attributes.
- `behaviorTree.ts`: The "Body" - executes the physical movement and vectors.
- `physics.ts`: The "World" - handles stamina, pressure, ball movement, and set-piece triggers.
- `Pitch.svelte`: The "Camera" - merely reads the `matchState` and renders the SVG positions.

## License

MIT