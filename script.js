/**
 * PIXEL QUEST BEYOND WORLDS
 * A Retro-Style Indie Platformer with Multiverse Exploration
 * 
 * Complete 2D browser-based RPG - Vanilla JavaScript
 * No external frameworks - HTML5 Canvas
 */

// ============================================
// GAME CONSTANTS
// ============================================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const TILE_SIZE = 32;
const TILE_HEIGHT = 16;
const PLATFORM_WIDTH = 70;
const GRAVITY = 0.6;
const MAX_FALL_SPEED = 16;
const FRICTION = 0.85;
const PLAYER_SPEED = 5;
const PLAYER_JUMP_FORCE = -14;
const PLAYER_MAX_HP = 100;
const ENEMY_BASE_HP = 20;
const ENEMY_BASE_DAMAGE = 8;
const ENEMY_ATTACK_RANGE = 140; // Long-range attack
const ENEMY_ATTACK_COOLDOWN = 90; // frames between attacks
const BOSS_HP = 300;
const BOSS_DAMAGE = 20;
const BOSS_ATTACK_RANGE = 200;  // Boss long-range
const BOSS_ATTACK_COOLDOWN = 45;
const ATTACK_COOLDOWN = 400;
const INVINCIBILITY_TIME = 1500;
const DOOR_INTERACT_RANGE = 50;

// Skill constants
const DASH_SPEED = 18;
const DASH_DURATION = 8;       // frames
const DASH_COOLDOWN = 90;     // frames (~1.5s at 60fps)
const POWER_SLASH_DAMAGE = 55;
const POWER_SLASH_DURATION = 20;
const POWER_SLASH_COOLDOWN = 150; // frames (~2.5s)

// ============================================
// SOUND SYSTEM (Web Audio API - No external files)
// ============================================
class SoundManager {
    constructor() {
        this.audioCtx = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not available:', e);
        }
    }

    resume() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playTone(frequency, duration, type = 'square') {
        if (!this.audioCtx) this.init();
        if (!this.audioCtx) return;
        this.resume();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.frequency.value = frequency;
        osc.type = type;
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
        osc.start(this.audioCtx.currentTime);
        osc.stop(this.audioCtx.currentTime + duration);
    }

    playDoorSound() {
        this.playTone(400, 0.1);
        setTimeout(() => this.playTone(600, 0.1), 100);
        setTimeout(() => this.playTone(800, 0.2), 200);
    }

    playAttackSound() {
        this.playTone(150, 0.05, 'sawtooth');
        this.playTone(200, 0.05, 'sawtooth');
    }

    playLevelCompleteSound() {
        [523, 659, 784, 1047].forEach((f, i) => {
            setTimeout(() => this.playTone(f, 0.15), i * 100);
        });
    }

    playDamageSound() {
        this.playTone(100, 0.2, 'sawtooth');
        this.playTone(80, 0.2, 'sawtooth');
    }

    playEnemyDefeatSound() {
        this.playTone(300, 0.05);
        this.playTone(400, 0.05);
        this.playTone(500, 0.1);
    }

    playDashSound() {
        this.playTone(250, 0.06, 'sawtooth');
        this.playTone(350, 0.06, 'sawtooth');
    }

    playPowerSlashSound() {
        this.playTone(120, 0.08, 'sawtooth');
        this.playTone(180, 0.08, 'sawtooth');
        this.playTone(240, 0.1, 'sawtooth');
    }

    playHealSound() {
        this.playTone(440, 0.08);
        this.playTone(554, 0.08);
        this.playTone(659, 0.12);
    }
}

const soundManager = new SoundManager();

// ============================================
// PARTICLE SYSTEM
// ============================================
class Particle {
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

// ============================================
// PLAYER CLASS
// ============================================
class Player {
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

// ============================================
// ENEMY CLASS
// ============================================
class Enemy {
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

