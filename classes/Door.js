/**
 * DOOR CLASS
 */
import { DOOR_INTERACT_RANGE } from '../constants.js';

export class Door {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.locked = true;
        this.glowPhase = 0;
    }

    unlock() {
        this.locked = false;
    }

    update() {
        if (!this.locked) this.glowPhase += 0.1;
    }

    isPlayerNear(player) {
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dx = this.x + this.width / 2;
        const dy = this.y + this.height / 2;
        return Math.abs(px - dx) < DOOR_INTERACT_RANGE && Math.abs(py - dy) < DOOR_INTERACT_RANGE;
    }

    draw(ctx) {
        if (this.locked) {
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        } else {
            const glow = 0.5 + Math.sin(this.glowPhase) * 0.5;
            ctx.fillStyle = `rgba(0, 255, 65, ${0.3 + glow * 0.5})`;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = `rgba(0, 255, 65, ${0.8 + glow * 0.2})`;
            ctx.lineWidth = 4;
            ctx.strokeRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4);
        }
    }
}
