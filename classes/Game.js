/**
 * GAME CLASS
 */
import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    DASH_SPEED,
    DASH_COOLDOWN,
    DASH_DURATION,
    POWER_SLASH_COOLDOWN
} from '../constants.js';
import { SoundManager } from './SoundManager.js';
import { Player } from './Player.js';
import { Particle } from './Particle.js';
import { Level } from './Level.js';

const soundManager = new SoundManager();

export class Game {
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
