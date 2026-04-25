// Pixel-art sprites: GB / GBA-inspired palette, procedural tiles, hand-drawn bitmaps.
const Sprites = {
    // Shared 16-color palette (keys are lowercase hex '.'=transparent).
    palette: {
        '.': null,
        '0': '#1a1514', '1': '#3b2a23', '2': '#6e4326', '3': '#a07040',
        '4': '#d6a361', '5': '#f0d3a0', '6': '#ffe8c2', '7': '#2f7a3c',
        '8': '#58b35b', '9': '#a5e070', 'a': '#265fb0', 'b': '#4fa0e0',
        'c': '#c73b3b', 'd': '#e8821c', 'e': '#b8b8b8', 'f': '#ffffff'
    },
    _cache: {},

    build(key, rows, overrides) {
        const h = rows.length;
        const w = rows[0].length;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        const img = cx.createImageData(w, h);
        const pal = overrides ? Object.assign({}, this.palette, overrides) : this.palette;
        for (let y = 0; y < h; y++) {
            const row = rows[y];
            for (let x = 0; x < w; x++) {
                const col = pal[row[x]];
                if (!col) continue;
                const idx = (y * w + x) * 4;
                const rgb = parseInt(col.slice(1), 16);
                img.data[idx]     = (rgb >> 16) & 255;
                img.data[idx + 1] = (rgb >> 8) & 255;
                img.data[idx + 2] = rgb & 255;
                img.data[idx + 3] = 255;
            }
        }
        cx.putImageData(img, 0, 0);
        this._cache[key] = c;
        return c;
    },

    draw(ctx, key, x, y, scale, flipH) {
        const img = this._cache[key];
        if (!img) return;
        scale = scale || 1;
        const w = img.width * scale;
        const h = img.height * scale;
        if (flipH) {
            ctx.save();
            ctx.translate(x + w, y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, w, h);
            ctx.restore();
        } else {
            ctx.drawImage(img, Math.round(x), Math.round(y), w, h);
        }
    },

    // ─── PRELOADED PNG TILE TEXTURES ───
    // Map tile ID (see map.js TILES) → relative path of a ground-tile PNG.
    // Any tile ID not listed falls back to the procedural drawTile() below.
    TILE_IMAGES: {
        0:  'assets/tiles/traditional/grass.png',
        1:  'assets/tiles/traditional/dirt.png',
        2:  'assets/tiles/traditional/deep_water.png',
        3:  'assets/tiles/traditional/tree.png',
        4:  'assets/tiles/traditional/stone_wall.png',
        6:  'assets/tiles/traditional/tall_grass.png',
        7:  'assets/tiles/traditional/sand.png',
        8:  'assets/tiles/traditional/kawara_roof.png',
        10: 'assets/tiles/urban/pavement.png',
        11: 'assets/tiles/traditional/kawara_roof.png',
        13: 'assets/tiles/urban/rail.png',
        15: 'assets/tiles/traditional/planks.png',
        17: 'assets/tiles/traditional/flower_field.png',
        18: 'assets/tiles/traditional/fence.png',
        19: 'assets/tiles/urban/pavement.png'
    },
    _tileImgCache: {},       // HTMLImageElement per tileId, null while loading, undefined if no entry

    // ─── LOAD PROGRESS TRACKING ───
    // Every Image() kicked off by the loaders below registers with this
    // counter so the engine can show a loading bar and wait until
    // everything is in cache before leaving the title screen.
    _loadsTotal: 0,
    _loadsDone: 0,

    _trackImage(onDone) {
        this._loadsTotal++;
        let settled = false;
        return () => {
            if (settled) return;
            settled = true;
            this._loadsDone++;
            if (onDone) onDone();
        };
    },

    isReady() { return this._loadsDone >= this._loadsTotal; },
    progress() {
        if (this._loadsTotal === 0) return 1;
        return this._loadsDone / this._loadsTotal;
    },

    loadTileImages() {
        for (const [id, path] of Object.entries(this.TILE_IMAGES)) {
            if (this._tileImgCache[id]) continue;
            const img = new Image();
            const done = this._trackImage();
            img.onload  = () => { this._tileImgCache[id] = img;  done(); };
            img.onerror = () => { this._tileImgCache[id] = null; done(); };
            img.src = path;
            this._tileImgCache[id] = null; // "loading" marker
        }
    },

    drawTileImage(ctx, tileId, x, y, ts) {
        const img = this._tileImgCache[tileId];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, Math.round(x), Math.round(y), ts, ts);
            return true;
        }
        return false;
    },

    // ─── PROCEDURAL TILE RENDER (uses fillRect grid for chunky pixels) ───
    drawTile(ctx, tileId, x, y, ts) {
        // Preloaded PNG wins when available
        if (this.drawTileImage(ctx, tileId, x, y, ts)) return;

        const p = ts / 16; // pixel size
        const F = (px, py, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(Math.round(x + px * p), Math.round(y + py * p), Math.ceil(w * p), Math.ceil(h * p));
        };
        switch (tileId) {
            case 0: case 17: { // grass
                F(0, 0, 16, 16, '#4a8c3f');
                const dots = [[2,3],[5,1],[7,6],[11,4],[13,2],[3,10],[8,11],[12,13],[1,14],[14,9]];
                dots.forEach(([i,j]) => F(i, j, 1, 1, '#6fc050'));
                const darks = [[1,5],[6,8],[10,9],[14,11],[4,6],[9,3]];
                darks.forEach(([i,j]) => F(i, j, 1, 1, '#3d8c3a'));
                if (tileId === 17) {
                    F(3, 4, 1, 1, '#ff80aa'); F(4, 4, 1, 1, '#ff80aa');
                    F(10, 12, 1, 1, '#ffe050'); F(11, 12, 1, 1, '#ffe050');
                    F(7, 9, 1, 1, '#80b0ff');
                }
                break;
            }
            case 1: { // path / dirt
                F(0, 0, 16, 16, '#c4a96a');
                const stones = [[2,2],[5,6],[10,3],[12,10],[3,12],[8,13],[13,7]];
                stones.forEach(([i,j]) => F(i, j, 2, 1, '#a68848'));
                const spots = [[4,4],[11,5],[7,11]];
                spots.forEach(([i,j]) => F(i, j, 1, 1, '#8d6c33'));
                F(0, 0, 16, 1, '#b69a5c'); // top edge
                break;
            }
            case 2: case 9: { // water / bridge (with water)
                F(0, 0, 16, 16, '#3a6fb5');
                const t = Math.floor(Date.now() * 0.004) % 8;
                for (let i = 0; i < 3; i++) {
                    const wy = 3 + i * 5;
                    F(((t + i * 3) % 14), wy, 4, 1, '#6fa8d8');
                    F(((t + i * 3 + 7) % 14), wy + 2, 3, 1, '#2a5aa0');
                }
                if (tileId === 9) {
                    F(0, 5, 16, 2, '#8b5a2b'); F(0, 10, 16, 2, '#8b5a2b');
                    F(0, 7, 16, 1, '#a87040'); F(0, 12, 16, 1, '#a87040');
                }
                break;
            }
            case 3: { // tree
                F(0, 0, 16, 16, '#4a8c3f'); // grass base
                F(7, 11, 2, 4, '#5a3a1a'); // trunk
                F(7, 14, 2, 1, '#2a1a0a'); // trunk shadow
                // Canopy — 3-tone round blob
                const canopy = [[6,2,4,1],[5,3,6,1],[4,4,8,4],[5,8,6,1],[6,9,4,1]];
                canopy.forEach(([i,j,w,h]) => F(i, j, w, h, '#2d6a2a'));
                const canopyMid = [[5,4,6,3],[4,5,8,2]];
                canopyMid.forEach(([i,j,w,h]) => F(i, j, w, h, '#3d8a3a'));
                const canopyLight = [[6,4,3,2],[7,3,2,1]];
                canopyLight.forEach(([i,j,w,h]) => F(i, j, w, h, '#5dac4a'));
                F(5, 3, 1, 1, '#7fcc6a'); // sparkle
                break;
            }
            case 4: case 8: case 11: { // wall / roof
                const base = tileId === 11 ? '#c0392b' : tileId === 8 ? '#6a5a4a' : '#7a7a7a';
                const light = tileId === 11 ? '#e04d40' : tileId === 8 ? '#8a7a5a' : '#9a9a9a';
                const dark = tileId === 11 ? '#8a2a20' : tileId === 8 ? '#4a3a2a' : '#5a5a5a';
                F(0, 0, 16, 16, base);
                // Brick pattern
                for (let j = 0; j < 4; j++) {
                    const off = (j % 2) * 4;
                    for (let i = 0; i < 4; i++) {
                        const bx = (i * 4 + off) % 16;
                        F(bx, j * 4, 1, 4, dark); // left edge
                        F(bx, j * 4 + 3, 4, 1, dark); // bottom edge
                        F(bx + 1, j * 4, 1, 1, light); // top-left highlight
                    }
                }
                break;
            }
            case 5: { // door
                F(0, 0, 16, 16, '#7a7a7a'); // wall backing
                F(4, 2, 8, 14, '#5a3a1a'); // door plank
                F(4, 2, 8, 1, '#3a2010');
                F(4, 2, 1, 14, '#3a2010');
                F(4, 9, 8, 1, '#3a2010');
                F(10, 8, 1, 2, '#ffcc44'); // handle
                break;
            }
            case 6: { // tall grass
                F(0, 0, 16, 16, '#3d8c3a');
                const blades = [[1,3],[4,1],[6,5],[9,2],[11,6],[14,3],[2,9],[7,11],[12,10],[5,13]];
                blades.forEach(([i,j]) => {
                    F(i, j, 1, 3, '#58b35b');
                    F(i, j + 3, 1, 1, '#2d6a2a');
                });
                break;
            }
            case 7: { // sand
                F(0, 0, 16, 16, '#e8c86a');
                const sp = [[3,2],[9,4],[6,8],[12,11],[2,13],[14,7]];
                sp.forEach(([i,j]) => F(i, j, 1, 1, '#c0a040'));
                break;
            }
            case 10: case 19: { // concrete / station floor
                F(0, 0, 16, 16, '#aaaaaa');
                F(0, 0, 16, 1, '#888888');
                F(0, 7, 16, 1, '#888888');
                F(0, 15, 16, 1, '#888888');
                F(0, 0, 1, 16, '#888888');
                F(7, 0, 1, 16, '#888888');
                F(15, 0, 1, 16, '#888888');
                F(3, 3, 1, 1, '#cccccc');
                F(11, 11, 1, 1, '#cccccc');
                break;
            }
            case 12: { // playground
                F(0, 0, 16, 16, '#e8c86a');
                F(3, 4, 3, 3, '#c73b3b'); F(4, 5, 1, 1, '#ff8080');
                F(10, 9, 3, 3, '#4fa0e0'); F(11, 10, 1, 1, '#a0e0ff');
                break;
            }
            case 13: { // rail
                F(0, 0, 16, 16, '#6a5a4a');
                for (let i = 0; i < 4; i++) F(2 + i * 4, 2, 2, 12, '#8a7a5a');
                F(0, 6, 16, 1, '#cccccc'); F(0, 10, 16, 1, '#cccccc');
                break;
            }
            case 15: { // school floor
                F(0, 0, 16, 16, '#f0c070');
                F(0, 0, 16, 1, '#c89048');
                F(0, 15, 16, 1, '#c89048');
                F(0, 0, 1, 16, '#c89048');
                F(15, 0, 1, 16, '#c89048');
                break;
            }
            case 16: { // construction / hazard
                F(0, 0, 16, 16, '#1a1514');
                for (let s = -16; s < 32; s += 4) {
                    for (let i = 0; i < 4; i++) {
                        const px = s + i;
                        if (px >= 0 && px < 16) F(px, (px - s < 2 ? 0 : 2), 1, 16, '#ffcc44');
                    }
                }
                break;
            }
            case 18: { // fence
                F(0, 0, 16, 16, '#4a8c3f'); // grass behind
                F(2, 2, 2, 12, '#8b6843'); F(12, 2, 2, 12, '#8b6843');
                F(0, 5, 16, 2, '#a07040'); F(0, 10, 16, 2, '#a07040');
                F(2, 2, 2, 1, '#6e4326'); F(12, 2, 2, 1, '#6e4326');
                break;
            }
            case 14: { // market stall
                F(0, 0, 16, 16, '#c4a96a');
                F(0, 0, 16, 4, '#d6a361');
                for (let i = 0; i < 4; i++) F(i * 4, 0, 2, 4, '#ffffff');
                F(0, 4, 16, 1, '#8b5a2b');
                break;
            }
            case 20: { // exit glow
                F(0, 0, 16, 16, '#c4a96a');
                const pulse = Math.floor(Math.sin(Date.now() * 0.004) * 2 + 2);
                for (let r = 0; r < 6 + pulse; r++) {
                    const alpha = (6 + pulse - r) / 10;
                    ctx.fillStyle = `rgba(255,204,68,${alpha})`;
                    ctx.fillRect(Math.round(x + (8 - r / 2) * p), Math.round(y + (8 - r / 2) * p), Math.ceil(r * p), Math.ceil(r * p));
                }
                F(6, 7, 4, 2, '#ffee66');
                F(10, 6, 1, 4, '#ffee66');
                F(9, 5, 1, 1, '#ffee66'); F(9, 9, 1, 1, '#ffee66');
                break;
            }
            default: {
                F(0, 0, 16, 16, '#4a8c3f');
                break;
            }
        }
    },

    // ─── INIT: build all bitmap sprites ───
    init() {
        this._buildPlayer();
        this._buildNpc();
        this._buildCreatures();
        this._buildHands();
        this.loadTileImages();
        this.loadPlayerSprites();
        this.loadNpcSprites();
        this.loadCreatureVariants();
        this.loadKebabRunnerSprites();
    },

    CREATURE_VARIANTS: {
        coniglio: ['metallo', 'fuoco', 'acqua', 'terra', 'legno'],
        bue:      ['metallo', 'fuoco', 'acqua', 'terra', 'legno'],
        cane:     ['metallo', 'fuoco', 'acqua', 'terra', 'legno'],
        cavallo:  ['metallo', 'fuoco', 'acqua', 'terra', 'legno'],
        drago:    ['metallo', 'fuoco', 'acqua', 'terra', 'legno'],
        scimmia:  ['metallo', 'fuoco', 'acqua', 'terra', 'legno'],
        tigre:    ['metallo', 'fuoco', 'acqua', 'terra', 'legno']
    },
    loadCreatureVariants() {
        for (const [id, els] of Object.entries(this.CREATURE_VARIANTS)) {
            for (const el of els) {
                const key = `creature_${id}_${el}`;
                const img = new Image();
                const done = this._trackImage();
                img.onload  = () => { this._cache[key] = img; done(); };
                img.onerror = () => { done(); /* leave procedural fallback */ };
                img.src = `assets/sprites/creatures/${key}.png`;
            }
        }
    },

    KEBAB_RUNNER_INGREDIENTS: [
        'cetrioli','pomodori','cipolla','ketchup_maionese','salsa_yogurt',
        'salsa_piccante','carne','panino','piadina','patatine_fritte','insalata'
    ],
    loadKebabRunnerSprites() {
        for (const id of this.KEBAB_RUNNER_INGREDIENTS) {
            const key = `kr_${id}`;
            const img = new Image();
            const done = this._trackImage();
            img.onload  = () => { this._cache[key] = img; done(); };
            img.onerror = () => { done(); };
            img.src = `assets/sprites/kebab_runner/${id}.png`;
        }
    },

    NPC_NAMES: ['student', 'mei', 'nonno', 'kebabbaro', 'poliziotto', 'turista'],
    loadNpcSprites() {
        for (const name of this.NPC_NAMES) {
            for (let f = 0; f < 8; f++) {
                const key = `npc_${name}_${f}`;
                const img = new Image();
                const done = this._trackImage();
                img.onload  = () => { this._cache[key] = img; done(); };
                img.onerror = () => { done(); };
                img.src = `assets/sprites/characters/${key}.png`;
            }
        }
    },

    // Preload the 12 Piccoloplay PNGs into _cache (one per direction × frame).
    // Overrides the procedural bunny sprites once the PNGs arrive from the network.
    PLAYER_FRAMES: [
        ['down', 0], ['down', 1], ['down', 2],
        ['up', 0],   ['up', 1],   ['up', 2],
        ['right', 0], ['right', 1], ['right', 2],
        ['left', 0],  ['left', 1],  ['left', 2]
    ],
    loadPlayerSprites() {
        for (const [dir, frame] of this.PLAYER_FRAMES) {
            const key = `player_${dir}_${frame}`;
            const img = new Image();
            const done = this._trackImage();
            img.onload  = () => { this._cache[key] = img; done(); };
            img.onerror = () => { done(); /* keep procedural fallback */ };
            img.src = `assets/sprites/characters/${key}.png`;
        }
    },

    // Morra hands: fist (sasso), open palm (carta), scissors (forbice) — 16×16 left-facing.
    // Right-facing variant drawn by flipping at draw time.
    _buildHands() {
        const hPal = {
            '0': '#1a1514',   // outline
            '1': '#2a1a14',   // shadow
            '2': '#d6a078',   // skin mid
            '3': '#f0caa0',   // skin light
            '4': '#a07040'    // sleeve brown
        };

        // Fist (sasso) — knuckles facing right
        this.build('hand_fist', [
            '................',
            '.....000........',
            '....033330......',
            '...03322330.....',
            '..0332223330....',
            '..032222223300..',
            '..032222222230..',
            '..032222222230..',
            '..032222222230..',
            '..032222222230..',
            '..0322222233440.',
            '..0332222234440.',
            '...0333333244440',
            '....044444444440',
            '.....000000000..',
            '................'
        ], hPal);

        // Open palm (carta) — fingers up, facing right
        this.build('hand_paper', [
            '......000000....',
            '.....033223300..',
            '....03322233230.',
            '....03232332320.',
            '....03232323230.',
            '....03223332330.',
            '...0333223322330',
            '..033322222223230',
            '..0322222222333.',
            '..03222222223230',
            '..03222222223230',
            '..03222222233440',
            '..03333333334440',
            '..04444444444400',
            '...0000000000...',
            '................'
        ], hPal);

        // Scissors (forbice) — index + middle up, facing right
        this.build('hand_scissors', [
            '....000.........',
            '...03330........',
            '..0323230.......',
            '..0323230...000.',
            '..0323230..03230',
            '..0323230..03230',
            '..0323230..03230',
            '..0323230..03230',
            '..0333330..03230',
            '..0322233..03230',
            '..0322223300330.',
            '..03222222223300',
            '..03333333233440',
            '...044444444440.',
            '....00000000000.',
            '................'
        ], hPal);
    },

    // Draw a hand. side: 'player' (left, faces right) or 'cpu' (right, faces left = flipped).
    drawHand(ctx, x, y, shape, scale, side) {
        const keyMap = { 'carta': 'hand_paper', 'sasso': 'hand_fist', 'forbice': 'hand_scissors' };
        const key = keyMap[shape] || 'hand_fist';
        const flip = (side === 'cpu');
        this.draw(ctx, key, x, y, scale, flip);
    },

    // Player bunny 16×16 — 4 directions × 2 walk frames.
    // Palette: '0' outline, '6' skin/fur, 'c' red shirt, 'd' shoe, '1' dark
    _buildPlayer() {
        const pPal = { '0':'#1a1514', '5':'#3b2a23', '6':'#ffe8c2', '7':'#ffd0a8',
                       'c':'#c73b3b', 'd':'#8a2a20', 'e':'#333333', 'f':'#ffffff' };

        // Down facing (face camera)
        this.build('player_down_0', [
            '................',
            '....00....00....',
            '....0660..0660..',
            '....0660..0660..',
            '....0660..0660..',
            '.....06000060...',
            '....06666666060.',
            '....06f0660f60..',
            '....0666e666060.',
            '....0ccccccc60..',
            '....0ccccccc0...',
            '....0ccccccc0...',
            '....0cccccc0....',
            '....05050505....',
            '....0dd00dd0....',
            '.....00..00.....'
        ], pPal);

        // Down walk frame (shift legs)
        this.build('player_down_1', [
            '................',
            '....00....00....',
            '....0660..0660..',
            '....0660..0660..',
            '....0660..0660..',
            '.....06000060...',
            '....06666666060.',
            '....06f0660f60..',
            '....0666e666060.',
            '....0ccccccc60..',
            '....0ccccccc0...',
            '....0ccccccc0...',
            '....0cccccc0....',
            '.....050050500..',
            '.....0dd.0dd0...',
            '......00..00....'
        ], pPal);

        // Up facing (back)
        this.build('player_up_0', [
            '................',
            '....00....00....',
            '....0660..0660..',
            '....0660..0660..',
            '....0660..0660..',
            '.....06000060...',
            '....06666666060.',
            '....0666666660..',
            '....0666666660..',
            '....0ccccccc60..',
            '....0ccccccc0...',
            '....0ccccccc0...',
            '....0cccccc0....',
            '....05050505....',
            '....0dd00dd0....',
            '.....00..00.....'
        ], pPal);

        this.build('player_up_1', [
            '................',
            '....00....00....',
            '....0660..0660..',
            '....0660..0660..',
            '....0660..0660..',
            '.....06000060...',
            '....06666666060.',
            '....0666666660..',
            '....0666666660..',
            '....0ccccccc60..',
            '....0ccccccc0...',
            '....0ccccccc0...',
            '....0cccccc0....',
            '.....050050500..',
            '.....0dd.0dd0...',
            '......00..00....'
        ], pPal);

        // Right facing
        this.build('player_right_0', [
            '................',
            '.....00.........',
            '.....066........',
            '.....066........',
            '.....066.0......',
            '......066600....',
            '......066f600...',
            '......066ee600..',
            '......066666.0..',
            '.....0ccccc60...',
            '.....0cccccc0...',
            '.....0cccccc0...',
            '.....0ccccc0....',
            '.....050505.....',
            '.....0dd0dd.....',
            '......00.00.....'
        ], pPal);

        this.build('player_right_1', [
            '................',
            '.....00.........',
            '.....066........',
            '.....066........',
            '.....066.0......',
            '......066600....',
            '......066f600...',
            '......066ee600..',
            '......066666.0..',
            '.....0ccccc60...',
            '.....0cccccc0...',
            '.....0cccccc0...',
            '.....0ccccc0....',
            '......05050.....',
            '......0dd0d.....',
            '.......00.0.....'
        ], pPal);
    },

    // Generic NPC 16×16 — simple humanoid silhouette, color-tinted at draw time.
    _buildNpc() {
        this.build('npc_base', [
            '................',
            '.....000000.....',
            '....05555550....',
            '....06666660....',
            '....06606660....',
            '....06666660....',
            '....05555550....',
            '.....00000......',
            '....0aaaaaa0....',
            '...0aaaaaaaa0...',
            '...0aaaaaaaa0...',
            '...0aaaaaaaa0...',
            '...0aaaaaaaa0...',
            '....0aaaaaa0....',
            '....05050505....',
            '.....00..00.....'
        ], { '0':'#1a1514', '5':'#3b2a23', '6':'#ffe8c2', 'a':'#6464ff' });
    },

    // Helper: draws NPC with a tint override on the body color 'a'.
    drawNpc(ctx, x, y, scale, bodyColor) {
        // For per-color variations we rebuild if needed; we cache one per color.
        const key = 'npc_' + (bodyColor || '#6464ff').replace('#', '');
        if (!this._cache[key]) {
            this.build(key, [
                '................',
                '.....000000.....',
                '....05555550....',
                '....06666660....',
                '....06606660....',
                '....06666660....',
                '....05555550....',
                '.....00000......',
                '....0aaaaaa0....',
                '...0aaaaaaaa0...',
                '...0aaaaaaaa0...',
                '...0aaaaaaaa0...',
                '...0aaaaaaaa0...',
                '....0aaaaaa0....',
                '....05050505....',
                '.....00..00.....'
            ], { '0':'#1a1514', '5':'#3b2a23', '6':'#ffe8c2', 'a': bodyColor || '#6464ff' });
        }
        this.draw(ctx, key, x, y, scale);
    },

    // 12 zodiac creatures — 16×16 simplified silhouettes.
    // Convention: dark outline '0', body tones via palette overrides.
    // We reuse the same template families (rabbit/long/stout) with different palettes.
    _buildCreatures() {
        const mk = (key, rows, colors) => this.build('creature_' + key, rows, colors);

        // ── RABBIT silhouette (used for coniglio, topo) ──
        const rabbit = [
            '................',
            '....00....00....',
            '...0bb0..0bb0...',
            '...0bb0..0bb0...',
            '....00000000....',
            '...0bbbbbbbb0...',
            '..0bbbbbbbbbb0..',
            '..0bbbebbbebb0..',
            '..0bbffbbbffbb0.',
            '..0bbbbb0bbbbb0.',
            '..0bbbb000bbbb0.',
            '...0bbbbbbbbb0..',
            '....00bbbbb00...',
            '....0bb000bb0...',
            '....00....00....',
            '................'
        ];

        // ── LONG CREATURE (drago, serpente, cavallo) ──
        const long = [
            '................',
            '........000.....',
            '.......0bbb0....',
            '......0bbbbb0...',
            '.....0bbbebb0...',
            '....0bbbeebb0...',
            '...0bbbbbbbb0...',
            '..0bbbbbbbb0....',
            '.0bbbbbbb0......',
            '0bbbbbb0........',
            '0bbbbb0.........',
            '0bbbb0..........',
            '0bbb0...........',
            '.000............',
            '................',
            '................'
        ];

        // ── STOUT CREATURE (bue, maiale, tigre, scimmia, gallo, cane, capra) ──
        const stout = [
            '................',
            '.....000000.....',
            '....0bbbbbb0....',
            '...0bbbbbbbb0...',
            '..0bbbbbbbbbb0..',
            '..0bbefbbfebb0..',
            '..0bbbb00bbbb0..',
            '..0bbb0000bbb0..',
            '..0bbbbbbbbbb0..',
            '..0bbbbbbbbbb0..',
            '...0bbbbbbbb0...',
            '....0bbbbbb0....',
            '.....00000000...',
            '....0b0..0b0....',
            '....000..000....',
            '................'
        ];

        // Palettes per creature — outline '0' black, body tones b=base, e=dark accent, f=white.
        // Element-tinted.
        const P = (base, accent, light) => ({
            '0':'#1a1514', 'b': base, 'e': accent, 'f': light || '#ffffff'
        });

        mk('coniglio', rabbit, P('#4fa0e0', '#265fb0', '#b8d8f0'));        // acqua
        mk('topo',     rabbit, P('#b8b8b8', '#6a6a6a', '#ffffff'));         // metallo
        mk('cavallo',  long,   P('#e8821c', '#8b4513', '#ffd090'));         // fuoco
        mk('drago',    long,   P('#c73b3b', '#7a1a1a', '#ff9090'));         // fuoco (drago)
        mk('serpente', long,   P('#58b35b', '#2d5a1e', '#a5e070'));         // legno
        mk('bue',      stout,  P('#8b6843', '#3b2a23', '#c0a070'));         // terra
        mk('tigre',    stout,  P('#ff9020', '#c73b3b', '#ffe0a0'));         // fuoco
        mk('scimmia',  stout,  P('#a07040', '#3b2a23', '#e8c86a'));         // legno
        mk('maiale',   stout,  P('#ffa4c2', '#c76b85', '#ffd0e0'));         // fuoco
        mk('gallo',    stout,  P('#e8821c', '#c73b3b', '#ffe050'));         // metallo
        mk('cane',     stout,  P('#c4a96a', '#6e4326', '#f0d3a0'));         // terra
        mk('capra',    stout,  P('#e0e0e0', '#8a7a5a', '#ffffff'));         // terra
    }
};