    draw(ctx) {
        ctx.fillStyle = this.isBoss ? '#ff0040' : '#bf00ff';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Attack hitbox visual (when attacking)
        if (this.attacking && this.attackTimer > 8) {
            const ar = this.getAttackRect();
            ctx.fillStyle = 'rgba(255, 100, 100, 0.5)';
            ctx.fillRect(ar.x, ar.y, ar.width, ar.height);
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

// ============================================
// DOOR CLASS
// ============================================
class Door {
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

// ============================================
// KEY CLASS
// ============================================
class Key {
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

// ============================================
// HEALING ITEM CLASS
// ============================================
const HEAL_AMOUNT = 25;

class HealingItem {
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

// ============================================
// LEVEL CLASS
// ============================================
class Level {
    constructor(index) {
        this.index = index;
        this.platforms = [];
        this.enemies = [];
        this.door = null;
        this.key = null;
        this.healingItems = [];
        this.playerStartX = 64;
        this.playerStartY = CANVAS_HEIGHT - 100;
        this.useKey = false; // true = door unlocks with key, false = with enemies
        this.build();
    }

    build() {
        const ts = TILE_SIZE;
        const groundPlatformY = CANVAS_HEIGHT - ts;

        // Ground
        this.platforms.push({ x: 0, y: groundPlatformY, width: CANVAS_WIDTH, height: ts });

        const isBossLevel = this.index === 14;
        const tileCount = Math.min(6 + Math.floor(this.index / 2), 10);
        const difficulty = Math.min(this.index + 1, 12);
        const diffMultiplier = 1 + this.index * 0.12;

        const tileLayouts = [
            [{ x: 200, y: 350, w: 2 }, { x: 400, y: 300, w: 1 }, { x: 550, y: 350, w: 2 }, { x: 300, y: 250, w: 2 }, { x: 600, y: 220, w: 1 }],
            [{ x: 150, y: 360, w: 2 }, { x: 400, y: 300, w: 2 }, { x: 600, y: 360, w: 1 }, { x: 250, y: 240, w: 1 }, { x: 500, y: 200, w: 2 }, { x: 650, y: 140, w: 1 }],
            [{ x: 100, y: 350, w: 2 }, { x: 350, y: 280, w: 2 }, { x: 550, y: 350, w: 1 }, { x: 200, y: 220, w: 1 }, { x: 450, y: 180, w: 2 }, { x: 620, y: 120, w: 1 }],
            [{ x: 180, y: 360, w: 2 }, { x: 420, y: 300, w: 1 }, { x: 580, y: 360, w: 2 }, { x: 300, y: 250, w: 2 }, { x: 500, y: 160, w: 1 }, { x: 660, y: 100, w: 2 }],
            [{ x: 120, y: 350, w: 1 }, { x: 350, y: 300, w: 2 }, { x: 550, y: 340, w: 1 }, { x: 450, y: 240, w: 2 }, { x: 620, y: 180, w: 1 }, { x: 690, y: 120, w: 1 }],
            [{ x: 200, y: 360, w: 2 }, { x: 400, y: 290, w: 1 }, { x: 580, y: 350, w: 2 }, { x: 280, y: 230, w: 1 }, { x: 480, y: 170, w: 2 }, { x: 640, y: 110, w: 1 }],
            [{ x: 150, y: 350, w: 1 }, { x: 380, y: 300, w: 2 }, { x: 600, y: 340, w: 2 }, { x: 250, y: 220, w: 2 }, { x: 520, y: 160, w: 1 }, { x: 670, y: 100, w: 2 }],
            [{ x: 180, y: 360, w: 2 }, { x: 420, y: 310, w: 1 }, { x: 560, y: 350, w: 2 }, { x: 320, y: 250, w: 2 }, { x: 500, y: 180, w: 1 }, { x: 650, y: 120, w: 1 }],
            [{ x: 100, y: 350, w: 2 }, { x: 350, y: 280, w: 2 }, { x: 540, y: 340, w: 1 }, { x: 220, y: 230, w: 1 }, { x: 460, y: 170, w: 2 }, { x: 630, y: 110, w: 2 }],
            [{ x: 130, y: 360, w: 1 }, { x: 380, y: 300, w: 2 }, { x: 570, y: 350, w: 2 }, { x: 270, y: 240, w: 2 }, { x: 490, y: 180, w: 1 }, { x: 660, y: 100, w: 1 }],
        ];
        const extraTiles = [
            { x: 350, y: 380, w: 1 }, { x: 500, y: 320, w: 1 }, { x: 200, y: 280, w: 1 }, { x: 600, y: 260, w: 1 }, { x: 400, y: 200, w: 1 },
        ];
        const layout = tileLayouts[Math.min(this.index, tileLayouts.length - 1)];
        const tiles = layout.slice(0, tileCount - 1);
        while (tiles.length < tileCount - 1) {
            tiles.push(extraTiles[(tiles.length - layout.length) % extraTiles.length]);
        }
        const th = TILE_HEIGHT;
        const pw = PLATFORM_WIDTH;
        for (const t of tiles) {
            this.platforms.push({
                x: t.x,
                y: t.y,
                width: pw,
                height: th
            });
        }
        this.platforms.push({ x: CANVAS_WIDTH - 100, y: 80, width: 100, height: ts });

        this.door = new Door(CANVAS_WIDTH - PLATFORM_WIDTH, 16, 48, 64);

        const template = this.platforms.filter(p => p.y < groundPlatformY - ts);
        this.useKey = false; // Every level uses enemies now

        // Every stage has enemies; each stage adds more (1, 2, 3, ... up to 12, then boss)
        const enemyCount = isBossLevel ? 1 : Math.min(this.index + 1, 12);
        const hp = isBossLevel
            ? Math.floor((BOSS_HP + this.index * 25) * diffMultiplier)
            : Math.floor((ENEMY_BASE_HP + difficulty * 10) * diffMultiplier);
        const dmg = isBossLevel
            ? BOSS_DAMAGE + Math.floor(this.index * 3)
            : Math.floor((ENEMY_BASE_DAMAGE + difficulty * 2.5) * diffMultiplier);
        const speed = isBossLevel ? 1.3 + this.index * 0.08 : 1.5 + difficulty * 0.2;
        const attackCd = Math.max(20, (isBossLevel ? BOSS_ATTACK_COOLDOWN : ENEMY_ATTACK_COOLDOWN) - difficulty * 6);
        const attackRange = isBossLevel ? BOSS_ATTACK_RANGE + this.index * 5 : ENEMY_ATTACK_RANGE + Math.floor(difficulty) * 8;

        const groundStandY = CANVAS_HEIGHT - ts - 32;
        const spawnPlatforms = template.filter(p => p.x < CANVAS_WIDTH - 150);
        const platformsByHeight = [...spawnPlatforms].sort((a, b) => a.y - b.y);
        const topPlat = platformsByHeight[0] || { x: 350, width: 64, y: 200 };
        const midPlat = platformsByHeight[Math.floor(platformsByHeight.length / 2)] || topPlat;
        const botPlat = platformsByHeight[platformsByHeight.length - 1] || { x: 200, width: 200, y: 350 };

        for (let i = 0; i < enemyCount; i++) {
            let ex, ey;
            if (isBossLevel) {
                ex = CANVAS_WIDTH / 2 - 32;
                ey = groundStandY;
            } else {
                const tier = i % 3;
                if (tier === 0) {
                    ex = 100 + (i * 127) % 520;
                    ey = groundStandY;
                } else if (tier === 1) {
                    ex = midPlat.x + 15 + (i * 67) % Math.max(20, midPlat.width - 30);
                    ey = midPlat.y - 32;
                } else {
                    ex = topPlat.x + 15 + (i * 83) % Math.max(20, topPlat.width - 30);
                    ey = topPlat.y - 32;
                }
                ex = Math.max(80, Math.min(CANVAS_WIDTH - 112, ex));
            }
            this.enemies.push(new Enemy(ex, ey, isBossLevel ? 64 : 32, isBossLevel ? 48 : 32, hp, dmg, isBossLevel, {
                speed,
                patrolRange: 80 + difficulty * 6,
                attackCooldown: attackCd,
                attackRange
            }));
        }

        // Healing items on level 6 and above
        if (this.index >= 5 && !isBossLevel && template.length > 0) {
            const plat = template[Math.floor(template.length / 2)];
            const hx = plat.x + plat.width / 2 - 12;
            const hy = plat.y - 28;
            this.healingItems.push(new HealingItem(hx, hy));
        }
    }

    allEnemiesDefeated() {
        return this.enemies.length === 0 || this.enemies.every(e => e.health <= 0);
    }

    canUnlockDoor(keyCollected) {
        if (this.useKey) return keyCollected;
        return this.allEnemiesDefeated();
    }
}

// ============================================
// GAME CLASS
// ============================================
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;

        this.player = new Player();
        this.particles = [];
        this.levels = [];
        this.currentLevelIndex = 0;
        this.currentLevel = null;
        this.keyCollected = false;

        this.state = 'title'; // title, playing, levelComplete, gameOver, ending, transition, paused
        this.lastTime = 0;
        this.fadeAlpha = 0;
        this.keys = { left: false, right: false };

        this.doorTransitionTimer = 0;
        this.bgPhase = 0;

        this.bindElements();
        this.bindEvents();
        this.bindMobileControls();
        this.buildLevels();
        this.detectMobile();
    }

    bindElements() {
        this.titleScreen = document.getElementById('title-screen');
        this.levelCompleteScreen = document.getElementById('level-complete-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.endingScreen = document.getElementById('ending-screen');
        this.pauseOverlay = document.getElementById('pause-overlay');
        this.healthBar = document.getElementById('health-bar');
        this.levelIndicator = document.getElementById('level-indicator');
        this.dashCooldownBar = document.getElementById('dash-cooldown-bar');
        this.powerSlashCooldownBar = document.getElementById('power-slash-cooldown-bar');
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
        document.getElementById('play-again-btn').addEventListener('click', () => this.playAgain());
        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) resumeBtn.addEventListener('click', () => this.resumeFromPause());
        // Tap/click to start on title screen
        this.titleScreen.addEventListener('click', (e) => {
            if (this.state === 'title' && e.target.closest('#title-screen')) {
                soundManager.resume();
                this.startGame();
            }
        });
        this.titleScreen.addEventListener('touchend', (e) => {
            if (this.state === 'title' && e.target.closest('#title-screen')) {
                e.preventDefault();
                soundManager.resume();
                this.startGame();
            }
        }, { passive: false });
    }

    detectMobile() {
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isNarrow = window.innerWidth <= 768;
        document.body.classList.toggle('is-mobile', isTouch || isNarrow);
    }

    resumeFromPause() {
        if (this.state === 'paused') {
            this.state = 'playing';
            this.pauseOverlay.classList.add('hidden');
        }
    }

    bindMobileControls() {
        const joystickBase = document.getElementById('joystick-base');
        const joystickStick = document.getElementById('joystick-stick');
        const jump = document.getElementById('btn-jump');
        const attack = document.getElementById('btn-attack');
        const dash = document.getElementById('btn-dash');
        const power = document.getElementById('btn-power');
        const interact = document.getElementById('btn-interact');
        const preventTouch = (e) => e.preventDefault();

        // Virtual joystick (left/right = move, up = jump)
        if (joystickBase && joystickStick) {
            let jumpTriggeredThisHold = false;
            const updateStick = (clientX, clientY) => {
                const rect = joystickBase.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const radius = rect.width / 2 - 20;
                let dx = clientX - cx;
                let dy = clientY - cy;
                // Clamp to circular boundary
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius) {
                    const s = radius / dist;
                    dx *= s;
                    dy *= s;
                }
                joystickBase.classList.add('active');
                joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                const deadZone = radius * 0.25;
                const jumpThreshold = radius * 0.4;
                this.keys.left = dx < -deadZone;
                this.keys.right = dx > deadZone;
                // Up = jump (once per stick hold)
                if (dy < -jumpThreshold && !jumpTriggeredThisHold && (this.state === 'playing' || this.state === 'paused')) {
                    jumpTriggeredThisHold = true;
                    this.player.jump();
                }
            };
            const resetStick = () => {
                jumpTriggeredThisHold = false;
                joystickBase.classList.remove('active');
                joystickStick.style.transform = 'translate(-50%, -50%)';
                this.keys.left = false;
                this.keys.right = false;
                document.removeEventListener('touchmove', onDocTouchMove);
                document.removeEventListener('touchend', onDocTouchEnd);
            };
            const onDocTouchMove = (e) => {
                if (e.touches.length > 0) {
                    e.preventDefault();
                    const t = e.touches[0];
                    updateStick(t.clientX, t.clientY);
                }
            };
            const onDocTouchEnd = (e) => {
                if (e.touches.length === 0) {
                    e.preventDefault();
                    resetStick();
                }
            };
            joystickBase.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const t = e.touches[0];
                updateStick(t.clientX, t.clientY);
                document.addEventListener('touchmove', onDocTouchMove, { passive: false });
                document.addEventListener('touchend', onDocTouchEnd, { passive: false });
            }, { passive: false });
            joystickBase.addEventListener('touchcancel', resetStick);
            joystickBase.addEventListener('mousedown', (e) => {
                e.preventDefault();
                updateStick(e.clientX, e.clientY);
                const onMouseMove = (ev) => updateStick(ev.clientX, ev.clientY);
                const onMouseUp = () => {
                    resetStick();
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
            joystickBase.addEventListener('contextmenu', preventTouch);
        }

        const bindBtn = (el, onDown, onUp) => {
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
            el.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); }, { passive: false });
            el.addEventListener('mousedown', () => onDown());
            el.addEventListener('mouseup', () => onUp());
            el.addEventListener('mouseleave', () => onUp());
        };

        bindBtn(jump, () => {
            if (this.state === 'playing' || this.state === 'paused') this.player.jump();
        }, () => {});
        bindBtn(attack, () => {
            if (this.state === 'playing' || this.state === 'paused') this.player.attack();
        }, () => {});
        bindBtn(dash, () => {
            if (this.state === 'playing' || this.state === 'paused') this.player.useDash();
        }, () => {});
        bindBtn(power, () => {
            if (this.state === 'playing' || this.state === 'paused') this.player.usePowerSlash();
        }, () => {});
        bindBtn(interact, () => {
            if ((this.state === 'playing' || this.state === 'paused') &&
                this.currentLevel?.door?.isPlayerNear(this.player) && !this.currentLevel.door.locked) {
                this.enterDoor();
            }
        }, () => {});

        // Prevent context menu / long-press on action buttons
        [jump, attack, dash, power, interact].filter(Boolean).forEach(el => {
            el?.addEventListener('contextmenu', preventTouch);
        });
    }

    buildLevels() {
        this.levels = [];
        for (let i = 0; i < 15; i++) {
            this.levels.push(new Level(i));
        }
    }

    onKeyDown(e) {
        if (e.key === 'Escape') {
            if (this.state === 'playing') {
                this.state = 'paused';
                this.pauseOverlay.classList.remove('hidden');
            } else if (this.state === 'paused') {
                this.state = 'playing';
                this.pauseOverlay.classList.add('hidden');
            }
            e.preventDefault();
            return;
        }

        if (this.state === 'title' && e.key === 'Enter') {
            soundManager.resume();
            this.startGame();
            return;
        }

        if (this.state !== 'playing' && this.state !== 'paused') return;

        switch (e.key) {
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.keys.left = true;
                e.preventDefault();
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.keys.right = true;
                e.preventDefault();
                break;
            case 'ArrowUp':
            case 'w':
            case 'W':
                this.player.jump();
                e.preventDefault();
                break;
            case ' ':
                this.player.attack();
                e.preventDefault();
                break;
            case 'q':
            case 'Q':
                this.player.useDash();
                e.preventDefault();
                break;
            case 'r':
            case 'R':
                this.player.usePowerSlash();
                e.preventDefault();
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                e.preventDefault();
                break;
            case 'e':
            case 'E':
                if (this.currentLevel.door && this.currentLevel.door.isPlayerNear(this.player) && !this.currentLevel.door.locked) {
                    this.enterDoor();
                }
                e.preventDefault();
                break;
        }
    }

    onKeyUp(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
    }

    startGame() {
        this.titleScreen.classList.add('hidden');
        this.state = 'playing';
        this.currentLevelIndex = 0;
        this.keyCollected = false;
        this.loadLevel(this.currentLevelIndex);
        this.gameLoop();
    }

    loadLevel(index) {
        this.currentLevel = this.levels[index];
        this.keyCollected = this.currentLevel.useKey ? false : true;
        this.player.reset(this.currentLevel.playerStartX, this.currentLevel.playerStartY);

        if (!this.currentLevel.useKey && this.currentLevel.enemies.length > 0) {
            this.currentLevel.door.locked = true;
        }
        if (this.currentLevel.useKey && this.currentLevel.enemies.length > 0) {
            this.currentLevel.door.locked = true;
        }

        this.levelIndicator.textContent = `Level ${index + 1}`;
        this.particles = [];
    }

    enterDoor() {
        soundManager.playDoorSound();
        soundManager.playLevelCompleteSound();
        this.state = 'levelComplete';
        this.levelCompleteScreen.classList.remove('hidden');
        const msg = this.currentLevelIndex >= 14 ? 'Multiverse saved!' : `World ${this.currentLevelIndex + 1} complete!`;
        document.getElementById('level-complete-message').textContent = msg;
    }

    update() {
        if (this.state === 'levelComplete') {
            this.levelCompleteTimer = (this.levelCompleteTimer || 90) - 1;
            if (this.levelCompleteTimer <= 0) {
                this.levelCompleteScreen.classList.add('hidden');
                this.levelCompleteTimer = null;
                this.currentLevelIndex++;
                if (this.currentLevelIndex >= 15) {
                    this.state = 'ending';
                    this.endingScreen.classList.remove('hidden');
                } else {
                    this.state = 'transition';
                    this.fadeAlpha = 0;
                    this.doorTransitionTimer = 30;
                }
            }
            return;
        }

        if (this.state === 'transition') {
            this.doorTransitionTimer--;
            this.fadeAlpha = 1 - this.doorTransitionTimer / 30;
            if (this.doorTransitionTimer <= 0) {
                this.loadLevel(this.currentLevelIndex);
                this.state = 'playing';
                this.fadeAlpha = 1;
                this.fadeInTimer = 30;
            }
            return;
        }

        if (this.state === 'playing' && this.fadeInTimer) {
            this.fadeInTimer--;
            this.fadeAlpha = this.fadeInTimer / 30;
        }

        if (this.state !== 'playing') return;

        // Apply movement from key state (skip when dashing)
        if (!this.player.dashing) {
            if (this.keys.left && !this.keys.right) this.player.move(-1);
            else if (this.keys.right && !this.keys.left) this.player.move(1);
            else this.player.move(0);
        } else {
            this.player.vx = (this.player.facingRight ? 1 : -1) * DASH_SPEED;
        }
        this.player.update(this.currentLevel.platforms, this.dtScale || 1);

        for (const enemy of this.currentLevel.enemies) {
            if (enemy.health <= 0) continue;
            enemy.update(this.currentLevel.platforms, this.player, this.dtScale || 1);

            // Contact damage
            if (this.player.collidesWith(enemy)) {
                this.player.takeDamage(enemy.damage);
                if (this.player.health <= 0) {
                    this.state = 'gameOver';
                    this.gameOverScreen.classList.remove('hidden');
                }
            }

            // Enemy attack damage (deal damage once per attack when hitbox is active)
            if (enemy.attacking && enemy.attackTimer > 8 && !enemy.attackDealtThisRound) {
                const ar = enemy.getAttackRect();
                if (this.player.x < ar.x + ar.width && this.player.x + this.player.width > ar.x &&
                    this.player.y < ar.y + ar.height && this.player.y + this.player.height > ar.y) {
                    enemy.attackDealtThisRound = true;
                    this.player.takeDamage(enemy.damage);
                    if (this.player.health <= 0) {
                        this.state = 'gameOver';
                        this.gameOverScreen.classList.remove('hidden');
                    }
                }
            }
        }

        if (this.currentLevel.key && this.currentLevel.key.collidesWith(this.player)) {
            this.currentLevel.key.collect();
            this.keyCollected = true;
        }

        for (const item of this.currentLevel.healingItems || []) {
            if (item.collidesWith(this.player)) {
                item.collect(this.player);
                soundManager.playHealSound();
            }
        }

        if (this.keyCollected || !this.currentLevel.useKey) {
            if (this.currentLevel.canUnlockDoor(this.keyCollected)) {
                this.currentLevel.door.unlock();
            }
        }

        this.currentLevel.door.update();

        if (this.currentLevel.key) this.currentLevel.key.update();
        for (const item of this.currentLevel.healingItems || []) item.update();

        if (this.player.isAttackActive()) {
            const ar = this.player.getAttackRect();
            const damage = this.player.getAttackDamage();
            for (const enemy of this.currentLevel.enemies) {
                if (enemy.health <= 0) continue;
                if (ar.x < enemy.x + enemy.width && ar.x + ar.width > enemy.x &&
                    ar.y < enemy.y + enemy.height && ar.y + ar.height > enemy.y) {
                    enemy.takeDamage(damage);
                    if (enemy.health <= 0) {
                        soundManager.playEnemyDefeatSound();
                        for (let i = 0; i < 12; i++) {
                            const angle = (Math.PI * 2 * i) / 12;
                            this.particles.push(new Particle(
                                enemy.x + enemy.width / 2,
                                enemy.y + enemy.height / 2,
                                Math.cos(angle) * 4,
                                Math.sin(angle) * 4,
                                enemy.isBoss ? 'rgb(255, 0, 64)' : 'rgb(191, 0, 255)',
                                30
                            ));
                        }
                    }
                }
            }
        }

        this.particles = this.particles.filter(p => {
            p.update(this.dtScale || 1);
            return !p.isDead();
        });
    }

    drawDynamicBackground() {
        const t = this.bgPhase || 0;
        const ctx = this.ctx;

        const b = 0.04 + Math.sin(t * 0.2) * 0.01;
        const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        grad.addColorStop(0, `rgba(8, 8, 22, 1)`);
        grad.addColorStop(0.3, `rgba(12, 10, 28, 1)`);
        grad.addColorStop(0.6, `rgba(10, 12, 24, 1)`);
        grad.addColorStop(1, `rgba(5, 8, 18, 1)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const parallax = (i, speed) => ((t * speed * 30 + i * 150) % (CANVAS_WIDTH + 250)) - 80;
        ctx.fillStyle = 'rgba(0, 30, 50, 0.35)';
        for (let i = 0; i < 4; i++) {
            const ox = parallax(i, 0.25);
            ctx.beginPath();
            ctx.moveTo(ox, CANVAS_HEIGHT);
            ctx.lineTo(ox + 100, CANVAS_HEIGHT - 100 - i * 25);
            ctx.lineTo(ox + 220, CANVAS_HEIGHT - 60);
            ctx.lineTo(ox + 360, CANVAS_HEIGHT);
            ctx.closePath();
            ctx.fill();
        }

        ctx.fillStyle = 'rgba(30, 0, 50, 0.25)';
        for (let i = 0; i < 3; i++) {
            const ox = parallax(i + 10, 0.4);
            ctx.beginPath();
            ctx.moveTo(ox, CANVAS_HEIGHT);
            ctx.lineTo(ox + 140, CANVAS_HEIGHT - 70);
            ctx.lineTo(ox + 320, CANVAS_HEIGHT);
            ctx.closePath();
            ctx.fill();
        }

        for (let i = 0; i < 20; i++) {
            const x = (i * 113 + Math.floor(t * 40)) % (CANVAS_WIDTH + 50) - 25;
            const y = (i * 67 + 40) % (CANVAS_HEIGHT - 60);
            const flicker = 0.4 + Math.sin(t * 1.5 + i * 0.5) * 0.25;
            ctx.fillStyle = `rgba(0, 212, 255, ${flicker * 0.12})`;
            ctx.fillRect(x, y, 2, 2);
        }

        ctx.fillStyle = `rgba(0, 0, 0, ${0.025 + Math.sin(t * 2) * 0.008})`;
        for (let y = 0; y < CANVAS_HEIGHT; y += 6) ctx.fillRect(0, y, CANVAS_WIDTH, 1);
    }

    draw() {
        this.drawDynamicBackground();

        if (this.state === 'playing' || this.state === 'paused' || this.state === 'transition') {
            if (this.currentLevel) {
                this.currentLevel.platforms.forEach(p => {
                    this.ctx.fillStyle = '#2a2a3e';
                    this.ctx.fillRect(p.x, p.y, p.width, p.height);
                    this.ctx.strokeStyle = '#00ff41';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(p.x, p.y, p.width, p.height);
                });

                this.currentLevel.door.draw(this.ctx);

                if (this.currentLevel.key) this.currentLevel.key.draw(this.ctx);
                for (const item of this.currentLevel.healingItems || []) item.draw(this.ctx);

                for (const enemy of this.currentLevel.enemies) {
                    if (enemy.health > 0) enemy.draw(this.ctx);
                }

                this.particles.forEach(p => p.draw(this.ctx));

                this.player.draw(this.ctx);
            }

            this.healthBar.style.width = `${(this.player.health / this.player.maxHealth) * 100}%`;
            this.dashCooldownBar.style.width = `${(1 - this.player.dashCooldown / DASH_COOLDOWN) * 100}%`;
            this.powerSlashCooldownBar.style.width = `${(1 - this.player.powerSlashCooldown / POWER_SLASH_COOLDOWN) * 100}%`;
        }

        if (this.state === 'transition' && this.fadeAlpha > 0) {
            this.ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
            this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        if (this.state === 'playing' && this.fadeInTimer > 0) {
            this.ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeInTimer / 30})`;
            this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
    }

    gameLoop(timestamp = 0) {
        const deltaTime = this.lastTime ? timestamp - this.lastTime : 16.67;
        this.lastTime = timestamp;
        // Scale factor: game assumes 60fps (~16.67ms per frame). Cap dt to avoid physics explosions.
        this.dtScale = Math.min(Math.max(deltaTime, 1) / 16.67, 3);
        this.bgPhase = (this.bgPhase || 0) + 0.012;

        this.update();
        this.draw();

        if (this.state !== 'gameOver' && this.state !== 'ending') {
            requestAnimationFrame((t) => this.gameLoop(t));
        }
    }

    restart() {
        this.gameOverScreen.classList.add('hidden');
        this.state = 'playing';
        this.currentLevelIndex = 0;
        this.keyCollected = false;
        this.buildLevels();
        this.loadLevel(0);
        this.gameLoop();
    }

    playAgain() {
        this.endingScreen.classList.add('hidden');
        this.startGame();
    }
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
