/**
 * BOMB SKILL PROJECTILE
 */
import {
    CANVAS_HEIGHT,
    GRAVITY,
    BOMB_FUSE_TIME,
    BOMB_THROW_SPEED_X,
    BOMB_THROW_SPEED_Y,
    BOMB_EXPLOSION_RADIUS
} from '../constants.js';

export class Bomb {
    constructor(x, y, facingRight) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.vx = (facingRight ? 1 : -1) * BOMB_THROW_SPEED_X;
        this.vy = BOMB_THROW_SPEED_Y;
        this.fuseTimer = BOMB_FUSE_TIME;
        this.exploded = false;
        this.explosionRadius = BOMB_EXPLOSION_RADIUS;
        this.explosionTimer = 0;
    }

    update(platforms, dtScale = 1) {
        if (this.exploded) {
            if (this.explosionTimer > 0) this.explosionTimer -= dtScale;
            return;
        }

        this.vy += GRAVITY * dtScale;
        const vxStep = this.vx * dtScale;
        const vyStep = this.vy * dtScale;

        this.x += vxStep;
        this.y += vyStep;

        // Simple platform bounce/damp behavior before detonation.
        for (const p of platforms) {
            const nearestX = Math.max(p.x, Math.min(this.x, p.x + p.width));
            const nearestY = Math.max(p.y, Math.min(this.y, p.y + p.height));
            const dx = this.x - nearestX;
            const dy = this.y - nearestY;
            if (dx * dx + dy * dy <= this.radius * this.radius) {
                if (Math.abs(dy) > Math.abs(dx)) {
                    if (this.vy > 0) this.y = p.y - this.radius;
                    else this.y = p.y + p.height + this.radius;
                    this.vy *= -0.35;
                    this.vx *= 0.8;
                } else {
                    if (this.vx > 0) this.x = p.x - this.radius;
                    else this.x = p.x + p.width + this.radius;
                    this.vx *= -0.45;
                }
            }
        }

        if (this.y + this.radius > CANVAS_HEIGHT) {
            this.y = CANVAS_HEIGHT - this.radius;
            this.vy *= -0.35;
            this.vx *= 0.85;
        }

        this.fuseTimer -= dtScale;
        if (this.fuseTimer <= 0) {
            this.explode();
        }
    }

    explode() {
        if (this.exploded) return;
        this.exploded = true;
        this.explosionTimer = 12;
        this.vx = 0;
        this.vy = 0;
    }

    isExpired() {
        return this.exploded && this.explosionTimer <= 0;
    }

    draw(ctx) {
        if (!this.exploded) {
            const pulse = 0.7 + Math.sin(this.fuseTimer * 0.25) * 0.3;
            ctx.fillStyle = `rgba(255, 120, 0, ${pulse})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffefb3';
            ctx.fillRect(this.x - 2, this.y - this.radius - 5, 4, 4);
            return;
        }

        const r = this.explosionRadius * (1 - this.explosionTimer / 12);
        ctx.fillStyle = `rgba(255, 160, 40, ${0.35 + (this.explosionTimer / 12) * 0.35})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(12, r), 0, Math.PI * 2);
        ctx.fill();
    }
}
