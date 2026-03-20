/**
 * PIXEL QUEST BEYOND WORLDS - GAME CONSTANTS
 */

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 480;
export const TILE_SIZE = 32;
export const TILE_HEIGHT = 16;
export const PLATFORM_WIDTH = 70;
export const GRAVITY = 0.6;
export const MAX_FALL_SPEED = 16;
export const FRICTION = 0.85;
export const PLAYER_SPEED = 5;
export const PLAYER_JUMP_FORCE = -14;
export const PLAYER_MAX_HP = 100;
export const ENEMY_BASE_HP = 20;
export const ENEMY_BASE_DAMAGE = 8;
export const ENEMY_ATTACK_RANGE = 140; // Long-range attack
export const ENEMY_ATTACK_COOLDOWN = 90; // frames between attacks
export const BOSS_HP = 300;
export const BOSS_DAMAGE = 20;
export const BOSS_ATTACK_RANGE = 200;  // Boss long-range
export const BOSS_ATTACK_COOLDOWN = 45;
export const ATTACK_COOLDOWN = 400;
export const INVINCIBILITY_TIME = 1500;
export const DOOR_INTERACT_RANGE = 50;

// Skill constants
export const DASH_SPEED = 18;
export const DASH_DURATION = 8;       // frames
export const DASH_COOLDOWN = 90;     // frames (~1.5s at 60fps)
export const POWER_SLASH_DAMAGE = 55;
export const POWER_SLASH_DURATION = 20;
export const POWER_SLASH_COOLDOWN = 150; // frames (~2.5s)

// Bomb skill constants
export const BOMB_COOLDOWN = 210;
export const BOMB_FUSE_TIME = 140;
export const BOMB_THROW_SPEED_X = 5.2;
export const BOMB_THROW_SPEED_Y = -6.5;
export const BOMB_EXPLOSION_RADIUS = 110;
export const BOMB_DAMAGE = 90;
export const BOMB_KNOCKBACK = 8;

// Laser skill constants
export const LASER_COOLDOWN = 160;
export const LASER_DURATION = 14;
export const LASER_RANGE = 330;
export const LASER_DAMAGE = 65;
export const LASER_THICKNESS = 24;
export const LASER_BURN_TICKS = 3;
export const LASER_BURN_DAMAGE = 6;

export const HEAL_AMOUNT = 25;
export const HEAL_DROP_CHANCE = 0.35;
