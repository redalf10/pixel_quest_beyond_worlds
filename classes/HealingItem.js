/**
 * HEALING ITEM CLASS
 */
import { HEAL_AMOUNT } from '../constants.js';

export class HealingItem {
    constructor(x, y, amount = HEAL_AMOUNT) {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 24;
        this.amount = amount;
        this.collected = false;
        this.bobPhase = 0;
    }

    update() {
        this.bobPhase += 0.08;
    }

    collidesWith(player) {
        if (this.collected) return false;
        return player.x < this.x + this.width &&
               player.x + player.width > this.x &&
               player.y < this.y + this.height &&
               player.y + player.height > this.y;
    }

    collect(player) {
        if (this.collected) return;
        this.collected = true;
        player.health = Math.min(player.maxHealth, player.health + this.amount);
    }

    draw(ctx) {
        if (this.collected) return;
        const bob = Math.sin(this.bobPhase) * 5;
        ctx.fillStyle = '#00ff41';
        ctx.fillRect(this.x, this.y + bob, this.width, this.height);
        ctx.fillStyle = '#00aa2a';
        ctx.fillRect(this.x + 4, this.y + 4 + bob, 8, 12);
        ctx.fillRect(this.x + 12, this.y + 4 + bob, 8, 12);
    }
}
