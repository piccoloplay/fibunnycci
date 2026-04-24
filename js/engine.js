const Game = {
    canvas: null,
    ctx: null,
    // title | overworld | dialogue | menu | tris | combat | teambuilder | transition
    state: 'title',
    _pendingTris: null,
    _pendingCombat: null,
    _pendingVN: null,
    _loadingAfter: null,    // callback to run once all assets are in cache
    _currentAreaId: 'villaggio',
    _transitionTimer: 0,
    _transitionTarget: null, // {episode, x, y, areaId}
    lastTime: 0,
    playTime: 0,
    currentEpisode: 'ep01',
    currentMap: 'village',

    // Game state for save/menu
    gameState: {
        currentEpisode: 'ep01',
        currentMap: 'village',
        player: null,
        party: [],
        inventory: [],
        monsters: [],
        flags: {},
        playTime: 0,
        team: ['coniglio', 'cavallo', 'bue'],
        unlockedAreas: [0, 1]
    },

    async init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // HD resolution, pixel-perfect (no smoothing) for 16-bit look
        this.canvas.width = 672;
        this.canvas.height = 1320;
        this.ctx.imageSmoothingEnabled = false;

        Input.init();
        Touch.init(this.canvas);
        Dialogue.init();
        Menu.init();
        Debug.init();
        Audio.init();
        Sprites.init();
        TitleScreen.init();

        this.state = 'title';
        // Title screen stays silent — no music until the player actually starts.
        requestAnimationFrame(t => this.loop(t));
    },

    async loadEpisode(episodeId) {
        const response = await fetch(`episodes/${episodeId}.json`);
        const data = await response.json();

        GameMap.loadFromEpisode(data);
        NPC.loadFromEpisode(data);
        Player.init(data.playerStart.x, data.playerStart.y);

        this.gameState.party = data.party;
        this.gameState.inventory = data.inventory;
        this.gameState.currentEpisode = episodeId;
        this.currentEpisode = episodeId;
    },

    _tryLoadAutoSave() {
        const autoSave = Save.load('auto');
        if (autoSave) {
            Player.init(autoSave.playerPos.x, autoSave.playerPos.y);
            if (autoSave.party) this.gameState.party = autoSave.party;
            if (autoSave.inventory) this.gameState.inventory = autoSave.inventory;
            if (autoSave.flags) this.gameState.flags = autoSave.flags;
            if (autoSave.playTime) this.playTime = autoSave.playTime;
            if (autoSave.team) {
                this.gameState.team = autoSave.team;
                TeamBuilder.currentTeam = autoSave.team;
            }
            if (autoSave.unlockedAreas) {
                this.gameState.unlockedAreas = autoSave.unlockedAreas;
                WorldMap.unlockedAreas = autoSave.unlockedAreas;
            }
            if (autoSave.collection) {
                Creatures.collection = autoSave.collection;
                this.gameState.collection = autoSave.collection;
            }
        }
    },

    loop(timestamp) {
        const dt = this.lastTime ? timestamp - this.lastTime : 16;
        this.lastTime = timestamp;

        if (this.state === 'overworld') {
            this.playTime += dt;
        }

        Input.update();
        Touch.update();

        // Settings panel intercepts all input when open
        // Always update debug for slide animation (even when closing)
        if (Debug.active || Debug._slideProgress > 0) {
            Debug.update(dt);
        }
        if (!Debug.active) {
            this.update(dt);
        }
        this.render();

        requestAnimationFrame(t => this.loop(t));
    },

    // ─── TOAST ───
    _toast: null,
    showToast(text, ms) {
        this._toast = { text, life: 0, maxLife: ms || 3500 };
    },
    _updateToast(dt) {
        if (!this._toast) return;
        this._toast.life += dt;
        if (this._toast.life >= this._toast.maxLife) this._toast = null;
    },
    _renderToast(ctx, w, h) {
        const t = this._toast;
        if (!t) return;
        let alpha = 1;
        if (t.life < 200) alpha = t.life / 200;
        else if (t.life > t.maxLife - 400) alpha = (t.maxLife - t.life) / 400;
        alpha = Math.max(0, Math.min(1, alpha));

        const lines = t.text.split('\n');
        ctx.save();
        ctx.font = 'bold 16px Nunito, sans-serif';
        const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
        const padX = 20, padY = 14, lineH = 24;
        const boxW = Math.min(w - 40, Math.max(200, maxW + padX * 2));
        const boxH = padY * 2 + lines.length * lineH;
        const x = (w - boxW) / 2;
        const y = h - boxH - 140;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(15,15,35,0.94)';
        UI.roundRect(ctx, x, y, boxW, boxH, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,160,255,0.5)';
        ctx.lineWidth = 2;
        UI.roundRect(ctx, x, y, boxW, boxH, 12);
        ctx.stroke();
        lines.forEach((line, i) => {
            UI.text(ctx, line, w / 2, y + padY + i * lineH + 18, {
                color: '#fff', size: 15, align: 'center', bold: i === 0
            });
        });
        ctx.restore();
    },

    // Cross-browser fullscreen toggle with iOS fallback
    toggleFullscreen() {
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        const iosHint = 'Schermo intero non disponibile.\nSu iPhone: Condividi → Aggiungi a Home';
        if (!req) {
            this.showToast(iosHint, 4500);
            return;
        }
        try {
            if (isFs && exit) {
                exit.call(document);
            } else {
                const result = req.call(el);
                if (result && typeof result.catch === 'function') {
                    result.catch(() => this.showToast(iosHint, 4500));
                }
            }
        } catch (e) {
            this.showToast(iosHint, 4500);
        }
    },

    // ─── UPDATE ───
    update(dt) {
        this._updateToast(dt);
        switch (this.state) {
            case 'title':
                this._updateTitle(dt);
                break;
            case 'transition':
                this._updateTransition(dt);
                break;
            case 'worldmap':
                this._updateWorldMap(dt);
                break;
            case 'overworld':
                this._updateOverworld(dt);
                break;
            case 'dialogue':
                Dialogue.update(dt);
                if (!Dialogue.active) {
                    if (this._pendingCombat) {
                        const playerTeam = TeamBuilder.getTeamCreatures();
                        const areaId = this._currentAreaId || 'villaggio';
                        Combat.start(playerTeam, this._pendingCombat, this.canvas.width, this.canvas.height, areaId);
                        this.state = 'combat';
                        this._pendingCombat = null;
                        Audio.playMusic('combat');
                    } else if (this._pendingTris) {
                        Tris.start(this._pendingTris, this.canvas.width, this.canvas.height);
                        this.state = 'tris';
                        this._pendingTris = null;
                    } else if (this._pendingVN) {
                        VN.start(this._pendingVN);
                        this.state = 'vn';
                        this._pendingVN = null;
                    } else {
                        this.state = 'overworld';
                    }
                }
                break;
            case 'vn':
                VN.update(dt);
                if (!VN.active) {
                    this.state = 'overworld';
                    Audio.playMusic(this._currentAreaId);
                }
                break;
            case 'loading':
                if (Sprites.isReady() && GameMap.isReady()) {
                    const after = this._loadingAfter;
                    this._loadingAfter = null;
                    this.state = 'overworld';
                    if (after) after();
                }
                break;
            case 'combat':
                Combat.update(dt);
                if (!Combat.active) {
                    this.state = 'overworld';
                    Audio.playMusic(this._currentAreaId);
                }
                break;
            case 'tris':
                Tris.update(dt);
                if (!Tris.active) this.state = 'overworld';
                break;
            case 'menu':
                Menu.update();
                // Only go to overworld if menu closed AND state wasn't changed by menu action
                if (!Menu.active && this.state === 'menu') this.state = 'overworld';
                break;
            case 'teambuilder':
                TeamBuilder.update(dt);
                if (!TeamBuilder.active) {
                    this.gameState.team = TeamBuilder.currentTeam;
                    this.state = 'overworld';
                }
                break;
        }
    },

    _loading: false,

    _updateTitle(dt) {
        if (this._loading) return; // Wait for episode to load
        const result = TitleScreen.update(dt);
        if (result === 'Continua') {
            this._startContinue();
        } else if (result === 'Nuova Partita') {
            this._startNewGame();
        } else if (result === 'Opzioni') {
            Debug.toggle();
        }
    },

    async _startNewGame() {
        if (this._loading) return;
        this._loading = true;
        TitleScreen.active = false;
        Audio.play('confirm');
        try {
            await this.loadEpisode('ep01');
        } catch (e) {
            console.error('Failed to load episode:', e);
            TitleScreen.active = true;
            this.state = 'title';
            this._loading = false;
            return;
        }
        this._currentAreaId = 'villaggio';
        WorldMap.unlockedAreas = [0, 1];
        TeamBuilder.currentTeam = ['coniglio', 'cavallo', 'bue'];
        Creatures.initCollection();
        this.gameState.team = ['coniglio', 'cavallo', 'bue'];
        this.gameState.unlockedAreas = [0, 1];
        this.gameState.collection = Creatures.collection;
        this.playTime = 0;
        // Hand off to the loading screen — it waits for all PNG assets
        // to settle before dropping into the overworld and starting music.
        this._enterLoading(() => {
            Audio.playMusic(this._currentAreaId);
        });
        this._loading = false;
    },

    async _startContinue() {
        if (this._loading) return;
        this._loading = true;
        TitleScreen.active = false;
        Audio.play('confirm');
        try {
            await this.loadEpisode('ep01');
        } catch (e) {
            console.error('Failed to load episode:', e);
            TitleScreen.active = true;
            this.state = 'title';
            this._loading = false;
            return;
        }
        this._tryLoadAutoSave();
        this._enterLoading(() => {
            Audio.playMusic(this._currentAreaId);
        });
        this._loading = false;
    },

    // ─── TRANSITION between areas ───
    _updateTransition(dt) {
        this._transitionTimer += dt;
        // Fade out 400ms → load → fade in 400ms
        if (this._transitionTimer > 400 && this._transitionTarget) {
            const target = this._transitionTarget;
            this._transitionTarget = null;
            this._doTransition(target);
        }
        if (this._transitionTimer > 800 && !this._loading) {
            this.state = 'overworld';
            this._transitionTimer = 0;
            Audio.playMusic(this._currentAreaId);
        }
    },

    async _doTransition(target) {
        this._loading = true;
        this._currentAreaId = target.areaId || this._currentAreaId;
        try {
            await this.loadEpisode(target.episode);
        } catch (e) {
            try { await this.loadEpisode('ep01'); } catch (e2) {}
        }
        Player.init(target.x, target.y);
        this._loading = false;
        Audio.playMusic(this._currentAreaId);
    },

    _startTransition(exit) {
        Audio.play('transition');
        this._transitionTarget = {
            episode: exit.targetEpisode,
            x: exit.targetX,
            y: exit.targetY,
            areaId: exit.areaId || this._currentAreaId
        };
        this._transitionTimer = 0;
        this.state = 'transition';
    },

    _openWorldMap() {
        this._syncGameState();
        WorldMap.unlockedAreas = this.gameState.unlockedAreas;
        WorldMap.open();
        this.state = 'worldmap';
    },

    _updateWorldMap(dt) {
        const result = WorldMap.update(dt);
        if (result) {
            if (result.action === 'enter') {
                this._startTransition({
                    targetEpisode: result.area.episode,
                    targetX: 14, targetY: 14,
                    areaId: result.area.id
                });
                WorldMap.close();
            } else if (result.action === 'back') {
                WorldMap.close();
                this.state = 'overworld';
            }
        }
    },

    _startNpcDialog(npc) {
        Touch.cancelPath();
        Audio.play('npcTalk');
        const dialogueData = NPC.interact(npc);
        Dialogue.start(dialogueData);
        this.state = 'dialogue';
        if (npc.triggerCombat) {
            this._pendingCombat = npc.triggerCombat;
        } else if (npc.triggerTris) {
            this._pendingTris = npc.triggerTris;
        } else if (npc.triggerVN) {
            this._pendingVN = npc.triggerVN;
        }
        NPC.advanceDialogue(npc);
    },

    _updateOverworld(dt) {
        Player.update(dt);

        // Check if player stepped on an exit tile
        if (!Player.moving) {
            const exit = GameMap.getExitAt(Player.gridX, Player.gridY);
            if (exit) {
                this._startTransition(exit);
                return;
            }
        }

        // Pending talk queued by Touch after pathfinding — fires when player is fully stopped
        if (!Player.moving && Touch._pendingTalkNpc) {
            const { x, y } = Touch._pendingTalkNpc;
            Touch._pendingTalkNpc = null;
            const npc = NPC.getAt(x, y);
            if (npc) {
                Player.direction = Touch._directionTo(Player.gridX, Player.gridY, x, y);
                this._startNpcDialog(npc);
                return;
            }
        }

        // Interact with NPC via keyboard confirm when facing one.
        // Touch users go through the explicit "Parla con …" button instead.
        if (Input.wasPressed('confirm') && !Player.moving) {
            const facing = Player.getFacingTile();
            const npc = NPC.getAt(facing.x, facing.y);
            if (npc) this._startNpcDialog(npc);
        }

        // Open menu
        if (Input.wasPressed('menu') || Input.wasPressed('cancel')) {
            Touch.cancelPath();
            Audio.play('menuOpen');
            this._syncGameState();
            Menu.open(this.gameState);
            this.state = 'menu';
        }
    },

    _syncGameState() {
        this.gameState.player = { gridX: Player.gridX, gridY: Player.gridY };
        this.gameState.playTime = this.playTime;
        this.gameState.team = TeamBuilder.currentTeam;
        this.gameState.unlockedAreas = WorldMap.unlockedAreas;
        this.gameState.collection = Creatures.collection;
    },

    // ─── RENDER ───
    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, w, h);

        switch (this.state) {
            case 'title':
                TitleScreen.render(ctx, w, h);
                break;

            case 'worldmap':
                WorldMap.render(ctx, w, h);
                break;

            case 'teambuilder':
                TeamBuilder.render(ctx, w, h);
                break;

            case 'vn':
                VN.render(ctx, w, h);
                break;

            case 'loading':
                this._renderLoading(ctx, w, h);
                break;

            case 'transition':
                // Render overworld behind the fade
                this._renderOverworld(ctx, w, h);
                // Fade to black and back
                const fadeProgress = this._transitionTimer / 800;
                const alpha = fadeProgress < 0.5
                    ? fadeProgress * 2          // fade out 0→1
                    : 2 - fadeProgress * 2;     // fade in 1→0
                ctx.fillStyle = `rgba(0,0,0,${Math.min(1, alpha)})`;
                ctx.fillRect(0, 0, w, h);
                // Area name in the middle during peak darkness
                if (fadeProgress > 0.3 && fadeProgress < 0.7) {
                    ctx.fillStyle = `rgba(255,204,68,${1 - Math.abs(0.5 - fadeProgress) * 4})`;
                    ctx.font = 'bold 14px Nunito, sans-serif';
                    ctx.textAlign = 'center';
                    const areaName = this._transitionTarget
                        ? (this._transitionTarget.areaId || '').replace(/_/g, ' ')
                        : this._currentAreaId;
                    ctx.fillText(areaName.toUpperCase(), w / 2, h / 2);
                    ctx.textAlign = 'left';
                }
                break;

            default:
                // Overworld-based states: overworld, dialogue, menu, combat, tris
                this._renderOverworld(ctx, w, h);
                break;
        }

        // Debug HUD (always)
        Debug.updateFPS(performance.now());
        Debug.renderOverlay(ctx, w);

        // Always-on fullscreen toggle button (rendered below the settings panel so it hides when open)
        if (Debug._slideProgress <= 0) {
            this._renderFullscreenButton(ctx, w, h);
        }

        // Toast (above everything except the settings panel)
        this._renderToast(ctx, w, h);

        // Settings panel on top of everything
        if (Debug._slideProgress > 0) {
            Debug.renderPanel(ctx, w, h);
        }
    },

    // Fullscreen button position (used by both render and touch hit-test)
    _fsBtn: { x: 0, y: 44, size: 40 },

    _getFullscreenBtnRect(w) {
        const s = this._fsBtn.size;
        return { x: w - s - 10, y: this._fsBtn.y, w: s, h: s };
    },

    // ─── LOADING STATE ───
    _enterLoading(after) {
        this._loadingAfter = after || null;
        this.state = 'loading';
    },

    _renderLoading(ctx, w, h) {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, w, h);

        // Combined progress: sprite cache + map image/mask
        const sprP = Sprites.progress ? Sprites.progress() : 1;
        const mapP = GameMap.isReady() ? 1 : 0;
        const p = Math.max(0, Math.min(1, sprP * 0.85 + mapP * 0.15));

        UI.text(ctx, 'Caricamento…', w / 2, h * 0.45, {
            color: '#fff', size: 28, bold: true, align: 'center'
        });

        const barW = Math.min(w - 80, 420);
        const barH = 18;
        const bx = (w - barW) / 2;
        const by = h * 0.5;

        // Track
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        UI.roundRect(ctx, bx, by, barW, barH, 9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        UI.roundRect(ctx, bx, by, barW, barH, 9);
        ctx.stroke();

        // Fill
        ctx.fillStyle = '#ffcc44';
        UI.roundRect(ctx, bx, by, Math.max(4, barW * p), barH, 9);
        ctx.fill();

        // Counter
        const done = (Sprites._loadsDone || 0);
        const total = (Sprites._loadsTotal || 0);
        UI.text(ctx, `${done} / ${total} asset`, w / 2, by + barH + 30, {
            color: '#bbc', size: 16, align: 'center'
        });
    },

    // ─── "PARLA CON <NPC>" BUTTON ───
    // Returns the first talkable NPC (directly-faced tile first, then
    // any cardinal neighbour). Only valid when standing still in overworld.
    _getTalkableNpc() {
        if (this.state !== 'overworld' || Player.moving) return null;
        const facing = Player.getFacingTile();
        const facedNpc = NPC.getAt(facing.x, facing.y);
        if (facedNpc) return facedNpc;
        const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        for (const [dx, dy] of dirs) {
            const n = NPC.getAt(Player.gridX + dx, Player.gridY + dy);
            if (n) return n;
        }
        return null;
    },

    // Rect of the Parla button (used by both render and touch hit-test).
    // Sized generously because touch targets on a 672-wide canvas scale
    // down to ~390 CSS px on a phone — at that scale a ~60px tall pill is
    // borderline unreachable with a thumb.
    _getParlaBtnRect(w, h) {
        const bw = Math.min(w - 40, 480), bh = 92;
        const barH = this._navBarHeight || 100;
        return { x: w / 2 - bw / 2, y: h - barH - bh - 28, w: bw, h: bh };
    },

    _renderParlaButton(ctx, w, h) {
        const npc = this._getTalkableNpc();
        if (!npc) return;
        const r = this._getParlaBtnRect(w, h);
        // Pulse
        const pulse = 0.88 + Math.sin(performance.now() * 0.006) * 0.08;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = 'rgba(40,50,100,0.94)';
        UI.roundRect(ctx, r.x, r.y, r.w, r.h, 38);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,220,255,0.9)';
        ctx.lineWidth = 4;
        UI.roundRect(ctx, r.x, r.y, r.w, r.h, 38);
        ctx.stroke();
        UI.text(ctx, '💬  Parla con ' + npc.name, r.x + r.w / 2, r.y + r.h / 2 + 10, {
            color: '#fff', size: 28, bold: true, align: 'center'
        });
        ctx.restore();
    },

    _renderFullscreenButton(ctx, w) {
        const r = this._getFullscreenBtnRect(w);
        const isFs = Debug._isFullscreen();

        // Pill background
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        UI.roundRect(ctx, r.x, r.y, r.w, r.h, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        UI.roundRect(ctx, r.x, r.y, r.w, r.h, 10);
        ctx.stroke();

        // Expand / collapse icon: 4 L-shaped corners
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const d = isFs ? 6 : 10;   // inner gap from center for collapse vs expand
        const len = 7;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        const corners = [[-1,-1],[1,-1],[-1,1],[1,1]];
        for (const [sx, sy] of corners) {
            const ax = cx + sx * d;
            const ay = cy + sy * d;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax + sx * len, ay);
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax, ay + sy * len);
            ctx.stroke();
        }
    },

    _renderOverworld(ctx, w, h) {
        // Camera follows player with zoom. Player stays centered on screen
        // at all times — if we run off the edge of the map the background
        // (already filled black in render()) shows through.
        const zoom = 2.0; // integer zoom = clean 2x nearest-neighbour on 64px tile PNGs
        const ts = GameMap.TILE_SIZE * GameMap.SCALE;
        const viewW = w / zoom;
        const viewH = h / zoom;
        const camX = Player.pixelX - viewW / 2 + ts / 2;
        const camY = Player.pixelY - viewH / 2 + ts / 2;

        // Apply zoom
        ctx.save();
        ctx.scale(zoom, zoom);

        // Draw map
        GameMap.render(ctx, camX, camY, viewW, viewH);

        // Debug overlays
        Debug.renderGrid(ctx, camX, camY, viewW, viewH);
        Debug.renderCollisions(ctx, camX, camY, viewW, viewH);

        // Draw NPCs
        NPC.render(ctx, camX, camY);

        // Draw player
        Player.render(ctx, camX, camY);

        // Touch overlays (path preview)
        Touch.render(ctx, viewW, viewH);

        ctx.restore(); // Remove zoom for HUD

        // HUD
        this._renderHUD(ctx, w, h);

        // Virtual joystick (screen space, above HUD)
        if (this.state === 'overworld') Touch.renderOverlay(ctx, w, h);

        // Overlays
        if (this.state === 'dialogue') Dialogue.render(ctx, w, h);
        if (this.state === 'menu') Menu.render(ctx, w, h);
        if (this.state === 'combat') Combat.render(ctx, w, h);
        if (this.state === 'tris') Tris.render(ctx, w, h);
    },

    // Bottom nav bar items and hit areas
    _navBarItems: [
        { id: 'home', label: 'Home', icon: 'home' },
        { id: 'team', label: 'Team', icon: 'team' },
        { id: 'menu', label: 'Menu', icon: 'menu' }
    ],
    _navBarHeight: 100,

    _renderHUD(ctx, w, h) {
        // Top bar — minimal pill
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        UI.roundRect(ctx, 8, 6, 130, 30, 10);
        ctx.fill();
        UI.text(ctx, this.currentEpisode.toUpperCase(), 20, 28, {
            color: '#fff', size: 14, bold: true
        });

        const timeStr = Save._formatTime(this.playTime);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        UI.roundRect(ctx, w - 108, 6, 100, 30, 10);
        ctx.fill();
        UI.text(ctx, timeStr, w - 58, 28, {
            color: '#ddd', size: 14, align: 'center'
        });

        // ─── BOTTOM NAV BAR ───
        if (this.state === 'overworld') {
            const barH = this._navBarHeight;
            const barY = h - barH;
            const itemCount = this._navBarItems.length;
            const itemW = w / itemCount;

            // Bar background with blur effect
            const barGrad = ctx.createLinearGradient(0, barY - 10, 0, h);
            barGrad.addColorStop(0, 'rgba(15,15,35,0)');
            barGrad.addColorStop(0.15, 'rgba(15,15,35,0.9)');
            barGrad.addColorStop(1, 'rgba(10,10,25,0.98)');
            ctx.fillStyle = barGrad;
            ctx.fillRect(0, barY - 10, w, barH + 10);

            // Items
            for (let i = 0; i < itemCount; i++) {
                const item = this._navBarItems[i];
                const ix = i * itemW + itemW / 2;
                const iy = barY + 32;

                // Icon circle background — BIG
                const iconGrad = ctx.createRadialGradient(ix, iy, 0, ix, iy, 34);
                iconGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
                iconGrad.addColorStop(1, 'rgba(255,255,255,0.04)');
                ctx.fillStyle = iconGrad;
                ctx.beginPath();
                ctx.arc(ix, iy, 34, 0, Math.PI * 2);
                ctx.fill();

                // Icon border
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw icon — bigger
                UI.drawIcon(ctx, ix, iy, item.icon, 20);

                // Label
                UI.text(ctx, item.label, ix, barY + 80, {
                    color: '#bbc', size: 14, bold: true, align: 'center'
                });

                // Separator line (except last)
                if (i < itemCount - 1) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo((i + 1) * itemW, barY + 10);
                    ctx.lineTo((i + 1) * itemW, h - 15);
                    ctx.stroke();
                }
            }
        }

        if (this.state === 'overworld' && !Player.moving) {
            // Tappable "Parla con <npc>" button (replaces the old passive hint)
            this._renderParlaButton(ctx, w, h);

            // Exit zone hint
            const facing = Player.getFacingTile();
            const nearbyExit = GameMap.getExitAt(Player.gridX, Player.gridY) ||
                GameMap.getExitAt(facing.x, facing.y);
            if (nearbyExit && nearbyExit.label) {
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                const exitHint = '→ ' + nearbyExit.label;
                ctx.font = UI.fontBold(16);
                const exitW = ctx.measureText(exitHint).width;
                UI.roundRect(ctx, w / 2 - exitW / 2 - 16, h - 80, exitW + 32, 36, 14);
                ctx.fill();
                ctx.textAlign = 'center';
                UI.text(ctx, exitHint, w / 2, h - 54, {
                    color: '#ffcc44', size: 16, bold: true, align: 'center'
                });
            }
        }
    },

    _setupAutoSave() {
        window.addEventListener('beforeunload', () => {
            this._syncGameState();
            Save.save('auto', this.gameState);
        });
    }
};

// Start the game
window.addEventListener('DOMContentLoaded', () => {
    Game.init();
    Game._setupAutoSave();
});
