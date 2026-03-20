/**
 * ENEMY CLASS
 */
import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    GRAVITY,
    ENEMY_BASE_HP,
    ENEMY_BASE_DAMAGE,
    ENEMY_ATTACK_RANGE,
    ENEMY_ATTACK_COOLDOWN,
    BOSS_HP,
    BOSS_DAMAGE,
    BOSS_ATTACK_RANGE,
    BOSS_ATTACK_COOLDOWN
} from '../constants.js';

export class Enemy {
    constructor(x, y, width, height, hp, damage, isBoss = false, options = {}) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.health = hp;
        this.maxHealth = hp;
        this.damage = damage;
        this.vx = options.speed || (isBoss ? 1.5 : 2);
        this.vy = 0;
        this.patrolLeft = x - (options.patrolRange || 80);
        this.patrolRight = x + (options.patrolRange || 80);
        this.onGround = false;
        this.isBoss = isBoss;
        this.facingRight = true;
        this.attacking = false;
        this.attackTimer = 0;
        this.attackCooldown = options.attackCooldown || (isBoss ? BOSS_ATTACK_COOLDOWN : ENEMY_ATTACK_COOLDOWN);
        this.attackRange = options.attackRange || (isBoss ? BOSS_ATTACK_RANGE : ENEMY_ATTACK_RANGE);
        this.attackCooldownTimer = 30; // Initial delay before first attack
        this.attackDealtThisRound = false; // Only deal damage once per attack animation
        this.jumpCooldown = 0;
        this.burnTicks = 0;
        this.burnDamage = 0;
        this.burnTickTimer = 0;
        this.defeatHandled = false;
        const JUMP_FORCE = isBoss ? -13 : -12;
        this.jumpForce = options.jumpForce ?? JUMP_FORCE;
    }

    update(platforms, player, dtScale = 1) {
        this.vy += GRAVITY * dtScale;
        const vxStep = this.vx * dtScale, vyStep = this.vy * dtScale;
        this.x += vxStep;
        this.y += vyStep;

        this.onGround = false;
        for (const p of platforms) {
            if (this.collidesWith(p)) {
                if (this.vy > 0 && this.y + this.height - vyStep <= p.y) {
                    this.y = p.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                }
                if (this.vx > 0 && this.x + this.width - vxStep <= p.x) {
                    this.x = p.x - this.width;
                    this.vx = -this.vx;
                } else if (this.vx < 0 && this.x - vxStep >= p.x + p.width) {
                    this.x = p.x + p.width;
                    this.vx = -this.vx;
                }
            }
        }

        if (this.y + this.height > CANVAS_HEIGHT) {
            this.y = CANVAS_HEIGHT - this.height;
            this.vy = 0;
            this.onGround = true;
        }

        // Face and move toward player when in detection range (long range = can attack from far)
        if (player && player.health > 0) {
            const detectRange = this.attackRange + 60;
            const closeRange = 180; // When player is close, speed up to catch them
            const px = player.x + player.width / 2;
            const py = player.y + player.height / 2;
            const ex = this.x + this.width / 2;
            const ey = this.y + this.height / 2;
            const distX = Math.abs(px - ex);
            const distY = py - ey;
            if (distX < detectRange && Math.abs(distY) < 120) {
                // Turn to face the player
                this.facingRight = px > ex;
                // Jump when player is above and we're on ground (to reach higher platforms)
                if (this.onGround && this.jumpCooldown <= 0 && distY < -40) {
                    this.vy = this.jumpForce;
                    this.onGround = false;
                    this.jumpCooldown = 45;
                }
                // Pause briefly when in attack range to prepare attack
                if (distX < this.attackRange && this.attackCooldownTimer <= 0) {
                    this.vx = 0;
                } else if (distX < detectRange * 0.7) {
                    const baseSpeed = Math.max(Math.abs(this.vx), this.isBoss ? 1.5 : 2);
                    const chaseSpeed = distX < closeRange
                        ? (this.isBoss ? 6 : 5.5)  // Speed up when close to catch player (player speed is 5)
                        : baseSpeed;
                    this.vx = (px > ex ? 1 : -1) * chaseSpeed;
                }
            }
        }

        if (this.jumpCooldown > 0) this.jumpCooldown--;

        if (this.burnTicks > 0) {
            this.burnTickTimer -= dtScale;
            if (this.burnTickTimer <= 0) {
                this.takeDamage(this.burnDamage);
                this.burnTicks--;
                this.burnTickTimer = 22;
            }
        }

        // Patrol reversal (only when not engaging player)
        if (!player || player.health <= 0) {
            this.facingRight = this.vx > 0;
        }
        const px = player ? player.x + player.width / 2 : 0;
        const ex = this.x + this.width / 2;
        const engagingPlayer = player && player.health > 0 && Math.abs(px - ex) < this.attackRange + 80;
        if (!engagingPlayer) {
            if (this.x <= this.patrolLeft) this.vx = Math.abs(this.vx);
            if (this.x + this.width >= this.patrolRight) this.vx = -Math.abs(this.vx);
        }

        // Attack logic
        if (this.attacking) {
            this.attackTimer--;
            if (this.attackTimer <= 0) {
                this.attacking = false;
                this.attackCooldownTimer = this.attackCooldown;
                this.attackDealtThisRound = false;
            }
        } else {
            if (this.attackCooldownTimer > 0) this.attackCooldownTimer--;
            else if (player && player.health > 0 && this.isPlayerInAttackRange(player)) {
                this.attacking = true;
                this.attackTimer = 12;
                this.attackDealtThisRound = false;
            }
        }
    }

    isPlayerInAttackRange(player) {
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const ex = this.x + this.width / 2;
        const ey = this.y + this.height / 2;
        const distX = Math.abs(px - ex);
        const distY = Math.abs(py - ey);
        const sameSide = (this.facingRight && px > ex) || (!this.facingRight && px < ex);
        return distX < this.attackRange && distY < 100 && sameSide && this.attackCooldownTimer <= 0;
    }

    getAttackRect() {
        const w = Math.min(this.attackRange, this.isBoss ? 180 : 120);
        const h = this.isBoss ? 48 : 36;
        const x = this.facingRight ? this.x + this.width - 4 : this.x - w + 4;
        const y = this.y + this.height / 2 - h / 2;
        return { x, y, width: w, height: h };
    }

    collidesWith(rect) {
        return this.x < rect.x + rect.width &&
               this.x + this.width > rect.x &&
               this.y < rect.y + rect.height &&
               this.y + this.height > rect.y;
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
    }

    applyBurn(ticks, damagePerTick) {
        this.burnTicks = Math.max(this.burnTicks, ticks);
        this.burnDamage = Math.max(this.burnDamage, damagePerTick);
        this.burnTickTimer = Math.min(this.burnTickTimer || 22, 8);
    }

    draw(ctx) {
        ctx.fillStyle = this.isBoss ? '#ff0040' : '#bf00ff';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Attack hitbox visual (when attacking)
        if (this.attacking && this.attackTimer > 8) {
            const ar = this.getAttackRect();
            ctx.fillStyle = 'rgba(255, 100, 100, 0.5)';
            ctx.fillRect(ar.x, ar.y, ar.width, ar.height);
        }

        if (this.burnTicks > 0 && this.health > 0) {
            ctx.fillStyle = 'rgba(255, 120, 0, 0.45)';
            ctx.fillRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4);
        }

        // Health bar for boss
        if (this.isBoss) {
            const barW = this.width;
            const barH = 6;
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x, this.y - 15, barW, barH);
            ctx.fillStyle = '#ff0040';
            ctx.fillRect(this.x, this.y - 15, barW * (this.health / this.maxHealth), barH);
        }
    }
}
