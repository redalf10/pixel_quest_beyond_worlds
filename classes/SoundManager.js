/**
 * SOUND MANAGER - Web Audio API (No external files)
 */
export class SoundManager {
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

    playBombDeploySound() {
        this.playTone(180, 0.06, 'triangle');
    }

    playBombExplodeSound() {
        this.playTone(90, 0.14, 'sawtooth');
        setTimeout(() => this.playTone(65, 0.18, 'sawtooth'), 40);
    }

    playLaserSound() {
        this.playTone(520, 0.06, 'square');
        setTimeout(() => this.playTone(760, 0.08, 'square'), 20);
    }
}
