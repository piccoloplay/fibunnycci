const TeamBuilder = {
    active: false,
    animTimer: 0,
    currentTeam: ['coniglio', 'cavallo', 'bue'],
    mode: 'view', // 'view' | 'swap'
    swapSlot: -1,
    scrollOffset: 0,

    open() {
        this.active = true;
        this.mode = 'view';
        this.animTimer = 0;
        this.scrollOffset = 0;
    },

    close() {
        this.active = false;
    },

    getTeamCreatures() {
        return this.currentTeam.map(id => {
            const c = Creatures.getById(id);
            if (!c) return null;
            const level = Creatures.getLevel(id);
            return { ...Creatures.getStatsForLevel(c, level), currentHp: Creatures.getStatsForLevel(c, level).maxHp };
        }).filter(c => c !== null);
    },

    update(dt) {
        if (!this.active) return;
        this.animTimer += dt;

        // Back button (keyboard)
        if (Input.wasPressed('cancel')) {
            if (this.mode === 'swap') {
                this.mode = 'view';
                Audio.play('cancel');
            } else {
                this.close();
                Audio.play('cancel');
            }
        }
    },

    // ─── TOUCH HANDLER (called from touch.js) ───
    handleTap(pos, w, h) {
        if (this.mode === 'view') {
            this._handleViewTap(pos, w, h);
        } else {
            this._handleSwapTap(pos, w, h);
        }
    },

    _handleViewTap(pos, w, h) {
        // Back button (bottom bar)
        if (this._isBackHit(pos, w, h)) {
            this.close();
            Audio.play('cancel');
            return;
        }

        // Team slot cards
        const cardH = 150;
        const startY = 100;
        const gap = 16;

        for (let i = 0; i < 3; i++) {
            const cy = startY + i * (cardH + gap);
            if (pos.y >= cy && pos.y <= cy + cardH && pos.x >= 30 && pos.x <= w - 30) {
                this.swapSlot = i;
                this.mode = 'swap';
                this.scrollOffset = 0;
                Audio.play('select');
                return;
            }
        }
    },

    _handleSwapTap(pos, w, h) {
        // Back button (bottom bar)
        if (this._isBackHit(pos, w, h)) {
            this.mode = 'view';
            Audio.play('cancel');
            return;
        }

        // Roster items
        const roster = Creatures.roster;
        const itemH = 90;
        const startY = 80;
        const visibleCount = Math.floor((h - startY - 40) / itemH);

        for (let vi = 0; vi < visibleCount && vi + this.scrollOffset < roster.length; vi++) {
            const i = vi + this.scrollOffset;
            const iy = startY + vi * itemH;
            if (pos.y >= iy && pos.y <= iy + itemH - 6 && pos.x >= 20 && pos.x <= w - 20) {
                const newId = roster[i].id;
                const existingSlot = this.currentTeam.indexOf(newId);
                if (existingSlot !== -1 && existingSlot !== this.swapSlot) {
                    this.currentTeam[existingSlot] = this.currentTeam[this.swapSlot];
                }
                this.currentTeam[this.swapSlot] = newId;
                this.mode = 'view';
                Audio.play('confirm');
                return;
            }
        }

        // Scroll arrows
        if (pos.y < startY && this.scrollOffset > 0) {
            this.scrollOffset--;
            Audio.play('select');
        }
        if (pos.y > h - 40 && this.scrollOffset + visibleCount < roster.length) {
            this.scrollOffset++;
            Audio.play('select');
        }
    },

    // ─── RENDER ───
    render(ctx, w, h) {
        if (!this.active) return;

        if (this.mode === 'view') {
            this._renderView(ctx, w, h);
        } else {
            this._renderSwap(ctx, w, h);
        }
    },

    _renderView(ctx, w, h) {
        UI.drawPanelBg(ctx, w, h, { dark: true });

        // Back button
        this._drawBackButton(ctx, w, h);

        // Title
        UI.text(ctx, 'IL TUO TEAM', w / 2, 45, {
            color: '#ffcc00', size: 28, bold: true, align: 'center'
        });
        UI.text(ctx, 'Tocca uno slot per cambiare', w / 2, 75, {
            color: '#889', size: 14, align: 'center'
        });

        // Team slots — big cards
        const cardH = 150;
        const startY = 100;
        const gap = 16;

        for (let i = 0; i < 3; i++) {
            const creature = Creatures.getById(this.currentTeam[i]);
            if (!creature) continue;

            const cy = startY + i * (cardH + gap);
            const level = Creatures.getLevel(creature.id);
            const stats = Creatures.getStatsForLevel(creature, level);

            // Pop-in
            const popT = Math.min(1, Math.max(0, (this.animTimer - i * 60) / 300));
            const popScale = UI.easeOutBack(popT);

            ctx.save();
            ctx.translate(w / 2, cy + cardH / 2);
            ctx.scale(popScale, popScale);
            ctx.translate(-w / 2, -(cy + cardH / 2));

            // Card background with gradient
            const cardGrad = ctx.createLinearGradient(30, cy, 30, cy + cardH);
            cardGrad.addColorStop(0, 'rgba(60,80,140,0.25)');
            cardGrad.addColorStop(1, 'rgba(30,40,80,0.3)');
            ctx.fillStyle = cardGrad;
            UI.roundRect(ctx, 30, cy, w - 60, cardH, 16);
            ctx.fill();

            ctx.strokeStyle = creature.color;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 2;
            UI.roundRect(ctx, 30, cy, w - 60, cardH, 16);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Slot number
            ctx.fillStyle = creature.color;
            UI.roundRect(ctx, 38, cy + 8, 36, 24, 8);
            ctx.fill();
            UI.text(ctx, `${i + 1}`, 56, cy + 26, {
                color: '#fff', size: 16, bold: true, align: 'center'
            });

            // Creature sprite
            Creatures.drawCreature(ctx, 120, cy + cardH / 2, creature, 36, 'idle', this.animTimer);

            // Info
            UI.text(ctx, creature.creatureName, 175, cy + 30, {
                color: '#fff', size: 20, bold: true
            });
            UI.text(ctx, `Lv.${level} — ${creature.role}`, 175, cy + 52, {
                color: creature.color, size: 14
            });

            // Stats
            UI.text(ctx, `HP:${stats.maxHp}  ATK:${stats.atk}  DEF:${stats.def}`, 175, cy + 76, {
                color: '#bbc', size: 13
            });
            UI.text(ctx, `CRT:${(stats.critChance * 100).toFixed(0)}%  EVA:${(stats.evasionChance * 100).toFixed(0)}%`, 175, cy + 96, {
                color: '#99a', size: 12
            });

            // XP bar
            const xp = Creatures.getXP(creature.id);
            const xpNext = Creatures.getXPForNextLevel(level);
            const xpRatio = xpNext === Infinity ? 1 : xp / xpNext;
            UI.drawHPBar(ctx, 175, cy + 110, w - 230, 10, xpRatio, { borderColor: '#446' });
            UI.text(ctx, `XP: ${xp}/${xpNext === Infinity ? 'MAX' : xpNext}`, 175, cy + 134, {
                color: '#778', size: 11
            });

            // Element badge
            if (creature.element) {
                const el = Creatures.ELEMENTS[creature.element];
                ctx.fillStyle = el.color;
                ctx.globalAlpha = 0.8;
                UI.roundRect(ctx, w - 110, cy + 12, 70, 24, 8);
                ctx.fill();
                ctx.globalAlpha = 1;
                UI.text(ctx, el.name, w - 75, cy + 30, {
                    color: '#fff', size: 12, bold: true, align: 'center'
                });
            }

            ctx.restore();
        }
    },

    _renderSwap(ctx, w, h) {
        UI.drawPanelBg(ctx, w, h, { dark: true });

        this._drawBackButton(ctx, w, h);

        UI.text(ctx, `Slot ${this.swapSlot + 1}: Scegli creatura`, w / 2, 45, {
            color: '#ffcc00', size: 22, bold: true, align: 'center'
        });

        const roster = Creatures.roster;
        const itemH = 90;
        const startY = 80;
        const visibleCount = Math.floor((h - startY - 40) / itemH);

        for (let vi = 0; vi < visibleCount && vi + this.scrollOffset < roster.length; vi++) {
            const i = vi + this.scrollOffset;
            const creature = roster[i];
            const iy = startY + vi * itemH;
            const inTeam = this.currentTeam.includes(creature.id);
            const unlocked = Creatures.isUnlocked(creature.id);

            // Card
            ctx.fillStyle = inTeam ? 'rgba(255,200,50,0.1)' : unlocked ? 'rgba(255,255,255,0.05)' : 'rgba(50,50,50,0.3)';
            UI.roundRect(ctx, 20, iy, w - 40, itemH - 6, 12);
            ctx.fill();
            ctx.strokeStyle = inTeam ? 'rgba(255,200,50,0.3)' : unlocked ? 'rgba(255,255,255,0.1)' : 'rgba(100,100,100,0.2)';
            ctx.lineWidth = 1.5;
            UI.roundRect(ctx, 20, iy, w - 40, itemH - 6, 12);
            ctx.stroke();

            if (unlocked) {
                const level = Creatures.getLevel(creature.id);

                // Sprite
                Creatures.drawCreature(ctx, 65, iy + itemH / 2 - 3, creature, 24, 'idle', this.animTimer);

                // Info
                UI.text(ctx, creature.creatureName, 105, iy + 24, {
                    color: '#fff', size: 18, bold: true
                });
                UI.text(ctx, `Lv.${level} — ${creature.role}`, 105, iy + 46, {
                    color: creature.color, size: 13
                });
                UI.text(ctx, `HP:${creature.maxHp} ATK:${creature.atk} DEF:${creature.def}`, 105, iy + 66, {
                    color: '#99a', size: 12
                });

                // In team badge
                if (inTeam) {
                    ctx.fillStyle = 'rgba(255,200,50,0.8)';
                    UI.roundRect(ctx, w - 120, iy + 10, 80, 24, 8);
                    ctx.fill();
                    UI.text(ctx, 'IN TEAM', w - 80, iy + 28, {
                        color: '#333', size: 12, bold: true, align: 'center'
                    });
                }
            } else {
                // Locked
                UI.text(ctx, '???', 65, iy + itemH / 2 + 5, {
                    color: '#555', size: 24, align: 'center'
                });
                UI.text(ctx, 'Non sbloccato', 105, iy + 35, {
                    color: '#555', size: 16
                });
                UI.text(ctx, 'Vinci battaglie per catturare!', 105, iy + 56, {
                    color: '#444', size: 12
                });
            }
        }

        // Scroll indicators
        if (this.scrollOffset > 0) {
            UI.text(ctx, '▲ Scorri su', w / 2, startY - 8, {
                color: '#668', size: 14, align: 'center'
            });
        }
        if (this.scrollOffset + visibleCount < roster.length) {
            UI.text(ctx, '▼ Scorri giu', w / 2, h - 20, {
                color: '#668', size: 14, align: 'center'
            });
        }
    },

    BACK_BAR_H: 68,

    _drawBackButton(ctx, w, h) {
        const bh = this.BACK_BAR_H;
        const by = h - bh;
        const btnW = Math.min(260, w - 40);
        const bx = (w - btnW) / 2;
        ctx.fillStyle = 'rgba(10,10,30,0.9)';
        ctx.fillRect(0, by, w, bh);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, by, w, 1);
        ctx.fillStyle = 'rgba(160,160,255,0.18)';
        UI.roundRect(ctx, bx, by + 10, btnW, bh - 20, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,160,255,0.4)';
        ctx.lineWidth = 2;
        UI.roundRect(ctx, bx, by + 10, btnW, bh - 20, 14);
        ctx.stroke();
        UI.text(ctx, '← Indietro', w / 2, by + bh / 2 + 6, {
            color: '#fff', size: 18, bold: true, align: 'center'
        });
    },

    _isBackHit(pos, w, h) {
        return pos.y >= h - this.BACK_BAR_H;
    }
};
