const Audio = {
    ctx: null,
    enabled: true,
    volume: 0.5,
    musicVolume: 0.3,
    _initialized: false,

    // ─── MUSIC SYSTEM ───
    _currentMusic: null,      // HTMLAudioElement currently playing
    _currentMusicId: null,    // ID of current track
    _nextMusic: null,         // For crossfade
    _fadeInterval: null,

    // Music tracks — file paths or procedural IDs
    MUSIC: {
        title:      { src: 'assets/audio/title.ogg',      procedural: 'title' },
        villaggio:  { src: 'assets/audio/villaggio.ogg',   procedural: 'overworld_calm' },
        foresta:    { src: 'assets/audio/foresta.ogg',     procedural: 'overworld_dark' },
        montagna:   { src: 'assets/audio/montagna.ogg',    procedural: 'overworld_epic' },
        tempio:     { src: 'assets/audio/tempio.ogg',      procedural: 'overworld_mystic' },
        citta:      { src: 'assets/audio/citta.ogg',       procedural: 'overworld_urban' },
        combat:     { src: 'assets/audio/combat.ogg',      procedural: 'combat' },
        victory:    { src: 'assets/audio/victory.ogg',     procedural: 'victory_fanfare' },
        defeat:     { src: 'assets/audio/defeat.ogg',      procedural: 'defeat_theme' }
    },

    init() {
        // AudioContext requires user interaction first. We attach unlock hooks
        // on window (capture phase) AND expose Audio.unlock() for input modules
        // to call directly from their event handlers — iOS Safari is fussy.
        const resume = () => this.unlock();
        window.addEventListener('click', resume, { capture: true, passive: true });
        window.addEventListener('touchstart', resume, { capture: true, passive: true });
        window.addEventListener('pointerdown', resume, { capture: true, passive: true });
        window.addEventListener('keydown', resume, { capture: true, passive: true });
    },

    // Idempotent — safe to call from every tap/key handler.
    unlock() {
        const firstTime = !this._initialized;
        if (firstTime) {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this._initialized = true;
            } catch (e) { return; }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        if (firstTime && this._currentMusicId && !this._procInterval && !this._currentMusic) {
            const pending = this._currentMusicId;
            this._currentMusicId = null; // force restart
            this.playMusic(pending);
        }
    },

    // ─── MUSIC PLAYBACK ───

    playMusic(id) {
        if (!this.enabled) return;
        if (this._currentMusicId === id) return; // Already playing

        const track = this.MUSIC[id];
        if (!track) return;

        // Stop current with fade
        this.stopMusic(500);

        this._currentMusicId = id;

        // Try loading the actual file first
        const audio = new window.Audio();
        audio.src = track.src;
        audio.loop = true;
        audio.volume = 0;

        audio.addEventListener('canplaythrough', () => {
            this._currentMusic = audio;
            this._fadeIn(audio, 800);
        }, { once: true });

        audio.addEventListener('error', () => {
            // File not found — use procedural music
            this._playProceduralMusic(track.procedural || id);
        }, { once: true });

        audio.load();
    },

    stopMusic(fadeMs) {
        if (this._fadeInterval) {
            clearInterval(this._fadeInterval);
            this._fadeInterval = null;
        }

        if (this._currentMusic) {
            if (fadeMs && fadeMs > 0) {
                this._fadeOut(this._currentMusic, fadeMs);
            } else {
                this._currentMusic.pause();
                this._currentMusic.currentTime = 0;
                this._currentMusic = null;
            }
        }
        // Stop procedural music
        if (this._procInterval) {
            clearInterval(this._procInterval);
            this._procInterval = null;
        }
        this._currentMusicId = null;
    },

    _fadeIn(audio, ms) {
        audio.volume = 0;
        audio.play().catch(() => {});
        const step = 30;
        const increment = this.musicVolume / (ms / step);
        this._fadeInterval = setInterval(() => {
            if (audio.volume + increment >= this.musicVolume) {
                audio.volume = this.musicVolume;
                clearInterval(this._fadeInterval);
                this._fadeInterval = null;
            } else {
                audio.volume += increment;
            }
        }, step);
    },

    _fadeOut(audio, ms) {
        const step = 30;
        const decrement = audio.volume / (ms / step);
        const fadeInt = setInterval(() => {
            if (audio.volume - decrement <= 0) {
                audio.volume = 0;
                audio.pause();
                audio.currentTime = 0;
                clearInterval(fadeInt);
                if (this._currentMusic === audio) this._currentMusic = null;
            } else {
                audio.volume -= decrement;
            }
        }, step);
    },

    // ─── PROCEDURAL MUSIC (fallback when no audio files) ───
    _procInterval: null,
    _procStep: 0,

    _playProceduralMusic(type) {
        if (!this._initialized) return;

        const patterns = this._getMusicPattern(type);
        if (!patterns) return;

        this._procStep = 0;
        const bpm = patterns.bpm || 120;
        const stepMs = (60000 / bpm) / 2; // 8th notes

        this._procInterval = setInterval(() => {
            if (!this.enabled) return;
            const noteIdx = this._procStep % patterns.melody.length;
            const freq = patterns.melody[noteIdx];
            const bassIdx = this._procStep % patterns.bass.length;
            const bassFreq = patterns.bass[bassIdx];

            if (freq > 0) {
                this._tone(0.12, freq, freq * 0.98, patterns.wave || 'square', this.musicVolume * 0.4);
            }
            if (bassFreq > 0) {
                this._tone(0.18, bassFreq, bassFreq * 0.97, 'triangle', this.musicVolume * 0.3);
            }
            // Drums on beats
            if (this._procStep % 4 === 0) {
                this._noise(0.05, 100, 50, 'square', this.musicVolume * 0.15);
            }
            if (this._procStep % 4 === 2) {
                this._noise(0.03, 800, 400, 'square', this.musicVolume * 0.08);
            }

            this._procStep++;
        }, stepMs);
    },

    _getMusicPattern(type) {
        // Note frequencies (C4=262, D4=294, E4=330, F4=349, G4=392, A4=440, B4=494, C5=523)
        const C4=262, D4=294, E4=330, F4=349, G4=392, A4=440, B4=494, C5=523;
        const C3=131, D3=147, E3=165, F3=175, G3=196, A3=220, B3=247;

        switch (type) {
            case 'title':
                return {
                    bpm: 100, wave: 'square',
                    melody: [E4,0,G4,0,C5,0,B4,0, A4,0,G4,0,E4,0,D4,0, E4,0,G4,0,A4,0,G4,0, E4,0,D4,0,C4,0,0,0],
                    bass:   [C3,0,0,C3, E3,0,0,E3, A3,0,0,A3, G3,0,0,G3, C3,0,0,C3, E3,0,0,E3, F3,0,0,F3, G3,0,0,G3]
                };
            case 'overworld_calm':
                return {
                    bpm: 110, wave: 'triangle',
                    melody: [C4,0,E4,0,G4,0,E4,0, F4,0,A4,0,G4,0,0,0, E4,0,G4,0,C5,0,B4,0, A4,0,G4,0,E4,0,0,0],
                    bass:   [C3,0,0,0, G3,0,0,0, F3,0,0,0, G3,0,0,0, A3,0,0,0, E3,0,0,0, F3,0,0,0, G3,0,0,0]
                };
            case 'overworld_dark':
                return {
                    bpm: 90, wave: 'square',
                    melody: [E4,0,0,D4, 0,C4,0,0, D4,0,0,E4, 0,0,0,0, F4,0,0,E4, 0,D4,0,0, C4,0,D4,0, 0,0,0,0],
                    bass:   [A3,0,0,0, 0,0,A3,0, E3,0,0,0, 0,0,E3,0, F3,0,0,0, 0,0,F3,0, E3,0,0,0, 0,0,0,0]
                };
            case 'overworld_epic':
                return {
                    bpm: 120, wave: 'square',
                    melody: [G4,0,G4,0, A4,0,B4,0, C5,0,0,B4, A4,0,G4,0, A4,0,A4,0, B4,0,C5,0, B4,0,0,A4, G4,0,0,0],
                    bass:   [C3,0,E3,0, G3,0,0,0, F3,0,A3,0, C3,0,0,0, D3,0,F3,0, A3,0,0,0, G3,0,B3,0, C3,0,0,0]
                };
            case 'overworld_mystic':
                return {
                    bpm: 85, wave: 'sine',
                    melody: [A4,0,0,C5, 0,B4,0,0, A4,0,0,E4, 0,0,0,0, F4,0,0,A4, 0,G4,0,0, E4,0,0,D4, 0,0,0,0],
                    bass:   [A3,0,0,0, E3,0,0,0, A3,0,0,0, E3,0,0,0, F3,0,0,0, C3,0,0,0, D3,0,0,0, E3,0,0,0]
                };
            case 'overworld_urban':
                return {
                    bpm: 130, wave: 'square',
                    melody: [E4,0,E4,G4, 0,A4,0,G4, E4,0,D4,0, 0,0,E4,0, G4,0,G4,A4, 0,C5,0,A4, G4,0,E4,0, 0,0,0,0],
                    bass:   [C3,0,C3,0, E3,0,0,0, G3,0,G3,0, C3,0,0,0, A3,0,A3,0, C3,0,0,0, F3,0,G3,0, C3,0,0,0]
                };
            case 'combat':
                return {
                    bpm: 150, wave: 'square',
                    melody: [E4,E4,0,G4, A4,0,G4,0, E4,0,D4,E4, 0,0,G4,0, A4,A4,0,C5, B4,0,A4,0, G4,0,E4,D4, 0,0,0,0],
                    bass:   [A3,0,A3,0, C3,0,C3,0, D3,0,D3,0, E3,0,E3,0, A3,0,A3,0, F3,0,F3,0, G3,0,G3,0, E3,0,E3,0]
                };
            case 'victory_fanfare':
                return {
                    bpm: 140, wave: 'square',
                    melody: [C5,0,C5,0,C5,0,0,0, G4,0,A4,0,B4,0,C5,0, 0,0,C5,0,0,0,0,0, 0,0,0,0,0,0,0,0],
                    bass:   [C3,0,0,0,E3,0,0,0, F3,0,0,0,G3,0,0,0, C3,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0]
                };
            case 'defeat_theme':
                return {
                    bpm: 70, wave: 'triangle',
                    melody: [E4,0,0,D4, 0,0,C4,0, 0,0,0,0, B3,0,0,0, A3,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
                    bass:   [A3,0,0,0, 0,0,0,0, E3,0,0,0, 0,0,0,0, A3,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]
                };
            default: return null;
        }
    },

    _ensureCtx() {
        if (!this._initialized) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this._initialized = true;
        }
        return this.ctx;
    },

    // ─── SFX GENERATOR (jsfxr-style) ───

    // Play a procedurally generated sound
    play(name) {
        if (!this.enabled || !this._initialized) return;
        const fn = this.SFX[name];
        if (fn) fn.call(this);
    },

    SFX: {
        // ── COMBAT ──
        hit() {
            Audio._noise(0.08, 800, 200, 'sawtooth', 0.4);
        },

        crit() {
            Audio._tone(0.05, 600, 1200, 'square', 0.3);
            setTimeout(() => Audio._noise(0.12, 1000, 100, 'sawtooth', 0.5), 50);
            setTimeout(() => Audio._tone(0.08, 1400, 800, 'square', 0.2), 100);
        },

        evade() {
            Audio._tone(0.1, 400, 800, 'sine', 0.25);
            setTimeout(() => Audio._tone(0.08, 800, 400, 'sine', 0.15), 80);
        },

        draw() {
            Audio._tone(0.15, 300, 300, 'triangle', 0.2);
        },

        ko() {
            Audio._tone(0.1, 600, 100, 'sawtooth', 0.4);
            setTimeout(() => Audio._tone(0.15, 400, 50, 'sawtooth', 0.3), 120);
            setTimeout(() => Audio._noise(0.2, 200, 50, 'square', 0.3), 250);
        },

        // ── MORRA ──
        countdown() {
            Audio._tone(0.08, 440, 440, 'square', 0.2);
        },

        countdownGo() {
            Audio._tone(0.06, 440, 880, 'square', 0.3);
            setTimeout(() => Audio._tone(0.1, 880, 880, 'square', 0.25), 60);
        },

        reveal() {
            Audio._tone(0.04, 300, 600, 'triangle', 0.25);
            setTimeout(() => Audio._tone(0.04, 400, 700, 'triangle', 0.2), 50);
        },

        // ── UI ──
        select() {
            Audio._tone(0.04, 600, 700, 'square', 0.15);
        },

        confirm() {
            Audio._tone(0.05, 500, 800, 'square', 0.2);
            setTimeout(() => Audio._tone(0.06, 800, 1000, 'square', 0.15), 60);
        },

        cancel() {
            Audio._tone(0.06, 500, 300, 'square', 0.15);
        },

        menuOpen() {
            Audio._tone(0.03, 400, 600, 'triangle', 0.15);
            setTimeout(() => Audio._tone(0.03, 500, 700, 'triangle', 0.12), 40);
            setTimeout(() => Audio._tone(0.04, 600, 800, 'triangle', 0.1), 80);
        },

        // ── SPECIAL MOVES ──
        powerUp() {
            // Deep gong + rising chi + low rumble
            Audio._tone(0.5, 110, 90, 'triangle', 0.35);
            setTimeout(() => Audio._tone(0.35, 220, 440, 'sawtooth', 0.22), 60);
            setTimeout(() => Audio._tone(0.4, 330, 660, 'square', 0.18), 180);
            setTimeout(() => Audio._noise(0.25, 200, 80, 'square', 0.12), 260);
        },

        elementSwap() {
            // Sparkly ascending chime (pentatonic-ish)
            const notes = [523, 659, 784, 988, 1175];
            notes.forEach((f, i) => {
                setTimeout(() => Audio._tone(0.12, f, f * 1.1, 'sine', 0.22), i * 50);
            });
            setTimeout(() => Audio._noise(0.18, 3000, 1000, 'sine', 0.08), 260);
        },

        dimensionExit() {
            // Quick whoosh back to reality
            Audio._tone(0.18, 600, 200, 'sine', 0.2);
            setTimeout(() => Audio._noise(0.15, 400, 100, 'sine', 0.1), 80);
        },

        // ── OVERWORLD ──
        npcTalk() {
            Audio._tone(0.03, 300, 500, 'triangle', 0.12);
        },

        step() {
            Audio._noise(0.03, 100, 50, 'square', 0.06);
        },

        transition() {
            Audio._tone(0.08, 300, 600, 'sine', 0.2);
            setTimeout(() => Audio._tone(0.08, 400, 800, 'sine', 0.18), 80);
            setTimeout(() => Audio._tone(0.1, 500, 1000, 'sine', 0.15), 160);
            setTimeout(() => Audio._tone(0.12, 600, 1200, 'sine', 0.12), 250);
        },

        // ── RESULTS ──
        win() {
            const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
            notes.forEach((f, i) => {
                setTimeout(() => Audio._tone(0.12, f, f, 'square', 0.2 - i * 0.03), i * 100);
            });
        },

        lose() {
            const notes = [400, 350, 300, 200];
            notes.forEach((f, i) => {
                setTimeout(() => Audio._tone(0.15, f, f, 'sawtooth', 0.15), i * 150);
            });
        },

        victory() {
            const melody = [523, 523, 523, 659, 784, 659, 784, 1047];
            const durations = [0.08, 0.08, 0.12, 0.08, 0.08, 0.06, 0.06, 0.2];
            let time = 0;
            melody.forEach((f, i) => {
                setTimeout(() => Audio._tone(durations[i], f, f, 'square', 0.2), time);
                time += durations[i] * 1000 + 40;
            });
        },

        defeat() {
            const melody = [400, 380, 350, 300, 250, 200];
            melody.forEach((f, i) => {
                setTimeout(() => Audio._tone(0.2, f, f * 0.9, 'sawtooth', 0.15), i * 200);
            });
        }
    },

    // ─── LOW-LEVEL GENERATORS ───

    _tone(duration, freqStart, freqEnd, type, vol) {
        if (!Audio._initialized) return;
        const ctx = Audio.ctx;
        const t = ctx.currentTime;
        const v = (vol || 0.2) * Audio.volume;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freqStart, t);
        osc.frequency.linearRampToValueAtTime(freqEnd, t + duration);

        gain.gain.setValueAtTime(v, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration + 0.01);
    },

    _noise(duration, freqStart, freqEnd, type, vol) {
        if (!Audio._initialized) return;
        const ctx = Audio.ctx;
        const t = ctx.currentTime;
        const v = (vol || 0.2) * Audio.volume;

        // White noise via buffer
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        // Bandpass filter for tone
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freqStart, t);
        filter.frequency.linearRampToValueAtTime(freqEnd, t + duration);
        filter.Q.value = 2;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(v, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(t);
        noise.stop(t + duration + 0.01);
    }
};
