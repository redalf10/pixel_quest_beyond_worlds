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
    constructor(character = 'player_1') {
        this.character = character;
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
        
        // Animation
        this.sprites = {
            idle: [],
            run: [],
            attack: []
        };
        this.currentAnimation = 'idle';
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.frameSpeed = 6; // Lower = faster
        
        this.loadSprites();
    }
    
    loadSprites() {
        // Load sprite sheets from the selected character folder
        // Dynamically detect available frames for each animation
        const spriteData = [
            { name: 'idle', maxFrames: 5 },
            { name: 'run', maxFrames: 5 },
            { name: 'attack', maxFrames: 3 }
        ];
        
        spriteData.forEach(data => {
            // Try to load frames 1-maxFrames, but only add valid ones
            for (let i = 1; i <= data.maxFrames; i++) {
                const img = new Image();
                const src = `./${this.character}/${data.name}_${i}.png`;
                
                // Only add to sprites array AFTER confirming it loads successfully
                img.onload = () => {
                    // Image loaded successfully, add it
                    this.sprites[data.name].push(img);
                };
                
                img.onerror = () => {
                    // Image failed to load, log warning but don't add it
                    console.warn(`Sprite not found: ${src}`);
                };
                
                // Start loading the image
                img.src = src;
            }
        });
    }

    update(platforms, dtScale = 1) {
        // Update animation
        this.updateAnimation();
        
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

    updateAnimation() {
        // Determine which animation should play
        let nextAnimation = 'idle';
        
        if (this.attacking || this.powerSlashing) {
            nextAnimation = 'attack';
        } else if (Math.abs(this.vx) > 0.5) {
            nextAnimation = 'run';
        } else {
            nextAnimation = 'idle';
        }
        
        // Switch animation if state changed
        if (nextAnimation !== this.currentAnimation) {
            this.currentAnimation = nextAnimation;
            this.currentFrame = 0;
            this.frameTimer = 0;
        }
        
        // Update frame timer
        this.frameTimer++;
        if (this.frameTimer >= this.frameSpeed) {
            this.frameTimer = 0;
            this.currentFrame++;
            
            // Loop animation
            const maxFrame = this.sprites[this.currentAnimation].length;
            if (this.currentFrame >= maxFrame) {
                this.currentFrame = 0;
            }
        }
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

        const x = this.x;
        const y = this.y;
        const currentSprite = this.sprites[this.currentAnimation][this.currentFrame];
        
        // Draw sprite
        if (currentSprite && currentSprite.complete) {
            ctx.save();
            
            const spriteWidth = 48;
            const spriteHeight = 64;
            const offsetX = (spriteWidth - this.width) / 2;
            const offsetY = spriteHeight - this.height;
            
            // Flip sprite if facing left
            if (!this.facingRight) {
                ctx.translate(x + spriteWidth - offsetX, y - offsetY);
                ctx.scale(-1, 1);
                ctx.drawImage(currentSprite, 0, 0, spriteWidth, spriteHeight);
            } else {
                ctx.drawImage(currentSprite, x - offsetX, y - offsetY, spriteWidth, spriteHeight);
            }
            
            ctx.restore();
        }

        // ── DASH TRAIL ─────────────────────────────────────────────────
        if (this.dashing) {
            const c = this.color;
            ctx.fillStyle = c + '55';
            ctx.fillRect(this.facingRight ? x - 10 : x + this.width, y + 2, 10, this.height - 4);
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
