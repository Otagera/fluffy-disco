# Football Simulation Engine (v2)

A high-performance, statistically driven 2D football match engine overhaul. This version transitions from an "arcade" DOM-based approach to a Data-Oriented Design (DOD) architecture, decoupling simulation logic from the UI framework.

## Core Pillars

1.  **Decoupled Simulation:** The core engine is pure TypeScript, utilizing `Float32Array` for state to maximize V8 optimization and support headless batch simulations.
2.  **Biomechanical Steering:** Movement is governed by Craig Reynolds' steering behaviors (Seek, Arrive, Separation) rather than linear point-to-point translation.
3.  **Statistical Realism:** Action resolution uses Gaussian (Normal) distributions (Box-Muller transform) instead of uniform RNG, incorporating "Consistency" as a hidden attribute.
4.  **Kinetic Ball Physics:** The ball is an independent physical entity with mass, friction, and impulse-based interaction.
5.  **WebGL Rendering:** A "dumb" PixiJS pipeline reads raw memory buffers to render 22+ players at 60FPS without framework overhead.

## Architecture

```text
src/lib/
├── engine/               # Pure TS Simulation (No Svelte Runes)
│   ├── core/             # RNG, Memory Buffers, Constants
│   ├── physics/          # Steering, Kinematics, Collisions
│   ├── ai/               # Spatial Maps, Tactics, Decision Making
│   └── Match.ts          # Orchestrator
├── renderer/             # PixiJS View Layer
│   ├── PixiApp.ts        # WebGL Initialization
│   └── SpriteManager.ts  # Sprite Handoff
└── ui/                   # Svelte 5 Components (HUD, Menus)
```

## Performance Targets
- **Headless:** 100+ match simulations in under 5 seconds.
- **Watched:** 60FPS WebGL rendering with zero layout thrashing.
- **Memory:** Zero GC pressure during the match loop via pre-allocated TypedArrays.
