const Input = {
    keys: {},
    justPressed: {},
    _prevKeys: {},

    init() {
        window.addEventListener('keydown', e => {
            e.preventDefault();
            if (typeof Audio !== 'undefined' && Audio.unlock) Audio.unlock();
            this.keys[e.key] = true;
        });
        window.addEventListener('keyup', e => {
            this.keys[e.key] = false;
        });
        this._initDpad();
        this._initButtons();
    },

    // Force a key press to be detected as justPressed on next update
    triggerPress(key) {
        this._forcePressed[key] = true;
    },

    _forcePressed: {},

    update() {
        // Merge forcePressed into justPressed
        this.justPressed = {};
        for (const key in this.keys) {
            this.justPressed[key] = this.keys[key] && !this._prevKeys[key];
        }
        // Apply forced presses (from touch)
        for (const key in this._forcePressed) {
            this.justPressed[key] = true;
            this.keys[key] = true; // Also make isDown work
        }
        this._prevKeys = { ...this.keys };
        // Clear forced keys
        for (const key in this._forcePressed) {
            this.keys[key] = false;
        }
        this._forcePressed = {};
    },

    isDown(action) {
        switch (action) {
            case 'up': return this.keys['ArrowUp'] || this.keys['w'] || this.keys['W'];
            case 'down': return this.keys['ArrowDown'] || this.keys['s'] || this.keys['S'];
            case 'left': return this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A'];
            case 'right': return this.keys['ArrowRight'] || this.keys['d'] || this.keys['D'];
            case 'confirm': return this.keys['Enter'] || this.keys[' '] || this.keys['z'] || this.keys['Z'];
            case 'cancel': return this.keys['Escape'] || this.keys['x'] || this.keys['X'] || this.keys['Backspace'];
            case 'menu': return this.keys['Escape'] || this.keys['m'] || this.keys['M'];
            default: return false;
        }
    },

    wasPressed(action) {
        switch (action) {
            case 'up': return this.justPressed['ArrowUp'] || this.justPressed['w'] || this.justPressed['W'];
            case 'down': return this.justPressed['ArrowDown'] || this.justPressed['s'] || this.justPressed['S'];
            case 'left': return this.justPressed['ArrowLeft'] || this.justPressed['a'] || this.justPressed['A'];
            case 'right': return this.justPressed['ArrowRight'] || this.justPressed['d'] || this.justPressed['D'];
            case 'confirm': return this.justPressed['Enter'] || this.justPressed[' '] || this.justPressed['z'] || this.justPressed['Z'];
            case 'cancel': return this.justPressed['Escape'] || this.justPressed['x'] || this.justPressed['X'] || this.justPressed['Backspace'];
            case 'menu': return this.justPressed['Escape'] || this.justPressed['m'] || this.justPressed['M'];
            default: return false;
        }
    },

    _initDpad() {
        const dirs = ['up', 'down', 'left', 'right'];
        dirs.forEach(dir => {
            const btn = document.getElementById('dpad-' + dir);
            if (!btn) return;

            const keyMap = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
            const key = keyMap[dir];

            btn.addEventListener('touchstart', e => { e.preventDefault(); this.keys[key] = true; });
            btn.addEventListener('touchend', e => { e.preventDefault(); this.keys[key] = false; });
            btn.addEventListener('touchcancel', e => { e.preventDefault(); this.keys[key] = false; });
        });
    },

    _initButtons() {
        const btnA = document.getElementById('btn-a');
        const btnB = document.getElementById('btn-b');
        const btnMenu = document.getElementById('btn-menu');

        if (btnA) {
            btnA.addEventListener('touchstart', e => { e.preventDefault(); this.keys['z'] = true; });
            btnA.addEventListener('touchend', e => { e.preventDefault(); this.keys['z'] = false; });
            btnA.addEventListener('click', () => { this.keys['z'] = true; setTimeout(() => this.keys['z'] = false, 100); });
        }
        if (btnB) {
            btnB.addEventListener('touchstart', e => { e.preventDefault(); this.keys['x'] = true; });
            btnB.addEventListener('touchend', e => { e.preventDefault(); this.keys['x'] = false; });
            btnB.addEventListener('click', () => { this.keys['x'] = true; setTimeout(() => this.keys['x'] = false, 100); });
        }
        if (btnMenu) {
            btnMenu.addEventListener('click', () => { this.keys['m'] = true; setTimeout(() => this.keys['m'] = false, 100); });
        }
    }
};
