const Debug = {
    active: false,
    _selectedIndex: 0,
    _scrollOffset: 0,
    _animTimer: 0,
    _slideProgress: 0, // 0=closed, 1=open

    settings: {
        playerSpeed: { value: 0.5, min: 0.5, max: 5, step: 0.1, label: 'Velocita giocatore' },
        textSpeed: { value: 30, min: 10, max: 100, step: 5, label: 'Velocita testo' },
        musicVolume: { value: 0.3, min: 0, max: 1, step: 0.05, label: 'Volume musica' },
        sfxVolume: { value: 0.5, min: 0, max: 1, step: 0.05, label: 'Volume effetti' },
        showGrid: { value: false, label: 'Mostra griglia' },
        showCollisions: { value: false, label: 'Mostra collisioni' },
        showFPS: { value: false, label: 'Mostra FPS' },
        showPlayerPos: { value: false, label: 'Mostra posizione' }
    },

    _frames: [],
    _fps: 0,

    init() {
        this._loadSettings();
        this._applySettings();
        this._setupToggle();
    },

    get(key) {
        return this.settings[key] ? this.settings[key].value : undefined;
    },

    toggle() {
        this.active = !this.active;
        if (this.active) {
            this._selectedIndex = 0;
            this._scrollOffset = 0;
        }
    },

    _setupToggle() {
        window.addEventListener('keydown', e => {
            if (e.key === 'F9') this.toggle();
        });

        // No visible button — F9 on desktop, or access via menu "Opzioni"
    },

    _applySettings() {
        Player.moveSpeed = this.settings.playerSpeed.value;
        Dialogue.charSpeed = this.settings.textSpeed.value;
        if (typeof Audio !== 'undefined') {
            Audio.musicVolume = this.settings.musicVolume.value;
            Audio.volume = this.settings.sfxVolume.value;
        }
    },

    SETTINGS_VERSION: 2,

    _saveSettings() {
        const data = { _v: this.SETTINGS_VERSION };
        for (const [key, s] of Object.entries(this.settings)) data[key] = s.value;
        localStorage.setItem('fibunnycci_debug', JSON.stringify(data));
    },

    _loadSettings() {
        const raw = localStorage.getItem('fibunnycci_debug');
        if (!raw) return;
        try {
            const data = JSON.parse(raw);
            // Discard saves from a previous defaults version
            if (data._v !== this.SETTINGS_VERSION) {
                localStorage.removeItem('fibunnycci_debug');
                return;
            }
            for (const [key, val] of Object.entries(data)) {
                if (key === '_v') continue;
                if (this.settings[key] !== undefined) this.settings[key].value = val;
            }
        } catch (e) {}
    },

    // ─── UPDATE (call from engine when active) ───
    update(dt) {
        this._animTimer += dt;

        // Slide animation
        if (this.active) {
            this._slideProgress = Math.min(1, this._slideProgress + dt * 0.005);
        } else {
            this._slideProgress = Math.max(0, this._slideProgress - dt * 0.008); // Close faster
        }

        // Don't process input when closing
        if (!this.active) return;

        const items = this._getItems();

        if (Input.wasPressed('up')) {
            this._selectedIndex = Math.max(0, this._selectedIndex - 1);
            Audio.play('select');
        }
        if (Input.wasPressed('down')) {
            this._selectedIndex = Math.min(items.length - 1, this._selectedIndex + 1);
            Audio.play('select');
        }

        const item = items[this._selectedIndex];
        if (!item) return;

        if (item.type === 'bool' && Input.wasPressed('confirm')) {
            this.settings[item.key].value = !this.settings[item.key].value;
            this._applySettings();
            this._saveSettings();
            Audio.play('confirm');
        }

        if (item.type === 'range') {
            if (Input.wasPressed('left') || Input.isDown('left')) {
                const s = this.settings[item.key];
                s.value = Math.max(s.min, s.value - s.step);
                this._applySettings();
                this._saveSettings();
            }
            if (Input.wasPressed('right') || Input.isDown('right')) {
                const s = this.settings[item.key];
                s.value = Math.min(s.max, s.value + s.step);
                this._applySettings();
                this._saveSettings();
            }
        }

        if (item.type === 'action' && Input.wasPressed('confirm')) {
            if (item.key === 'reset') {
                this._resetDefaults();
                Audio.play('confirm');
            } else if (item.key === 'close') {
                this.active = false;
                Audio.play('cancel');
            } else if (item.key === 'fullscreen') {
                this._toggleFullscreen();
                Audio.play('confirm');
            }
        }

        if (Input.wasPressed('cancel')) {
            this.active = false;
            Audio.play('cancel');
        }
    },

    _getItems() {
        const items = [];
        for (const [key, s] of Object.entries(this.settings)) {
            items.push({
                key,
                label: s.label,
                type: typeof s.value === 'boolean' ? 'bool' : 'range',
                value: s.value,
                min: s.min, max: s.max, step: s.step
            });
        }
        items.push({ key: 'reset', label: 'Reset impostazioni', type: 'action' });
        items.push({ key: 'close', label: 'Chiudi', type: 'action' });
        return items;
    },

    _isFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement);
    },

    _toggleFullscreen() {
        if (this._isFullscreen()) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) exit.call(document);
        } else {
            const el = document.documentElement;
            const req = el.requestFullscreen || el.webkitRequestFullscreen;
            if (req) req.call(el);
        }
    },

    _resetDefaults() {
        const defaults = {
            playerSpeed: 0.5, textSpeed: 30, musicVolume: 0.3, sfxVolume: 0.5,
            showGrid: false, showCollisions: false, showFPS: false, showPlayerPos: false
        };
        for (const [key, val] of Object.entries(defaults)) {
            if (this.settings[key]) this.settings[key].value = val;
        }
        localStorage.removeItem('fibunnycci_debug');
        this._applySettings();
    },

    // ─── RENDER SETTINGS PANEL (Canvas-based, fullscreen) ───
    renderPanel(ctx, w, h) {
        if (this._slideProgress <= 0) return;

        const p = this._easeOutBack(this._slideProgress);

        ctx.save();

        // Background
        ctx.fillStyle = 'rgba(8,8,25,0.97)';
        ctx.fillRect(0, 0, w, h * p);

        if (p < 0.1) { ctx.restore(); return; }

        // Title
        UI.text(ctx, 'IMPOSTAZIONI', w / 2, 55 * p, {
            color: '#ffcc00', size: 30, bold: true, align: 'center'
        });

        // Close button
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        UI.roundRect(ctx, w - 90, 20, 70, 40, 12);
        ctx.fill();
        UI.text(ctx, 'Chiudi', w - 55, 46, { color: '#aab', size: 14, align: 'center' });

        // Items — HD sized
        const items = this._getItems();
        const itemH = 85;
        const startY = 90;
        const visibleItems = Math.floor((h - startY - 40) / itemH);

        // Scroll if needed
        if (this._selectedIndex >= this._scrollOffset + visibleItems) {
            this._scrollOffset = this._selectedIndex - visibleItems + 1;
        }
        if (this._selectedIndex < this._scrollOffset) {
            this._scrollOffset = this._selectedIndex;
        }

        for (let vi = 0; vi < visibleItems && vi + this._scrollOffset < items.length; vi++) {
            const i = vi + this._scrollOffset;
            const item = items[i];
            const iy = (startY + vi * itemH) * p;
            const selected = i === this._selectedIndex;

            // Item background with slide-in animation
            const slideDelay = i * 0.05;
            const itemP = Math.max(0, Math.min(1, (this._slideProgress - slideDelay) / (1 - slideDelay)));
            const slideX = (1 - this._easeOutCubic(itemP)) * w * 0.3;

            ctx.save();
            ctx.translate(slideX, 0);

            if (selected) {
                ctx.fillStyle = 'rgba(160,160,255,0.1)';
                UI.roundRect(ctx, 20, iy, w - 40, itemH - 10, 14);
                ctx.fill();
                ctx.strokeStyle = '#a0a0ff';
                ctx.lineWidth = 2;
                UI.roundRect(ctx, 20, iy, w - 40, itemH - 10, 14);
                ctx.stroke();
            }

            // Label
            UI.text(ctx, item.label, 36, iy + 28, {
                color: selected ? '#fff' : '#aab', size: 20, bold: selected
            });

            // Value
            if (item.type === 'bool') {
                // Toggle switch — BIG for touch
                const bx = w - 110;
                const by = iy + 10;
                ctx.fillStyle = item.value ? '#4caf50' : '#555';
                UI.roundRect(ctx, bx, by, 70, 34, 17);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(item.value ? bx + 52 : bx + 18, by + 17, 12, 0, Math.PI * 2);
                ctx.fill();
            } else if (item.type === 'range') {
                const s = this.settings[item.key];
                const barX = 36;
                const barW = w - 150;
                const barY = iy + 45;
                const ratio = (s.value - s.min) / (s.max - s.min);

                // Track
                ctx.fillStyle = '#333';
                UI.roundRect(ctx, barX, barY, barW, 10, 5);
                ctx.fill();
                // Fill
                ctx.fillStyle = selected ? '#a0a0ff' : '#666';
                UI.roundRect(ctx, barX, barY, Math.max(10, barW * ratio), 10, 5);
                ctx.fill();
                // Knob — BIG
                ctx.fillStyle = selected ? '#fff' : '#bbb';
                ctx.beginPath();
                ctx.arc(barX + barW * ratio, barY + 5, 14, 0, Math.PI * 2);
                ctx.fill();
                // Value
                UI.text(ctx, s.value.toFixed(s.step < 0.1 ? 2 : 1), w - 40, iy + 52, {
                    color: '#ffcc00', size: 18, bold: true, align: 'right'
                });

                if (selected) {
                    UI.text(ctx, '< tocca slider >', w / 2, iy + 72, {
                        color: '#556', size: 13, align: 'center'
                    });
                }
            } else if (item.type === 'action') {
                // Action buttons as tappable cards
                const actionColor = item.key === 'reset' ? '#cc3333' : '#4466aa';
                ctx.fillStyle = selected ? actionColor : actionColor + '66';
                UI.roundRect(ctx, 36, iy + 5, w - 72, itemH - 20, 14);
                ctx.fill();
                UI.text(ctx, item.label, w / 2, iy + itemH / 2 - 2, {
                    color: '#fff', size: 20, bold: true, align: 'center'
                });
            }

            ctx.restore();
        }

        // Scroll indicators
        ctx.textAlign = 'center';
        if (this._scrollOffset > 0) {
            ctx.fillStyle = '#a0a0ff';
            ctx.font = '20px Nunito, sans-serif';
            ctx.fillText('▲', w / 2, startY * p - 5);
        }
        if (this._scrollOffset + visibleItems < items.length) {
            ctx.fillStyle = '#a0a0ff';
            ctx.font = '20px Nunito, sans-serif';
            ctx.fillText('▼', w / 2, h - 15);
        }

        // No footer needed — touch-friendly controls

        ctx.textAlign = 'left';
        ctx.restore();
    },

    // ─── FPS/DEBUG OVERLAY ───
    updateFPS(timestamp) {
        this._frames.push(timestamp);
        const cutoff = timestamp - 1000;
        this._frames = this._frames.filter(t => t > cutoff);
        this._fps = this._frames.length;
    },

    renderOverlay(ctx, w) {
        let y = 34;
        if (this.settings.showFPS.value) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, y, 60, 16);
            ctx.fillStyle = this._fps >= 55 ? '#4caf50' : this._fps >= 30 ? '#ff9800' : '#f44336';
            ctx.font = '18px Nunito, sans-serif';
            ctx.fillText(`FPS: ${this._fps}`, 4, y + 12);
            y += 18;
        }
        if (this.settings.showPlayerPos.value) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, y, 100, 16);
            ctx.fillStyle = '#fff';
            ctx.font = '18px Nunito, sans-serif';
            ctx.fillText(`X:${Player.gridX} Y:${Player.gridY}`, 4, y + 12);
        }
    },

    renderGrid(ctx, cameraX, cameraY, viewW, viewH) {
        if (!this.settings.showGrid.value) return;
        const ts = GameMap.TILE_SIZE * GameMap.SCALE;
        const startCol = Math.floor(cameraX / ts);
        const startRow = Math.floor(cameraY / ts);
        const endCol = startCol + Math.ceil(viewW / ts) + 1;
        const endRow = startRow + Math.ceil(viewH / ts) + 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;
        for (let col = startCol; col <= endCol; col++) {
            const x = col * ts - cameraX;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, viewH); ctx.stroke();
        }
        for (let row = startRow; row <= endRow; row++) {
            const y = row * ts - cameraY;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewW, y); ctx.stroke();
        }
    },

    renderCollisions(ctx, cameraX, cameraY, viewW, viewH) {
        if (!this.settings.showCollisions.value) return;
        const ts = GameMap.TILE_SIZE * GameMap.SCALE;
        const startCol = Math.floor(cameraX / ts);
        const startRow = Math.floor(cameraY / ts);
        const endCol = startCol + Math.ceil(viewW / ts) + 1;
        const endRow = startRow + Math.ceil(viewH / ts) + 1;
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                if (!GameMap.isWalkable(col, row)) {
                    const x = col * ts - cameraX;
                    const y = row * ts - cameraY;
                    ctx.fillStyle = 'rgba(255,0,0,0.25)';
                    ctx.fillRect(x, y, ts, ts);
                }
            }
        }
    },

    // ─── HELPERS ───
    _easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },

    _easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    },

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
};
