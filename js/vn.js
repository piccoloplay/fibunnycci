// Visual Novel runtime.
// Interprets a scene JSON (vn/scenes/*.json) as a linear sequence of events:
//   bg / show / change / hide / line / narrator / music / sfx / wait
// Stays on `line`/`narrator` until the player taps; other events auto-advance.

const VN = {
    active: false,
    sceneId: null,
    events: [],
    index: 0,

    // Rendering state
    bgKey: null,
    slots: { left: null, center: null, right: null },
    activeSlot: null,           // slot of the currently speaking character
    speaker: '',
    text: '',
    fullText: '',
    typing: false,
    charsShown: 0,
    charDelayMs: 22,
    _charTimer: 0,

    // Input — managed locally to decouple from overworld Touch
    _tapped: false,
    _tapHandler: null,

    // Fade between bg / sprite changes
    _fadeMs: 0,
    _fadeDuration: 250,

    // Image cache for VN assets (separate from Sprites._cache so we don't
    // pollute the main atlas)
    _imgCache: {},

    // Bust crop: by default, show the top 55% of the full-body PNG so the
    // bust "leans into" the dialog box. Per-character overrides can shift
    // X and Y to handle off-centre artwork. All values normalised 0..1.
    BUST_CROP_DEFAULT: { x: 0, y: 0, w: 1, h: 0.55 },
    BUST_CROP: {
        // Tighter top crop for tall sprites with a lot of head space
        // can be added here as we tune them per character.
    },

    // Short wait / pause directives
    _waitMs: 0,

    // Small idle animation for the "tap to continue" triangle
    _idle: 0,

    async start(sceneId) {
        this.sceneId = sceneId;
        this.events = [];
        this.index = 0;
        this.bgKey = null;
        this.slots = { left: null, center: null, right: null };
        this.activeSlot = null;
        this.speaker = '';
        this.text = '';
        this.fullText = '';
        this.typing = false;
        this.charsShown = 0;
        this._waitMs = 0;
        this._tapped = false;
        this.active = true;

        try {
            const resp = await fetch(`vn/scenes/${sceneId}.json`);
            const data = await resp.json();
            this.events = data.events || [];
            this._preloadAssets();
            this._runNextEvent();
        } catch (e) {
            console.error('[VN] failed to load scene', sceneId, e);
            this.active = false;
        }
        this._installTapHandler();
    },

    close() {
        this.active = false;
        this._removeTapHandler();
    },

    _installTapHandler() {
        if (this._tapHandler) return;
        const canvas = document.getElementById('game-canvas');
        this._tapHandler = (e) => {
            if (!this.active) return;
            e.preventDefault();
            this._tapped = true;
        };
        canvas.addEventListener('pointerdown', this._tapHandler, { passive: false });
    },

    _removeTapHandler() {
        if (!this._tapHandler) return;
        const canvas = document.getElementById('game-canvas');
        canvas.removeEventListener('pointerdown', this._tapHandler);
        this._tapHandler = null;
    },

    _preloadAssets() {
        const seen = new Set();
        for (const ev of this.events) {
            if (ev.type === 'bg' && ev.image) this._loadImage('bg', ev.image, seen);
            if ((ev.type === 'show' || ev.type === 'change') && ev.sprite)
                this._loadImage('sprites', ev.sprite, seen);
        }
    },

    // name can include the extension (e.g. "bg_kebab_stazione.jpg") or
    // omit it (e.g. "bg_lavagna" → defaults to .png). The cache key is
    // the name as written in the scene JSON, so render() can look it up
    // by exactly that string.

    _loadImage(folder, name, seen) {
        if (seen.has(name) || this._imgCache[name]) return;
        seen.add(name);
        const file = name.includes('.') ? name : (name + '.png');
        const path = `assets/vn/${folder}/${file}`;
        const img = new Image();
        img.onload = () => { this._imgCache[name] = img; };
        img.onerror = () => { console.warn('[VN] missing asset', path); };
        img.src = path;
    },

    _runNextEvent() {
        // Consume auto-advancing events (bg/show/change/hide/music/sfx/wait)
        // until we hit a `line` or `narrator`, at which point we stop and
        // wait for the player to tap.
        while (this.index < this.events.length) {
            const ev = this.events[this.index];
            this.index++;

            if (ev.type === 'bg') {
                this.bgKey = ev.image;
                this._fadeMs = this._fadeDuration;
                continue;
            }
            if (ev.type === 'show') {
                // mode optional: 'bust' (default) | 'full'
                this.slots[ev.slot] = { sprite: ev.sprite, mode: ev.mode || 'bust' };
                this._fadeMs = this._fadeDuration;
                continue;
            }
            if (ev.type === 'change') {
                this.slots[ev.slot] = { sprite: ev.sprite, mode: ev.mode || 'bust' };
                continue;
            }
            if (ev.type === 'hide') {
                this.slots[ev.slot] = null;
                continue;
            }
            if (ev.type === 'music') {
                if (typeof Audio !== 'undefined' && Audio.playMusic) Audio.playMusic(ev.track);
                continue;
            }
            if (ev.type === 'sfx') {
                if (typeof Audio !== 'undefined' && Audio.play) Audio.play(ev.clip);
                continue;
            }
            if (ev.type === 'wait') {
                this._waitMs = ev.ms || 500;
                return;
            }
            if (ev.type === 'line') {
                this.speaker = ev.speaker || '';
                this.fullText = ev.text || '';
                this.text = '';
                this.charsShown = 0;
                this.typing = true;
                this._charTimer = 0;
                this.activeSlot = this._slotOfSpeaker(this.speaker);
                return;
            }
            if (ev.type === 'narrator') {
                this.speaker = '';
                this.fullText = ev.text || '';
                this.text = '';
                this.charsShown = 0;
                this.typing = true;
                this._charTimer = 0;
                this.activeSlot = null;
                return;
            }
        }
        // End of scene
        this.close();
    },

    _slotOfSpeaker(speaker) {
        if (!speaker) return null;
        const s = speaker.toLowerCase().split(/\s+/)[0];
        for (const slot of ['left', 'center', 'right']) {
            const entry = this.slots[slot];
            if (!entry) continue;
            const key = (typeof entry === 'string') ? entry : entry.sprite;
            if (key && key.toLowerCase().startsWith(s)) return slot;
        }
        return null;
    },

    update(dt) {
        if (!this.active) return;

        this._idle += dt;

        if (this._fadeMs > 0) this._fadeMs = Math.max(0, this._fadeMs - dt);

        if (this._waitMs > 0) {
            this._waitMs -= dt;
            if (this._waitMs <= 0) {
                this._waitMs = 0;
                this._tapped = false;
                this._runNextEvent();
            }
            return;
        }

        if (this.typing) {
            this._charTimer += dt;
            while (this._charTimer >= this.charDelayMs && this.charsShown < this.fullText.length) {
                this._charTimer -= this.charDelayMs;
                this.charsShown++;
            }
            this.text = this.fullText.slice(0, this.charsShown);
            if (this.charsShown >= this.fullText.length) this.typing = false;
        }

        if (this._tapped) {
            this._tapped = false;
            if (this.typing) {
                // Fast-forward to end of line
                this.charsShown = this.fullText.length;
                this.text = this.fullText;
                this.typing = false;
            } else {
                this._runNextEvent();
            }
        }
    },

    render(ctx, w, h) {
        if (!this.active) return;

        // Scene band: top 65%
        const sceneH = Math.floor(h * 0.65);

        // Background
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, sceneH);
        if (this.bgKey && this._imgCache[this.bgKey]) {
            const img = this._imgCache[this.bgKey];
            ctx.drawImage(img, 0, 0, w, sceneH);
        } else if (this.bgKey) {
            // Fallback label while PNG loads
            UI.text(ctx, this.bgKey, w / 2, sceneH / 2, {
                color: '#888', size: 18, align: 'center'
            });
        }

        // Sprite slots — anchors along the scene band.
        // Each character is shown as a BUST (top portion of the full-body
        // PNG) by default; pass mode:'full' on the show/change event to
        // override. BUST_CROP holds per-character normalised crop boxes;
        // anything not listed uses BUST_CROP_DEFAULT (top 55%).
        const slotX = { left: w * 0.22, center: w * 0.5, right: w * 0.78 };
        for (const slot of ['left', 'center', 'right']) {
            const entry = this.slots[slot];
            if (!entry) continue;
            const key = (typeof entry === 'string') ? entry : entry.sprite;
            const mode = (typeof entry === 'object' && entry.mode) || 'bust';
            const img = this._imgCache[key];
            if (!img) continue;

            const cfg = (mode === 'full')
                ? { x: 0, y: 0, w: 1, h: 1 }
                : (this.BUST_CROP[key] || this.BUST_CROP_DEFAULT);

            const sx = Math.round(cfg.x * img.width);
            const sy = Math.round(cfg.y * img.height);
            const sw = Math.round(cfg.w * img.width);
            const sh = Math.round(cfg.h * img.height);

            // Display height: ~85% of the scene band; width follows aspect
            const targetH = sceneH * 0.85;
            const scale = targetH / sh;
            const dw = sw * scale;
            const dh = sh * scale;
            const dx = slotX[slot] - dw / 2;
            const dy = sceneH - dh;

            // Non-speaker dimming — combine darker brightness + reduced
            // saturation so the inactive bust reads as 'in shadow'. Just
            // brightness(0.55) was too subtle.
            const isActive = this.activeSlot === null || this.activeSlot === slot;
            ctx.save();
            if (!isActive) ctx.filter = 'brightness(0.45) saturate(0.55)';
            ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
            ctx.restore();

            // Extra black tint on the inactive sprite (clipped to the
            // sprite's own alpha via source-atop, so only the painted
            // pixels darken — transparent areas stay transparent).
            if (!isActive) {
                ctx.save();
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                ctx.fillRect(dx, dy, dw, dh);
                ctx.restore();
            }

            // Bottom fade gradient — softens the bust cut so it doesn't
            // look "decapitated" at the dialog box edge. Only applied
            // when bust-cropping (mode='bust').
            if (mode === 'bust') {
                const fadeH = Math.min(60, dh * 0.18);
                const grd = ctx.createLinearGradient(0, dy + dh - fadeH, 0, dy + dh);
                grd.addColorStop(0, 'rgba(0,0,0,0)');
                grd.addColorStop(1, 'rgba(0,0,0,0.55)');
                ctx.fillStyle = grd;
                ctx.fillRect(dx, dy + dh - fadeH, dw, fadeH);
            }
        }

        // Fade overlay on bg/sprite transitions
        if (this._fadeMs > 0) {
            const alpha = this._fadeMs / this._fadeDuration;
            ctx.fillStyle = `rgba(0,0,0,${alpha})`;
            ctx.fillRect(0, 0, w, sceneH);
        }

        // Dialog band: bottom 35%
        const dialogY = sceneH;
        const dialogH = h - sceneH;
        const gradient = ctx.createLinearGradient(0, dialogY - 20, 0, dialogY);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, dialogY - 20, w, 20);

        // Dialog box
        const boxPad = 18;
        const boxX = boxPad;
        const boxY = dialogY + 20;
        const boxW = w - boxPad * 2;
        const boxH = dialogH - 40;
        ctx.fillStyle = 'rgba(8,10,28,0.92)';
        UI.roundRect(ctx, boxX, boxY, boxW, boxH, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,170,255,0.45)';
        ctx.lineWidth = 2;
        UI.roundRect(ctx, boxX, boxY, boxW, boxH, 14);
        ctx.stroke();

        // Name tag
        if (this.speaker) {
            const tagX = boxX + 12;
            const tagY = boxY - 22;
            const tagW = Math.max(140, ctx.measureText(this.speaker).width + 40);
            const tagH = 36;
            ctx.fillStyle = 'rgba(40,50,100,0.95)';
            UI.roundRect(ctx, tagX, tagY, tagW, tagH, 10);
            ctx.fill();
            ctx.strokeStyle = 'rgba(180,200,255,0.6)';
            ctx.lineWidth = 2;
            UI.roundRect(ctx, tagX, tagY, tagW, tagH, 10);
            ctx.stroke();
            UI.text(ctx, this.speaker, tagX + tagW / 2, tagY + 24, {
                color: '#fff', size: 18, bold: true, align: 'center'
            });
        }

        // Dialog text (word-wrapped)
        this._drawWrappedText(ctx,
            this.text,
            boxX + 22,
            boxY + 32,
            boxW - 44,
            this.speaker ? '#fff' : '#ddd',
            this.speaker ? 22 : 20,
            !this.speaker);

        // Tap-to-continue triangle (only when typing is done)
        if (!this.typing && this._waitMs === 0) {
            const tx = boxX + boxW - 30;
            const ty = boxY + boxH - 18 + Math.sin(this._idle * 0.006) * 3;
            ctx.fillStyle = '#ffcc44';
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx - 10, ty - 10);
            ctx.lineTo(tx + 10, ty - 10);
            ctx.closePath();
            ctx.fill();
        }
    },

    _drawWrappedText(ctx, str, x, y, maxW, color, size, italic) {
        ctx.font = (italic ? 'italic ' : '') + `${size}px Nunito, sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        const words = str.split(' ');
        let line = '';
        let cy = y;
        const lineH = Math.round(size * 1.35);
        for (const word of words) {
            const test = line ? line + ' ' + word : word;
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, x, cy);
                line = word;
                cy += lineH;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, x, cy);
    }
};
