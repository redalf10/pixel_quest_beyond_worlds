/**
 * KEY CLASS
 */
export class Key {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 24;
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

    collect() {
        this.collected = true;
    }

    draw(ctx) {
        if (this.collected) return;
        const bob = Math.sin(this.bobPhase) * 5;
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this.x, this.y + bob, this.width, this.height);
    }
}
