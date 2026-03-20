/**
 * PLAYER CLASS
 */
import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    GRAVITY,
    MAX_FALL_SPEED,
    FRICTION,
    PLAYER_SPEED,
    PLAYER_JUMP_FORCE,
    PLAYER_MAX_HP,
    DASH_SPEED,
    DASH_DURATION,
    DASH_COOLDOWN,
    POWER_SLASH_DAMAGE,
    POWER_SLASH_DURATION,
    POWER_SLASH_COOLDOWN
} from '../constants.js';
import { SoundManager } from './SoundManager.js';

const soundManager = new SoundManager();

export class Player {
    constructor() {
        this.x = 64;
        this.y = CANVAS_HEIGHT - 100;
        this.width = 28;
        this.height = 32;
        this.vx = 0;
        this.vy = 0;
        this.health = PLAYER_MAX_HP;
        this.maxHealth = PLAYER_MAX_HP;
        this.onGround = false;
        this.facingRight = true;
        this.attacking = false;
        this.attackTimer = 0;
        this.invincible = false;
        this.invincibleTimer = 0;
        // Skills
        this.dashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.powerSlashing = false;
        this.powerSlashTimer = 0;
        this.powerSlashCooldown = 0;
    }

    update(platforms, dtScale = 1) {
        // Gravity
        this.vy += GRAVITY * dtScale;
        this.vy = Math.min(this.vy, MAX_FALL_SPEED);

        // Apply velocity
        this.x += this.vx * dtScale;
        this.y += this.vy * dtScale;

        // Friction (skip during dash)
        if (!this.dashing) this.vx *= Math.pow(FRICTION, dtScale);

        // Collision with platforms - process highest platforms first (lowest y) so we land on top
        const vxStep = this.vx * dtScale, vyStep = this.vy * dtScale;
        const eps = 1;
        this.onGround = false;
        const sorted = [...platforms].sort((a, b) => a.y - b.y);
        for (const p of sorted) {
            if (this.collidesWith(p)) {
                if (this.vy > 0 && this.y + this.height - vyStep <= p.y + eps) {
                    this.y = p.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                } else if (this.vy < 0 && this.y - vyStep >= p.y + p.height - eps) {
                    this.y = p.y + p.height;
                    this.vy = 0;
                }
                if (this.vx > 0 && this.x + this.width - vxStep <= p.x + eps) {
                    this.x = p.x - this.width;
                    this.vx = 0;
                } else if (this.vx < 0 && this.x - vxStep >= p.x + p.width - eps) {
                    this.x = p.x + p.width;
                    this.vx = 0;
                }
            }
        }

        // Ground boundary
        if (this.y + this.height > CANVAS_HEIGHT) {
            this.y = CANVAS_HEIGHT - this.height;
            this.vy = 0;
            this.onGround = true;
        }
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > CANVAS_WIDTH) this.x = CANVAS_WIDTH - this.width;

        // Attack cooldown
        if (this.attacking) {
            this.attackTimer--;
            if (this.attackTimer <= 0) this.attacking = false;
        }

        // Invincibility
        if (this.invincible) {
            this.invincibleTimer--;
            if (this.invincibleTimer <= 0) this.invincible = false;
        }

        // Dash (overrides movement - brief invincibility)
        if (this.dashing) {
            this.dashTimer--;
            if (this.dashTimer <= 0) this.dashing = false;
        }
        if (this.dashCooldown > 0) this.dashCooldown--;

        // Power slash
        if (this.powerSlashing) {
            this.powerSlashTimer--;
            if (this.powerSlashTimer <= 0) this.powerSlashing = false;
        }
        if (this.powerSlashCooldown > 0) this.powerSlashCooldown--;
    }

    collidesWith(rect) {
        return this.x < rect.x + rect.width &&
               this.x + this.width > rect.x &&
               this.y < rect.y + rect.height &&
               this.y + this.height > rect.y;
    }

    move(direction) {
        this.vx = direction * PLAYER_SPEED;
        if (direction !== 0) this.facingRight = direction > 0;
    }

    jump() {
        if (this.onGround) {
            this.vy = PLAYER_JUMP_FORCE;
            this.onGround = false;
        }
    }

    attack() {
        if (!this.attacking && !this.powerSlashing) {
            this.attacking = true;
            this.attackTimer = 15;
            soundManager.playAttackSound();
        }
    }

    useDash() {
        if (!this.dashing && this.dashCooldown <= 0) {
            this.dashing = true;
            this.dashTimer = DASH_DURATION;
            this.dashCooldown = DASH_COOLDOWN;
            this.vx = (this.facingRight ? 1 : -1) * DASH_SPEED;
            this.invincible = true;
            this.invincibleTimer = DASH_DURATION;
            soundManager.playDashSound();
        }
    }

    usePowerSlash() {
        if (!this.attacking && !this.powerSlashing && this.powerSlashCooldown <= 0) {
            this.powerSlashing = true;
            this.powerSlashTimer = POWER_SLASH_DURATION;
            this.powerSlashCooldown = POWER_SLASH_COOLDOWN;
            soundManager.playPowerSlashSound();
        }
    }

    takeDamage(amount) {
        if (this.invincible) return;
        this.health = Math.max(0, this.health - amount);
        this.invincible = true;
        this.invincibleTimer = 60;
        soundManager.playDamageSound();
    }

    getAttackRect() {
        const isPowerSlash = this.powerSlashing && this.powerSlashTimer > 12;
        const w = isPowerSlash ? 60 : 40;
        const h = isPowerSlash ? 36 : 24;
        const x = this.facingRight ? this.x + this.width - 4 : this.x - w + 4;
        const y = this.y + this.height / 2 - h / 2;
        return { x, y, width: w, height: h };
    }

    isAttackActive() {
        if (this.attacking && this.attackTimer > 10) return true;
        if (this.powerSlashing && this.powerSlashTimer > 12) return true;
        return false;
    }

    getAttackDamage() {
        return (this.powerSlashing && this.powerSlashTimer > 12) ? POWER_SLASH_DAMAGE : 30;
    }

    draw(ctx) {
        // Blink when invincible
        if (this.invincible && Math.floor(Date.now() / 100) % 2 === 0) return;

        ctx.fillStyle = '#00ff41';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Eyes
        ctx.fillStyle = '#000';
        const eyeX = this.facingRight ? this.x + 18 : this.x + 10;
        ctx.fillRect(eyeX, this.y + 8, 4, 4);
        ctx.fillRect(eyeX + 8, this.y + 8, 4, 4);

        // Attack hitbox visual (when attacking or power slashing)
        if (this.isAttackActive()) {
            const ar = this.getAttackRect();
            ctx.fillStyle = this.powerSlashing ? 'rgba(255, 100, 0, 0.6)' : 'rgba(255, 255, 0, 0.5)';
            ctx.fillRect(ar.x, ar.y, ar.width, ar.height);
        }
    }

    reset(startX, startY) {
        this.x = startX;
        this.y = startY;
        this.vx = 0;
        this.vy = 0;
        this.health = this.maxHealth;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.attacking = false;
        this.dashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.powerSlashing = false;
        this.powerSlashTimer = 0;
        this.powerSlashCooldown = 0;
    }
}
