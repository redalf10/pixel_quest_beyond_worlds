/**
 * PARTICLE CLASS
 */
export class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }

    update(dtScale = 1) {
        this.x += this.vx * dtScale;
        this.y += this.vy * dtScale;
        this.life -= dtScale;
    }

    draw(ctx) {
        const alpha = this.life / this.maxLife;
        const color = this.color.startsWith('rgb')
            ? this.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba')
            : this.color;
        ctx.fillStyle = color;
        ctx.fillRect(this.x - 4, this.y - 4, 8, 8);
    }

    isDead() {
        return this.life <= 0;
    }
}
