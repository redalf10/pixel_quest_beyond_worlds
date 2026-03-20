/**
 * LEVEL CLASS
 */
import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    TILE_SIZE,
    TILE_HEIGHT,
    PLATFORM_WIDTH,
    ENEMY_BASE_HP,
    ENEMY_BASE_DAMAGE,
    ENEMY_ATTACK_RANGE,
    ENEMY_ATTACK_COOLDOWN,
    BOSS_HP,
    BOSS_DAMAGE,
    BOSS_ATTACK_RANGE,
    BOSS_ATTACK_COOLDOWN
} from '../constants.js';
import { Enemy } from './Enemy.js';
import { Door } from './Door.js';
import { Key } from './Key.js';
import { HealingItem } from './HealingItem.js';

export class Level {
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
        this.backgroundColor = this.getBackgroundColorForLevel(index);
        this.build();
    }

    getBackgroundColorForLevel(index) {
        // Array of background color themes for each level
        const colorThemes = [
            { base: '#080816', mid1: '#0c0a1c', mid2: '#0a0c18', dark: '#050812', accent: '00a8ff' }, // Level 0 - Cool Blue
            { base: '#1a0f0f', mid1: '#2a1010', mid2: '#1a0a08', dark: '#0f0505', accent: 'ff6b00' }, // Level 1 - Orange Red
            { base: '#0f1a0f', mid1: '#0a2a0a', mid2: '#081a08', dark: '#050f05', accent: '00ff41' }, // Level 2 - Green
            { base: '#1a0f1a', mid1: '#2a1a2a', mid2: '#1a0a1a', dark: '#0f050f', accent: 'ff00ff' }, // Level 3 - Purple
            { base: '#1a1308', mid1: '#2a2008', mid2: '#1a1208', dark: '#0f0805', accent: 'ffff00' }, // Level 4 - Yellow
            { base: '#0f1a1a', mid1: '#0a2a2a', mid2: '#081a1a', dark: '#050f0f', accent: '00ffff' }, // Level 5 - Cyan
            { base: '#160a10', mid1: '#240a18', mid2: '#140a0f', dark: '#0a0508', accent: 'ff1493' }, // Level 6 - Hot Pink
            { base: '#0a160a', mid1: '#082408', mid2: '#061408', dark: '#040805', accent: '32ff7f' }, // Level 7 - Lime Green
            { base: '#1a0a0a', mid1: '#2a1010', mid2: '#1a0808', dark: '#0f0404', accent: 'ff4444' }, // Level 8 - Red
            { base: '#0a0a16', mid1: '#0a0a2a', mid2: '#080808', dark: '#040404', accent: '4444ff' }, // Level 9 - Deep Blue
            { base: '#1a1a0a', mid1: '#2a2408', mid2: '#1a1808', dark: '#0f0f05', accent: 'ffcc00' }, // Level 10 - Gold
            { base: '#160816', mid1: '#240824', mid2: '#140814', dark: '#0a0408', accent: 'cc44ff' }, // Level 11 - Violet
            { base: '#0f180f', mid1: '#082a08', mid2: '#061a06', dark: '#040a04', accent: '44ff88' }, // Level 12 - Spring Green
            { base: '#1a0916', mid1: '#2a1220', mid2: '#1a0814', dark: '#0f0508', accent: 'ff44aa' }, // Level 13 - Rose
            { base: '#080816', mid1: '#101030', mid2: '#0a0a1a', dark: '#050508', accent: '8844ff' }  // Level 14 - Indigo (Boss)
        ];
        
        return colorThemes[Math.min(index, colorThemes.length - 1)];
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
