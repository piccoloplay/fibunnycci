const Dialogue = {
    active: false,
    lines: [],
    currentLine: 0,
    currentChar: 0,
    npcName: '',
    npcColor: '#fff',
    npcId: '',
    fullText: '',
    displayText: '',
    charTimer: 0,
    charSpeed: 30,
    finished: false,
    animTimer: 0,
    _inputCooldown: 0, // Prevent instant skip on open

    // Special NPC IDs that get visual novel mode
    VN_NPCS: ['sensei', 'sfidante1', 'sfidante2'],

    init() {},

    start(dialogueData) {
        this.active = true;
        this.npcName = dialogueData.name;
        this.npcColor = dialogueData.color;
        this.npcId = dialogueData.npcId || '';
        this.lines = dialogueData.lines;
        this.currentLine = 0;
        this.animTimer = 0;
        this._inputCooldown = 300; // Ignore input for 300ms after opening
        this._showLine();
    },

    _showLine() {
        this.fullText = this.lines[this.currentLine];
        this.displayText = '';
        this.currentChar = 0;
        this.charTimer = 0;
        this.finished = false;
    },

    _isVnMode() {
        return this.VN_NPCS.includes(this.npcId);
    },

    update(dt) {
        if (!this.active) return;
        this.animTimer += dt;

        // Cooldown to prevent instant skip
        if (this._inputCooldown > 0) {
            this._inputCooldown -= dt;
            return;
        }

        // Text animation
        if (!this.finished) {
            this.charTimer += dt;
            while (this.charTimer >= this.charSpeed && this.currentChar < this.fullText.length) {
                this.displayText += this.fullText[this.currentChar];
                this.currentChar++;
                this.charTimer -= this.charSpeed;
                if (this.currentChar % 4 === 0) Audio.play('npcTalk');
            }
            if (this.currentChar >= this.fullText.length) {
                this.finished = true;
            }
        }

        if (Input.wasPressed('confirm')) {
            if (!this.finished) {
                // Skip to end of line
                this.displayText = this.fullText;
                this.finished = true;
            } else {
                this.currentLine++;
                if (this.currentLine >= this.lines.length) {
                    this.close();
                } else {
                    this._showLine();
                    this._inputCooldown = 150; // Small cooldown between lines
                }
            }
        }

        if (Input.wasPressed('cancel')) {
            this.close();
        }
    },

    close() {
        this.active = false;
    },

    // ─── RENDER ───
    render(ctx, w, h) {
        if (!this.active) return;

        if (this._isVnMode()) {
            this._renderVN(ctx, w, h);
        } else {
            this._renderNormal(ctx, w, h);
        }
    },

    // ─── NORMAL DIALOGUE (textbox over overworld) ───
    _renderNormal(ctx, w, h) {
        const boxH = 180;
        // Stick just above the 100 px bottom nav bar — clear separation.
        const boxY = h - boxH - 110;
        const boxX = 24;
        const boxW = w - 48;

        // Semi-transparent background
        const grad = ctx.createLinearGradient(0, boxY, 0, boxY + boxH);
        grad.addColorStop(0, 'rgba(10,10,40,0.93)');
        grad.addColorStop(1, 'rgba(10,10,40,0.97)');
        ctx.fillStyle = grad;
        UI.roundRect(ctx, boxX, boxY, boxW, boxH, 16);
        ctx.fill();

        // Border
        ctx.strokeStyle = this.npcColor;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2.5;
        UI.roundRect(ctx, boxX, boxY, boxW, boxH, 16);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Name tag
        ctx.font = UI.fontBold(18);
        const nameW = ctx.measureText(this.npcName).width + 30;
        ctx.fillStyle = this.npcColor;
        UI.roundRect(ctx, boxX + 16, boxY - 18, Math.max(nameW, 80), 34, 10);
        ctx.fill();

        UI.text(ctx, this.npcName, boxX + 30, boxY + 6, {
            color: '#fff', size: 18, bold: true
        });

        // Text
        ctx.fillStyle = '#e8e8e8';
        ctx.font = UI.font(18);
        this._drawWrappedText(ctx, this.displayText, boxX + 28, boxY + 48, boxW - 56, 26);

        // Continue arrow
        if (this.finished) {
            const blink = Math.sin(this.animTimer * 0.005) > 0;
            if (blink) {
                UI.text(ctx, '▼', boxX + boxW - 28, boxY + boxH - 16, {
                    color: '#a0a0ff', size: 20, align: 'right'
                });
            }
        }
    },

    // ─── VISUAL NOVEL DIALOGUE (special NPCs only) ───
    _renderVN(ctx, w, h) {
        // Full background gradient (like a visual novel scene)
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        // Color based on NPC
        const npcBgColors = {
            'sensei': ['#1a2a3a', '#0a1a2a', '#1a2a4a'],
            'sfidante1': ['#3a1a1a', '#2a0a0a', '#4a1a2a'],
            'sfidante2': ['#1a1a3a', '#0a0a2a', '#2a1a4a']
        };
        const colors = npcBgColors[this.npcId] || ['#1a1a2a', '#0a0a1a', '#1a1a3a'];
        bgGrad.addColorStop(0, colors[0]);
        bgGrad.addColorStop(0.5, colors[1]);
        bgGrad.addColorStop(1, colors[2]);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Atmospheric particles
        ctx.fillStyle = `rgba(255,255,255,0.03)`;
        for (let i = 0; i < 15; i++) {
            const px = (i * 97 + this.animTimer * 0.008) % w;
            const py = (i * 67 + this.animTimer * 0.005) % h;
            const pSize = 20 + Math.sin(this.animTimer * 0.002 + i) * 15;
            ctx.beginPath();
            ctx.arc(px, py, pSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Big character sprite
        this._renderVnCharacter(ctx, w, h);

        // Textbox — HD sized
        const boxH = 220;
        const boxY = h * 0.58;
        const boxX = 24;
        const boxW = w - 48;

        // Box background
        const grad = ctx.createLinearGradient(0, boxY, 0, boxY + boxH);
        grad.addColorStop(0, 'rgba(10,10,40,0.94)');
        grad.addColorStop(1, 'rgba(10,10,40,0.98)');
        ctx.fillStyle = grad;
        UI.roundRect(ctx, boxX, boxY, boxW, boxH, 18);
        ctx.fill();

        // Border glow
        ctx.strokeStyle = this.npcColor;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 3;
        UI.roundRect(ctx, boxX, boxY, boxW, boxH, 18);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Name tag
        ctx.font = UI.fontBold(22);
        const nameW = ctx.measureText(this.npcName).width + 36;
        ctx.fillStyle = this.npcColor;
        UI.roundRect(ctx, boxX + 20, boxY - 22, Math.max(nameW, 100), 40, 12);
        ctx.fill();

        UI.text(ctx, this.npcName, boxX + 36, boxY + 6, {
            color: '#fff', size: 22, bold: true
        });

        // Text
        ctx.fillStyle = '#e8e8e8';
        ctx.font = UI.font(20);
        this._drawWrappedText(ctx, this.displayText, boxX + 32, boxY + 50, boxW - 64, 28);

        // Continue
        if (this.finished) {
            const blink = Math.sin(this.animTimer * 0.005) > 0;
            if (blink) {
                UI.text(ctx, '▼', boxX + boxW - 30, boxY + boxH - 20, {
                    color: '#a0a0ff', size: 24, align: 'right'
                });
            }
        }
    },

    _renderVnCharacter(ctx, w, h) {
        const spriteY = h * 0.32;
        const spriteSize = 90; // BIG for HD
        const bounce = Math.sin(this.animTimer * 0.003) * 3;

        // Glow
        ctx.fillStyle = this.npcColor;
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        ctx.arc(w / 2, spriteY + bounce, spriteSize * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Try to draw creature for mapped NPCs
        const creatureId = this._getCreatureIdForNpc(this.npcId);
        if (creatureId) {
            const creature = Creatures.getById(creatureId);
            if (creature) {
                Creatures.drawCreature(ctx, w / 2, spriteY + bounce, creature, spriteSize, 'idle', this.animTimer);
                return;
            }
        }

        // Default big NPC
        this._drawBigNpc(ctx, w / 2, spriteY + bounce, spriteSize);
    },

    _drawBigNpc(ctx, x, y, s) {
        // Body
        ctx.fillStyle = this.npcColor;
        ctx.beginPath();
        ctx.ellipse(x, y + s * 0.1, s * 0.4, s * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.stroke();

        // Head
        ctx.fillStyle = '#ffd5b5';
        ctx.beginPath();
        ctx.ellipse(x, y - s * 0.4, s * 0.28, s * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();

        // Hair
        ctx.fillStyle = '#5a3a2a';
        ctx.beginPath();
        ctx.ellipse(x, y - s * 0.55, s * 0.3, s * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(x - s * 0.1, y - s * 0.4, s * 0.08, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + s * 0.1, y - s * 0.4, s * 0.08, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(x - s * 0.08, y - s * 0.38, s * 0.04, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + s * 0.12, y - s * 0.38, s * 0.04, 0, Math.PI * 2); ctx.fill();

        // Mouth
        if (!this.finished) {
            const open = Math.sin(this.animTimer * 0.015) > 0;
            if (open) {
                ctx.fillStyle = '#333';
                ctx.beginPath(); ctx.ellipse(x, y - s * 0.25, s * 0.05, s * 0.03, 0, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(x, y - s * 0.24, s * 0.05, 0, Math.PI); ctx.stroke();
        }
    },

    _getCreatureIdForNpc(npcId) {
        const mapping = {
            'sfidante1': 'tigre',
            'sfidante2': 'drago',
            'sensei': 'serpente'
        };
        return mapping[npcId] || null;
    },

    _drawWrappedText(ctx, text, x, y, maxW, lineH) {
        const words = text.split(' ');
        let line = '';
        let cy = y;
        for (const word of words) {
            const test = line + word + ' ';
            if (ctx.measureText(test).width > maxW && line.length > 0) {
                ctx.fillText(line.trim(), x, cy);
                line = word + ' ';
                cy += lineH;
            } else {
                line = test;
            }
        }
        if (line.trim()) ctx.fillText(line.trim(), x, cy);
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
