const GameMap = {
    TILE_SIZE: 16,
    SCALE: 4,  // HD: 16*4 = 64px per tile
    tileData: null,
    collisionData: null,
    width: 0,
    height: 0,

    // Tile types and their placeholder colors
    TILES: {
        0: { color: '#4a8c3f', name: 'grass' },
        1: { color: '#c4a96a', name: 'path' },
        2: { color: '#3a6fb5', name: 'water' },
        3: { color: '#2d5a1e', name: 'tree' },
        4: { color: '#7a7a7a', name: 'wall' },
        5: { color: '#8b6b4a', name: 'door' },
        6: { color: '#5a7a4a', name: 'tall_grass' },
        7: { color: '#9a8a6a', name: 'sand' },
        8: { color: '#6a5a4a', name: 'roof' },
        9: { color: '#4a7a8a', name: 'bridge' },
        10: { color: '#b0b0b0', name: 'concrete' },
        11: { color: '#c0392b', name: 'school_roof' },
        12: { color: '#e8c86a', name: 'playground' },
        13: { color: '#555555', name: 'rail' },
        14: { color: '#d4a24a', name: 'market_stall' },
        15: { color: '#f0c070', name: 'school_floor' },
        16: { color: '#e07030', name: 'construction' },
        17: { color: '#3a9a5a', name: 'park_grass' },
        18: { color: '#8a6a4a', name: 'fence' },
        19: { color: '#607090', name: 'station_floor' },
        20: { color: '#ffcc44', name: 'exit_zone' }
    },

    exits: [], // {x, y, targetEpisode, targetX, targetY, direction, label}

    loadFromEpisode(episodeData) {
        this.width = episodeData.map.width;
        this.height = episodeData.map.height;
        this.tileData = episodeData.map.tiles;
        this.collisionData = episodeData.map.collisions;
        this.exits = episodeData.exits || [];
    },

    getExitAt(gridX, gridY) {
        return this.exits.find(e => e.x === gridX && e.y === gridY);
    },

    isWalkable(gridX, gridY) {
        if (gridX < 0 || gridY < 0 || gridX >= this.width || gridY >= this.height) return false;
        return this.collisionData[gridY][gridX] === 0;
    },

    getTile(gridX, gridY) {
        if (gridX < 0 || gridY < 0 || gridX >= this.width || gridY >= this.height) return 4;
        return this.tileData[gridY][gridX];
    },

    render(ctx, cameraX, cameraY, viewW, viewH) {
        const ts = this.TILE_SIZE * this.SCALE;
        const startCol = Math.floor(cameraX / ts);
        const startRow = Math.floor(cameraY / ts);
        const endCol = startCol + Math.ceil(viewW / ts) + 1;
        const endRow = startRow + Math.ceil(viewH / ts) + 1;

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const tileId = this.getTile(col, row);
                const x = col * ts - cameraX;
                const y = row * ts - cameraY;
                // 16-bit pixel tile (procedural). Falls back to solid color via default case.
                Sprites.drawTile(ctx, tileId, x, y, ts);
            }
        }
    },

    _drawTileDetail(ctx, tileId, x, y, ts) {
        const cx = x + ts / 2;
        const cy = y + ts / 2;

        switch (tileId) {
            case 0: // grass — soft blades
                ctx.fillStyle = '#5aaa4f';
                for (let i = 0; i < 6; i++) {
                    const gx = x + 8 + (i * 37 % (ts - 16));
                    const gy = y + 10 + (i * 23 % (ts - 20));
                    ctx.beginPath();
                    ctx.moveTo(gx, gy + 10);
                    ctx.quadraticCurveTo(gx - 3, gy, gx + 2, gy - 4);
                    ctx.quadraticCurveTo(gx + 4, gy, gx + 1, gy + 10);
                    ctx.fill();
                }
                break;
            case 2: // water — smooth waves
                const wt = Date.now() * 0.002;
                ctx.fillStyle = 'rgba(80,140,220,0.25)';
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    const wy = y + ts * 0.25 + i * ts * 0.25;
                    ctx.moveTo(x, wy);
                    for (let wx = 0; wx <= ts; wx += 4) {
                        ctx.lineTo(x + wx, wy + Math.sin(wt + wx * 0.08 + i) * 4);
                    }
                    ctx.lineTo(x + ts, wy + 8);
                    ctx.lineTo(x, wy + 8);
                    ctx.closePath();
                    ctx.fill();
                }
                break;
            case 3: // tree — smooth trunk + round canopy
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.ellipse(cx + 2, y + ts - 6, ts * 0.35, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                // Trunk
                const trunkGrad = ctx.createLinearGradient(cx - 5, y, cx + 5, y);
                trunkGrad.addColorStop(0, '#6a4a2a');
                trunkGrad.addColorStop(0.5, '#8a6a4a');
                trunkGrad.addColorStop(1, '#5a3a1a');
                ctx.fillStyle = trunkGrad;
                ctx.beginPath();
                ctx.moveTo(cx - 5, y + ts * 0.45);
                ctx.lineTo(cx - 4, y + ts - 8);
                ctx.lineTo(cx + 4, y + ts - 8);
                ctx.lineTo(cx + 5, y + ts * 0.45);
                ctx.closePath();
                ctx.fill();
                // Canopy layers
                const canopyColors = ['#1a8a0a', '#2aaa1a', '#1a7a0a'];
                canopyColors.forEach((c, i) => {
                    ctx.fillStyle = c;
                    ctx.beginPath();
                    ctx.arc(cx + (i - 1) * 6, y + ts * 0.3 - i * 4, ts * 0.32 - i * 2, 0, Math.PI * 2);
                    ctx.fill();
                });
                // Canopy highlight
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.beginPath();
                ctx.arc(cx - 4, y + ts * 0.22, ts * 0.18, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 6: // tall grass — wavy blades
                for (let i = 0; i < 7; i++) {
                    const bx = x + 5 + i * (ts / 7);
                    const sway = Math.sin(Date.now() * 0.002 + i * 0.8) * 3;
                    ctx.strokeStyle = i % 2 === 0 ? '#3a8c2f' : '#4a9c3f';
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(bx, y + ts - 4);
                    ctx.quadraticCurveTo(bx + sway, y + ts * 0.5, bx + sway * 1.5, y + 8);
                    ctx.stroke();
                }
                break;
            case 12: // playground — smooth colored circles
                ctx.fillStyle = 'rgba(220,190,100,0.3)';
                ctx.beginPath(); ctx.arc(x + ts * 0.3, y + ts * 0.3, 8, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(x + ts * 0.7, y + ts * 0.7, 6, 0, Math.PI * 2); ctx.fill();
                break;
            case 13: // rail — smooth tracks
                ctx.fillStyle = '#888';
                ctx.fillRect(x + 4, y + ts * 0.3, ts - 8, 4);
                ctx.fillRect(x + 4, y + ts * 0.6, ts - 8, 4);
                // Ties
                ctx.fillStyle = '#8a7a5a';
                for (let i = 0; i < 5; i++) {
                    const tx = x + 8 + i * (ts / 5);
                    ctx.fillRect(tx, y + ts * 0.25, 5, ts * 0.45);
                }
                break;
            case 14: // market stall — awning
                const awningGrad = ctx.createLinearGradient(x, y, x, y + ts * 0.2);
                awningGrad.addColorStop(0, '#d4a24a');
                awningGrad.addColorStop(1, '#c09040');
                ctx.fillStyle = awningGrad;
                ctx.fillRect(x, y, ts, ts * 0.2);
                // Stripes
                ctx.fillStyle = '#fff';
                for (let i = 0; i < 4; i++) {
                    ctx.fillRect(x + i * (ts / 3.5) + 4, y, ts / 7, ts * 0.2);
                }
                break;
            case 16: // construction — hazard stripes
                ctx.fillStyle = '#e07030';
                ctx.globalAlpha = 0.3;
                for (let i = 0; i < 5; i++) {
                    ctx.fillRect(x + i * (ts / 4), y, ts / 8, ts);
                }
                ctx.globalAlpha = 1;
                break;
            case 17: // park grass — flowers
                const flowers = [
                    { dx: 0.2, dy: 0.3, c: '#ff7090', s: 5 },
                    { dx: 0.7, dy: 0.5, c: '#70a0ff', s: 4 },
                    { dx: 0.4, dy: 0.75, c: '#ffe050', s: 5 },
                    { dx: 0.8, dy: 0.2, c: '#ff90b0', s: 3 }
                ];
                flowers.forEach(f => {
                    // Petals
                    ctx.fillStyle = f.c;
                    for (let p = 0; p < 5; p++) {
                        const angle = p * Math.PI * 2 / 5;
                        ctx.beginPath();
                        ctx.arc(x + ts * f.dx + Math.cos(angle) * f.s, y + ts * f.dy + Math.sin(angle) * f.s, f.s * 0.6, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    // Center
                    ctx.fillStyle = '#ffee44';
                    ctx.beginPath();
                    ctx.arc(x + ts * f.dx, y + ts * f.dy, f.s * 0.4, 0, Math.PI * 2);
                    ctx.fill();
                });
                break;
            case 18: // fence — smooth rounded posts
                ctx.fillStyle = '#7a6a4a';
                // Posts
                for (let i = 0; i < 2; i++) {
                    const px = x + 10 + i * (ts - 20);
                    ctx.beginPath();
                    ctx.moveTo(px - 3, y + 8);
                    ctx.lineTo(px + 3, y + 8);
                    ctx.lineTo(px + 3, y + ts - 4);
                    ctx.lineTo(px - 3, y + ts - 4);
                    ctx.closePath();
                    ctx.fill();
                    // Post top (rounded)
                    ctx.beginPath();
                    ctx.arc(px, y + 8, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Crossbars
                ctx.fillRect(x + 4, y + ts * 0.3, ts - 8, 4);
                ctx.fillRect(x + 4, y + ts * 0.6, ts - 8, 4);
                break;
            case 20: // exit zone — glowing pulsing circle + arrow
                const pulse = 0.3 + Math.sin(Date.now() * 0.004) * 0.15;
                ctx.fillStyle = `rgba(255,204,68,${pulse})`;
                ctx.beginPath();
                ctx.arc(cx, cy, ts * 0.35, 0, Math.PI * 2);
                ctx.fill();
                // Arrow
                ctx.fillStyle = `rgba(255,220,100,${0.5 + Math.sin(Date.now() * 0.005) * 0.3})`;
                ctx.beginPath();
                ctx.moveTo(cx - 10, cy - 8);
                ctx.lineTo(cx + 10, cy);
                ctx.lineTo(cx - 10, cy + 8);
                ctx.closePath();
                ctx.fill();
                break;
        }
    }
};
