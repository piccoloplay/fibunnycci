const NPC = {
    list: [],

    loadFromEpisode(episodeData) {
        this.list = episodeData.npcs.map(data => ({
            id: data.id,
            name: data.name,
            gridX: data.x,
            gridY: data.y,
            direction: data.direction || 'down',
            color: data.color || '#4080c0',
            dialogue: data.dialogue,
            dialogueIndex: 0,
            triggerTris: data.triggerTris || null,
            triggerCombat: data.triggerCombat || null
        }));
    },

    getAt(gridX, gridY) {
        return this.list.find(n => n.gridX === gridX && n.gridY === gridY);
    },

    interact(npc) {
        // Face toward player (8 directions)
        const dx = Player.gridX - npc.gridX;
        const dy = Player.gridY - npc.gridY;
        if (dx !== 0 && dy !== 0) {
            // Diagonal
            const hDir = dx > 0 ? 'right' : 'left';
            const vDir = dy > 0 ? 'down' : 'up';
            npc.direction = vDir + '_' + hDir;
        } else if (Math.abs(dx) > Math.abs(dy)) {
            npc.direction = dx > 0 ? 'right' : 'left';
        } else {
            npc.direction = dy > 0 ? 'down' : 'up';
        }

        const lines = npc.dialogue[npc.dialogueIndex] || npc.dialogue[0];
        return { name: npc.name, lines: lines, color: npc.color, npcId: npc.id };
    },

    advanceDialogue(npc) {
        if (npc.dialogueIndex < npc.dialogue.length - 1) {
            npc.dialogueIndex++;
        }
    },

    render(ctx, cameraX, cameraY) {
        const ts = GameMap.TILE_SIZE * GameMap.SCALE;
        const s = GameMap.SCALE / 2; // Scale factor for HD

        this.list.forEach(npc => {
            const x = npc.gridX * ts - cameraX;
            const y = npc.gridY * ts - cameraY;
            const cx = x + ts / 2;
            const cy = y + ts / 2;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(s, s);

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath();
            ctx.ellipse(0, 14, 12, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Body (round, smooth)
            ctx.fillStyle = npc.color;
            ctx.beginPath();
            ctx.ellipse(0, 3, 10, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Head (round)
            ctx.fillStyle = '#ffd5b5';
            ctx.beginPath();
            ctx.ellipse(0, -8, 9, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.stroke();

            // Hair
            ctx.fillStyle = '#8a7a5a';
            ctx.beginPath();
            ctx.ellipse(0, -12, 9.5, 5, 0, Math.PI, Math.PI * 2);
            ctx.fill();

            // Eyes (smooth circles, direction-aware)
            ctx.fillStyle = '#fff';
            const d = npc.direction;
            const isUp = d === 'up';
            const lookX = d.includes('left') ? -2 : d.includes('right') ? 2 : 0;
            if (!isUp) {
                // Eye whites
                ctx.beginPath(); ctx.arc(-3.5 + lookX, -8, 3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(3.5 + lookX, -8, 3, 0, Math.PI * 2); ctx.fill();
                // Pupils
                ctx.fillStyle = '#333';
                ctx.beginPath(); ctx.arc(-2.5 + lookX, -7.5, 1.8, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(4.5 + lookX, -7.5, 1.8, 0, Math.PI * 2); ctx.fill();
                // Eye shine
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(-3.5 + lookX, -9, 0.8, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(3.5 + lookX, -9, 0.8, 0, Math.PI * 2); ctx.fill();
            }

            // Mouth
            if (!isUp) {
                ctx.fillStyle = '#cc8877';
                ctx.beginPath(); ctx.arc(lookX, -3, 1.5, 0, Math.PI * 2); ctx.fill();
            }

            // Legs (smooth ellipses)
            ctx.fillStyle = '#556';
            ctx.beginPath(); ctx.ellipse(-4, 11, 3, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(4, 11, 3, 4, 0, 0, Math.PI * 2); ctx.fill();

            ctx.restore(); // Undo translate+scale

            // Name tag above NPC (rendered at full resolution, not scaled)
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.font = 'bold 20px Nunito, sans-serif';
            const nameW = ctx.measureText(npc.name).width;
            const nameX = cx - nameW / 2 - 6;
            const nameY = y + 4;
            UI.roundRect(ctx, nameX, nameY, nameW + 12, 18, 8);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(npc.name, cx, nameY + 13);
            ctx.textAlign = 'left';
        });
    }
};
