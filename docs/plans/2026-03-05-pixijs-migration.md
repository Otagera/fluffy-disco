# PixiJS Rendering Migration Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the football simulation's rendering layer from SVG to a high-performance PixiJS WebGL/WebGPU application with sprite pooling, cinematic rain, and smooth interpolation.

**Architecture:** A centralized `PixiRenderer` class in `renderer.ts` will manage the PIXI application, scene graph (layers), and object pools. The `Pitch.svelte` component will act as the host, initializing the renderer and passing the `matchState` for updates.

**Tech Stack:** PixiJS v8, Svelte 5, TypeScript.

---

### Task 1: Create PixiRenderer Class

**Files:**
- Create: `src/lib/game/renderer.ts`

**Step 1: Define the Renderer Structure**
Implement the basic class with layers and initialization logic. Use `PIXI.Graphics` to pre-render a base texture for players and the ball to avoid per-frame graphics calls.

**Step 2: Implement Sprite Pooling**
Create a `Map` to store player sprites indexed by ID.

**Step 3: Implement Weather (Rain)**
Add a simple particle-like system for rain streaks that can be toggled.

**Step 4: Implementation Code (Initial Draft)**
```typescript
import * as PIXI from 'pixi.js';
import { PITCH_W, PITCH_H } from './constants';
import type { Player, Ball } from './types';

export class PixiRenderer {
  app: PIXI.Application;
  pitchLayer: PIXI.Container;
  shadowLayer: PIXI.Container;
  entityLayer: PIXI.Container;
  weatherLayer: PIXI.Container;
  
  playerSprites: Map<number, PIXI.Container> = new Map();
  ballSprite!: PIXI.Sprite;
  ballShadow!: PIXI.Graphics;
  
  playerTexture!: PIXI.Texture;
  ballTexture!: PIXI.Texture;
  
  isRaining = false;
  rainStreaks: PIXI.Graphics[] = [];

  constructor() {
    this.app = new PIXI.Application();
    this.pitchLayer = new PIXI.Container();
    this.shadowLayer = new PIXI.Container();
    this.entityLayer = new PIXI.Container();
    this.weatherLayer = new PIXI.Container();
  }

  async init(container: HTMLElement) {
    await this.app.init({
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
    });
    container.appendChild(this.app.canvas);

    this.app.stage.addChild(this.pitchLayer);
    this.app.stage.addChild(this.shadowLayer);
    this.app.stage.addChild(this.entityLayer);
    this.app.stage.addChild(this.weatherLayer);

    this.createTextures();
    this.drawPitch();
    this.createRain();
  }

  private createTextures() {
    const g = new PIXI.Graphics();
    // Player Base
    g.circle(0, 0, 2).fill({ color: 0xffffff }).stroke({ color: 0x000000, width: 0.3 });
    // Directional indicator (Nose)
    g.poly([2, -0.5, 3, 0, 2, 0.5]).fill(0xffffff);
    this.playerTexture = this.app.renderer.generateTexture(g);
    
    g.clear();
    g.circle(0, 0, 0.5).fill(0xffffff);
    this.ballTexture = this.app.renderer.generateTexture(g);
  }

  private drawPitch() {
    const g = new PIXI.Graphics();
    // Grass
    g.rect(0, 0, PITCH_W, PITCH_H).fill(0x2d8a4a);
    // ... Add pitch lines here based on SVG logic ...
    this.pitchLayer.addChild(g);
  }

  private createRain() {
    for (let i = 0; i < 500; i++) {
      const r = new PIXI.Graphics().rect(0, 0, 1, 15).fill(0xffffff);
      r.alpha = 0.2;
      r.visible = false;
      this.weatherLayer.addChild(r);
      this.rainStreaks.push(r);
    }
  }

  update(state: any) {
    // Camera
    const cam = state.camera;
    this.app.stage.scale.set(cam.zoom);
    this.app.stage.pivot.set(cam.x * PITCH_W, cam.y * PITCH_H);
    this.app.stage.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

    // Players
    state.players.forEach((p: Player) => {
      let sprite = this.playerSprites.get(p.id);
      if (!sprite) {
        sprite = new PIXI.Container();
        const body = new PIXI.Sprite(this.playerTexture);
        body.anchor.set(0.5);
        sprite.addChild(body);
        // Add shadow
        const shadow = new PIXI.Graphics().circle(0, 0, 2).fill({ color: 0x000000, alpha: 0.2 });
        this.shadowLayer.addChild(shadow);
        (sprite as any).shadow = shadow;

        this.entityLayer.addChild(sprite);
        this.playerSprites.set(p.id, sprite);
      }
      
      sprite.x = p.x;
      sprite.y = p.y;
      (sprite as any).shadow.x = p.x + 0.5;
      (sprite as any).shadow.y = p.y + 0.5;
      
      // Direction based on velocity
      if (p.vx !== 0 || p.vy !== 0) {
        sprite.rotation = Math.atan2(p.vy, p.vx);
      }
    });

    // Ball
    if (!this.ballSprite) {
      this.ballSprite = new PIXI.Sprite(this.ballTexture);
      this.ballSprite.anchor.set(0.5);
      this.entityLayer.addChild(this.ballSprite);
      this.ballShadow = new PIXI.Graphics().circle(0, 0, 0.5).fill({ color: 0x000000, alpha: 0.3 });
      this.shadowLayer.addChild(this.ballShadow);
    }
    const b = state.ball;
    this.ballSprite.x = b.x;
    this.ballSprite.y = b.y;
    this.ballSprite.scale.set(1 + b.z * 0.1);
    this.ballShadow.x = b.x + b.z * 0.5;
    this.ballShadow.y = b.y + b.z * 0.5;
    this.ballShadow.alpha = 0.3 / (1 + b.z * 0.1);

    // Weather
    if (this.isRaining) {
      this.rainStreaks.forEach(r => {
        r.visible = true;
        r.y += 20;
        if (r.y > PITCH_H) {
          r.y = -20;
          r.x = Math.random() * PITCH_W;
        }
      });
    } else {
      this.rainStreaks.forEach(r => r.visible = false);
    }
  }
}
```

---

### Task 2: Refactor Pitch.svelte

**Files:**
- Modify: `src/lib/components/Pitch.svelte`

**Step 1: Remove SVG and CSS Weather**
Clean out the old rendering logic.

**Step 2: Initialize PixiRenderer**
Use `onMount` to create the renderer and bind it to a `div`.

**Step 3: Setup the Ticker**
Use `app.ticker.add()` to call `renderer.update(matchState)`.

---

### Task 3: Handle "Skip to End" Overlay

**Files:**
- Modify: `src/routes/match/[id]/+page.svelte`

**Step 1: Ensure Renderer Stops during Simulation**
Ensure that when `isSimulating` is true, we either pause the Pixi ticker or the ticker handles the empty state gracefully.

---

### Task 4: Commit and Verify

**Step 1: Verify PixiJS Initialization**
Run the app and check for the PixiJS canvas in the DOM.

**Step 2: Verify Smoothness**
Check that players move smoothly and the directional "nose" works.
