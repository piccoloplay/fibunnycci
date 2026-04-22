const Save = {
    STORAGE_KEY: 'fibunnycci_save',
    MAX_SLOTS: 3,

    save(slot, gameState) {
        const saves = this._getAllSaves();
        const playerPos = gameState.player
            ? { x: gameState.player.gridX, y: gameState.player.gridY }
            : { x: 14, y: 11 }; // fallback
        saves[slot] = {
            timestamp: Date.now(),
            date: new Date().toLocaleString('it-IT'),
            episode: gameState.currentEpisode,
            playerPos: playerPos,
            mapId: gameState.currentMap,
            party: gameState.party,
            inventory: gameState.inventory,
            flags: gameState.flags,
            playTime: gameState.playTime,
            team: gameState.team,
            unlockedAreas: gameState.unlockedAreas,
            collection: gameState.collection
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saves));
        return true;
    },

    load(slot) {
        const saves = this._getAllSaves();
        return saves[slot] || null;
    },

    getSlotInfo(slot) {
        const data = this.load(slot);
        if (!data) return null;
        return {
            date: data.date,
            episode: data.episode,
            playTime: this._formatTime(data.playTime),
            mapId: data.mapId
        };
    },

    deleteSave(slot) {
        const saves = this._getAllSaves();
        delete saves[slot];
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saves));
    },

    _getAllSaves() {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    },

    _formatTime(ms) {
        if (!ms) return '00:00';
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
};
