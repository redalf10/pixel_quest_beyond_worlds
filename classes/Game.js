/**
 * GAME CLASS
 */
import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    DASH_SPEED,
    DASH_COOLDOWN,
    DASH_DURATION,
    POWER_SLASH_COOLDOWN,
    BOMB_COOLDOWN,
    BOMB_DAMAGE,
    BOMB_KNOCKBACK,
    LASER_COOLDOWN,
    HEAL_DROP_CHANCE
} from '../constants.js';
import { SoundManager } from './SoundManager.js';
import { Player } from './Player.js';
import { Particle } from './Particle.js';
import { Level } from './Level.js';
import { Bomb } from './Bomb.js';
import { HealingItem } from './HealingItem.js';

const soundManager = new SoundManager();
const ROUND_TIME_MS = 60_000;

export class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;

        this.player = new Player();
        this.particles = [];
        this.bombs = [];
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
        this.roundTimeRemainingMs = ROUND_TIME_MS;
        this.frameDeltaMs = 16.67;

        this.bindElements();
        this.selectedPlayerColor = '#00ff41';
        this.bindEvents();
        this.bindPlayerColorPicker();
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
        this.bombCooldownBar = document.getElementById('bomb-cooldown-bar');
        this.laserCooldownBar = document.getElementById('laser-cooldown-bar');
        this.roundTimerEl = document.getElementById('round-timer');
        this.playerColorPicker = document.getElementById('player-color-picker');
        this.playerColorChoices = Array.from(document.querySelectorAll('.player-color-choice'));
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
            if (e.target.closest('#player-color-picker')) return;
            if (this.state === 'title' && e.target.closest('#title-screen')) {
                soundManager.resume();
                this.startGame();
            }
        });
        this.titleScreen.addEventListener('touchend', (e) => {
            if (e.target.closest('#player-color-picker')) return;
            if (this.state === 'title' && e.target.closest('#title-screen')) {
                e.preventDefault();
                soundManager.resume();
                this.startGame();
            }
        }, { passive: false });
    }

    bindPlayerColorPicker() {
        if (!this.playerColorChoices?.length) return;

        const applySelection = (color) => {
            if (!color) return;
            this.selectedPlayerColor = color;
            this.player.setColor(color);
            for (const choice of this.playerColorChoices) {
                choice.classList.toggle('is-selected', choice.dataset.color === color);
            }
        };

        for (const choice of this.playerColorChoices) {
            choice.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                applySelection(choice.dataset.color);
            });
            choice.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                applySelection(choice.dataset.color);
            }, { passive: false });
        }

        applySelection(this.playerColorChoices[0]?.dataset.color || this.selectedPlayerColor);
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
        const bomb = document.getElementById('btn-bomb');
        const laser = document.getElementById('btn-laser') || document.getElementById('btn-lazer');
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
        bindBtn(bomb, () => {
            if (this.state === 'playing' || this.state === 'paused') this.triggerBomb();
        }, () => {});
        bindBtn(laser, () => {
            if (this.state === 'playing' || this.state === 'paused') this.triggerLaser();
        }, () => {});
        bindBtn(interact, () => {
            if ((this.state === 'playing' || this.state === 'paused') &&
                this.currentLevel?.door?.isPlayerNear(this.player) && !this.currentLevel.door.locked) {
                this.enterDoor();
            }
        }, () => {});

        // Prevent context menu / long-press on action buttons
        [jump, attack, dash, power, bomb, laser, interact].filter(Boolean).forEach(el => {
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
            case 'f':
            case 'F':
                this.triggerBomb();
                e.preventDefault();
                break;
            case 'x':
            case 'X':
                this.triggerLaser();
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
        this.player.setColor(this.selectedPlayerColor);
        this.titleScreen.classList.add('hidden');
        this.state = 'playing';
        this.currentLevelIndex = 0;
        this.keyCollected = false;
        this.roundTimeRemainingMs = ROUND_TIME_MS;
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
        this.bombs = [];
        this.roundTimeRemainingMs = ROUND_TIME_MS;
        this.updateRoundTimerUI();
    }

    updateRoundTimerUI() {
        if (!this.roundTimerEl) return;
        const totalSeconds = Math.ceil(this.roundTimeRemainingMs / 1000);
        const safeSeconds = Math.max(0, totalSeconds);
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        this.roundTimerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        this.roundTimerEl.classList.toggle('danger', safeSeconds <= 10);
    }

    triggerBomb() {
        if (!this.player.useBomb()) return;
        const x = this.player.facingRight ? this.player.x + this.player.width + 4 : this.player.x - 4;
        const y = this.player.y + this.player.height * 0.45;
        this.bombs.push(new Bomb(x, y, this.player.facingRight));
        soundManager.playBombDeploySound();
    }

    triggerLaser() {
        const beam = this.player.useLaser();
        if (!beam) return;
        soundManager.playLaserSound();
        this.applyLaserDamage(beam);
    }

    applyLaserDamage(beam) {
        const minX = Math.min(beam.startX, beam.endX);
        const maxX = Math.max(beam.startX, beam.endX);
        const minY = beam.startY - beam.thickness / 2;
        const maxY = beam.startY + beam.thickness / 2;

        for (const enemy of this.currentLevel.enemies) {
            if (enemy.health <= 0) continue;
            const ex1 = enemy.x;
            const ex2 = enemy.x + enemy.width;
            const ey1 = enemy.y;
            const ey2 = enemy.y + enemy.height;
            const intersects = ex2 > minX && ex1 < maxX && ey2 > minY && ey1 < maxY;
            if (!intersects) continue;

            enemy.takeDamage(beam.damage);
            enemy.applyBurn?.(beam.burnTicks, beam.burnDamage);

            if (enemy.health <= 0) this.onEnemyDefeated(enemy);
        }
    }

    explodeBomb(bomb) {
        soundManager.playBombExplodeSound();
        const cx = bomb.x;
        const cy = bomb.y;
        const radius = bomb.explosionRadius;

        for (const enemy of this.currentLevel.enemies) {
            if (enemy.health <= 0) continue;
            const ex = enemy.x + enemy.width / 2;
            const ey = enemy.y + enemy.height / 2;
            const dx = ex - cx;
            const dy = ey - cy;
            const distSq = dx * dx + dy * dy;
            if (distSq > radius * radius) continue;

            enemy.takeDamage(BOMB_DAMAGE);
            const dist = Math.max(Math.sqrt(distSq), 1);
            enemy.vx += (dx / dist) * BOMB_KNOCKBACK;
            enemy.vy -= Math.max(2.5, (1 - dist / radius) * BOMB_KNOCKBACK * 0.7);

            if (enemy.health <= 0) this.onEnemyDefeated(enemy);
        }

        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            this.particles.push(new Particle(
                cx,
                cy,
                Math.cos(angle) * 5,
                Math.sin(angle) * 5,
                'rgb(255, 120, 20)',
                24
            ));
        }
    }

    onEnemyDefeated(enemy) {
        if (enemy.defeatHandled) return;
        enemy.defeatHandled = true;

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

        if (Math.random() < HEAL_DROP_CHANCE) {
            const dropX = enemy.x + enemy.width / 2 - 12;
            const dropY = enemy.y + enemy.height - 24;
            (this.currentLevel.healingItems ||= []).push(new HealingItem(dropX, dropY));
        }
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

        this.roundTimeRemainingMs = Math.max(0, this.roundTimeRemainingMs - this.frameDeltaMs);
        this.updateRoundTimerUI();
        if (this.roundTimeRemainingMs <= 0) {
            this.state = 'gameOver';
            this.gameOverScreen.classList.remove('hidden');
            return;
        }

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

            if (enemy.health <= 0) {
                this.onEnemyDefeated(enemy);
                continue;
            }

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

        for (const bomb of this.bombs) {
            const wasExploded = bomb.exploded;
            bomb.update(this.currentLevel.platforms, this.dtScale || 1);
            if (!wasExploded && bomb.exploded) this.explodeBomb(bomb);
        }
        this.bombs = this.bombs.filter((bomb) => !bomb.isExpired());

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
                        this.onEnemyDefeated(enemy);
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

        // Get background colors from current level
        const bgColor = this.currentLevel?.backgroundColor || { 
            base: '#080816', mid1: '#0c0a1c', mid2: '#0a0c18', dark: '#050812', accent: '00a8ff' 
        };
        
        const b = 0.04 + Math.sin(t * 0.2) * 0.01;
        const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        grad.addColorStop(0, `rgba(${this.hexToRgb(bgColor.base)}, 1)`);
        grad.addColorStop(0.3, `rgba(${this.hexToRgb(bgColor.mid1)}, 1)`);
        grad.addColorStop(0.6, `rgba(${this.hexToRgb(bgColor.mid2)}, 1)`);
        grad.addColorStop(1, `rgba(${this.hexToRgb(bgColor.dark)}, 1)`);
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

    hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `${r}, ${g}, ${b}`;
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

                this.bombs.forEach((bomb) => bomb.draw(this.ctx));

                this.particles.forEach(p => p.draw(this.ctx));

                this.player.draw(this.ctx);
            }

            this.healthBar.style.width = `${(this.player.health / this.player.maxHealth) * 100}%`;
            this.dashCooldownBar.style.width = `${(1 - this.player.dashCooldown / DASH_COOLDOWN) * 100}%`;
            this.powerSlashCooldownBar.style.width = `${(1 - this.player.powerSlashCooldown / POWER_SLASH_COOLDOWN) * 100}%`;
            if (this.bombCooldownBar) this.bombCooldownBar.style.width = `${(1 - this.player.bombCooldown / BOMB_COOLDOWN) * 100}%`;
            if (this.laserCooldownBar) this.laserCooldownBar.style.width = `${(1 - this.player.laserCooldown / LASER_COOLDOWN) * 100}%`;
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
        this.frameDeltaMs = Math.min(Math.max(deltaTime, 1), 100);
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
        this.roundTimeRemainingMs = ROUND_TIME_MS;
        this.buildLevels();
        this.loadLevel(0);
        this.bombs = [];
        this.gameLoop();
    }

    playAgain() {
        this.endingScreen.classList.add('hidden');
        this.startGame();
    }
}
