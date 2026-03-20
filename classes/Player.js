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
    POWER_SLASH_COOLDOWN,
    BOMB_COOLDOWN,
    LASER_COOLDOWN,
    LASER_DURATION,
    LASER_RANGE,
    LASER_DAMAGE,
    LASER_THICKNESS,
    LASER_BURN_TICKS,
    LASER_BURN_DAMAGE
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
        this.color = '#00ff41';
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
        this.bombCooldown = 0;
        this.laserCooldown = 0;
        this.laserTimer = 0;
        this.lastLaser = null;
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

        if (this.bombCooldown > 0) this.bombCooldown--;
        if (this.laserCooldown > 0) this.laserCooldown--;
        if (this.laserTimer > 0) this.laserTimer -= dtScale;
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

    canThrowBomb() {
        return this.bombCooldown <= 0;
    }

    useBomb() {
        if (!this.canThrowBomb()) return false;
        this.bombCooldown = BOMB_COOLDOWN;
        return true;
    }

    canUseLaser() {
        return this.laserCooldown <= 0;
    }

    useLaser() {
        if (!this.canUseLaser()) return null;
        this.laserCooldown = LASER_COOLDOWN;
        this.laserTimer = LASER_DURATION;
        const dir = this.facingRight ? 1 : -1;
        const startX = this.facingRight ? this.x + this.width : this.x;
        const startY = this.y + this.height / 2;
        const beam = {
            startX,
            startY,
            endX: startX + dir * LASER_RANGE,
            thickness: LASER_THICKNESS,
            damage: LASER_DAMAGE,
            burnTicks: LASER_BURN_TICKS,
            burnDamage: LASER_BURN_DAMAGE
        };
        this.lastLaser = beam;
        return beam;
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

    setColor(color) {
        if (typeof color !== 'string' || !color.trim()) return;
        this.color = color;
    }

    draw(ctx) {
        // Blink when invincible
        if (this.invincible && Math.floor(Date.now() / 100) % 2 === 0) return;

        const x = this.x, y = this.y;
        const facing = this.facingRight;
        const c = this.color;
        const isAtk = this.isAttackActive();
        const isPowerSlash = this.powerSlashing && this.powerSlashTimer > 12;
        const bladeLen = isAtk ? (isPowerSlash ? 22 : 18) : 12;

        // ── SWORD ──────────────────────────────────────────────────────
        if (facing) {
            ctx.fillStyle = '#6b3a1f'; ctx.fillRect(x + 24, y + 13, 5, 7);         // grip
            ctx.fillStyle = '#d4a017'; ctx.fillRect(x + 22, y + 10, 3, 12);         // crossguard
            if (isPowerSlash) { ctx.fillStyle = 'rgba(255,140,0,0.85)'; ctx.fillRect(x + 25, y + 13, bladeLen + 2, 5); } // power glow
            ctx.fillStyle = '#c8d8e8'; ctx.fillRect(x + 25, y + 14, bladeLen, 3);  // blade
            ctx.fillStyle = '#e8f4fc'; ctx.fillRect(x + 25, y + 14, bladeLen, 1);  // blade edge shine
            ctx.fillStyle = '#c8d8e8'; ctx.fillRect(x + 25 + bladeLen, y + 15, 3, 1); // tip
        } else {
            ctx.fillStyle = '#6b3a1f'; ctx.fillRect(x - 1, y + 13, 5, 7);          // grip
            ctx.fillStyle = '#d4a017'; ctx.fillRect(x + 3,  y + 10, 3, 12);         // crossguard
            if (isPowerSlash) { ctx.fillStyle = 'rgba(255,140,0,0.85)'; ctx.fillRect(x - bladeLen - 2, y + 13, bladeLen + 2, 5); }
            ctx.fillStyle = '#c8d8e8'; ctx.fillRect(x - bladeLen, y + 14, bladeLen, 3);
            ctx.fillStyle = '#e8f4fc'; ctx.fillRect(x - bladeLen, y + 14, bladeLen, 1);
            ctx.fillStyle = '#c8d8e8'; ctx.fillRect(x - bladeLen - 3, y + 15, 3, 1);
        }

        // ── GREAVES (armored legs) ─────────────────────────────────────
        ctx.fillStyle = '#3a3a50';
        ctx.fillRect(x + 4,  y + 23, 9, 9);   // left leg dark base
        ctx.fillRect(x + 15, y + 23, 9, 9);   // right leg dark base
        ctx.fillStyle = c;
        ctx.fillRect(x + 5,  y + 24, 6, 5);   // left greave plate
        ctx.fillRect(x + 16, y + 24, 6, 5);   // right greave plate
        ctx.fillStyle = '#1e1e2c';
        ctx.fillRect(x + 3,  y + 29, 10, 3);  // left boot
        ctx.fillRect(x + 15, y + 29, 10, 3);  // right boot

        // ── BELT ───────────────────────────────────────────────────────
        ctx.fillStyle = '#2c1a08'; ctx.fillRect(x + 3, y + 20, 22, 3);   // belt strap
        ctx.fillStyle = '#d4a017'; ctx.fillRect(x + 11, y + 20, 6, 3);   // gold buckle
        ctx.fillStyle = '#8b6000'; ctx.fillRect(x + 12, y + 21, 4, 1);   // buckle detail

        // ── CHEST ARMOR ────────────────────────────────────────────────
        ctx.fillStyle = c; ctx.fillRect(x + 3, y + 9, 22, 11);            // chest base
        ctx.fillStyle = 'rgba(255,255,255,0.17)'; ctx.fillRect(x + 8, y + 10, 12, 8);  // breastplate sheen
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x + 13, y + 10, 2, 9);        // center ridge
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 3, y + 19, 22, 1);        // chest bottom rim

        // ── PAULDRONS (shoulder guards) ────────────────────────────────
        ctx.fillStyle = c;
        ctx.fillRect(x,      y + 9, 5, 7);   // left
        ctx.fillRect(x + 23, y + 9, 5, 7);   // right
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x,      y + 15, 5, 1);  // left rim
        ctx.fillRect(x + 23, y + 15, 5, 1);  // right rim
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x + 1,  y + 9, 3, 2);   // left highlight
        ctx.fillRect(x + 24, y + 9, 3, 2);   // right highlight

        // ── HELMET ─────────────────────────────────────────────────────
        ctx.fillStyle = c;
        ctx.fillRect(x + 4,  y + 1, 20, 9);  // main plate
        ctx.fillRect(x + 2,  y + 3,  4, 7);  // left cheek guard
        ctx.fillRect(x + 22, y + 3,  4, 7);  // right cheek guard
        ctx.fillStyle = '#d4a017'; ctx.fillRect(x + 10, y, 8, 3);         // gold crest
        ctx.fillStyle = '#ffe566'; ctx.fillRect(x + 11, y, 6, 1);         // crest shine
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 5, y + 1, 18, 2); // helmet highlight
        ctx.fillStyle = '#08080f'; ctx.fillRect(x + 4, y + 5, 20, 4);     // visor slit

        // Glowing eyes through visor
        ctx.fillStyle = '#00ffcc';
        if (facing) {
            ctx.fillRect(x + 15, y + 6, 4, 2);
            ctx.fillRect(x + 21, y + 7, 2, 1);
        } else {
            ctx.fillRect(x + 9, y + 6, 4, 2);
            ctx.fillRect(x + 5, y + 7, 2, 1);
        }

        // ── DASH TRAIL ─────────────────────────────────────────────────
        if (this.dashing) {
            ctx.fillStyle = c + '55';
            ctx.fillRect(facing ? x - 10 : x + this.width, y + 2, 10, this.height - 4);
        }

        // ── ATTACK HITBOX VISUAL ───────────────────────────────────────
        if (isAtk) {
            const ar = this.getAttackRect();
            ctx.fillStyle = isPowerSlash ? 'rgba(255,100,0,0.4)' : 'rgba(255,220,0,0.3)';
            ctx.fillRect(ar.x, ar.y, ar.width, ar.height);
        }

        // ── LASER ──────────────────────────────────────────────────────
        if (this.laserTimer > 0 && this.lastLaser) {
            const alpha = 0.35 + (this.laserTimer / LASER_DURATION) * 0.35;
            ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
            ctx.lineWidth = this.lastLaser.thickness;
            ctx.beginPath();
            ctx.moveTo(this.lastLaser.startX, this.lastLaser.startY);
            ctx.lineTo(this.lastLaser.endX, this.lastLaser.startY);
            ctx.stroke();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.lastLaser.startX, this.lastLaser.startY);
            ctx.lineTo(this.lastLaser.endX, this.lastLaser.startY);
            ctx.stroke();
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
        this.bombCooldown = 0;
        this.laserCooldown = 0;
        this.laserTimer = 0;
        this.lastLaser = null;
    }
}
