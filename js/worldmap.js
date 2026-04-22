const WorldMap = {
    active: false,
    selectedNode: 0,
    animTimer: 0,
    unlockedAreas: [0, 1], // Start with first 2 areas unlocked

    // Area nodes with positions on the map
    areas: [
        {
            id: 'villaggio',
            name: 'Villaggio Sakura',
            description: 'Un tranquillo villaggio tra i ciliegi. Il viaggio inizia qui.',
            x: 0.5, y: 0.82,
            color: '#e8a0b0',
            icon: '🌸',
            episode: 'ep01',
            boss: 'Kuro il Ribelle',
            connections: [1, 2]
        },
        {
            id: 'foresta',
            name: 'Foresta del Topo',
            description: 'Una foresta oscura piena di creature agili e sfuggenti.',
            x: 0.25, y: 0.62,
            color: '#4a8c3f',
            icon: '🌲',
            episode: 'ep02',
            boss: 'Re Topo Grigio',
            connections: [0, 3]
        },
        {
            id: 'montagna',
            name: 'Monte del Bue',
            description: 'Montagne imponenti dove risiedono creature corazzate.',
            x: 0.75, y: 0.62,
            color: '#887766',
            icon: '⛰️',
            episode: 'ep03',
            boss: 'Generale Bue',
            connections: [0, 3, 4]
        },
        {
            id: 'tempio',
            name: 'Tempio del Drago',
            description: 'Un tempio antico dove i maestri insegnano la via del Kung Fu.',
            x: 0.5, y: 0.42,
            color: '#33aa66',
            icon: '🏯',
            episode: 'ep04',
            boss: 'Maestro Drago Jade',
            connections: [1, 2, 4]
        },
        {
            id: 'citta',
            name: 'Città di Numeropoli',
            description: 'La capitale del Yilon-Verse. Qui si decide tutto.',
            x: 0.5, y: 0.22,
            color: '#a0a0ff',
            icon: '🏙️',
            episode: 'ep05',
            boss: 'Mei la Stratega',
            connections: [2, 3]
        }
    ],

    open() {
        this.active = true;
        this.animTimer = 0;
        // Select first unlocked area
        this.selectedNode = this.unlockedAreas[this.unlockedAreas.length - 1];
    },

    close() {
        this.active = false;
    },

    update(dt) {
        if (!this.active) return null;
        this.animTimer += dt;

        const current = this.areas[this.selectedNode];

        // Navigate between connected unlocked nodes
        if (Input.wasPressed('left') || Input.wasPressed('up')) {
            this._navigatePrev();
        }
        if (Input.wasPressed('right') || Input.wasPressed('down')) {
            this._navigateNext();
        }

        if (Input.wasPressed('confirm')) {
            if (this.unlockedAreas.includes(this.selectedNode)) {
                return { action: 'enter', area: current };
            }
        }

        if (Input.wasPressed('cancel')) {
            return { action: 'back' };
        }

        return null;
    },

    _navigatePrev() {
        const unlocked = [...this.unlockedAreas];
        const idx = unlocked.indexOf(this.selectedNode);
        if (idx > 0) {
            this.selectedNode = unlocked[idx - 1];
        } else if (unlocked.length > 0) {
            this.selectedNode = unlocked[unlocked.length - 1]; // Wrap around
        }
    },

    _navigateNext() {
        const unlocked = [...this.unlockedAreas];
        const idx = unlocked.indexOf(this.selectedNode);
        if (idx < unlocked.length - 1) this.selectedNode = unlocked[idx + 1];
    },

    unlockArea(areaIndex) {
        if (!this.unlockedAreas.includes(areaIndex)) {
            this.unlockedAreas.push(areaIndex);
            this.unlockedAreas.sort((a, b) => a - b);
        }
    },

    render(ctx, w, h) {
        if (!this.active) return;

        // Background
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, w, h);

        // Map background - parchment feel
        ctx.fillStyle = '#12122a';
        ctx.fillRect(20, 50, w - 40, h - 120);
        ctx.strokeStyle = 'rgba(160,160,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 50, w - 40, h - 120);

        // Title
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 14px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MAPPA — YILON-VERSE', w / 2, 35);

        // Draw connections first
        ctx.strokeStyle = 'rgba(160,160,255,0.15)';
        ctx.lineWidth = 2;
        this.areas.forEach((area, i) => {
            area.connections.forEach(connIdx => {
                if (connIdx > i) {
                    const other = this.areas[connIdx];
                    const ax = 20 + area.x * (w - 40);
                    const ay = 50 + area.y * (h - 120);
                    const bx = 20 + other.x * (w - 40);
                    const by = 50 + other.y * (h - 120);

                    const bothUnlocked = this.unlockedAreas.includes(i) && this.unlockedAreas.includes(connIdx);
                    ctx.strokeStyle = bothUnlocked ? 'rgba(160,160,255,0.3)' : 'rgba(100,100,100,0.1)';

                    // Dashed line
                    ctx.setLineDash(bothUnlocked ? [6, 4] : [3, 6]);
                    ctx.beginPath();
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(bx, by);
                    ctx.stroke();
                }
            });
        });
        ctx.setLineDash([]);

        // Draw nodes
        this.areas.forEach((area, i) => {
            const nx = 20 + area.x * (w - 40);
            const ny = 50 + area.y * (h - 120);
            const unlocked = this.unlockedAreas.includes(i);
            const selected = i === this.selectedNode;

            // Node circle
            const radius = selected ? 22 : 18;
            const pulse = selected ? Math.sin(this.animTimer * 0.004) * 3 : 0;

            // Glow
            if (selected) {
                ctx.shadowColor = area.color;
                ctx.shadowBlur = 15;
            }

            ctx.fillStyle = unlocked ? area.color : '#333';
            ctx.beginPath();
            ctx.arc(nx, ny, radius + pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = selected ? '#fff' : (unlocked ? 'rgba(255,255,255,0.3)' : 'rgba(100,100,100,0.2)');
            ctx.lineWidth = selected ? 2 : 1;
            ctx.stroke();

            ctx.shadowBlur = 0;

            // Icon
            ctx.font = `${radius}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText(unlocked ? area.icon : '🔒', nx, ny + radius * 0.35);

            // Area name
            ctx.fillStyle = unlocked ? '#fff' : '#555';
            ctx.font = '16px Nunito, sans-serif';
            ctx.fillText(area.name, nx, ny + radius + 14);
        });

        // Info panel for selected area
        const selected = this.areas[this.selectedNode];
        const unlocked = this.unlockedAreas.includes(this.selectedNode);
        const panelY = h - 62;

        ctx.fillStyle = 'rgba(10,10,30,0.9)';
        ctx.fillRect(15, panelY, w - 30, 52);
        ctx.strokeStyle = 'rgba(160,160,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(15, panelY, w - 30, 52);

        ctx.textAlign = 'center';

        if (unlocked) {
            ctx.fillStyle = selected.color;
            ctx.font = 'bold 20px Nunito, sans-serif';
            ctx.fillText(selected.name, w / 2, panelY + 15);

            ctx.fillStyle = '#aaa';
            ctx.font = '16px Nunito, sans-serif';
            ctx.fillText(selected.description, w / 2, panelY + 28);

            ctx.fillStyle = '#ff8080';
            ctx.font = '16px Nunito, sans-serif';
            ctx.fillText(`Boss: ${selected.boss}`, w / 2, panelY + 40);
        } else {
            ctx.fillStyle = '#555';
            ctx.font = '18px Nunito, sans-serif';
            ctx.fillText('Area bloccata', w / 2, panelY + 22);
            ctx.fillStyle = '#444';
            ctx.font = '16px Nunito, sans-serif';
            ctx.fillText('Sconfiggi il boss dell\'area precedente', w / 2, panelY + 36);
        }

        // Controls hint
        ctx.fillStyle = '#444';
        ctx.font = '16px Nunito, sans-serif';
        ctx.fillText('Frecce: naviga | A: entra | B: indietro', w / 2, h - 5);

        ctx.textAlign = 'left';
    }
};
