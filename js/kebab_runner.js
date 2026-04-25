// Kebab Runner — minigioco 3 corsie integrato nel JRPG.
// Lanciato da NPC con triggerKebabRunner: "<recipeId>".
// Pattern: stesso del modulo combat/tris (singleton globale, update+render
// chiamati dal Game loop in engine.js).
const KebabRunner = {
    active: false,
    phase: 'intro',           // 'intro' | 'running' | 'win' | 'lose'

    // Player state
    lane: 0,                  // -1 sx, 0 centro, 1 dx
    laneAnimX: 0,             // offset interpolato in screen px
    jumpMs: 0,                // ms residui di salto
    JUMP_DURATION: 700,
    LANE_LERP: 0.18,

    // World
    scrollY: 0,
    speed: 0.42,              // px/ms
    SPEED_GROW: 0.00006,
    SPEED_CAP: 0.78,

    // Spawning
    nextSpawnAt: 0,
    SPAWN_EVERY: 360,         // px di scroll fra una row e l'altra

    // Entities
    objects: [],              // { type:'ing'|'obs', kind, lane, spawnY, aerial }

    // Inventory + recipe
    inventory: {},
    recipe: {},
    recipeId: null,
    rewardOro: 50,

    // Lives & timing
    lives: 3,
    elapsedMs: 0,

    // FX
    flashMs: 0,               // red flash on hit
    pickupFx: [],             // floating "+1" texts
    screenShake: 0,

    // Tutorial overlay
    _tutorial: false,
    _tutorialStep: 0,
    TUTORIAL_SLIDES: [
        { title: 'Kebab Runner', body: 'Corri, raccogli gli ingredienti della ricetta, evita gli ostacoli.' },
        { title: 'Comandi', body: 'TAP a sinistra dello schermo: corsia sinistra.\nTAP a destra: corsia destra.\nPulsante SALTA in basso o swipe verso l\'alto: salto.' },
        { title: 'Vita & vittoria', body: '3 vite. Un ostacolo non saltato = -1 vita. Completi la ricetta = vinci.' }
    ],

    // Recipe definitions
    RECIPES: {
        kebab_classico: {
            label: 'Kebab Classico',
            ingredients: { panino: 1, carne: 1, cetrioli: 2, salsa_piccante: 1 }
        }
    },

    // Ingredients available (id -> displayed cap when not in recipe)
    ALL_INGREDIENTS: [
        'cetrioli','pomodori','cipolla','ketchup_maionese','salsa_yogurt',
        'salsa_piccante','carne','panino','piadina','patatine_fritte','insalata'
    ],

    // ─── LIFECYCLE ────────────────────────────────────────────────────
    start(recipeId, canvasW, canvasH) {
        this.active = true;
        this.phase = 'intro';
        this._w = canvasW || 672;
        this._h = canvasH || 1320;

        this.lane = 0;
        this.laneAnimX = 0;
        this.jumpMs = 0;

        this.scrollY = 0;
        this.speed = 0.42;
        this.nextSpawnAt = this.SPAWN_EVERY;

        this.objects = [];
        this.inventory = {};
        for (const id of this.ALL_INGREDIENTS) this.inventory[id] = 0;

        const r = this.RECIPES[recipeId] || this.RECIPES.kebab_classico;
        this.recipe = { ...r.ingredients };
        this.recipeId = recipeId || 'kebab_classico';

        this.lives = 3;
        this.elapsedMs = 0;
        this.flashMs = 0;
        this.pickupFx = [];
        this.screenShake = 0;

        this._tutorial = false;
        this._tutorialStep = 0;
    },

    close() {
        this.active = false;
    },

    // ─── UPDATE ──────────────────────────────────────────────────────
    update(dt) {
        if (!this.active) return;

        // Tutorial / intro screens don't tick the game world
        if (this._tutorial || this.phase === 'intro' ||
            this.phase === 'win' || this.phase === 'lose') return;

        this.elapsedMs += dt;

        // Speed up over time
        this.speed = Math.min(this.SPEED_CAP, this.speed + this.SPEED_GROW * dt);

        // Scroll
        this.scrollY += this.speed * dt;

        // Spawn rows on schedule
        while (this.scrollY >= this.nextSpawnAt) {
            this._spawnRow(this.nextSpawnAt);
            this.nextSpawnAt += this.SPAWN_EVERY;
        }

        // Lane interpolation
        const laneW = this._w / 3;
        const targetX = this.lane * laneW;
        this.laneAnimX += (targetX - this.laneAnimX) * this.LANE_LERP;

        // Jump countdown
        if (this.jumpMs > 0) this.jumpMs = Math.max(0, this.jumpMs - dt);

        // Object check + culling
        const playerY = this._h * 0.78;
        const hitTop = playerY - 44;
        const hitBot = playerY + 44;
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const o = this.objects[i];
            // Objects spawn ~120 px ABOVE the screen and move DOWN as
            // scrollY grows past their spawnY. Sign was inverted in v1.
            const screenY = -120 + (this.scrollY - o.spawnY);
            // Cull below screen
            if (screenY > this._h + 80) {
                this.objects.splice(i, 1);
                continue;
            }
            // Collision when in player's Y zone AND on player's lane
            if (o.lane === this.lane && screenY > hitTop && screenY < hitBot && !o._hit) {
                o._hit = true;
                if (o.type === 'ing') {
                    // Aerial ingredient requires jump
                    if (o.aerial && this.jumpMs <= 0) continue;
                    this.inventory[o.kind] = (this.inventory[o.kind] || 0) + 1;
                    this.pickupFx.push({ x: this._w * 0.5 + this.laneAnimX, y: playerY - 60, kind: o.kind, ms: 800 });
                    if (typeof Audio !== 'undefined' && Audio.play) Audio.play('confirm');
                    this.objects.splice(i, 1);
                } else if (o.type === 'obs') {
                    // Low obstacle: jump avoids it. High obstacle: must change lane.
                    if (o.aerial !== true && this.jumpMs > 0) continue;
                    this.lives--;
                    this.flashMs = 280;
                    this.screenShake = 12;
                    if (typeof Audio !== 'undefined' && Audio.play) Audio.play('cancel');
                    this.objects.splice(i, 1);
                }
            }
        }

        // Pickup FX update
        for (let i = this.pickupFx.length - 1; i >= 0; i--) {
            this.pickupFx[i].ms -= dt;
            this.pickupFx[i].y -= 0.06 * dt;
            if (this.pickupFx[i].ms <= 0) this.pickupFx.splice(i, 1);
        }

        if (this.flashMs > 0) this.flashMs = Math.max(0, this.flashMs - dt);
        if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 0.05);

        // Win check
        if (this._recipeComplete()) {
            this.phase = 'win';
            if (typeof Audio !== 'undefined' && Audio.play) Audio.play('confirm');
            return;
        }
        // Lose check
        if (this.lives <= 0) {
            this.phase = 'lose';
            if (typeof Audio !== 'undefined' && Audio.play) Audio.play('cancel');
            return;
        }
    },

    _recipeComplete() {
        for (const id in this.recipe) {
            if ((this.inventory[id] || 0) < this.recipe[id]) return false;
        }
        return true;
    },

    _spawnRow(spawnY) {
        const r = Math.random();
        const recipeIds = Object.keys(this.recipe);
        const pickRecipe = () => recipeIds[Math.floor(Math.random() * recipeIds.length)];
        const pickAny = () => this.ALL_INGREDIENTS[Math.floor(Math.random() * this.ALL_INGREDIENTS.length)];

        if (r < 0.30) {
            // single recipe ingredient (favored)
            this.objects.push({ type: 'ing', kind: pickRecipe(), lane: -1 + Math.floor(Math.random() * 3), spawnY });
        } else if (r < 0.50) {
            // two ingredients (one recipe + one any)
            const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
            this.objects.push({ type: 'ing', kind: pickRecipe(), lane: lanes[0], spawnY });
            this.objects.push({ type: 'ing', kind: pickAny(),    lane: lanes[1], spawnY });
        } else if (r < 0.68) {
            // single low obstacle
            this.objects.push({ type: 'obs', kind: 'cone', lane: -1 + Math.floor(Math.random() * 3), spawnY, aerial: false });
        } else if (r < 0.84) {
            // single high obstacle (must jump)
            this.objects.push({ type: 'obs', kind: 'wall', lane: -1 + Math.floor(Math.random() * 3), spawnY, aerial: true });
        } else if (r < 0.94) {
            // double obstacle, one lane free
            const free = -1 + Math.floor(Math.random() * 3);
            for (const l of [-1, 0, 1]) {
                if (l !== free) this.objects.push({ type: 'obs', kind: 'cone', lane: l, spawnY, aerial: false });
            }
        } else {
            // aerial ingredient (only collectable while jumping)
            this.objects.push({ type: 'ing', kind: pickAny(), lane: -1 + Math.floor(Math.random() * 3), spawnY, aerial: true });
        }
    },

    // ─── INPUT ───────────────────────────────────────────────────────
    onTap(x, y) {
        if (!this.active) return;
        if (this._tutorial) {
            this._tutorialStep++;
            if (this._tutorialStep >= this.TUTORIAL_SLIDES.length) this._tutorial = false;
            return;
        }
        if (this.phase === 'intro') {
            this.phase = 'running';
            return;
        }
        if (this.phase === 'win' || this.phase === 'lose') {
            // tap closes; engine reads !active and returns to overworld
            this.close();
            return;
        }
        // Help button top-left
        if (x < 60 && y < 60) {
            this._tutorial = true;
            this._tutorialStep = 0;
            return;
        }
        // Jump button: bottom center (~ 240px wide, 80 tall, just above bottom edge)
        const jbW = 260, jbH = 80;
        const jbX = (this._w - jbW) / 2;
        const jbY = this._h - jbH - 24;
        if (x >= jbX && x <= jbX + jbW && y >= jbY && y <= jbY + jbH) {
            this._jump();
            return;
        }
        // Lane change: left or right HALF of the playfield
        if (this.phase === 'running') {
            if (x < this._w / 2) this.lane = Math.max(-1, this.lane - 1);
            else                 this.lane = Math.min(1,  this.lane + 1);
        }
    },

    onSwipeUp() {
        if (this.active && this.phase === 'running') this._jump();
    },

    onKeyboard() {
        if (!this.active || this._tutorial) return;
        if (this.phase === 'intro' && Input.wasPressed('confirm')) {
            this.phase = 'running';
            return;
        }
        if ((this.phase === 'win' || this.phase === 'lose') && Input.wasPressed('confirm')) {
            this.close();
            return;
        }
        if (this.phase !== 'running') return;
        if (Input.wasPressed('left'))  this.lane = Math.max(-1, this.lane - 1);
        if (Input.wasPressed('right')) this.lane = Math.min(1,  this.lane + 1);
        if (Input.wasPressed('up') || Input.wasPressed('confirm')) this._jump();
    },

    _jump() {
        if (this.jumpMs <= 0) {
            this.jumpMs = this.JUMP_DURATION;
            if (typeof Audio !== 'undefined' && Audio.play) Audio.play('npcTalk');
        }
    },

    // ─── RENDER ──────────────────────────────────────────────────────
    render(ctx, w, h) {
        if (!this.active) return;
        this._w = w; this._h = h;

        // Screen shake
        let sx = 0, sy = 0;
        if (this.screenShake > 0) {
            sx = (Math.random() - 0.5) * this.screenShake;
            sy = (Math.random() - 0.5) * this.screenShake;
        }
        ctx.save();
        ctx.translate(sx, sy);

        this._renderBackground(ctx, w, h);
        this._renderLanes(ctx, w, h);
        this._renderObjects(ctx, w, h);
        this._renderPlayer(ctx, w, h);
        this._renderPickupFx(ctx);

        ctx.restore();

        // Hit flash (full screen)
        if (this.flashMs > 0) {
            ctx.fillStyle = `rgba(255,60,60,${(this.flashMs / 280) * 0.5})`;
            ctx.fillRect(0, 0, w, h);
        }

        this._renderHUD(ctx, w, h);
        this._renderJumpButton(ctx, w, h);
        this._renderHelpButton(ctx);

        if (this.phase === 'intro') this._renderIntro(ctx, w, h);
        if (this.phase === 'win')   this._renderWin(ctx, w, h);
        if (this.phase === 'lose')  this._renderLose(ctx, w, h);
        if (this._tutorial)         this._renderTutorial(ctx, w, h);
    },

    _renderBackground(ctx, w, h) {
        // Sky-to-ground gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#86c8e8');
        grad.addColorStop(0.5, '#a0d0a8');
        grad.addColorStop(1, '#7a5430');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    },

    _renderLanes(ctx, w, h) {
        const laneW = w / 3;
        // Asphalt-like band covering the 3 lanes
        ctx.fillStyle = '#5b4630';
        ctx.fillRect(0, 0, w, h);
        // Lane separators (dashed, scrolling)
        ctx.strokeStyle = '#f0d878';
        ctx.lineWidth = 4;
        ctx.setLineDash([28, 28]);
        ctx.lineDashOffset = -this.scrollY;
        for (let i = 1; i < 3; i++) {
            const x = i * laneW;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    },

    _renderObjects(ctx, w, h) {
        const laneW = w / 3;
        for (const o of this.objects) {
            const screenY = -120 + (this.scrollY - o.spawnY);
            if (screenY < -80 || screenY > h + 80) continue;
            const cx = laneW / 2 + (o.lane + 1) * laneW;
            const cy = screenY;

            if (o.type === 'ing') {
                // Pulse on aerial ingredients
                const aerialBob = o.aerial ? Math.sin((this.scrollY + o.spawnY) * 0.02) * 6 : 0;
                const key = `kr_${o.kind}`;
                const img = (typeof Sprites !== 'undefined') && Sprites._cache[key];
                const size = 88;
                // Soft halo
                ctx.fillStyle = o.aerial ? 'rgba(255,220,80,0.35)' : 'rgba(255,255,255,0.25)';
                ctx.beginPath();
                ctx.arc(cx, cy + aerialBob, size * 0.55, 0, Math.PI * 2);
                ctx.fill();
                if (img) {
                    ctx.drawImage(img, cx - size / 2, cy - size / 2 + aerialBob, size, size);
                } else {
                    // Fallback: emoji label
                    ctx.fillStyle = '#fff';
                    ctx.font = '52px serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('🥗', cx, cy + 18 + aerialBob);
                }
            } else {
                // Obstacle: cone (low) or wall (high)
                if (o.aerial) {
                    // High wall — must jump
                    ctx.fillStyle = '#7a3030';
                    ctx.fillRect(cx - 80, cy - 40, 160, 80);
                    ctx.strokeStyle = '#440';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(cx - 80, cy - 40, 160, 80);
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 30px Nunito, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('SALTA', cx, cy + 10);
                } else {
                    // Low cone
                    ctx.fillStyle = '#ff7733';
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - 38);
                    ctx.lineTo(cx + 32, cy + 30);
                    ctx.lineTo(cx - 32, cy + 30);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#552200';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    // White stripe
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(cx - 22, cy - 4, 44, 8);
                }
            }
        }
    },

    _renderPlayer(ctx, w, h) {
        const laneW = w / 3;
        const baseX = w / 2 + this.laneAnimX;
        const baseY = h * 0.78;

        // Jump effect: pop up + scale
        const jp = this.jumpMs / this.JUMP_DURATION; // 1 → 0
        const jumpArc = jp > 0 ? Math.sin(jp * Math.PI) : 0;     // 0 → 1 → 0
        const yOff = -jumpArc * 70;
        const scale = 1 + jumpArc * 0.25;

        // Shadow (shrinks while airborne)
        ctx.fillStyle = `rgba(0,0,0,${0.45 * (1 - jumpArc * 0.6)})`;
        ctx.beginPath();
        ctx.ellipse(baseX, baseY + 36, 32 * (1 - jumpArc * 0.4), 8 * (1 - jumpArc * 0.4), 0, 0, Math.PI * 2);
        ctx.fill();

        // Sprite from PNG (fallback rectangle if missing)
        const frame = Math.floor(this.elapsedMs / 130) % 3;
        const key = `player_down_${frame}`;
        const img = (typeof Sprites !== 'undefined') && Sprites._cache[key];
        const size = 96 * scale;
        if (img) {
            ctx.drawImage(img, baseX - size / 2, baseY + yOff - size + 20, size, size);
        } else {
            ctx.fillStyle = '#e06040';
            ctx.fillRect(baseX - size / 2, baseY + yOff - size + 20, size, size);
        }
    },

    _renderPickupFx(ctx) {
        for (const fx of this.pickupFx) {
            const a = Math.max(0, fx.ms / 800);
            ctx.fillStyle = `rgba(80,200,120,${a})`;
            ctx.font = 'bold 28px Nunito, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('+1 ' + this._label(fx.kind), fx.x, fx.y);
        }
    },

    _label(id) {
        const m = {
            cetrioli: 'Cetrioli', pomodori: 'Pomodori', cipolla: 'Cipolla',
            ketchup_maionese: 'Ketchup', salsa_yogurt: 'Yogurt', salsa_piccante: 'Salsa',
            carne: 'Carne', panino: 'Panino', piadina: 'Piadina',
            patatine_fritte: 'Patatine', insalata: 'Insalata'
        };
        return m[id] || id;
    },

    _renderHUD(ctx, w, h) {
        // Top bar
        ctx.fillStyle = 'rgba(15,15,30,0.78)';
        ctx.fillRect(0, 0, w, 110);

        // Lives
        ctx.font = '28px Nunito, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.fillText('Vite:', 70, 38);
        for (let i = 0; i < 3; i++) {
            const cx = 160 + i * 32;
            ctx.fillStyle = i < this.lives ? '#ff4060' : 'rgba(255,255,255,0.18)';
            ctx.beginPath();
            ctx.arc(cx, 30, 12, 0, Math.PI * 2);
            ctx.fill();
        }

        // Recipe checklist (right side)
        ctx.font = 'bold 16px Nunito, sans-serif';
        ctx.textAlign = 'right';
        let ry = 28;
        for (const id in this.recipe) {
            const have = this.inventory[id] || 0;
            const need = this.recipe[id];
            ctx.fillStyle = have >= need ? '#80ff80' : '#fff';
            ctx.fillText(`${this._label(id)}  ${have}/${need}`, w - 24, ry);
            ry += 22;
        }
    },

    _renderJumpButton(ctx, w, h) {
        if (this.phase !== 'running') return;
        const bw = 260, bh = 80;
        const bx = (w - bw) / 2;
        const by = h - bh - 24;
        const cooldown = this.jumpMs / this.JUMP_DURATION;
        ctx.fillStyle = cooldown > 0 ? 'rgba(80,80,80,0.7)' : 'rgba(60,140,220,0.92)';
        UI.roundRect(ctx, bx, by, bw, bh, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        UI.roundRect(ctx, bx, by, bw, bh, 18);
        ctx.stroke();
        UI.text(ctx, cooldown > 0 ? 'IN ARIA…' : '↑ SALTA', w / 2, by + bh / 2 + 10, {
            color: '#fff', size: 26, bold: true, align: 'center'
        });
    },

    _renderHelpButton(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        UI.roundRect(ctx, 12, 12, 44, 44, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 2;
        UI.roundRect(ctx, 12, 12, 44, 44, 12);
        ctx.stroke();
        UI.text(ctx, '?', 34, 43, { color: '#fff', size: 26, bold: true, align: 'center' });
    },

    _renderIntro(ctx, w, h) {
        ctx.fillStyle = 'rgba(10,12,30,0.88)';
        ctx.fillRect(0, 0, w, h);
        const r = this.RECIPES[this.recipeId] || this.RECIPES.kebab_classico;
        UI.text(ctx, 'KEBAB RUNNER', w / 2, h * 0.32, {
            color: '#ffcc44', size: 42, bold: true, align: 'center'
        });
        UI.text(ctx, 'Ricetta: ' + r.label, w / 2, h * 0.40, {
            color: '#fff', size: 24, bold: true, align: 'center'
        });
        let ry = h * 0.46;
        for (const id in this.recipe) {
            UI.text(ctx, '• ' + this._label(id) + ' x' + this.recipe[id], w / 2, ry, {
                color: '#cce0ff', size: 22, align: 'center'
            });
            ry += 30;
        }
        UI.text(ctx, 'TOCCA PER COMINCIARE', w / 2, h * 0.72, {
            color: '#ffcc44', size: 24, bold: true, align: 'center'
        });
        UI.text(ctx, '(? in alto a sx per i comandi)', w / 2, h * 0.76, {
            color: '#aac', size: 16, align: 'center'
        });
    },

    _renderWin(ctx, w, h) {
        ctx.fillStyle = 'rgba(8,40,12,0.92)';
        ctx.fillRect(0, 0, w, h);
        UI.text(ctx, 'KEBAB PRONTO!', w / 2, h * 0.42, {
            color: '#ffe066', size: 48, bold: true, align: 'center'
        });
        UI.text(ctx, 'Ricetta completata in ' + Math.floor(this.elapsedMs / 1000) + 's', w / 2, h * 0.50, {
            color: '#fff', size: 22, align: 'center'
        });
        UI.text(ctx, '+ ' + this.rewardOro + ' oro', w / 2, h * 0.56, {
            color: '#ffd060', size: 26, bold: true, align: 'center'
        });
        UI.text(ctx, 'TOCCA PER USCIRE', w / 2, h * 0.74, {
            color: '#cce0ff', size: 22, bold: true, align: 'center'
        });
    },

    _renderLose(ctx, w, h) {
        ctx.fillStyle = 'rgba(40,8,12,0.92)';
        ctx.fillRect(0, 0, w, h);
        UI.text(ctx, 'GAME OVER', w / 2, h * 0.42, {
            color: '#ff8080', size: 48, bold: true, align: 'center'
        });
        UI.text(ctx, 'Riprova parlando di nuovo all\'NPC.', w / 2, h * 0.52, {
            color: '#fff', size: 20, align: 'center'
        });
        UI.text(ctx, 'TOCCA PER USCIRE', w / 2, h * 0.74, {
            color: '#cce0ff', size: 22, bold: true, align: 'center'
        });
    },

    _renderTutorial(ctx, w, h) {
        ctx.fillStyle = 'rgba(10,12,30,0.95)';
        ctx.fillRect(0, 0, w, h);
        const slide = this.TUTORIAL_SLIDES[this._tutorialStep] || this.TUTORIAL_SLIDES[0];
        UI.text(ctx, `${this._tutorialStep + 1} / ${this.TUTORIAL_SLIDES.length}`, w / 2, 100, {
            color: '#aac', size: 16, bold: true, align: 'center'
        });
        UI.text(ctx, slide.title, w / 2, 200, {
            color: '#ffcc44', size: 36, bold: true, align: 'center'
        });
        // Body wrapped
        ctx.fillStyle = '#e8e8f0';
        ctx.font = '22px Nunito, sans-serif';
        ctx.textAlign = 'left';
        const lines = slide.body.split('\n');
        let cy = 280;
        for (const para of lines) {
            const words = para.split(' ');
            let line = '';
            for (const word of words) {
                const test = line ? line + ' ' + word : word;
                if (ctx.measureText(test).width > w - 80 && line) {
                    ctx.fillText(line, 40, cy); line = word; cy += 32;
                } else { line = test; }
            }
            if (line) { ctx.fillText(line, 40, cy); cy += 32; }
            cy += 8;
        }
        UI.text(ctx, this._tutorialStep >= this.TUTORIAL_SLIDES.length - 1 ? 'TOCCA PER COMINCIARE' : 'TOCCA PER CONTINUARE', w / 2, h - 80, {
            color: '#ffcc44', size: 22, bold: true, align: 'center'
        });
    }
};
