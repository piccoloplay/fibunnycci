const Player = {
    gridX: 0,
    gridY: 0,
    pixelX: 0,
    pixelY: 0,
    targetX: 0,
    targetY: 0,
    moving: false,
    moveSpeed: 1.8,
    direction: 'down', // up, down, left, right, up_left, up_right, down_left, down_right
    animFrame: 0,
    animTimer: 0,

    // Bunny-boy colors (Piccoloplay)
    COLORS: {
        body: '#e06040',
        skin: '#ffd5b5',
        hair: '#5a3a2a',
        ears: '#e8a0b0',
        earInner: '#ffaaaa',
        pants: '#445'
    },

    init(startX, startY) {
        this.gridX = startX;
        this.gridY = startY;
        const ts = GameMap.TILE_SIZE * GameMap.SCALE;
        this.pixelX = startX * ts;
        this.pixelY = startY * ts;
        this.targetX = this.pixelX;
        this.targetY = this.pixelY;
        this.moving = false;
    },

    update(dt) {
        if (this.moving) {
            this._moveToTarget(dt);
            this.animTimer += dt;
            if (this.animTimer > 150) {
                this.animFrame = (this.animFrame + 1) % 4;
                this.animTimer = 0;
            }
        } else {
            this.animFrame = 0;
            this._checkMovementInput();
        }
    },

    _checkMovementInput() {
        let dx = 0, dy = 0;

        // Read both axes simultaneously for 8-direction
        if (Input.isDown('up')) dy = -1;
        if (Input.isDown('down')) dy = 1;
        if (Input.isDown('left')) dx = -1;
        if (Input.isDown('right')) dx = 1;

        // Cancel out opposing directions
        if (dy === -1 && Input.isDown('down')) dy = 0;
        if (dx === -1 && Input.isDown('right')) dx = 0;

        if (dx === 0 && dy === 0) return;

        // Set direction (8-way)
        if (dx === 0 && dy === -1) this.direction = 'up';
        else if (dx === 0 && dy === 1) this.direction = 'down';
        else if (dx === -1 && dy === 0) this.direction = 'left';
        else if (dx === 1 && dy === 0) this.direction = 'right';
        else if (dx === -1 && dy === -1) this.direction = 'up_left';
        else if (dx === 1 && dy === -1) this.direction = 'up_right';
        else if (dx === -1 && dy === 1) this.direction = 'down_left';
        else if (dx === 1 && dy === 1) this.direction = 'down_right';

        const newGridX = this.gridX + dx;
        const newGridY = this.gridY + dy;

        // For diagonals, check both the target AND the two adjacent tiles
        // This prevents cutting through corners
        if (dx !== 0 && dy !== 0) {
            const walkDiag = GameMap.isWalkable(newGridX, newGridY);
            const walkH = GameMap.isWalkable(this.gridX + dx, this.gridY);
            const walkV = GameMap.isWalkable(this.gridX, this.gridY + dy);
            const npcDiag = NPC.getAt(newGridX, newGridY);
            const npcH = NPC.getAt(this.gridX + dx, this.gridY);
            const npcV = NPC.getAt(this.gridX, this.gridY + dy);

            if (!walkDiag || !walkH || !walkV || npcDiag || npcH || npcV) {
                // Try sliding along one axis
                if (walkH && !npcH) {
                    dy = 0;
                    this.direction = dx === -1 ? 'left' : 'right';
                } else if (walkV && !npcV) {
                    dx = 0;
                    this.direction = dy === -1 ? 'up' : 'down';
                } else {
                    return; // Blocked
                }
            }
        } else {
            // Cardinal direction
            if (!GameMap.isWalkable(newGridX, newGridY)) return;
            if (NPC.getAt(newGridX, newGridY)) return;
        }

        const finalX = this.gridX + dx;
        const finalY = this.gridY + dy;
        this.gridX = finalX;
        this.gridY = finalY;
        const ts = GameMap.TILE_SIZE * GameMap.SCALE;
        this.targetX = finalX * ts;
        this.targetY = finalY * ts;
        this.moving = true;
    },

    _moveToTarget(dt) {
        const speed = this.moveSpeed * dt;
        const dx = this.targetX - this.pixelX;
        const dy = this.targetY - this.pixelY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < speed) {
            this.pixelX = this.targetX;
            this.pixelY = this.targetY;
            this.moving = false;
        } else {
            this.pixelX += (dx / dist) * speed;
            this.pixelY += (dy / dist) * speed;
        }
    },

    getFacingTile() {
        const dirs = {
            up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
            up_left: [-1, -1], up_right: [1, -1],
            down_left: [-1, 1], down_right: [1, 1]
        };
        const d = dirs[this.direction] || [0, 1];
        return { x: this.gridX + d[0], y: this.gridY + d[1] };
    },

    render(ctx, cameraX, cameraY) {
        const ts = GameMap.TILE_SIZE * GameMap.SCALE;
        const x = this.pixelX - cameraX;
        const y = this.pixelY - cameraY;
        const cx = x + ts / 2;
        const cy = y + ts / 2;

        // Soft pixel shadow
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        const sh = ts / 16;
        ctx.fillRect(Math.round(x + 4 * sh), Math.round(y + 13 * sh), Math.ceil(8 * sh), Math.ceil(2 * sh));

        // Pick sprite based on facing + walk frame
        const dir = this.direction || 'down';
        let face = 'down';
        let flip = false;
        if (dir.includes('up')) face = 'up';
        else if (dir.includes('left')) { face = 'right'; flip = true; }
        else if (dir.includes('right')) face = 'right';
        const frame = (this.moving && (this.animFrame % 2 === 1)) ? 1 : 0;
        const key = `player_${face}_${frame}`;
        Sprites.draw(ctx, key, Math.round(x), Math.round(y), ts / 16, flip);
        return;

        const bob = this.moving ? Math.sin(this.animFrame * Math.PI / 2) * 2 : 0;

        // Derive facing from direction
        const isUp = this.direction.includes('up');
        const isDown = this.direction.includes('down');
        const isLeft = this.direction.includes('left');
        const isRight = this.direction.includes('right');
        const isDiag = this.direction.includes('_');

        // Body lean for diagonals
        const leanX = isLeft ? -2 : isRight ? 2 : 0;

        ctx.save();
        ctx.translate(cx, cy);

        // Scale up for HD canvas (player was designed for SCALE 2, now SCALE 4)
        const pScale = GameMap.SCALE / 2;
        ctx.scale(pScale, pScale);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(0, 14, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── BUNNY EARS (behind head when facing down) ──
        if (isDown || (!isUp && !isDiag)) {
            this._drawEars(ctx, bob, leanX, false);
        }

        // ── BODY ──
        ctx.fillStyle = this.COLORS.body;
        ctx.beginPath();
        ctx.ellipse(leanX, 3 - bob, 9, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // ── HEAD ──
        ctx.fillStyle = this.COLORS.skin;
        ctx.beginPath();
        ctx.ellipse(leanX, -7 - bob, 8, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // ── BUNNY EARS (in front when facing up) ──
        if (isUp) {
            this._drawEars(ctx, bob, leanX, true);
        }

        // ── HAIR ──
        ctx.fillStyle = this.COLORS.hair;
        if (isUp) {
            // Hair visible from behind
            ctx.beginPath();
            ctx.ellipse(leanX, -10 - bob, 8.5, 5, 0, Math.PI, Math.PI * 2);
            ctx.fill();
        } else {
            // Bangs
            ctx.fillRect(leanX - 7, -14 - bob, 14, 4);
        }

        // ── EYES ──
        ctx.fillStyle = '#333';
        if (isDown && !isDiag) {
            // Front facing - big kawaii eyes
            this._drawEyes(ctx, leanX, -8 - bob, 0);
        } else if (isUp && !isDiag) {
            // Back - no eyes
        } else if (isLeft && !isDiag) {
            // Left profile
            this._drawEyes(ctx, leanX - 3, -8 - bob, -1);
        } else if (isRight && !isDiag) {
            // Right profile
            this._drawEyes(ctx, leanX + 3, -8 - bob, 1);
        } else if (this.direction === 'down_left') {
            this._drawEyes(ctx, leanX - 1, -8 - bob, -0.5);
        } else if (this.direction === 'down_right') {
            this._drawEyes(ctx, leanX + 1, -8 - bob, 0.5);
        } else if (this.direction === 'up_left') {
            // Slight turn - one eye visible
            ctx.beginPath();
            ctx.arc(leanX - 4, -8 - bob, 1.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.direction === 'up_right') {
            ctx.beginPath();
            ctx.arc(leanX + 4, -8 - bob, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── MOUTH (front/side only) ──
        if (!isUp) {
            ctx.fillStyle = '#cc6666';
            ctx.beginPath();
            ctx.arc(leanX + (isLeft ? -2 : isRight ? 2 : 0), -3 - bob, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── LEGS ──
        ctx.fillStyle = this.COLORS.pants;
        if (this.moving) {
            const legPhase = this.animFrame % 2 === 0;
            const legSpread = isDiag ? 2 : 3;
            // Left leg
            ctx.fillRect(-5 + leanX + (legPhase ? -legSpread : legSpread), 9 - bob, 4, 5);
            // Right leg
            ctx.fillRect(1 + leanX + (legPhase ? legSpread : -legSpread), 9 - bob, 4, 5);
        } else {
            ctx.fillRect(-4 + leanX, 9, 4, 5);
            ctx.fillRect(1 + leanX, 9, 4, 5);
        }

        // ── BUNNY TAIL (when facing up) ──
        if (isUp) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(leanX, 7 - bob, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    },

    _drawEars(ctx, bob, leanX, front) {
        const earH = front ? 10 : 12;

        // Left ear
        ctx.fillStyle = this.COLORS.ears;
        ctx.beginPath();
        ctx.ellipse(leanX - 4, -16 - bob, 3, earH, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.6;
        ctx.stroke();
        // Inner
        ctx.fillStyle = this.COLORS.earInner;
        ctx.beginPath();
        ctx.ellipse(leanX - 4, -16 - bob, 1.5, earH * 0.6, -0.1, 0, Math.PI * 2);
        ctx.fill();

        // Right ear
        ctx.fillStyle = this.COLORS.ears;
        ctx.beginPath();
        ctx.ellipse(leanX + 4, -17 - bob, 3, earH, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.fillStyle = this.COLORS.earInner;
        ctx.beginPath();
        ctx.ellipse(leanX + 4, -17 - bob, 1.5, earH * 0.6, 0.15, 0, Math.PI * 2);
        ctx.fill();
    },

    _drawEyes(ctx, ex, ey, lookDir) {
        // lookDir: -1=left, 0=center, 1=right, 0.5/-0.5 = slight
        const spread = Math.abs(lookDir) < 0.8 ? 3 : 2;
        const offsetX = lookDir * 1.5;

        // White
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(ex - spread + offsetX, ey, 2.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(ex + spread + offsetX, ey, 2.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#222';
        const pupilShift = lookDir * 0.8;
        ctx.beginPath();
        ctx.arc(ex - spread + offsetX + pupilShift, ey + 0.5, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + spread + offsetX + pupilShift, ey + 0.5, 1.3, 0, Math.PI * 2);
        ctx.fill();

        // Shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex - spread + offsetX - 0.5, ey - 1, 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(ex + spread + offsetX - 0.5, ey - 1, 0.6, 0, Math.PI * 2);
        ctx.fill();
    }
};
