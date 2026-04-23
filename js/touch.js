const Touch = {
    mode: 'tap', // Only tap-to-move now
    enabled: false,

    // Tap-to-move state
    tapTarget: null,
    path: [],
    pathIndex: 0,
    // Max tiles the player walks per single tap on an empty tile. Keeps
    // movement granular — you tap multiple times instead of sending the
    // player on a long auto-walk. Tapping an NPC ignores this and uses
    // the full path so a single tap gets you to the conversation.
    MAX_STEPS_PER_TAP: 2,

    // Tap state
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,

    // Hold-to-walk state
    _holding: false,
    _holdX: 0,
    _holdY: 0,
    _holdTimer: 0,
    _holdRepathInterval: 300,

    // NPC interaction flag (only talk when explicitly tapped)
    _tappedNpc: false,

    // Pending NPC talk after pathfinding finishes (consumed by engine when !Player.moving)
    _pendingTalkNpc: null,

    // Settings slider drag state (key of the setting being dragged, or null)
    _sliderDrag: null,

    // Swipe detection
    _swipeStartX: 0,
    _swipeStartY: 0,
    _swipeStartTime: 0,

    _canvas: null,
    _rect: null,

    init(canvas) {
        this._canvas = canvas;
        // Always enabled — works for both touch AND mouse
        this.enabled = true;

        document.body.classList.add('touch-tap');

        // Touch events (mobile)
        canvas.addEventListener('touchstart', e => this._onTouchStart(e), { passive: false });
        canvas.addEventListener('touchmove', e => this._onTouchMove(e), { passive: false });
        canvas.addEventListener('touchend', e => this._onTouchEnd(e), { passive: false });
        canvas.addEventListener('touchcancel', e => this._onTouchEnd(e), { passive: false });

        // Mouse events (desktop) — same behavior as tap
        canvas.addEventListener('mousedown', e => {
            if (Audio.unlock) Audio.unlock();
            const pos = this._getMousePos(e);
            this._holding = true;
            this._holdX = pos.x;
            this._holdY = pos.y;
            this._holdTimer = 0;
            this._swipeStartX = pos.x;
            this._swipeStartY = pos.y;
            this._swipeStartTime = Date.now();
            this._handleTap(pos);
        });
        canvas.addEventListener('mousemove', e => {
            if (this._holding) {
                const pos = this._getMousePos(e);
                this._holdX = pos.x;
                this._holdY = pos.y;
                if (this._sliderDrag && Debug.active) this._updateSliderFromPos(pos);
            }
        });
        canvas.addEventListener('mouseup', e => {
            this._holding = false;
            this._sliderDrag = null;
        });
    },

    _getMousePos(e) {
        if (!this._rect || this._rect.width === 0) {
            this._rect = this._canvas.getBoundingClientRect();
        }
        const scaleX = this._canvas.width / this._rect.width;
        const scaleY = this._canvas.height / this._rect.height;
        return {
            x: (e.clientX - this._rect.left) * scaleX,
            y: (e.clientY - this._rect.top) * scaleY
        };
    },

    _getCanvasPos(touch) {
        if (!this._rect || this._rect.width === 0) {
            this._rect = this._canvas.getBoundingClientRect();
        }
        const scaleX = this._canvas.width / this._rect.width;
        const scaleY = this._canvas.height / this._rect.height;
        return {
            x: (touch.clientX - this._rect.left) * scaleX,
            y: (touch.clientY - this._rect.top) * scaleY
        };
    },

    _onTouchStart(e) {
        e.preventDefault();
        if (Audio.unlock) Audio.unlock();
        const pos = this._getCanvasPos(e.touches[0]);
        this._holding = true;
        this._holdX = pos.x;
        this._holdY = pos.y;
        this._holdTimer = 0;
        this._swipeStartX = pos.x;
        this._swipeStartY = pos.y;
        this._swipeStartTime = Date.now();
        this._handleTap(pos);
    },

    _onTouchMove(e) {
        e.preventDefault();
        if (this._holding) {
            const pos = this._getCanvasPos(e.touches[0]);
            this._holdX = pos.x;
            this._holdY = pos.y;
            if (this._sliderDrag && Debug.active) this._updateSliderFromPos(pos);
        }
    },

    _onTouchEnd(e) {
        e.preventDefault();
        this._holding = false;
        this._sliderDrag = null;
    },

    _handleTap(pos) {
        // Settings panel intercepts taps when open
        if (Debug.active) {
            this._handleSettingsTap(pos);
            return;
        }

        // Always-on fullscreen toggle button (top-right, visible in every state)
        if (Game._getFullscreenBtnRect) {
            const r = Game._getFullscreenBtnRect(this._canvas.width);
            if (pos.x >= r.x - 4 && pos.x <= r.x + r.w + 4 &&
                pos.y >= r.y - 4 && pos.y <= r.y + r.h + 4) {
                Game.toggleFullscreen();
                Audio.play('confirm');
                return;
            }
        }

        const state = Game.state;

        if (state === 'title') {
            // Match button positions from titlescreen.js render
            const ch = this._canvas.height;
            const cw = this._canvas.width;
            const menuY = ch * 0.58;
            const btnH = 72;
            const btnGap = 16;
            const btnW = cw * 0.65;
            const btnX = cw / 2 - btnW / 2;
            const items = TitleScreen.ITEMS;

            for (let i = 0; i < items.length; i++) {
                const by = menuY + i * (btnH + btnGap);
                if (pos.x >= btnX && pos.x <= btnX + btnW && pos.y >= by && pos.y <= by + btnH) {
                    TitleScreen.selectedIndex = i;
                    Input.triggerPress('z');
                    return;
                }
            }
            return;
        }

        if (state === 'dialogue') {
            Input.triggerPress('z');
            return;
        }

        if (state === 'worldmap') {
            this._handleWorldMapTap(pos);
            return;
        }

        if (state === 'menu') {
            Menu.handleTap(pos, this._canvas.width, this._canvas.height);
            return;
        }

        if (state === 'teambuilder') {
            TeamBuilder.handleTap(pos, this._canvas.width, this._canvas.height);
            return;
        }

        if (state === 'combat') {
            this._handleCombatTap(pos);
            return;
        }

        if (state === 'tris') {
            this._handleTrisTap(pos);
            return;
        }

        if (state === 'overworld') {
            // Check bottom nav bar tap
            const h = this._canvas.height;
            const barH = Game._navBarHeight || 90;
            if (pos.y >= h - barH) {
                this._handleNavBarTap(pos);
                return;
            }
            this._handleOverworldTap(pos);
            return;
        }
    },

    _handleOverworldTap(pos) {
        const ts = GameMap.TILE_SIZE * GameMap.SCALE;
        const camX = Player.pixelX - this._canvas.width / 2 + ts / 2;
        const camY = Player.pixelY - this._canvas.height / 2 + ts / 2;
        const mapW = GameMap.width * ts;
        const mapH = GameMap.height * ts;
        const cx = Math.max(0, Math.min(camX, mapW - this._canvas.width));
        const cy = Math.max(0, Math.min(camY, mapH - this._canvas.height));

        const worldX = pos.x + cx;
        const worldY = pos.y + cy;
        const gridX = Math.floor(worldX / ts);
        const gridY = Math.floor(worldY / ts);

        // Tapped on NPC
        const npc = NPC.getAt(gridX, gridY);
        if (npc) {
            const dx = Math.abs(Player.gridX - gridX);
            const dy = Math.abs(Player.gridY - gridY);
            if (dx <= 1 && dy <= 1 && (dx + dy) > 0) {
                Player.direction = this._directionTo(Player.gridX, Player.gridY, gridX, gridY);
                this._tappedNpc = true;
                Input.triggerPress('z');
            } else {
                const adj = this._getAdjacentWalkable(gridX, gridY);
                if (adj) {
                    this.path = this._findPath(Player.gridX, Player.gridY, adj.x, adj.y);
                    this.pathIndex = 0;
                    this.tapTarget = { gridX: adj.x, gridY: adj.y, interactNpc: true, npcX: gridX, npcY: gridY };
                }
            }
            return;
        }

        // Tapped near NPC
        const dirs8 = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
        for (const [ddx, ddy] of dirs8) {
            const nearNpc = NPC.getAt(gridX + ddx, gridY + ddy);
            if (nearNpc && GameMap.isWalkable(gridX, gridY)) {
                this.path = this._findPath(Player.gridX, Player.gridY, gridX, gridY);
                this.pathIndex = 0;
                this.tapTarget = { gridX, gridY, interactNpc: true, npcX: gridX + ddx, npcY: gridY + ddy };
                return;
            }
        }

        // Walkable tile — plan a SHORT move (max 3 tiles) toward the tap
        // target, even if the full path would be longer. This gives the
        // player fine-grained control: a single tap moves a little, you
        // stop automatically, tap again to keep going. Pathfinding still
        // lets us route around obstacles for those 3 tiles.
        if (GameMap.isWalkable(gridX, gridY) && !NPC.getAt(gridX, gridY)) {
            const fullPath = this._findPath(Player.gridX, Player.gridY, gridX, gridY);
            this.path = fullPath.slice(0, this.MAX_STEPS_PER_TAP);
            this.pathIndex = 0;
            this.tapTarget = { gridX, gridY };
        }
    },

    _handleCombatTap(pos) {
        const w = this._canvas.width;
        const h = this._canvas.height;

        if (Combat.phase === 'tap_to_play' || Combat.phase === 'round_end' || Combat.phase === 'match_end') {
            Input.triggerPress('z');
            return;
        }

        if (Combat.phase === 'unit_select') {
            const cardW = 140;
            const cardH = 170;
            const gap = 20;
            const totalW = cardW * 3 + gap * 2;
            const startX = (w - totalW) / 2;
            // Player cards (match render: by = h * 0.48)
            // Also check CPU cards (by = 220) for info
            for (let i = 0; i < 3; i++) {
                const bx = startX + i * (cardW + gap);
                const byPlayer = h * 0.48;
                const byCpu = 220;
                // Player card tap
                if (pos.x >= bx && pos.x <= bx + cardW && pos.y >= byPlayer && pos.y <= byPlayer + cardH) {
                    Combat.selectIndex = i;
                    Input.triggerPress('z');
                    return;
                }
            }
        }

        if (Combat.phase === 'morra_choice') {
            const btnSize = 160;
            const gap = 20;
            const totalW = btnSize * 3 + gap * 2;
            const startX = (w - totalW) / 2;
            const btnY = h * 0.6;

            for (let i = 0; i < 3; i++) {
                const bx = startX + i * (btnSize + gap);
                if (pos.x >= bx && pos.x <= bx + btnSize && pos.y >= btnY && pos.y <= btnY + btnSize) {
                    Combat.selectIndex = i;
                    Input.triggerPress('z');
                    return;
                }
            }
        }

        if (Combat.phase === 'action_select') {
            const cardW = w - 60;
            const cardH = 64;
            const gap = 12;
            const startY = h * 0.66;
            const startX = 30;
            for (let i = 0; i < Combat.ACTIONS.length; i++) {
                const y = startY + i * (cardH + gap);
                if (pos.x >= startX && pos.x <= startX + cardW && pos.y >= y && pos.y <= y + cardH) {
                    const a = Combat.ACTIONS[i];
                    if (!Combat._isActionAvailable(a.id)) { Audio.play('cancel'); return; }
                    Combat.selectIndex = i;
                    Combat._commitAction(i);
                    return;
                }
            }
        }

        if (Combat.phase === 'element_pick') {
            const elementIds = Object.keys(Creatures.ELEMENTS);
            const btnSize = 96;
            const gap = 10;
            const totalW = btnSize * elementIds.length + gap * (elementIds.length - 1);
            const startX = (w - totalW) / 2;
            const btnY = h * 0.68;
            for (let i = 0; i < elementIds.length; i++) {
                const bx = startX + i * (btnSize + gap);
                if (pos.x >= bx && pos.x <= bx + btnSize && pos.y >= btnY && pos.y <= btnY + btnSize) {
                    Combat.selectIndex = i;
                    Input.triggerPress('z');
                    return;
                }
            }
        }
    },

    _getAdjacentWalkable(npcX, npcY) {
        const dx = Math.abs(Player.gridX - npcX);
        const dy = Math.abs(Player.gridY - npcY);
        if (dx <= 1 && dy <= 1 && (dx + dy) > 0) return null;

        const dirs = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
        let best = null;
        let bestDist = Infinity;
        for (const [ddx, ddy] of dirs) {
            const tx = npcX + ddx;
            const ty = npcY + ddy;
            if (GameMap.isWalkable(tx, ty) && !NPC.getAt(tx, ty)) {
                const dist = Math.abs(tx - Player.gridX) + Math.abs(ty - Player.gridY);
                if (dist < bestDist) { bestDist = dist; best = { x: tx, y: ty }; }
            }
        }
        return best;
    },

    // ─── A* PATHFINDING ───
    _findPath(sx, sy, ex, ey) {
        if (sx === ex && sy === ey) return [];

        const open = [];
        const closed = new Set();
        const cameFrom = {};
        const key = (x, y) => `${x},${y}`;
        const heuristic = (x, y) => Math.abs(x - ex) + Math.abs(y - ey);

        open.push({ x: sx, y: sy, g: 0, f: heuristic(sx, sy) });

        const dirs = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
        let iterations = 0;

        while (open.length > 0 && iterations < 500) {
            iterations++;
            open.sort((a, b) => a.f - b.f);
            const current = open.shift();
            const ck = key(current.x, current.y);

            if (current.x === ex && current.y === ey) {
                const path = [];
                let k = ck;
                while (k && k !== key(sx, sy)) {
                    const [px, py] = k.split(',').map(Number);
                    path.unshift({ x: px, y: py });
                    k = cameFrom[k];
                }
                return path;
            }

            closed.add(ck);

            for (const [ddx, ddy] of dirs) {
                const nx = current.x + ddx;
                const ny = current.y + ddy;
                const nk = key(nx, ny);

                if (closed.has(nk)) continue;
                if (!GameMap.isWalkable(nx, ny)) continue;
                if (NPC.getAt(nx, ny) && !(nx === ex && ny === ey)) continue;

                if (ddx !== 0 && ddy !== 0) {
                    if (!GameMap.isWalkable(current.x + ddx, current.y) ||
                        !GameMap.isWalkable(current.x, current.y + ddy)) continue;
                }

                const moveCost = (ddx !== 0 && ddy !== 0) ? 1.414 : 1;
                const g = current.g + moveCost;
                const existing = open.find(n => n.x === nx && n.y === ny);

                if (existing) {
                    if (g < existing.g) {
                        existing.g = g;
                        existing.f = g + heuristic(nx, ny);
                        cameFrom[nk] = ck;
                    }
                } else {
                    open.push({ x: nx, y: ny, g, f: g + heuristic(nx, ny) });
                    cameFrom[nk] = ck;
                }
            }
        }
        return [];
    },

    // ─── UPDATE ───
    update() {
        if (!this.enabled) return;

        if (this.path.length > 0 && !Player.moving) {
            this._followPath();
        }
        // Note: we deliberately do NOT re-path while the finger is held.
        // One tap = one short move. To re-plan, lift and tap again. This
        // prevents the "feels like two taps" issue where touchstart fired
        // a path and 300ms later the hold timer fired another one.
    },

    _followPath() {
        if (this.pathIndex >= this.path.length) {
            this.path = [];
            this.pathIndex = 0;
            if (this.tapTarget && this.tapTarget.interactNpc) {
                const npcX = this.tapTarget.npcX || this.tapTarget.gridX;
                const npcY = this.tapTarget.npcY || this.tapTarget.gridY;
                Player.direction = this._directionTo(Player.gridX, Player.gridY, npcX, npcY);
                this._pendingTalkNpc = { x: npcX, y: npcY };
                this.tapTarget = null;
            }
            return;
        }

        const next = this.path[this.pathIndex];
        const dx = next.x - Player.gridX;
        const dy = next.y - Player.gridY;

        // If the next step isn't adjacent (the player got knocked off the
        // path) or is no longer walkable / an NPC stepped into it, cancel
        // the path instead of teleporting or trying to plough through —
        // this is what was causing the "jittery when colliding" feel.
        const adj = (Math.abs(dx) <= 1 && Math.abs(dy) <= 1);
        if (!adj ||
            !GameMap.isWalkable(next.x, next.y) ||
            NPC.getAt(next.x, next.y)) {
            this.cancelPath();
            return;
        }

        if (dx < 0) Input.keys['ArrowLeft'] = true;
        if (dx > 0) Input.keys['ArrowRight'] = true;
        if (dy < 0) Input.keys['ArrowUp'] = true;
        if (dy > 0) Input.keys['ArrowDown'] = true;

        setTimeout(() => {
            Input.keys['ArrowLeft'] = false;
            Input.keys['ArrowRight'] = false;
            Input.keys['ArrowUp'] = false;
            Input.keys['ArrowDown'] = false;
        }, 50);

        this.pathIndex++;
    },

    _directionTo(fromX, fromY, toX, toY) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        if (dx === 0 && dy < 0) return 'up';
        if (dx === 0 && dy > 0) return 'down';
        if (dx < 0 && dy === 0) return 'left';
        if (dx > 0 && dy === 0) return 'right';
        if (dx < 0 && dy < 0) return 'up_left';
        if (dx > 0 && dy < 0) return 'up_right';
        if (dx < 0 && dy > 0) return 'down_left';
        if (dx > 0 && dy > 0) return 'down_right';
        return 'down';
    },

    _handleNavBarTap(pos) {
        const w = this._canvas.width;
        const items = Game._navBarItems;
        if (!items) return;
        const itemW = w / items.length;
        const tappedIndex = Math.floor(pos.x / itemW);
        const item = items[tappedIndex];
        if (!item) return;

        Audio.play('select');

        switch (item.id) {
            case 'home':
                Game._syncGameState();
                Game.state = 'title';
                if (typeof TitleScreen !== 'undefined' && TitleScreen.init) TitleScreen.init();
                Audio.stopMusic(400); // title screen is silent
                break;
            case 'team':
                TeamBuilder.open();
                Game.state = 'teambuilder';
                break;
            case 'menu':
                // Opens the main menu (where Bestiario / Inventario / Mappa / Salva live)
                Game._syncGameState();
                Menu.open(Game.gameState);
                Menu.currentView = 'main';
                Game.state = 'menu';
                break;
        }
    },

    _handleWorldMapTap(pos) {
        const w = this._canvas.width;
        const h = this._canvas.height;

        // Check if tapped on an area node
        const areas = WorldMap.areas;
        for (let i = 0; i < areas.length; i++) {
            const nx = 20 + areas[i].x * (w - 40);
            const ny = 50 + areas[i].y * (h - 120);
            const dist = Math.sqrt((pos.x - nx) ** 2 + (pos.y - ny) ** 2);

            if (dist < 30 && WorldMap.unlockedAreas.includes(i)) {
                WorldMap.selectedNode = i;
                Input.triggerPress('z'); // Enter area
                return;
            }
        }
    },

    _handleTrisTap(pos) {
        if (Tris.winner !== 0) {
            // Result screen — tap to continue
            Input.triggerPress('z');
            return;
        }
        if (!Tris.playerTurn) return; // AI thinking

        // Map tap to grid cell
        const ox = Tris.GRID_OFFSET_X;
        const oy = Tris.GRID_OFFSET_Y;
        const cs = Tris.CELL_SIZE;

        const col = Math.floor((pos.x - ox) / cs);
        const row = Math.floor((pos.y - oy) / cs);

        if (col >= 0 && col <= 2 && row >= 0 && row <= 2) {
            Tris.cursorX = col;
            Tris.cursorY = row;
            Input.triggerPress('z'); // Place mark
        }
    },

    _handleSettingsTap(pos) {
        const w = this._canvas.width;
        const h = this._canvas.height;

        // Close button (top right)
        if (pos.x >= w - 90 && pos.y <= 60) {
            Debug.active = false;
            Audio.play('cancel');
            return;
        }

        const startY = 90;
        const itemH = 85;
        const items = Debug._getItems();

        for (let vi = 0; vi < items.length; vi++) {
            const i = vi + Debug._scrollOffset;
            if (i >= items.length) break;
            const iy = startY + vi * itemH;
            if (pos.y >= iy && pos.y <= iy + itemH - 10) {
                Debug._selectedIndex = i;
                const item = items[i];
                if (item.type === 'range') {
                    this._sliderDrag = item.key;
                    this._updateSliderFromPos(pos);
                } else {
                    Input.triggerPress('z');
                }
                return;
            }
        }
    },

    _updateSliderFromPos(pos) {
        const key = this._sliderDrag;
        const s = Debug.settings[key];
        if (!s || s.min === undefined) return;
        const w = this._canvas.width;
        const barX = 36;
        const barW = w - 150;
        const ratio = Math.max(0, Math.min(1, (pos.x - barX) / barW));
        const raw = s.min + ratio * (s.max - s.min);
        const snapped = Math.round((raw - s.min) / s.step) * s.step + s.min;
        const next = Math.max(s.min, Math.min(s.max, snapped));
        if (next === s.value) return;
        s.value = next;
        Debug._applySettings();
        Debug._saveSettings();
    },

    cancelPath() {
        this.path = [];
        this.pathIndex = 0;
        this.tapTarget = null;
        this._pendingTalkNpc = null;
    },

    // ─── RENDER ───
    render(ctx, w, h) {
        if (!this.enabled || this.path.length === 0) return;

        const ts = GameMap.TILE_SIZE * GameMap.SCALE;
        const camX = Player.pixelX - w / 2 + ts / 2;
        const camY = Player.pixelY - h / 2 + ts / 2;
        const mapW = GameMap.width * ts;
        const mapH = GameMap.height * ts;
        const cx = Math.max(0, Math.min(camX, mapW - w));
        const cy = Math.max(0, Math.min(camY, mapH - h));

        // Path dots
        for (let i = this.pathIndex; i < this.path.length; i++) {
            const px = this.path[i].x * ts - cx + ts / 2;
            const py = this.path[i].y * ts - cy + ts / 2;
            const alpha = 0.15 + (i / this.path.length) * 0.25;
            ctx.fillStyle = `rgba(255,204,68,${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Target marker
        const last = this.path[this.path.length - 1];
        const tx = last.x * ts - cx + ts / 2;
        const ty = last.y * ts - cy + ts / 2;
        const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
        ctx.strokeStyle = `rgba(255,204,68,${pulse})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, 8, 0, Math.PI * 2);
        ctx.stroke();
    }
};
