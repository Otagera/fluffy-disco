import * as PIXI from 'pixi.js';
import { PITCH_W, PITCH_H } from './constants';
import type { Player, MatchState } from './types';

const PITCH_PADDING = 10; 

export class PixiRenderer {
  app: PIXI.Application;
  
  // Containers
  worldContainer: PIXI.Container; 
  pitchLayer: PIXI.Container;
  shadowLayer: PIXI.Container;
  entityLayer: PIXI.Container;
  weatherLayer: PIXI.Container; 
  
  playerSprites: Map<number, PIXI.Container> = new Map();
  ballSprite!: PIXI.Sprite;
  ballShadow!: PIXI.Graphics;
  
  playerTexture!: PIXI.Texture;
  ballTexture!: PIXI.Texture;
  numberTextures: Map<number, PIXI.Texture> = new Map();
  
  isRaining = false;
  rainStreaks: PIXI.Graphics[] = [];
  
  viewportScale = 1; 

  constructor() {
    this.app = new PIXI.Application();
    this.worldContainer = new PIXI.Container();
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
      preference: 'webgl', 
    });
    
    container.innerHTML = '';
    container.appendChild(this.app.canvas);

    this.viewportScale = this.app.screen.width / (PITCH_W + PITCH_PADDING * 2);

    this.app.stage.addChild(this.worldContainer);
    this.worldContainer.addChild(this.pitchLayer);
    this.worldContainer.addChild(this.shadowLayer);
    this.worldContainer.addChild(this.entityLayer);
    this.app.stage.addChild(this.weatherLayer);

    this.createTextures();
    this.drawPitch();
    this.createRain();
  }

  private createTextures() {
    const g = new PIXI.Graphics();
    const s = this.viewportScale;
    
    // Player Base
    const radius = 2 * s;
    g.circle(0, 0, radius)
     .fill({ color: 0xffffff })
     .stroke({ color: 0x000000, width: 0.3 * s });
    
    // Nose
    g.poly([radius, -radius/4, radius * 1.5, 0, radius, radius/4])
     .fill(0xffffff);
    
    this.playerTexture = this.app.renderer.generateTexture(g);
    
    // Player Numbers
    for (let i = 1; i <= 22; i++) {
      const text = new PIXI.Text({
        text: i.toString(),
        style: {
          fontFamily: 'Arial',
          fontSize: 1.5 * s,
          fill: 0xffffff,
          fontWeight: 'bold',
        }
      });
      text.anchor.set(0.5);
      this.numberTextures.set(i, this.app.renderer.generateTexture(text));
    }

    g.clear();
    // Ball
    g.circle(0, 0, 0.4 * s).fill(0xffffff);
    this.ballTexture = this.app.renderer.generateTexture(g);
  }

  private drawPitch() {
    const g = new PIXI.Graphics();
    const s = this.viewportScale;
    const offsetX = PITCH_PADDING * s;
    const offsetY = 5 * s; 

    g.rect(0, 0, (PITCH_W + PITCH_PADDING * 2) * s, (PITCH_H + 10) * s).fill(0x111111);
    g.rect(offsetX, offsetY, PITCH_W * s, PITCH_H * s).fill(0x2d8a4a);
    
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) {
        g.rect(offsetX + i * (PITCH_W/8) * s, offsetY, (PITCH_W/8) * s, PITCH_H * s)
         .fill({ color: 0x267a41, alpha: 0.4 });
      }
    }

    const lineStyle = { color: 0xffffff, width: 0.4 * s, alpha: 0.5 };
    g.stroke(lineStyle);
    g.rect(offsetX, offsetY, PITCH_W * s, PITCH_H * s).stroke(lineStyle);
    g.moveTo(offsetX + (PITCH_W/2) * s, offsetY).lineTo(offsetX + (PITCH_W/2) * s, offsetY + PITCH_H * s).stroke(lineStyle);
    g.circle(offsetX + (PITCH_W/2) * s, offsetY + (PITCH_H/2) * s, 9.15 * s).stroke(lineStyle);
    g.circle(offsetX + (PITCH_W/2) * s, offsetY + (PITCH_H/2) * s, 0.2 * s).fill({ color: 0xffffff, alpha: 0.5 });
    g.rect(offsetX, offsetY + (PITCH_H/2 - 20.15) * s, 16.5 * s, 40.3 * s).stroke(lineStyle);
    g.rect(offsetX + (PITCH_W - 16.5) * s, offsetY + (PITCH_H/2 - 20.15) * s, 16.5 * s, 40.3 * s).stroke(lineStyle);
    g.rect(offsetX, offsetY + (PITCH_H/2 - 9.15) * s, 5.5 * s, 18.3 * s).stroke(lineStyle);
    g.rect(offsetX + (PITCH_W - 5.5) * s, offsetY + (PITCH_H/2 - 9.15) * s, 5.5 * s, 18.3 * s).stroke(lineStyle);

    const goalStyle = { color: 0xffffff, width: 0.6 * s, alpha: 0.8 };
    const netFill = { color: 0xffffff, alpha: 0.05 };
    g.rect(offsetX - 3 * s, offsetY + (PITCH_H/2 - 3.66) * s, 3 * s, 7.32 * s).fill(netFill).stroke(goalStyle);
    g.rect(offsetX + PITCH_W * s, offsetY + (PITCH_H/2 - 3.66) * s, 3 * s, 7.32 * s).fill(netFill).stroke(goalStyle);

    this.pitchLayer.addChild(g);
    (this as any).pitchOffsetX = offsetX;
    (this as any).pitchOffsetY = offsetY;
  }

  private createRain() {
    for (let i = 0; i < 1500; i++) {
      const r = new PIXI.Graphics()
        .rect(0, 0, 1, 10) 
        .fill({ color: 0xffffff, alpha: 0.1 });
      r.visible = false;
      r.x = Math.random() * this.app.screen.width;
      r.y = Math.random() * this.app.screen.height;
      r.rotation = 0.1; 
      this.weatherLayer.addChild(r);
      this.rainStreaks.push(r);
    }
  }

  update(state: MatchState) {
    if (!state) return;

    const s = this.viewportScale;
    const cam = state.camera;
    const zoom = cam.zoom;
    const offsetX = (this as any).pitchOffsetX;
    const offsetY = (this as any).pitchOffsetY;
    
    this.worldContainer.scale.set(zoom);
    this.worldContainer.pivot.set(offsetX + cam.x * PITCH_W * s, offsetY + cam.y * PITCH_H * s);
    this.worldContainer.position.set(this.app.screen.width / 2, this.app.screen.height / 2);

    state.players.forEach((p) => {
      let container = this.playerSprites.get(p.id);
      let shadow: PIXI.Graphics;
      let staminaBar: PIXI.Graphics;
      let numberSprite: PIXI.Sprite;
      
      if (!container) {
        container = new PIXI.Container();
        
        // Player Body
        const body = new PIXI.Sprite(this.playerTexture);
        body.anchor.set(0.5);
        body.tint = p.team === 'home' ? 0x3b82f6 : 0xef4444; 
        container.addChild(body);
        
        // Shadow
        shadow = new PIXI.Graphics()
          .circle(0, 0, 2 * s)
          .fill({ color: 0x000000, alpha: 0.25 });
        this.shadowLayer.addChild(shadow);
        (container as any).shadow = shadow;

        // Number
        numberSprite = new PIXI.Sprite(this.numberTextures.get(p.number) || this.numberTextures.get(1));
        numberSprite.anchor.set(0.5);
        container.addChild(numberSprite);
        (container as any).numberSprite = numberSprite;

        // Stamina Bar Container
        staminaBar = new PIXI.Graphics();
        container.addChild(staminaBar);
        (container as any).staminaBar = staminaBar;

        this.entityLayer.addChild(container);
        this.playerSprites.set(p.id, container);
      } else {
        shadow = (container as any).shadow;
        staminaBar = (container as any).staminaBar;
        numberSprite = (container as any).numberSprite;
      }
      
      container.x = offsetX + p.x * PITCH_W * s;
      container.y = offsetY + p.y * PITCH_H * s;
      shadow.x = container.x + 0.3 * s;
      shadow.y = container.y + 0.3 * s;
      
      if (Math.abs(p.vx) > 0.0001 || Math.abs(p.vy) > 0.0001) {
        container.rotation = Math.atan2(p.vy, p.vx);
        // Keep number upright relative to stage
        numberSprite.rotation = -container.rotation;
      }

      // Update Stamina Bar
      staminaBar.clear();
      if (p.currentStamina < 100) {
        staminaBar.rotation = -container.rotation; // Keep bar upright
        const barW = 3 * s;
        const barH = 0.4 * s;
        const barY = 3.5 * s;
        
        // Background
        staminaBar.rect(-barW/2, barY, barW, barH).fill({ color: 0x000000, alpha: 0.5 });
        
        // Foreground
        const color = p.currentStamina > 50 ? 0x4caf50 : p.currentStamina > 30 ? 0xffeb3b : 0xf44336;
        staminaBar.rect(-barW/2, barY, barW * (p.currentStamina / 100), barH).fill(color);
      }
    });

    const currentPlayerIds = new Set(state.players.map((p) => p.id));
    for (const [id, container] of this.playerSprites.entries()) {
      if (!currentPlayerIds.has(id)) {
        const shadow = (container as any).shadow;
        if (shadow) this.shadowLayer.removeChild(shadow);
        this.entityLayer.removeChild(container);
        this.playerSprites.delete(id);
      }
    }

    if (!this.ballSprite) {
      this.ballSprite = new PIXI.Sprite(this.ballTexture);
      this.ballSprite.anchor.set(0.5);
      this.entityLayer.addChild(this.ballSprite);
      
      this.ballShadow = new PIXI.Graphics()
        .circle(0, 0, 0.4 * s)
        .fill({ color: 0x000000, alpha: 0.3 });
      this.shadowLayer.addChild(this.ballShadow);
    }
    
    const b = state.ball;
    const bx = offsetX + b.x * PITCH_W * s;
    const by = offsetY + b.y * PITCH_H * s;
    
    this.ballSprite.x = bx;
    this.ballSprite.y = by;
    this.ballSprite.scale.set(1 + (b.z || 0) * 0.15);
    
    const shadowOffset = (b.z || 0) * 0.8 * s;
    this.ballShadow.x = bx + 0.2 * s + shadowOffset;
    this.ballShadow.y = by + 0.2 * s + shadowOffset;
    this.ballShadow.alpha = Math.max(0.1, 0.3 - (b.z || 0) * 0.05);

    if (this.isRaining) {
      this.rainStreaks.forEach(r => {
        r.visible = true;
        r.y += 10;
        r.x -= 2; 
        if (r.y > this.app.screen.height + 20) {
          r.y = -20;
          r.x = Math.random() * (this.app.screen.width + 100);
        }
      });
    } else {
      if (this.rainStreaks[0]?.visible) {
        this.rainStreaks.forEach(r => r.visible = false);
      }
    }
  }

  destroy() {
    this.app.destroy(true, { children: true, texture: true });
  }
}
