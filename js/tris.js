const Tris = {
    active: false,
    board: [],       // 0=empty, 1=player(X), 2=ai(O)
    cursorX: 1,
    cursorY: 1,
    playerTurn: true,
    winner: 0,       // 0=none, 1=player, 2=ai, 3=draw
    aiTimer: 0,
    areaName: '',
    animTimer: 0,
    resultTimer: 0,

    CELL_SIZE: 70,
    GRID_OFFSET_X: 0,
    GRID_OFFSET_Y: 0,

    start(areaName, canvasW, canvasH) {
        this.active = true;
        this.board = [0,0,0, 0,0,0, 0,0,0];
        this.cursorX = 1;
        this.cursorY = 1;
        this.playerTurn = true;
        this.winner = 0;
        this.areaName = areaName;
        this.aiTimer = 0;
        this.animTimer = 0;
        this.resultTimer = 0;

        // Center the grid
        const gridSize = this.CELL_SIZE * 3;
        this.GRID_OFFSET_X = (canvasW - gridSize) / 2;
        this.GRID_OFFSET_Y = (canvasH - gridSize) / 2 - 20;
    },

    update(dt) {
        if (!this.active) return;
        this.animTimer += dt;

        // Result screen
        if (this.winner !== 0) {
            this.resultTimer += dt;
            if (this.resultTimer > 2000 && Input.wasPressed('confirm')) {
                this.active = false;
            }
            return;
        }

        if (this.playerTurn) {
            // Move cursor
            if (Input.wasPressed('up')) this.cursorY = Math.max(0, this.cursorY - 1);
            if (Input.wasPressed('down')) this.cursorY = Math.min(2, this.cursorY + 1);
            if (Input.wasPressed('left')) this.cursorX = Math.max(0, this.cursorX - 1);
            if (Input.wasPressed('right')) this.cursorX = Math.min(2, this.cursorX + 1);

            // Place X
            if (Input.wasPressed('confirm')) {
                const idx = this.cursorY * 3 + this.cursorX;
                if (this.board[idx] === 0) {
                    this.board[idx] = 1;
                    this.winner = this._checkWinner();
                    if (this.winner === 0) {
                        this.playerTurn = false;
                        this.aiTimer = 0;
                    }
                }
            }

            // Cancel to quit
            if (Input.wasPressed('cancel')) {
                this.active = false;
            }
        } else {
            // AI turn with small delay
            this.aiTimer += dt;
            if (this.aiTimer > 500) {
                this._aiMove();
                this.winner = this._checkWinner();
                this.playerTurn = true;
            }
        }
    },

    _aiMove() {
        // 1. Try to win
        const winMove = this._findWinningMove(2);
        if (winMove !== -1) { this.board[winMove] = 2; return; }

        // 2. Block player
        const blockMove = this._findWinningMove(1);
        if (blockMove !== -1) { this.board[blockMove] = 2; return; }

        // 3. Take center
        if (this.board[4] === 0) { this.board[4] = 2; return; }

        // 4. Take a corner
        const corners = [0, 2, 6, 8].filter(i => this.board[i] === 0);
        if (corners.length > 0) {
            this.board[corners[Math.floor(Math.random() * corners.length)]] = 2;
            return;
        }

        // 5. Take any empty
        const empty = this.board.map((v, i) => v === 0 ? i : -1).filter(i => i !== -1);
        if (empty.length > 0) {
            this.board[empty[Math.floor(Math.random() * empty.length)]] = 2;
        }
    },

    _findWinningMove(player) {
        const lines = [
            [0,1,2],[3,4,5],[6,7,8], // rows
            [0,3,6],[1,4,7],[2,5,8], // cols
            [0,4,8],[2,4,6]          // diags
        ];
        for (const line of lines) {
            const vals = line.map(i => this.board[i]);
            const playerCount = vals.filter(v => v === player).length;
            const emptyCount = vals.filter(v => v === 0).length;
            if (playerCount === 2 && emptyCount === 1) {
                return line[vals.indexOf(0)];
            }
        }
        return -1;
    },

    _checkWinner() {
        const lines = [
            [0,1,2],[3,4,5],[6,7,8],
            [0,3,6],[1,4,7],[2,5,8],
            [0,4,8],[2,4,6]
        ];
        for (const line of lines) {
            const [a, b, c] = line;
            if (this.board[a] !== 0 && this.board[a] === this.board[b] && this.board[b] === this.board[c]) {
                return this.board[a]; // 1 or 2
            }
        }
        if (this.board.every(v => v !== 0)) return 3; // draw
        return 0;
    },

    render(ctx, w, h) {
        if (!this.active) return;

        // Background
        ctx.fillStyle = 'rgba(10, 10, 30, 0.95)';
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 16px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TRIS - ' + this.areaName, w / 2, 40);

        ctx.fillStyle = '#888';
        ctx.font = '18px Nunito, sans-serif';
        ctx.fillText('Tu sei X — Vinci!', w / 2, 58);

        const ox = this.GRID_OFFSET_X;
        const oy = this.GRID_OFFSET_Y;
        const cs = this.CELL_SIZE;

        // Grid lines
        ctx.strokeStyle = '#a0a0ff';
        ctx.lineWidth = 2;
        for (let i = 1; i < 3; i++) {
            // Vertical
            ctx.beginPath();
            ctx.moveTo(ox + i * cs, oy);
            ctx.lineTo(ox + i * cs, oy + cs * 3);
            ctx.stroke();
            // Horizontal
            ctx.beginPath();
            ctx.moveTo(ox, oy + i * cs);
            ctx.lineTo(ox + cs * 3, oy + i * cs);
            ctx.stroke();
        }

        // Cells
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const val = this.board[row * 3 + col];
                const cx = ox + col * cs + cs / 2;
                const cy = oy + row * cs + cs / 2;

                if (val === 1) this._drawX(ctx, cx, cy, cs);
                if (val === 2) this._drawO(ctx, cx, cy, cs);
            }
        }

        // Cursor (blink)
        if (this.playerTurn && this.winner === 0) {
            const blink = Math.sin(this.animTimer * 0.005) > 0;
            if (blink) {
                ctx.strokeStyle = '#ffcc00';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    ox + this.cursorX * cs + 4,
                    oy + this.cursorY * cs + 4,
                    cs - 8, cs - 8
                );
            }
        }

        // AI thinking indicator
        if (!this.playerTurn && this.winner === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '20px Nunito, sans-serif';
            ctx.textAlign = 'center';
            const dots = '.'.repeat(Math.floor(this.animTimer / 300) % 4);
            ctx.fillText('Avversario pensa' + dots, w / 2, oy + cs * 3 + 30);
        }

        // Result
        if (this.winner !== 0) {
            const msg = this.winner === 1 ? 'HAI VINTO!' :
                        this.winner === 2 ? 'HAI PERSO!' : 'PAREGGIO!';
            const color = this.winner === 1 ? '#4caf50' :
                          this.winner === 2 ? '#f44336' : '#ff9800';

            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, oy + cs * 3 + 10, w, 60);

            ctx.fillStyle = color;
            ctx.font = 'bold 20px Nunito, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(msg, w / 2, oy + cs * 3 + 42);

            if (this.resultTimer > 2000) {
                ctx.fillStyle = '#888';
                ctx.font = '18px Nunito, sans-serif';
                ctx.fillText('Tocca per continuare', w / 2, oy + cs * 3 + 60);
            }
        }

        // Controls hint
        ctx.fillStyle = '#555';
        ctx.font = '16px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Frecce: muovi | A: piazza | B: esci', w / 2, h - 20);

        ctx.textAlign = 'left';
    },

    _drawX(ctx, cx, cy, cs) {
        const s = cs * 0.3;
        ctx.strokeStyle = '#60b0ff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - s, cy - s);
        ctx.lineTo(cx + s, cy + s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + s, cy - s);
        ctx.lineTo(cx - s, cy + s);
        ctx.stroke();
    },

    _drawO(ctx, cx, cy, cs) {
        const r = cs * 0.3;
        ctx.strokeStyle = '#ff6080';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
    }
};
