const TitleScreen = {
    active: true,
    selectedIndex: 0,
    animTimer: 0,
    hasSave: false,
    ITEMS: [],

    init() {
        this.hasSave = Save.load(0) !== null || Save.load(1) !== null || Save.load(2) !== null || Save.load('auto') !== null;
        this.ITEMS = this.hasSave
            ? ['Continua', 'Nuova Partita', 'Opzioni']
            : ['Nuova Partita', 'Opzioni'];
        this.selectedIndex = 0;
    },

    update(dt) {
        if (!this.active) return null;
        this.animTimer += dt;

        if (Input.wasPressed('up')) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            Audio.play('select');
        }
        if (Input.wasPressed('down')) {
            this.selectedIndex = Math.min(this.ITEMS.length - 1, this.selectedIndex + 1);
            Audio.play('select');
        }
        if (Input.wasPressed('confirm')) {
            Audio.play('confirm');
            return this.ITEMS[this.selectedIndex];
        }
        return null;
    },

    render(ctx, w, h) {
        if (!this.active) return;

        // Background gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
        skyGrad.addColorStop(0, '#1a1a4a');
        skyGrad.addColorStop(0.4, '#2a2a6a');
        skyGrad.addColorStop(1, '#0a0a2a');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Stars
        for (let i = 0; i < 50; i++) {
            const sx = (i * 73 + 17) % w;
            const sy = (i * 47 + 31) % (h * 0.65);
            const brightness = 0.2 + 0.5 * Math.sin(this.animTimer * 0.002 + i);
            ctx.fillStyle = `rgba(255,255,255,${brightness})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5 + (i % 3), 0, Math.PI * 2);
            ctx.fill();
        }

        // Golden spiral (subtle)
        ctx.strokeStyle = 'rgba(255,200,100,0.05)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        let angle = 0, radius = 5;
        for (let i = 0; i < 200; i++) {
            angle += 0.08;
            radius += 0.6;
            const px = w / 2 + Math.cos(angle) * radius;
            const py = h * 0.32 + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Title
        const titleBob = Math.sin(this.animTimer * 0.002) * 6;

        ctx.save();
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 30;
        UI.text(ctx, 'FiBunnyCci', w / 2, h * 0.2 + titleBob, {
            color: '#ffcc00', size: 52, bold: true, align: 'center', noShadow: true
        });
        ctx.restore();

        UI.text(ctx, 'J  R  P  G', w / 2, h * 0.2 + 50 + titleBob, {
            color: '#a0b0ff', size: 26, bold: true, align: 'center'
        });

        UI.text(ctx, 'Il Yilon-Verse ti attende', w / 2, h * 0.2 + 85 + titleBob, {
            color: '#8888aa', size: 16, align: 'center'
        });

        // Bunny mascot
        const bunny = Creatures.getById('coniglio');
        if (bunny) {
            Creatures.drawCreature(ctx, w / 2, h * 0.40 + titleBob, bunny, 65, 'idle', this.animTimer);
        }

        // Menu buttons — BIG for mobile
        const menuY = h * 0.58;
        const btnW = w * 0.65;
        const btnH = 72;
        const btnGap = 16;

        const btnColors = [
            { c1: '#4488ff', c2: '#2266cc' },
            { c1: '#44cc66', c2: '#22aa44' },
            { c1: '#8866cc', c2: '#6644aa' }
        ];

        for (let i = 0; i < this.ITEMS.length; i++) {
            const by = menuY + i * (btnH + btnGap);
            const selected = i === this.selectedIndex;
            const btnBob = selected ? Math.sin(this.animTimer * 0.005) * 3 : 0;
            const colors = btnColors[i] || btnColors[0];

            UI.drawButton(ctx, w / 2 - btnW / 2, by + btnBob, btnW, btnH, this.ITEMS[i], {
                color1: colors.c1,
                color2: colors.c2,
                selected: selected,
                fontSize: 24,
                radius: 18
            });
        }

        // Footer
        UI.text(ctx, 'by piccoloplay', w / 2, h - 55, {
            color: '#556', size: 14, align: 'center'
        });
        UI.text(ctx, '1, 1, 2, 3, 5, 8, 13, 21...', w / 2, h - 32, {
            color: '#445', size: 12, align: 'center'
        });
    }
};
