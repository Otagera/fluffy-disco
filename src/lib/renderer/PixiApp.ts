import * as PIXI from 'pixi.js';
import { 
    PLAYER_COUNT, PLAYER_STRIDE, PLAYER_OFFSET_X, PLAYER_OFFSET_Y,
    PLAYER_OFFSET_STAMINA,
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
                background: '#2d8a4a', // Brighter Pitch Green
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
                fontSize: 14,
                fontWeight: '900',
                stroke: { color: '#1a5f2a', width: 3 }
            });

            // Create Player Sprites
            for (let i = 0; i < PLAYER_COUNT; i++) {
                const container = new PIXI.Container();
                
                const graphics = new PIXI.Graphics();
                // Home: Primary Green, Away: Red
                const color = i < 11 ? 0x1a5f2a : 0xdc3545; 
                graphics.circle(0, 0, 14).fill(color).stroke({ color: 0xffffff, width: 2 });
                
                const text = new PIXI.Text({ text: labels[i] || (i + 1).toString(), style: textStyle });
                text.anchor.set(0.5);
                text.y = 0; // Center number in circle

                const stamBg = new PIXI.Graphics().rect(-12, 18, 24, 4).fill(0x000000, 0.3);
                const stamFill = new PIXI.Graphics().rect(-12, 18, 24, 4).fill(0xffffff);
                stamFill.label = 'staminaFill'; 

                container.addChild(graphics);
                container.addChild(text);
                container.addChild(stamBg);
                container.addChild(stamFill);
                
                this.playerContainers.push(container);
                pitchLayer.addChild(container);
            }

            this.ballSprite = new PIXI.Graphics()
                .circle(0, 0, 6).fill(0xffffff)
                .stroke({ color: 0x000000, width: 1.5 });
            
            // Add a subtle shadow to the ball
            const ballShadow = new PIXI.Graphics()
                .circle(2, 2, 6).fill(0x000000, 0.2);
            
            const ballContainer = new PIXI.Container();
            ballContainer.addChild(ballShadow);
            ballContainer.addChild(this.ballSprite);
            
            this.ballSprite = ballContainer as any; // Trick to update container pos
            pitchLayer.addChild(ballContainer);

            this.app.ticker.add(this.renderTick.bind(this));
        } catch (err) {
            console.error("Failed to initialize PixiJS v8 Renderer:", err);
        }
    }

    private drawPitchMarkings(layer: PIXI.Container) {
        const g = new PIXI.Graphics();
        const lineStyle = { color: 0xffffff, width: 2, alpha: 0.4 };

        // Mowed grass pattern (stripes)
        for (let i = 0; i < 10; i++) {
            if (i % 2 === 0) {
                g.rect(i * 105, 0, 105, 680).fill({ color: 0xffffff, alpha: 0.05 });
            }
        }

        // Outer Boundary
        g.rect(0, 0, 1050, 680).stroke(lineStyle);
        // Halfway Line
        g.moveTo(525, 0).lineTo(525, 680).stroke(lineStyle);
        // Center Circle
        g.circle(525, 340, 91.5).stroke(lineStyle);
        g.circle(525, 340, 3).fill(0xffffff);

        // Penalty Areas
        g.rect(0, 138.5, 165, 403).stroke(lineStyle); 
        g.rect(1050 - 165, 138.5, 165, 403).stroke(lineStyle);

        // Goal Areas
        g.rect(0, 248.5, 55, 183).stroke(lineStyle);
        g.rect(1050 - 55, 248.5, 55, 183).stroke(lineStyle);

        // D-Arcs (Semi-circles before penalty area)
        // Correct centers: Penalty spots are 11m (110 units) from goal lines.
        // Radius is 9.15m (91.5 units).
        const arcRadius = 91.5;
        const angle = Math.acos(55 / 91.5); // 55 is distance from spot (110) to pen area line (165)

        // Left Arc: Centered at 110, pointing away from goal (towards center)
        g.moveTo(165, 340 - Math.sin(angle) * arcRadius);
        g.arc(110, 340, arcRadius, -angle, angle, false).stroke(lineStyle);

        // Right Arc: Centered at 1050-110=940, pointing away from goal (towards center)
        g.moveTo(1050 - 165, 340 - Math.sin(angle) * arcRadius);
        g.arc(1050 - 110, 340, arcRadius, Math.PI + angle, Math.PI - angle, true).stroke(lineStyle);

        // Goals
        const goalStyle = { color: 0xffffff, width: 4, alpha: 0.8 };
        g.moveTo(0, 303.4).lineTo(-20, 303.4).lineTo(-20, 376.6).lineTo(0, 376.6).stroke(goalStyle);
        g.moveTo(1050, 303.4).lineTo(1070, 303.4).lineTo(1070, 376.6).lineTo(1050, 376.6).stroke(goalStyle);

        layer.addChild(g);
    }

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
            const stamina = playerBuf[offset + PLAYER_OFFSET_STAMINA] || 1.0;
            const fill = container.children.find(c => c.label === 'staminaFill') as PIXI.Graphics;
            if (fill) {
                fill.scale.x = Math.max(0, stamina);
                if (stamina < 0.4) {
                    fill.tint = 0xff4444;
                } else if (stamina < 0.7) {
                    fill.tint = 0xffeb3b;
                } else {
                    fill.tint = 0xffffff;
                }
            }
        }

        if (this.ballSprite) {
            this.ballSprite.x = ballBuf[BALL_OFFSET_X] * 10;
            this.ballSprite.y = ballBuf[BALL_OFFSET_Y] * 10;
        }
    }

    public destroy() {
        if (this.app) {
            this.app.destroy({ removeView: false }, { children: true, texture: true });
        }
    }
}
