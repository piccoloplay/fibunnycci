const NPC = {
    list: [],

    loadFromEpisode(episodeData) {
        this.list = episodeData.npcs.map(data => ({
            id: data.id,
            name: data.name,
            sprite: data.sprite || null,      // new: PNG sprite key (e.g. 'kebabbaro')
            gridX: data.x,
            gridY: data.y,
            direction: data.direction || 'down',
            color: data.color || '#4080c0',
            dialogue: data.dialogue,
            dialogueIndex: 0,
            triggerTris: data.triggerTris || null,
            triggerCombat: data.triggerCombat || null,
            triggerVN: data.triggerVN || null,
            triggerKebabRunner: data.triggerKebabRunner || null
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

        this.list.forEach(npc => {
            const x = npc.gridX * ts - cameraX;
            const y = npc.gridY * ts - cameraY;
            const cx = x + ts / 2;

            // Pixel shadow
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            ctx.beginPath();
            ctx.ellipse(cx, y + ts - 8, ts * 0.25, ts * 0.08, 0, 0, Math.PI * 2);
            ctx.fill();

            // Prefer PNG sprite when available, else fall back to tinted bitmap
            const spriteKey = npc.sprite ? `npc_${npc.sprite}_0` : null;
            const spriteImg = spriteKey && Sprites._cache[spriteKey];
            if (spriteImg) {
                ctx.drawImage(spriteImg, Math.round(x), Math.round(y), ts, ts);
            } else {
                Sprites.drawNpc(ctx, Math.round(x), Math.round(y), ts / 16, npc.color);
            }

            // Name tag above NPC
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.font = 'bold 18px Nunito, sans-serif';
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
