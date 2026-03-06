import * as PIXI from 'pixi.js';
import { 
    PLAYER_COUNT, PLAYER_STRIDE, PLAYER_OFFSET_X, PLAYER_OFFSET_Y,
    BALL_OFFSET_X, BALL_OFFSET_Y 
} from '../engine/core/constants';
import type { MatchMemory } from '../engine/core/MatchMemory';

/**
 * MatchRenderer is a "dumb" view layer.
 * It reads from the Engine's raw memory and updates WebGL transforms.
 */
export class MatchRenderer {
    private app: PIXI.Application;
    private playerContainers: PIXI.Container[] = [];
    private ballSprite: PIXI.Graphics;
    private memory: MatchMemory;

    constructor(canvas: HTMLCanvasElement, memory: MatchMemory, labels: string[]) {
        this.memory = memory;
        this.app = new PIXI.Application();
        this.init(canvas, labels);
    }

    private async init(canvas: HTMLCanvasElement, labels: string[]) {
        try {
            await this.app.init({
                canvas: canvas,
                width: 1150, 
                height: 780,
                background: '#1a3c1a',
                antialias: true,
                resolution: window.devicePixelRatio || 1,
            });

            const stage = this.app.stage;
            const pitchLayer = new PIXI.Container();
            pitchLayer.x = 50; 
            pitchLayer.y = 50;
            stage.addChild(pitchLayer);

            this.drawPitchMarkings(pitchLayer);

            const textStyle = new PIXI.TextStyle({
                fill: '#ffffff',
                fontSize: 12,
                fontWeight: 'bold',
                stroke: { color: '#000000', width: 2 }
            });

            // Create Player Sprites
            for (let i = 0; i < PLAYER_COUNT; i++) {
                const container = new PIXI.Container();
                
                const graphics = new PIXI.Graphics();
                const color = i < 11 ? 0xd32f2f : 0x1976d2; 
                graphics.circle(0, 0, 12).fill(color).stroke({ color: 0xffffff, width: 2 });
                
                const text = new PIXI.Text({ text: labels[i] || (i + 1).toString(), style: textStyle });
                text.anchor.set(0.5);
                text.y = -22;

                const stamBg = new PIXI.Graphics().rect(-10, 15, 20, 4).fill(0x000000);
                const stamFill = new PIXI.Graphics().rect(-10, 15, 20, 4).fill(0x00ff00);
                stamFill.label = 'staminaFill'; 

                container.addChild(graphics);
                container.addChild(text);
                container.addChild(stamBg);
                container.addChild(stamFill);
                
                this.playerContainers.push(container);
                pitchLayer.addChild(container);
            }

            this.ballSprite = new PIXI.Graphics().circle(0, 0, 6).fill(0xffffff).stroke({ color: 0x000000, width: 1 });
            pitchLayer.addChild(this.ballSprite);

            this.app.ticker.add(this.renderTick.bind(this));
        } catch (err) {
            console.error("Failed to initialize PixiJS v8 Renderer:", err);
        }
    }

    private drawPitchMarkings(layer: PIXI.Container) {
        const g = new PIXI.Graphics();
        const lineStyle = { color: 0xffffff, width: 2, alpha: 0.5 };

        // Outer Boundary
        g.rect(0, 0, 1050, 680).stroke(lineStyle);
        // Halfway Line
        g.moveTo(525, 0).lineTo(525, 680).stroke(lineStyle);
        // Center Circle
        g.circle(525, 340, 91.5).stroke(lineStyle);
        g.circle(525, 340, 2).fill(0xffffff);

        // Penalty Areas
        g.rect(0, 138.5, 165, 403).stroke(lineStyle); 
        g.rect(1050 - 165, 138.5, 165, 403).stroke(lineStyle);

        // Goal Areas
        g.rect(0, 248.5, 55, 183).stroke(lineStyle);
        g.rect(1050 - 55, 248.5, 55, 183).stroke(lineStyle);

        // Goals
        const goalStyle = { color: 0xffffff, width: 4, alpha: 0.8 };
        g.moveTo(0, 303.4).lineTo(-20, 303.4).lineTo(-20, 376.6).lineTo(0, 376.6).stroke(goalStyle);
        g.moveTo(1050, 303.4).lineTo(1070, 303.4).lineTo(1070, 376.6).lineTo(1050, 376.6).stroke(goalStyle);

        layer.addChild(g);
    }

    /**
     * The Render Loop: Direct memory access to PixiJS transforms.
     * Scale 10x: 1 unit in Engine = 10 pixels in Pixi.
     */
    private renderTick() {
        if (this.playerContainers.length === 0) return;

        const playerBuf = this.memory.playerBuffer;
        const ballBuf = this.memory.ballBuffer;

        // Update Players
        for (let i = 0; i < PLAYER_COUNT; i++) {
            const offset = i * PLAYER_STRIDE;
            const container = this.playerContainers[i];
            if (!container) continue;
            
            container.x = playerBuf[offset + PLAYER_OFFSET_X] * 10;
            container.y = playerBuf[offset + PLAYER_OFFSET_Y] * 10;

            // Update Stamina Bar Width and Color
            const stamina = playerBuf[offset + PLAYER_OFFSET_STAMINA];
            const fill = container.children.find(c => c.label === 'staminaFill') as PIXI.Graphics;
            if (fill) {
                fill.scale.x = stamina;
                // Green (1.0) -> Red (0.0)
                const r = Math.floor(255 * (1 - stamina));
                const g = Math.floor(255 * stamina);
                fill.tint = (r << 16) | (g << 8);
            }
        }

        if (this.ballSprite) {
            this.ballSprite.x = ballBuf[BALL_OFFSET_X] * 10;
            this.ballSprite.y = ballBuf[BALL_OFFSET_Y] * 10;
        }
    }

    /**
     * Clean up PixiJS resources.
     */
    public destroy() {
        if (this.app) {
            this.app.destroy({ removeView: false }, { children: true, texture: true });
        }
    }
}
