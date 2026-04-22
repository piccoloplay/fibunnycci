// All 12 Zodiac Creatures
// Elements: Fuoco, Acqua, Terra, Legno, Metallo (Feng Shui cycle)
// XP/Level system + Capture system
const Creatures = {
    // ─── LEVEL SYSTEM ───
    MAX_LEVEL: 20,
    XP_PER_LEVEL: [0, 30, 70, 130, 210, 320, 460, 640, 870, 1150, 1500, 1920, 2420, 3000, 3680, 4460, 5360, 6380, 7540, 8850],

    // Stat growth per level (% of base stat added per level)
    GROWTH_PER_LEVEL: 0.06, // +6% per level → level 20 = +120% stats

    // ─── CAPTURE SYSTEM ───
    BASE_CAPTURE_RATE: 0.25, // 25% base chance after winning
    BOSS_CAPTURE_RATE: 1.0,  // 100% from bosses

    // Player's collection: { creatureId: { unlocked, level, xp, nickname } }
    // Stored in gameState.collection
    collection: {},

    initCollection() {
        // Start with Coniglio unlocked at level 1
        this.collection = {
            coniglio: { unlocked: true, level: 1, xp: 0 },
            cavallo: { unlocked: true, level: 1, xp: 0 },
            bue: { unlocked: true, level: 1, xp: 0 }
        };
    },

    isUnlocked(id) {
        return this.collection[id] && this.collection[id].unlocked;
    },

    getLevel(id) {
        return (this.collection[id] && this.collection[id].level) || 1;
    },

    getXP(id) {
        return (this.collection[id] && this.collection[id].xp) || 0;
    },

    getXPForNextLevel(level) {
        if (level >= this.MAX_LEVEL) return Infinity;
        return this.XP_PER_LEVEL[level] || (level * level * 50);
    },

    // Add XP to a creature, returns { leveledUp, newLevel }
    addXP(id, amount) {
        if (!this.collection[id]) {
            this.collection[id] = { unlocked: true, level: 1, xp: 0 };
        }
        const c = this.collection[id];
        if (c.level >= this.MAX_LEVEL) return { leveledUp: false, newLevel: c.level };

        c.xp += amount;
        let leveledUp = false;
        while (c.xp >= this.getXPForNextLevel(c.level) && c.level < this.MAX_LEVEL) {
            c.xp -= this.getXPForNextLevel(c.level);
            c.level++;
            leveledUp = true;
        }
        return { leveledUp, newLevel: c.level };
    },

    // Get creature stats adjusted for level
    getStatsForLevel(baseCreature, level) {
        const mult = 1 + (level - 1) * this.GROWTH_PER_LEVEL;
        return {
            ...baseCreature,
            level: level,
            maxHp: Math.round(baseCreature.maxHp * mult),
            atk: Math.round(baseCreature.atk * mult),
            def: Math.round(baseCreature.def * mult),
            // Crit and evasion grow slower
            critChance: Math.min(0.5, baseCreature.critChance + (level - 1) * 0.005),
            evasionChance: Math.min(0.4, baseCreature.evasionChance + (level - 1) * 0.003)
        };
    },

    // Try to capture a creature after winning. Returns true if captured.
    tryCapture(creatureId, isBoss) {
        if (this.isUnlocked(creatureId)) return false; // Already have it

        const rate = isBoss ? this.BOSS_CAPTURE_RATE : this.BASE_CAPTURE_RATE;
        const roll = Math.random();
        if (roll < rate) {
            this.collection[creatureId] = { unlocked: true, level: 1, xp: 0 };
            return true;
        }
        return false;
    },

    // Get unlocked creature IDs
    getUnlockedIds() {
        return Object.keys(this.collection).filter(id => this.collection[id].unlocked);
    },
    ELEMENTS: {
        fuoco:   { name: 'Fuoco',   icon: '🔥', color: '#ff4422', strong: 'metallo', weak: 'acqua' },
        acqua:   { name: 'Acqua',   icon: '💧', color: '#3388ff', strong: 'fuoco',   weak: 'terra' },
        terra:   { name: 'Terra',   icon: '🪨', color: '#aa8844', strong: 'acqua',   weak: 'legno' },
        legno:   { name: 'Legno',   icon: '🌿', color: '#44aa44', strong: 'terra',   weak: 'metallo' },
        metallo: { name: 'Metallo', icon: '⚔️', color: '#aaaacc', strong: 'legno',   weak: 'fuoco' }
    },

    roster: [
        {
            id: 'topo', creatureName: 'Topo', zodiac: 'Topo', role: 'Velocista',
            element: 'acqua',
            description: 'Agile e sfuggente. Colpisce dove non te lo aspetti.',
            maxHp: 75, atk: 28, def: 5, critChance: 0.22, evasionChance: 0.20,
            color: '#8899aa', accent: '#bbccdd'
        },
        {
            id: 'bue', creatureName: 'Bue', zodiac: 'Bue', role: 'Tank',
            element: 'terra',
            description: 'Resistente come una montagna. Niente lo abbatte.',
            maxHp: 130, atk: 26, def: 12, critChance: 0.08, evasionChance: 0.02,
            color: '#887766', accent: '#aa9988'
        },
        {
            id: 'tigre', creatureName: 'Tigre', zodiac: 'Tigre', role: 'DPS',
            element: 'legno',
            description: 'Potenza pura. Ogni colpo puo\' essere fatale.',
            maxHp: 85, atk: 38, def: 5, critChance: 0.30, evasionChance: 0.05,
            color: '#e09030', accent: '#ffb050'
        },
        {
            id: 'coniglio', creatureName: 'Coniglio', zodiac: 'Coniglio', role: 'Bilanciato',
            element: 'legno',
            description: 'Il simbolo di FiBunnyCci. Equilibrio perfetto.',
            maxHp: 100, atk: 32, def: 8, critChance: 0.15, evasionChance: 0.12,
            color: '#e8a0b0', accent: '#ffc0d0'
        },
        {
            id: 'drago', creatureName: 'Drago', zodiac: 'Drago', role: 'Potenza',
            element: 'fuoco',
            description: 'Leggendario. Stats superiori ma prevedibile.',
            maxHp: 110, atk: 36, def: 9, critChance: 0.15, evasionChance: 0.03,
            color: '#33aa66', accent: '#55cc88'
        },
        {
            id: 'serpente', creatureName: 'Serpente', zodiac: 'Serpente', role: 'Critico',
            element: 'fuoco',
            description: 'Silenzioso e letale. I critici sono la sua arma.',
            maxHp: 75, atk: 35, def: 4, critChance: 0.35, evasionChance: 0.10,
            color: '#6a4a8a', accent: '#8a6aaa'
        },
        {
            id: 'cavallo', creatureName: 'Cavallo', zodiac: 'Cavallo', role: 'Attaccante',
            element: 'fuoco',
            description: 'Veloce e potente. Travolge tutto sul suo cammino.',
            maxHp: 90, atk: 34, def: 6, critChance: 0.18, evasionChance: 0.10,
            color: '#8b5e3c', accent: '#a07050'
        },
        {
            id: 'capra', creatureName: 'Capra', zodiac: 'Capra', role: 'Supporto',
            element: 'terra',
            description: 'Resistente e imprevedibile. Non sottovalutarla.',
            maxHp: 105, atk: 28, def: 10, critChance: 0.12, evasionChance: 0.12,
            color: '#c0b090', accent: '#e0d0b0'
        },
        {
            id: 'scimmia', creatureName: 'Scimmia', zodiac: 'Scimmia', role: 'Trickster',
            element: 'metallo',
            description: 'Imprevedibile e furba. Schiva tutto e colpisce di crit.',
            maxHp: 80, atk: 30, def: 5, critChance: 0.25, evasionChance: 0.22,
            color: '#c08040', accent: '#e0a060'
        },
        {
            id: 'gallo', creatureName: 'Gallo', zodiac: 'Gallo', role: 'Difensore',
            element: 'metallo',
            description: 'Fiero e corazzato. Assorbe i colpi senza batter ciglio.',
            maxHp: 100, atk: 27, def: 11, critChance: 0.12, evasionChance: 0.06,
            color: '#cc9933', accent: '#eebb55'
        },
        {
            id: 'cane', creatureName: 'Cane', zodiac: 'Cane', role: 'Bilanciato',
            element: 'terra',
            description: 'Leale e affidabile. Nessun punto debole evidente.',
            maxHp: 100, atk: 31, def: 8, critChance: 0.15, evasionChance: 0.08,
            color: '#b08060', accent: '#d0a080'
        },
        {
            id: 'maiale', creatureName: 'Maiale', zodiac: 'Maiale', role: 'Resistente',
            element: 'acqua',
            description: 'Enorme riserva di HP. Vince per sfinimento.',
            maxHp: 140, atk: 24, def: 10, critChance: 0.08, evasionChance: 0.03,
            color: '#e0a0a0', accent: '#ffc0c0'
        }
    ],

    getById(id) {
        return this.roster.find(c => c.id === id);
    },

    getTeamCopy(ids) {
        return ids.map(id => {
            const base = this.getById(id);
            if (!base) return null;
            const level = this.getLevel(id);
            const scaled = this.getStatsForLevel(base, level);
            return { ...scaled, currentHp: scaled.maxHp };
        }).filter(c => c !== null);
    },

    // ─── MAIN DRAW ───
    drawCreature(ctx, x, y, creature, size, anim, animTimer) {
        const s = size || 30;
        const bob = anim === 'idle' ? Math.sin((animTimer || 0) * 0.003) * 2 : 0;

        ctx.save();
        ctx.translate(x, y + bob);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, s + 2, s * 0.6, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw animal-specific body
        switch (creature.id) {
            case 'topo': this._drawTopo(ctx, s, creature); break;
            case 'bue': this._drawBue(ctx, s, creature); break;
            case 'tigre': this._drawTigre(ctx, s, creature); break;
            case 'coniglio': this._drawConiglio(ctx, s, creature); break;
            case 'drago': this._drawDrago(ctx, s, creature); break;
            case 'serpente': this._drawSerpente(ctx, s, creature); break;
            case 'cavallo': this._drawCavallo(ctx, s, creature); break;
            case 'capra': this._drawCapra(ctx, s, creature); break;
            case 'scimmia': this._drawScimmia(ctx, s, creature); break;
            case 'gallo': this._drawGallo(ctx, s, creature); break;
            case 'cane': this._drawCane(ctx, s, creature); break;
            case 'maiale': this._drawMaiale(ctx, s, creature); break;
            default: this._drawDefault(ctx, s, creature); break;
        }

        // Element badge
        if (creature.element) {
            const el = this.ELEMENTS[creature.element];
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.arc(s * 0.55, -s * 0.6, s * 0.22, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = `${s * 0.25}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText(el.icon, s * 0.55, -s * 0.52);
            ctx.textAlign = 'left';
        }

        ctx.restore();
    },

    // ─── TOPO (Mouse) ───
    _drawTopo(ctx, s, c) {
        // Big round ears
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.55, s * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.35, -s * 0.55, s * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ddb0b0';
        ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.55, s * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.35, -s * 0.55, s * 0.18, 0, Math.PI * 2); ctx.fill();
        // Small round body
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.45, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
        // Tail - long and thin
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s * 0.3, s * 0.35);
        ctx.quadraticCurveTo(s * 0.8, s * 0.5, s * 0.7, 0); ctx.stroke();
        // Face
        this._kawaiiEyes(ctx, s, 0.35, -0.12);
        // Nose - pink dot
        ctx.fillStyle = '#ffaaaa';
        ctx.beginPath(); ctx.arc(0, s * 0.08, s * 0.06, 0, Math.PI * 2); ctx.fill();
        // Whiskers
        ctx.strokeStyle = '#888'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.08); ctx.lineTo(-s * 0.5, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.12); ctx.lineTo(-s * 0.5, s * 0.15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.1, s * 0.08); ctx.lineTo(s * 0.5, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.1, s * 0.12); ctx.lineTo(s * 0.5, s * 0.15); ctx.stroke();
        // Feet
        this._drawFeet(ctx, s, c.color);
    },

    // ─── BUE (Ox) ───
    _drawBue(ctx, s, c) {
        // Horns
        ctx.strokeStyle = '#ccaa66'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-s * 0.25, -s * 0.4); ctx.quadraticCurveTo(-s * 0.55, -s * 0.9, -s * 0.3, -s * 0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.25, -s * 0.4); ctx.quadraticCurveTo(s * 0.55, -s * 0.9, s * 0.3, -s * 0.8); ctx.stroke();
        // Large boxy body
        ctx.fillStyle = c.color;
        this._roundRect(ctx, -s * 0.55, -s * 0.4, s * 1.1, s * 1.2, s * 0.2);
        ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
        // Belly
        ctx.fillStyle = c.accent; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.ellipse(0, s * 0.2, s * 0.35, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // Snout
        ctx.fillStyle = '#ccbb99';
        ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 0.22, s * 0.15, 0, 0, Math.PI * 2); ctx.fill();
        // Nostrils
        ctx.fillStyle = '#887766';
        ctx.beginPath(); ctx.arc(-s * 0.07, s * 0.16, s * 0.04, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.07, s * 0.16, s * 0.04, 0, Math.PI * 2); ctx.fill();
        // Eyes - stern
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.08, s * 0.07, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.18, -s * 0.08, s * 0.07, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.1, s * 0.025, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.16, -s * 0.1, s * 0.025, 0, Math.PI * 2); ctx.fill();
        // Hooves
        ctx.fillStyle = '#554433';
        ctx.fillRect(-s * 0.35, s * 0.65, s * 0.2, s * 0.15);
        ctx.fillRect(s * 0.15, s * 0.65, s * 0.2, s * 0.15);
    },

    // ─── TIGRE (Tiger) ───
    _drawTigre(ctx, s, c) {
        // Ears
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.45); ctx.lineTo(-s * 0.38, -s * 0.85); ctx.lineTo(-s * 0.45, -s * 0.35); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(s * 0.15, -s * 0.45); ctx.lineTo(s * 0.38, -s * 0.85); ctx.lineTo(s * 0.45, -s * 0.35); ctx.closePath(); ctx.fill();
        // Body
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.55, s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
        // Stripes!
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.4); ctx.lineTo(-s * 0.05, -s * 0.15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -s * 0.45); ctx.lineTo(0, -s * 0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.15, -s * 0.4); ctx.lineTo(s * 0.05, -s * 0.15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s * 0.4, s * 0.1); ctx.lineTo(-s * 0.2, s * 0.15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.4, s * 0.1); ctx.lineTo(s * 0.2, s * 0.15); ctx.stroke();
        // White belly
        ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 0.3, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // Face
        this._kawaiiEyes(ctx, s, 0.4, -0.05);
        // Nose
        ctx.fillStyle = '#cc6644';
        ctx.beginPath(); ctx.moveTo(0, s * 0.05); ctx.lineTo(-s * 0.05, s * 0.12); ctx.lineTo(s * 0.05, s * 0.12); ctx.closePath(); ctx.fill();
        // Mouth
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, s * 0.12); ctx.lineTo(-s * 0.08, s * 0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, s * 0.12); ctx.lineTo(s * 0.08, s * 0.2); ctx.stroke();
        // Tail
        ctx.strokeStyle = c.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(s * 0.4, s * 0.2);
        ctx.quadraticCurveTo(s * 0.8, 0, s * 0.65, -s * 0.3); ctx.stroke();
        this._drawFeet(ctx, s, c.color);
    },

    // ─── CONIGLIO (Rabbit/Bunny - the protagonist!) ───
    _drawConiglio(ctx, s, c) {
        // Long ears
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.9, s * 0.12, s * 0.4, -0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.18, -s * 0.95, s * 0.12, s * 0.42, 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffaaaa';
        ctx.beginPath(); ctx.ellipse(-s * 0.15, -s * 0.9, s * 0.06, s * 0.28, -0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.18, -s * 0.95, s * 0.06, s * 0.28, 0.15, 0, Math.PI * 2); ctx.fill();
        // Round body
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
        // White belly
        ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.3, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // Big kawaii eyes
        this._kawaiiEyes(ctx, s, 0.4, -0.08);
        // Nose + mouth
        ctx.fillStyle = '#ff8888';
        ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.05, s * 0.035, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, s * 0.13); ctx.lineTo(-s * 0.06, s * 0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, s * 0.13); ctx.lineTo(s * 0.06, s * 0.2); ctx.stroke();
        // Cheeks
        ctx.fillStyle = 'rgba(255,100,100,0.2)';
        ctx.beginPath(); ctx.ellipse(-s * 0.35, s * 0.08, s * 0.1, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.35, s * 0.08, s * 0.1, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        // Tail puff
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s * 0.35, s * 0.35, s * 0.12, 0, Math.PI * 2); ctx.fill();
        this._drawFeet(ctx, s, c.color);
    },

    // ─── DRAGO (Dragon) ───
    _drawDrago(ctx, s, c) {
        // Wings
        ctx.fillStyle = c.accent; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.1);
        ctx.lineTo(-s * 0.9, -s * 0.5); ctx.lineTo(-s * 0.7, -s * 0.1);
        ctx.lineTo(-s * 0.85, s * 0.1); ctx.lineTo(-s * 0.4, s * 0.1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 0.1);
        ctx.lineTo(s * 0.9, -s * 0.5); ctx.lineTo(s * 0.7, -s * 0.1);
        ctx.lineTo(s * 0.85, s * 0.1); ctx.lineTo(s * 0.4, s * 0.1); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        // Horns
        ctx.fillStyle = '#ddaa33';
        ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.45); ctx.lineTo(-s * 0.3, -s * 0.9); ctx.lineTo(-s * 0.1, -s * 0.5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.45); ctx.lineTo(s * 0.3, -s * 0.9); ctx.lineTo(s * 0.1, -s * 0.5); ctx.closePath(); ctx.fill();
        // Body
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#225533'; ctx.lineWidth = 1; ctx.stroke();
        // Scales pattern
        ctx.fillStyle = c.accent; ctx.globalAlpha = 0.3;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(s * (-0.15 + i * 0.15), s * (0.1 + i * 0.08), s * 0.08, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Fierce eyes
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.12, s * 0.1, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.18, -s * 0.12, s * 0.1, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.12, s * 0.04, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.18, -s * 0.12, s * 0.04, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        // Snout
        ctx.fillStyle = c.accent;
        ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.15, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(-s * 0.05, s * 0.1, s * 0.025, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.05, s * 0.1, s * 0.025, 0, Math.PI * 2); ctx.fill();
        // Tail
        ctx.strokeStyle = c.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, s * 0.5);
        ctx.quadraticCurveTo(s * 0.6, s * 0.8, s * 0.8, s * 0.3); ctx.stroke();
        this._drawFeet(ctx, s, c.color);
    },

    // ─── SERPENTE (Snake) ───
    _drawSerpente(ctx, s, c) {
        // Coiled body
        ctx.strokeStyle = c.color; ctx.lineWidth = s * 0.25; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s * 0.4, s * 0.6);
        ctx.quadraticCurveTo(s * 0.7, s * 0.2, s * 0.3, 0);
        ctx.quadraticCurveTo(-s * 0.3, -s * 0.2, -s * 0.2, s * 0.2);
        ctx.quadraticCurveTo(-s * 0.1, s * 0.5, s * 0.2, s * 0.4);
        ctx.stroke();
        // Head
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(s * 0.4, s * 0.55, s * 0.2, s * 0.15, 0.3, 0, Math.PI * 2); ctx.fill();
        // Hood
        ctx.fillStyle = c.accent; ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(s * 0.25, s * 0.4);
        ctx.quadraticCurveTo(s * 0.15, s * 0.2, s * 0.3, s * 0.3);
        ctx.quadraticCurveTo(s * 0.6, s * 0.2, s * 0.55, s * 0.4);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        // Eyes - slit pupils
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.arc(s * 0.33, s * 0.5, s * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.47, s * 0.5, s * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(s * 0.33, s * 0.5, s * 0.02, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.47, s * 0.5, s * 0.02, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        // Tongue
        ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s * 0.55, s * 0.58);
        ctx.lineTo(s * 0.7, s * 0.55); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.55, s * 0.58);
        ctx.lineTo(s * 0.7, s * 0.62); ctx.stroke();
        // Pattern dots
        ctx.fillStyle = c.accent; ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(s * 0.1, s * 0.15, s * 0.04, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-s * 0.15, s * 0.3, s * 0.04, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    },

    // ─── CAVALLO (Horse) ───
    _drawCavallo(ctx, s, c) {
        // Ears
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.5); ctx.lineTo(-s * 0.2, -s * 0.85); ctx.lineTo(-s * 0.3, -s * 0.45); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.5); ctx.lineTo(s * 0.2, -s * 0.85); ctx.lineTo(s * 0.3, -s * 0.45); ctx.closePath(); ctx.fill();
        // Mane
        ctx.fillStyle = '#443322';
        ctx.beginPath(); ctx.moveTo(0, -s * 0.6);
        ctx.quadraticCurveTo(s * 0.15, -s * 0.3, s * 0.1, s * 0.1);
        ctx.lineTo(-s * 0.05, s * 0.1);
        ctx.quadraticCurveTo(-s * 0.1, -s * 0.3, 0, -s * 0.6);
        ctx.closePath(); ctx.fill();
        // Body - elongated
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.45, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
        // Long face
        ctx.fillStyle = c.accent;
        ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 0.18, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        // Eyes
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.ellipse(-s * 0.18, -s * 0.1, s * 0.06, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.18, -s * 0.1, s * 0.06, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.12, s * 0.025, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.16, -s * 0.12, s * 0.025, 0, Math.PI * 2); ctx.fill();
        // Nostrils
        ctx.fillStyle = '#887766';
        ctx.beginPath(); ctx.arc(-s * 0.06, s * 0.22, s * 0.03, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.06, s * 0.22, s * 0.03, 0, Math.PI * 2); ctx.fill();
        // Tail
        ctx.strokeStyle = '#443322'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.3);
        ctx.quadraticCurveTo(-s * 0.7, s * 0.6, -s * 0.5, s * 0.8); ctx.stroke();
        // Hooves
        ctx.fillStyle = '#333';
        ctx.fillRect(-s * 0.3, s * 0.5, s * 0.15, s * 0.12);
        ctx.fillRect(s * 0.15, s * 0.5, s * 0.15, s * 0.12);
    },

    // ─── CAPRA (Goat) ───
    _drawCapra(ctx, s, c) {
        // Curled horns
        ctx.strokeStyle = '#aa9955'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.55, s * 0.2, -0.5, Math.PI + 0.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.55, s * 0.2, -Math.PI + 0.5, 0.5); ctx.stroke();
        // Body
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
        // Beard
        ctx.fillStyle = c.accent;
        ctx.beginPath(); ctx.moveTo(-s * 0.05, s * 0.25);
        ctx.lineTo(0, s * 0.55); ctx.lineTo(s * 0.05, s * 0.25); ctx.closePath(); ctx.fill();
        // Face
        this._kawaiiEyes(ctx, s, 0.35, -0.08);
        // Nose
        ctx.fillStyle = '#aa8877';
        ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.06, s * 0.04, 0, 0, Math.PI * 2); ctx.fill();
        // Ears - floppy
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(-s * 0.4, -s * 0.2, s * 0.15, s * 0.08, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.4, -s * 0.2, s * 0.15, s * 0.08, 0.5, 0, Math.PI * 2); ctx.fill();
        this._drawFeet(ctx, s, '#554433');
    },

    // ─── SCIMMIA (Monkey) ───
    _drawScimmia(ctx, s, c) {
        // Big ears on sides
        ctx.fillStyle = '#ddb090';
        ctx.beginPath(); ctx.arc(-s * 0.5, -s * 0.1, s * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.5, -s * 0.1, s * 0.2, 0, Math.PI * 2); ctx.fill();
        // Body
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.45, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
        // Face circle (lighter)
        ctx.fillStyle = '#eeccaa';
        ctx.beginPath(); ctx.ellipse(0, s * 0.02, s * 0.3, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();
        // Eyes - mischievous
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.ellipse(-s * 0.12, -s * 0.08, s * 0.06, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.12, -s * 0.08, s * 0.06, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-s * 0.14, -s * 0.1, s * 0.025, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.1, -s * 0.1, s * 0.025, 0, Math.PI * 2); ctx.fill();
        // Mouth - grin
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, s * 0.08, s * 0.12, 0, Math.PI); ctx.stroke();
        // Curled tail
        ctx.strokeStyle = c.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(s * 0.3, s * 0.3);
        ctx.quadraticCurveTo(s * 0.7, s * 0.1, s * 0.6, -s * 0.2);
        ctx.quadraticCurveTo(s * 0.5, -s * 0.35, s * 0.55, -s * 0.15); ctx.stroke();
        this._drawFeet(ctx, s, c.color);
    },

    // ─── GALLO (Rooster) ───
    _drawGallo(ctx, s, c) {
        // Comb on top
        ctx.fillStyle = '#dd2222';
        ctx.beginPath(); ctx.arc(-s * 0.12, -s * 0.6, s * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -s * 0.7, s * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.12, -s * 0.6, s * 0.1, 0, Math.PI * 2); ctx.fill();
        // Body
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.45, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
        // Chest feather colors
        ctx.fillStyle = '#dd6633'; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 0.3, s * 0.25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // Tail feathers
        ctx.strokeStyle = '#226644'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-s * 0.2, s * 0.2); ctx.quadraticCurveTo(-s * 0.7, -s * 0.2, -s * 0.6, -s * 0.6); ctx.stroke();
        ctx.strokeStyle = '#2244aa';
        ctx.beginPath(); ctx.moveTo(-s * 0.15, s * 0.25); ctx.quadraticCurveTo(-s * 0.6, -s * 0.1, -s * 0.45, -s * 0.55); ctx.stroke();
        // Beak
        ctx.fillStyle = '#ffaa33';
        ctx.beginPath(); ctx.moveTo(s * 0.1, s * 0.02); ctx.lineTo(s * 0.3, s * 0.08); ctx.lineTo(s * 0.1, s * 0.14); ctx.closePath(); ctx.fill();
        // Wattle
        ctx.fillStyle = '#dd2222';
        ctx.beginPath(); ctx.ellipse(s * 0.08, s * 0.2, s * 0.06, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        // Eyes
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(-s * 0.12, -s * 0.08, s * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.08, -s * 0.08, s * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-s * 0.14, -s * 0.1, s * 0.025, 0, Math.PI * 2); ctx.fill();
        // Legs - thin
        ctx.strokeStyle = '#cc8833'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-s * 0.15, s * 0.5); ctx.lineTo(-s * 0.2, s * 0.75); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.15, s * 0.5); ctx.lineTo(s * 0.2, s * 0.75); ctx.stroke();
    },

    // ─── CANE (Dog) ───
    _drawCane(ctx, s, c) {
        // Floppy ears
        ctx.fillStyle = c.accent;
        ctx.beginPath(); ctx.ellipse(-s * 0.4, -s * 0.15, s * 0.12, s * 0.25, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.4, -s * 0.15, s * 0.12, s * 0.25, 0.3, 0, Math.PI * 2); ctx.fill();
        // Body
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.48, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
        // Snout
        ctx.fillStyle = c.accent;
        ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.2, s * 0.15, 0, 0, Math.PI * 2); ctx.fill();
        // Eyes - friendly
        this._kawaiiEyes(ctx, s, 0.35, -0.1);
        // Nose
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.ellipse(0, s * 0.06, s * 0.07, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        // Tongue
        ctx.fillStyle = '#ff6666';
        ctx.beginPath(); ctx.ellipse(s * 0.05, s * 0.22, s * 0.06, s * 0.08, 0.2, 0, Math.PI * 2); ctx.fill();
        // Tail wagging
        ctx.strokeStyle = c.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(s * 0.35, s * 0.2);
        ctx.quadraticCurveTo(s * 0.7, 0, s * 0.55, -s * 0.3); ctx.stroke();
        this._drawFeet(ctx, s, c.color);
    },

    // ─── MAIALE (Pig) ───
    _drawMaiale(ctx, s, c) {
        // Extra round body
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
        // Belly
        ctx.fillStyle = c.accent; ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.4, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // Floppy ears
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(-s * 0.3, -s * 0.35, s * 0.18, s * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.3, -s * 0.35, s * 0.18, s * 0.12, 0.5, 0, Math.PI * 2); ctx.fill();
        // Big snout
        ctx.fillStyle = '#ffaaaa';
        ctx.beginPath(); ctx.ellipse(0, s * 0.1, s * 0.18, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#cc8888'; ctx.lineWidth = 1; ctx.stroke();
        // Nostrils
        ctx.fillStyle = '#cc8888';
        ctx.beginPath(); ctx.ellipse(-s * 0.06, s * 0.1, s * 0.04, s * 0.03, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.06, s * 0.1, s * 0.04, s * 0.03, 0, 0, Math.PI * 2); ctx.fill();
        // Eyes - happy
        this._kawaiiEyes(ctx, s, 0.3, -0.1);
        // Curly tail
        ctx.strokeStyle = c.color; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(s * 0.45, s * 0.2, s * 0.12, 0, Math.PI * 1.5); ctx.stroke();
        // Hooves
        ctx.fillStyle = '#aa7777';
        ctx.fillRect(-s * 0.35, s * 0.45, s * 0.18, s * 0.12);
        ctx.fillRect(s * 0.17, s * 0.45, s * 0.18, s * 0.12);
    },

    _drawDefault(ctx, s, c) {
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        this._kawaiiEyes(ctx, s, 0.35, -0.1);
        this._drawFeet(ctx, s, c.color);
    },

    // ─── HELPERS ───
    _kawaiiEyes(ctx, s, spread, yPos) {
        // White
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(-s * spread, s * yPos, s * 0.12, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * spread, s * yPos, s * 0.12, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        // Pupils
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(-s * (spread - 0.03), s * (yPos + 0.02), s * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * (spread + 0.03), s * (yPos + 0.02), s * 0.07, 0, Math.PI * 2); ctx.fill();
        // Shine
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-s * (spread + 0.02), s * (yPos - 0.03), s * 0.03, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(s * (spread - 0.02), s * (yPos - 0.03), s * 0.03, 0, Math.PI * 2); ctx.fill();
    },

    _drawFeet(ctx, s, color) {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(-s * 0.22, s * 0.65, s * 0.15, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(s * 0.22, s * 0.65, s * 0.15, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#444'; ctx.lineWidth = 0.8;
        ctx.stroke();
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
