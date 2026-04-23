const Menu = {
    active: false,
    currentView: 'main',
    _gameState: null,
    _animTimer: 0,
    _scrollOffset: 0,

    _bestiaryDetail: null, // Selected creature for detail view

    MAIN_ITEMS: [
        { label: 'Team', icon: 'team', view: 'team', color1: '#4488ff', color2: '#2266cc' },
        { label: 'Bestiario', icon: 'bestiary', view: 'bestiary', color1: '#ff8833', color2: '#cc6622' },
        { label: 'Inventario', icon: 'inventory', view: 'inventory', color1: '#44cc66', color2: '#22aa44' },
        { label: 'Mappa', icon: 'map', view: 'worldmap', color1: '#cc44aa', color2: '#aa2288' },
        { label: 'Salva', icon: 'save', view: 'save', color1: '#4488ff', color2: '#2266cc' },
        { label: 'Opzioni', icon: 'settings', view: 'options', color1: '#888844', color2: '#666622' },
        { label: 'Chiudi', icon: 'close', view: 'close', color1: '#888899', color2: '#666677' }
    ],

    init() {
        // HTML overlay no longer used
    },

    open(gameState) {
        this.active = true;
        this.currentView = 'main';
        this._gameState = gameState;
        this._animTimer = 0;
        this._scrollOffset = 0;
    },

    close() {
        this.active = false;
    },

    update(dt) {
        if (!this.active) return;
        this._animTimer += dt;

        if (Input.wasPressed('cancel')) {
            if (this.currentView === 'main') {
                this.close();
            } else {
                this.currentView = 'main';
            }
            Audio.play('cancel');
        }
    },

    // ─── TOUCH HANDLER ───
    handleTap(pos, w, h) {
        if (this.currentView === 'main') {
            this._handleMainTap(pos, w, h);
        } else {
            // Bottom "Indietro" bar
            if (this._isBackHit(pos, w, h)) {
                if (this.currentView === 'creature_detail') {
                    this.currentView = 'bestiary';
                    this._bestiaryDetail = null;
                } else {
                    this.currentView = 'main';
                }
                Audio.play('cancel');
                return;
            }
            if (this.currentView === 'save') {
                this._handleSaveTap(pos, w, h);
            }
            if (this.currentView === 'bestiary') {
                this._handleBestiaryTap(pos, w, h);
            }
        }
    },

    _handleMainTap(pos, w, h) {
        const startY = 100;
        const btnH = 80;
        const gap = 14;

        for (let i = 0; i < this.MAIN_ITEMS.length; i++) {
            const by = startY + i * (btnH + gap);
            if (pos.y >= by && pos.y <= by + btnH && pos.x >= 40 && pos.x <= w - 40) {
                const item = this.MAIN_ITEMS[i];
                Audio.play('confirm');

                if (item.view === 'close') {
                    this.close();
                } else if (item.view === 'team') {
                    this.close();
                    TeamBuilder.open();
                    Game.state = 'teambuilder';
                } else if (item.view === 'worldmap') {
                    this.close();
                    Game._openWorldMap();
                } else if (item.view === 'options') {
                    this.close();
                    Debug.toggle();
                } else {
                    this.currentView = item.view;
                    this._scrollOffset = 0;
                }
                return;
            }
        }
    },

    _handleBestiaryTap(pos, w, h) {
        const roster = Creatures.roster;
        const itemH = 90;
        const startY = 65;

        for (let i = 0; i < roster.length; i++) {
            const cy = startY + i * itemH;
            if (cy > h) break;
            if (pos.y >= cy && pos.y <= cy + itemH - 8 && pos.x >= 16 && pos.x <= w - 16) {
                const c = roster[i];
                if (Creatures.isUnlocked(c.id)) {
                    this._bestiaryDetail = c;
                    this.currentView = 'creature_detail';
                    Audio.play('confirm');
                }
                return;
            }
        }
    },

    _handleSaveTap(pos, w, h) {
        for (let i = 0; i < Save.MAX_SLOTS; i++) {
            const sy = 80 + i * 100;
            if (pos.y >= sy && pos.y <= sy + 90 && pos.x >= 30 && pos.x <= w - 30) {
                Save.save(i, this._gameState);
                Audio.play('confirm');
                return;
            }
        }
    },

    // ─── RENDER ───
    render(ctx, w, h) {
        if (!this.active) return;

        switch (this.currentView) {
            case 'main': this._renderMain(ctx, w, h); break;
            case 'bestiary': this._renderBestiary(ctx, w, h); break;
            case 'creature_detail': this._renderCreatureDetail(ctx, w, h); break;
            case 'inventory': this._renderInventory(ctx, w, h); break;
            case 'save': this._renderSave(ctx, w, h); break;
        }
    },

    _renderMain(ctx, w, h) {
        UI.drawPanelBg(ctx, w, h, { dark: true });

        UI.text(ctx, 'Menu', w / 2, 65, {
            color: '#ffcc00', size: 36, bold: true, align: 'center'
        });

        const startY = 100;
        const btnW = w - 80;
        const btnH = 80;
        const gap = 14;

        for (let i = 0; i < this.MAIN_ITEMS.length; i++) {
            const item = this.MAIN_ITEMS[i];
            const by = startY + i * (btnH + gap);

            // Pop-in animation
            const popT = Math.min(1, Math.max(0, (this._animTimer - i * 40) / 250));
            const popScale = UI.easeOutBack(popT);
            if (popScale <= 0) continue;

            ctx.save();
            ctx.translate(w / 2, by + btnH / 2);
            ctx.scale(popScale, popScale);
            ctx.translate(-w / 2, -(by + btnH / 2));

            UI.drawButton(ctx, 40, by, btnW, btnH, item.label, {
                color1: item.color1,
                color2: item.color2,
                fontSize: 22,
                radius: 18
            });

            UI.drawIcon(ctx, 80, by + btnH / 2, item.icon, 18);

            ctx.restore();
        }
    },

    _renderBestiary(ctx, w, h) {
        UI.drawPanelBg(ctx, w, h, { dark: true });
        this._drawBackButton(ctx, w, h);

        UI.text(ctx, 'Bestiario', w / 2, 40, {
            color: '#ff8833', size: 26, bold: true, align: 'center'
        });

        const roster = Creatures.roster;
        const itemH = 90;
        const startY = 65;

        for (let i = 0; i < roster.length && i < 12; i++) {
            const c = roster[i];
            const cy = startY + i * itemH;
            if (cy > h - 20) break;

            const unlocked = Creatures.isUnlocked(c.id);

            ctx.fillStyle = unlocked ? 'rgba(255,255,255,0.05)' : 'rgba(50,50,50,0.2)';
            UI.roundRect(ctx, 16, cy, w - 32, itemH - 8, 12);
            ctx.fill();
            ctx.strokeStyle = unlocked ? c.color + '40' : 'rgba(100,100,100,0.15)';
            ctx.lineWidth = 1;
            UI.roundRect(ctx, 16, cy, w - 32, itemH - 8, 12);
            ctx.stroke();

            if (unlocked) {
                Creatures.drawCreature(ctx, 55, cy + itemH / 2 - 4, c, 22, 'idle', this._animTimer);

                UI.text(ctx, c.creatureName, 90, cy + 22, { color: '#fff', size: 16, bold: true });
                UI.text(ctx, `${c.role}`, 90, cy + 40, { color: c.color, size: 13 });
                UI.text(ctx, `HP:${c.maxHp} ATK:${c.atk} DEF:${c.def}`, 90, cy + 58, { color: '#99a', size: 12 });

                if (c.element) {
                    const el = Creatures.ELEMENTS[c.element];
                    UI.text(ctx, el.name, w - 55, cy + 22, { color: el.color, size: 12, bold: true, align: 'center' });
                }
            } else {
                UI.text(ctx, '???', 55, cy + itemH / 2 + 5, { color: '#444', size: 22, align: 'center' });
                UI.text(ctx, 'Non sbloccato', 90, cy + 35, { color: '#555', size: 14 });
            }
        }
    },

    _renderInventory(ctx, w, h) {
        UI.drawPanelBg(ctx, w, h, { dark: true });
        this._drawBackButton(ctx, w, h);

        UI.text(ctx, 'Inventario', w / 2, 40, {
            color: '#44cc66', size: 26, bold: true, align: 'center'
        });

        const inv = this._gameState ? this._gameState.inventory || [] : [];

        if (inv.length === 0) {
            UI.text(ctx, 'Inventario vuoto', w / 2, h / 2, {
                color: '#556', size: 18, align: 'center'
            });
        } else {
            for (let i = 0; i < inv.length; i++) {
                const iy = 70 + i * 60;
                ctx.fillStyle = 'rgba(255,255,255,0.04)';
                UI.roundRect(ctx, 24, iy, w - 48, 50, 12);
                ctx.fill();

                UI.text(ctx, inv[i].name, 40, iy + 32, { color: '#fff', size: 18 });
                UI.text(ctx, `x${inv[i].qty}`, w - 40, iy + 32, {
                    color: '#ffcc00', size: 18, bold: true, align: 'right'
                });
            }
        }
    },

    _renderSave(ctx, w, h) {
        UI.drawPanelBg(ctx, w, h, { dark: true });
        this._drawBackButton(ctx, w, h);

        UI.text(ctx, 'Salva Partita', w / 2, 45, {
            color: '#4488ff', size: 26, bold: true, align: 'center'
        });

        for (let i = 0; i < Save.MAX_SLOTS; i++) {
            const sy = 80 + i * 100;
            const info = Save.getSlotInfo(i);

            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            UI.roundRect(ctx, 30, sy, w - 60, 90, 14);
            ctx.fill();
            ctx.strokeStyle = 'rgba(100,150,255,0.2)';
            ctx.lineWidth = 1.5;
            UI.roundRect(ctx, 30, sy, w - 60, 90, 14);
            ctx.stroke();

            if (info) {
                UI.text(ctx, `Slot ${i + 1}`, 50, sy + 26, { color: '#fff', size: 18, bold: true });
                UI.text(ctx, info.date, 50, sy + 48, { color: '#aab', size: 14 });
                UI.text(ctx, `Ep. ${info.episode} | ${info.playTime}`, 50, sy + 70, { color: '#889', size: 13 });
            } else {
                UI.text(ctx, `Slot ${i + 1} — Vuoto`, 50, sy + 48, { color: '#556', size: 18 });
            }

            // Save button
            ctx.fillStyle = '#4488ff';
            UI.roundRect(ctx, w - 140, sy + 25, 90, 40, 10);
            ctx.fill();
            UI.text(ctx, 'Salva', w - 95, sy + 52, {
                color: '#fff', size: 16, bold: true, align: 'center'
            });
        }

        UI.text(ctx, 'Tocca "Salva" per salvare', w / 2, h - 40, {
            color: '#556', size: 13, align: 'center'
        });
    },

    // ─── CREATURE DETAIL (Ni no Kuni style) ───
    _renderCreatureDetail(ctx, w, h) {
        const c = this._bestiaryDetail;
        if (!c) { this.currentView = 'bestiary'; return; }

        const level = Creatures.getLevel(c.id);
        const stats = Creatures.getStatsForLevel(c, level);

        // Background gradient based on element
        const elColor = c.element ? Creatures.ELEMENTS[c.element].color : '#4488ff';
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#0a0a20');
        bgGrad.addColorStop(0.3, elColor + '22');
        bgGrad.addColorStop(0.7, '#0a0a20');
        bgGrad.addColorStop(1, '#0a0a1a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Decorative glow
        ctx.fillStyle = elColor;
        ctx.globalAlpha = 0.06;
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.3, 150, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Back button
        this._drawBackButton(ctx, w, h);

        // Creature name (big)
        UI.text(ctx, c.creatureName, w / 2, 55, {
            color: '#fff', size: 32, bold: true, align: 'center'
        });

        // Zodiac + Role
        UI.text(ctx, `${c.zodiac} — ${c.role}`, w / 2, 85, {
            color: elColor, size: 16, align: 'center'
        });

        // Element badge
        if (c.element) {
            const el = Creatures.ELEMENTS[c.element];
            ctx.fillStyle = el.color;
            ctx.globalAlpha = 0.8;
            UI.roundRect(ctx, w / 2 - 45, 95, 90, 28, 10);
            ctx.fill();
            ctx.globalAlpha = 1;
            UI.text(ctx, el.name, w / 2, 115, {
                color: '#fff', size: 14, bold: true, align: 'center'
            });
        }

        // BIG creature sprite (centered)
        Creatures.drawCreature(ctx, w / 2, h * 0.32, c, 80, 'idle', this._animTimer);

        // Level
        UI.text(ctx, `Lv. ${level}`, w / 2, h * 0.48, {
            color: '#ffcc00', size: 24, bold: true, align: 'center'
        });

        // XP bar
        const xp = Creatures.getXP(c.id);
        const xpNext = Creatures.getXPForNextLevel(level);
        const xpRatio = xpNext === Infinity ? 1 : xp / xpNext;
        UI.drawHPBar(ctx, w * 0.15, h * 0.5, w * 0.7, 14, xpRatio, { borderColor: '#446' });
        UI.text(ctx, `XP: ${xp} / ${xpNext === Infinity ? 'MAX' : xpNext}`, w / 2, h * 0.5 + 30, {
            color: '#889', size: 13, align: 'center'
        });

        // Stats panel
        const panelY = h * 0.56;
        const panelH = h * 0.3;
        ctx.fillStyle = 'rgba(20,20,50,0.6)';
        UI.roundRect(ctx, 30, panelY, w - 60, panelH, 16);
        ctx.fill();
        ctx.strokeStyle = elColor + '40';
        ctx.lineWidth = 1.5;
        UI.roundRect(ctx, 30, panelY, w - 60, panelH, 16);
        ctx.stroke();

        // Stat bars
        const statX = 50;
        const statBarW = w - 160;
        const statNames = ['HP', 'ATK', 'DEF', 'CRIT', 'EVA'];
        const statValues = [stats.maxHp, stats.atk, stats.def,
            Math.round(stats.critChance * 100), Math.round(stats.evasionChance * 100)];
        const statMaxes = [200, 50, 20, 50, 40];
        const statColors = ['#44cc66', '#ff6655', '#4488ff', '#ffcc00', '#aa66ff'];

        for (let i = 0; i < statNames.length; i++) {
            const sy = panelY + 25 + i * (panelH - 40) / 5;

            UI.text(ctx, statNames[i], statX, sy + 4, {
                color: '#aab', size: 14, bold: true
            });

            // Stat bar
            const ratio = Math.min(1, statValues[i] / statMaxes[i]);
            const barY = sy - 6;
            ctx.fillStyle = '#1a1a3a';
            UI.roundRect(ctx, statX + 60, barY, statBarW, 16, 6);
            ctx.fill();

            const barGrad = ctx.createLinearGradient(statX + 60, barY, statX + 60 + statBarW * ratio, barY);
            barGrad.addColorStop(0, statColors[i]);
            barGrad.addColorStop(1, statColors[i] + '88');
            ctx.fillStyle = barGrad;
            UI.roundRect(ctx, statX + 60, barY, statBarW * ratio, 16, 6);
            ctx.fill();

            // Value text
            UI.text(ctx, `${statValues[i]}${i >= 3 ? '%' : ''}`, w - 55, sy + 4, {
                color: '#fff', size: 14, bold: true, align: 'right'
            });
        }

        // Description
        UI.text(ctx, c.description, w / 2, h * 0.9, {
            color: '#889', size: 14, align: 'center'
        });

        // Hint
        UI.text(ctx, 'Tocca per tornare', w / 2, h - 30, {
            color: '#556', size: 12, align: 'center'
        });
    },

    // Bottom back bar. Tap area checked in handleTap via _isBackHit().
    BACK_BAR_H: 68,

    _drawBackButton(ctx, w, h) {
        const bh = this.BACK_BAR_H;
        const by = h - bh;
        const btnW = Math.min(260, w - 40);
        const bx = (w - btnW) / 2;
        // Bar background
        ctx.fillStyle = 'rgba(10,10,30,0.9)';
        ctx.fillRect(0, by, w, bh);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, by, w, 1);
        // Button
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
