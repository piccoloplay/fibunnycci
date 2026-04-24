// Image-based map loader. Replaces the old tile-grid system.
// Each episode references one background PNG and one black/white collision
// mask PNG of the same aspect ratio. The collision mask is sampled per-pixel
// to determine walkability (white = walkable, black = wall).
const GameMap = {
    TILE_SIZE: 16,
    SCALE: 4,            // 16 * 4 = 64 world px per logical tile
    width: 0,            // grid width in tiles
    height: 0,           // grid height in tiles

    bgImage: null,
    bgReady: false,
    maskReady: true,     // true when there's no mask or it's done loading

    _mask: null,         // Uint8ClampedArray (RGBA) of the collision PNG
    _maskW: 0,
    _maskH: 0,

    exits: [],
    TILES: {},           // kept empty so debug overlays don't crash

    isReady() { return this.bgReady && this.maskReady; },

    loadFromEpisode(episodeData) {
        const mapCfg = episodeData.map || {};
        this.exits = episodeData.exits || [];
        const ts = this.TILE_SIZE * this.SCALE;

        this.bgImage = new Image();
        this.bgReady = false;
        this.bgImage.onload = () => {
            this.width = Math.max(1, Math.floor(this.bgImage.width / ts));
            this.height = Math.max(1, Math.floor(this.bgImage.height / ts));
            this.bgReady = true;
        };
        this.bgImage.onerror = () => { this.bgReady = true; /* unblock */ };
        this.bgImage.src = mapCfg.image;

        // Optional collision mask
        this._mask = null;
        if (mapCfg.collision) {
            this.maskReady = false;
            const m = new Image();
            m.onload = () => {
                const c = document.createElement('canvas');
                c.width = m.width; c.height = m.height;
                const cx = c.getContext('2d');
                cx.drawImage(m, 0, 0);
                this._mask = cx.getImageData(0, 0, m.width, m.height).data;
                this._maskW = m.width;
                this._maskH = m.height;
                this.maskReady = true;
            };
            m.onerror = () => { this.maskReady = true; };
            m.src = mapCfg.collision;
        } else {
            this.maskReady = true;
        }
    },

    getExitAt(gridX, gridY) {
        return this.exits.find(e => e.x === gridX && e.y === gridY);
    },

    // Legacy API — some debug overlays still call this.
    getTile() { return 0; },

    isWalkable(gridX, gridY) {
        if (gridX < 0 || gridY < 0 || gridX >= this.width || gridY >= this.height) return false;
        if (!this._mask || !this.bgImage) return true;
        const ts = this.TILE_SIZE * this.SCALE;
        // Sample mask at the centre of the tile, remapped to mask coords.
        const worldX = gridX * ts + ts / 2;
        const worldY = gridY * ts + ts / 2;
        const mx = Math.floor(worldX * this._maskW / this.bgImage.width);
        const my = Math.floor(worldY * this._maskH / this.bgImage.height);
        if (mx < 0 || my < 0 || mx >= this._maskW || my >= this._maskH) return false;
        const idx = (my * this._maskW + mx) * 4;
        return this._mask[idx] >= 128;
    },

    render(ctx, cameraX, cameraY /*, viewW, viewH */) {
        if (!this.bgReady || !this.bgImage || !this.bgImage.complete) {
            // Fallback flat tile while the PNG loads
            ctx.fillStyle = '#4a8c3f';
            ctx.fillRect(-cameraX, -cameraY, 2000, 2000);
            return;
        }
        ctx.drawImage(this.bgImage, -cameraX, -cameraY, this.bgImage.width, this.bgImage.height);
    }
};
