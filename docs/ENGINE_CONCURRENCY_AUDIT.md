# Match Engine & Concurrency Technical Audit

## Scope
Reviewed:
- `ARCHITECTURE.md`
- `src/lib/engine/Match.svelte.ts`
- `src/lib/engine/physics/Steering.ts`
- `src/lib/engine/ai/SpatialMap.ts`
- `src/lib/engine/worker/match.worker.ts`
- `src/lib/engine/MatchController.svelte.ts`

## Executive Summary
- The overall DOD + worker split is sound for throughput: simulation is isolated in the worker, while the main thread mostly mirrors scalar state and copies small flat buffers.
- The highest-value hidden bottleneck is **control-map sampling inside pass targeting**, where many per-candidate `getControlAt()` calls execute floor/clamp/divisions repeatedly.
- The clearest physics/AI interaction flaw is that **`SpatialMap` ball weighting strongly overvalues near-ball clustering**, while the motion model has high steering gain; this combination can cause swarming/jitter around the ball and under-tracking of off-ball runs.
- A physics correctness issue exists in Magnus implementation: **`spinY` is tracked but unused in lateral curl force**, producing asymmetric spin behavior.

---

## 1) Core Architecture & Concurrency Findings

## What is working well
- Worker loop computes fixed micro-steps and limits raw frame delta (`safeDt`) before simulation, improving determinism and avoiding giant integration leaps after stalls.
- Message payload is intentionally tiny (`playerBuffer` + `ballBuffer`, ~252 floats), so structured clone overhead is moderate.
- Main thread copies typed arrays into a persistent local memory buffer (`set`) rather than replacing whole objects, which is a good choice for renderer access patterns.

## Risks / bottlenecks
1. **State message frequency can become the practical sync bottleneck at very high speeds**
   - The worker sends `STATE_UPDATE` every loop execution, not on a cadence tied to render needs.
   - At high speed settings, simulation often does many micro-steps per loop; only one message is sent per loop (good), but still often ~60Hz and always includes arrays.
   - This is usually acceptable, but if UI logic grows (analytics, overlays), message handling on main thread can dominate.

2. **Potential timer cleanup mismatch**
   - Main simulation uses `setTimeout` looping.
   - `SIMULATE_MATCH` path calls `clearInterval(intervalId)` instead of `clearTimeout(intervalId)`.
   - In browsers these are aliases on Window, but this is still a maintenance hazard and easy source of accidental loop leaks when ported/refactored.

### Recommendation
- Add adaptive publish throttling in worker (e.g., 20–30Hz for state while simulation speed > 5x, decoupled from physics tick).
- Replace `clearInterval` with `clearTimeout` for consistency.
- Optional: mark outgoing buffers transfer-friendly only if payload grows in future.

---

## 2) Performance & Efficiency Audit

## Hidden bottleneck (requested)
**Hidden bottleneck: pass-lane control sampling repeatedly calls `SpatialMap.getControlAt()` in nested loops.**

Why this is hidden:
- `SpatialMap.update()` is throttled (0.2s), so it *looks* like the expensive part is controlled.
- But pass targeting evaluates multiple teammates and lane samples; each sample incurs cell index math and bounds checks.
- This happens in tactical decision paths during live play, and scales with decision frequency, not just map refresh frequency.

Impact:
- CPU spikes during possession phases with many candidate pass evaluations.
- Particularly visible at 10x/100x where tactical decision loops run far more often.

Low-risk optimization:
- Cache `invCellW` / `invCellH` in `SpatialMap` and use multiply instead of divide in `getControlAt`.
- Expose a fast-path sampler that skips clamping when caller already bounds positions.
- Reduce pass lane samples dynamically with distance bands.

Other loop-level observations:
- `SpatialMap.update()` does a `Math.sqrt()` per influenced cell; replacing with approximate falloff or table lookup can reduce cost.
- Offside line calculation sorts defender x positions every tick; for 11 elements this is minor, but still a predictable per-tick allocation path if arrays are recreated.

---

## 3) Physics Accuracy & Numerical Stability

## Magnus effect review
- Current Magnus lateral force uses only `spinX` (`curlForce = spinX * speed * 0.15`) while `spinY` only decays and is never used for force contribution.
- This creates directional bias and can make curled trajectories feel inconsistent depending on how spin axes are assigned upstream.

## Stability at high speed
- Good safeguards present:
  - distance denominators are guarded with `Math.max(..., 0.01)` in seek/arrive.
  - worker caps `rawDt` and uses fixed substeps.
  - NaN guard before writing player physics results.
- Remaining risk:
  - `ax = force.fx / mass` and `ay = force.fy / mass` have no mass floor; if corrupted mass reaches 0, NaN/Infinity can still propagate before final clamp.

### Recommendation
- Add `const safeMass = Math.max(mass, 0.01)` before acceleration division.
- Incorporate both spin components in Magnus model (or rename fields to match actual axis usage).

---

## 4) Physics/AI Interaction Logic Flaw (requested)

**Potential logic flaw:** `SpatialMap` ball weighting strongly amplifies influence for players near the ball (`1.0 + 1.5/(1 + d/10)`) regardless of role/phase, while steering applies aggressive acceleration gain.

Why this causes unrealistic behavior:
- Near-ball players dominate control metrics, so AI heuristics that consume control can repeatedly favor short/local actions.
- Off-ball support and run-tracking become undervalued (especially wide or weak-side movements), producing “everyone converges to ball” behavior.
- Combined with high steering gain and short stopping dead-zone, players can oscillate around contested zones and appear to “vibrate” during rapid possession changes.

### Recommendation
- Make ball weight phase-aware (lower in settled possession, higher only in transition/loose-ball states).
- Blend role-based spread terms (e.g., CB/FB positional discipline) into influence.
- Apply temporal smoothing/hysteresis to chosen movement targets (stickiness window) to reduce rapid target flipping.

---

## 5) Goalkeeper IK Robustness

Findings:
- Save check is fundamentally a 2D Y/Z reach gate with probabilistic fumble, and hand position is snapped to goal line at ball crossing.
- This is performant and visually readable, but not fully robust:
  - No X-time-to-intercept or reaction-time integration; decision is made at boundary crossing instant.
  - The “reaction difficulty” term depends on `distY` only, not incoming ball angle/height rate.

Consequence:
- Some shots can look “teleport-saved” or “unsaveable” despite plausible trajectory, depending on crossing sample.

### Recommendation
- Add an interception window (e.g., 2–4 prior substeps) and evaluate predicted hand reach at crossing time.
- Include ball `vz` and shot angle into save chance weighting.

---

## 6) Prioritized Fix List
1. **Fix hidden CPU sink:** optimize pass-lane control sampling path.
2. **Fix physics consistency:** use both spin axes (or reconcile axis semantics).
3. **Add safety floor for mass division** in player acceleration.
4. **Phase-aware ballWeight + target hysteresis** to reduce swarm/vibration behavior.
5. **GK interception timing** for more realistic saves.

