const Combat = {
    active: false,
    phase: 'none',
    // unit_select | tap_to_play | morra_choice | reveal | resolve |
    // between_turns | round_end | match_end

    // Teams
    playerTeam: [],
    cpuTeam: [],

    // Match state
    playerRoundWins: 0,
    cpuRoundWins: 0,
    roundsToWin: 2,

    // Round state
    playerCreature: null,
    cpuCreature: null,
    playerCreatureIndex: -1,
    cpuCreatureIndex: -1,
    currentTurn: 0,
    playerMorraWins: 0,
    cpuMorraWins: 0,
    turnHistory: [], // Winner of each non-draw turn in the current round: 1=player, 2=cpu

    // Turn state
    playerChoice: -1,   // 0=carta, 1=sasso, 2=forbice
    cpuChoice: -1,
    morraWinner: 0,      // 0=draw, 1=player, 2=cpu
    turnDamage: 0,
    turnCrit: false,
    turnEvade: false,
    turnResult: '',      // 'win','lose','crit','evas','draw'
    turnElementMult: 1.0, // last hit element multiplier (1.5 super, 0.67 resist)

    // Per-match special move state (reset in start())
    playerUsedPowerUp: false,
    playerUsedElementSwap: false,
    playerNextAttackBuff: 1.0, // consumed on next successful player attack
    powerUpHpCostPct: 0.15,    // 15% of max HP
    powerUpDamageMult: 1.8,

    // Visual FX timers (ms remaining)
    _powerUpAuraMs: 0,          // orange/yellow concentric pulse while active
    _elementSwapMs: 0,          // swirl + flash on player when element changes
    _elementSwapColor: '#fff',

    // Timers & animation
    phaseTimer: 0,
    animTimer: 0,
    selectIndex: 0,

    // Creature animation state
    playerAnim: 'idle',
    cpuAnim: 'idle',
    playerAnimTimer: 0,
    cpuAnimTimer: 0,

    // Screen effects
    screenShake: 0,
    screenFlash: 0,
    screenFlashColor: '#fff',
    floatingTexts: [], // {text, x, y, color, size, life, maxLife, vy}

    // Camera zoom (applies to combat scene only, not to UI overlays)
    cameraZoom: 1.0,
    cameraZoomTarget: 1.0,
    _phaseZoomTargets: {
        'unit_select': 1.0,
        'tap_to_play': 1.02,
        'action_select': 1.03,
        'element_pick': 1.05,
        'morra_choice': 1.05,
        'countdown': 1.10,
        'reveal': 1.18,
        'resolve': 1.12,
        'between_turns': 1.0,
        'round_end': 0.92,
        'match_end': 1.0
    },

    // Polka-dot transition
    _transition: { active: false, timer: 0, duration: 600, color: '#000', expanding: true, onMid: null },

    // UI positions
    _w: 0,
    _h: 0,
    _stageId: 'villaggio',

    CHOICE_NAMES: ['Carta', 'Sasso', 'Forbice'],
    CHOICE_ICONS: ['📄', '🪨', '✂️'],

    // Stage backgrounds per area
    STAGES: {
        villaggio: {
            name: 'Villaggio Sakura',
            sky: ['#ffa0b0', '#ffccdd', '#ffe8f0'],
            ground: '#8b7355',
            groundAccent: '#a08868',
            details: 'sakura', // cherry blossoms
            horizonColor: '#5a9c4f',
            mountains: '#7a6a5a'
        },
        foresta: {
            name: 'Foresta del Topo',
            sky: ['#1a3322', '#2a5533', '#3a7744'],
            ground: '#3a5a2a',
            groundAccent: '#4a6a3a',
            details: 'trees',
            horizonColor: '#2d5a1e',
            mountains: '#1a3a12'
        },
        montagna: {
            name: 'Monte del Bue',
            sky: ['#4a5a7a', '#8a9aba', '#c0d0e8'],
            ground: '#7a7a6a',
            groundAccent: '#8a8a7a',
            details: 'rocks',
            horizonColor: '#6a6a5a',
            mountains: '#9a9a8a'
        },
        tempio: {
            name: 'Tempio del Drago',
            sky: ['#1a0a0a', '#3a1a1a', '#6a2a2a'],
            ground: '#5a3a2a',
            groundAccent: '#6a4a3a',
            details: 'lanterns',
            horizonColor: '#4a2a1a',
            mountains: '#2a1a0a'
        },
        citta: {
            name: 'Città di Numeropoli',
            sky: ['#1a1a3a', '#2a2a5a', '#4a4a8a'],
            ground: '#555566',
            groundAccent: '#666677',
            details: 'buildings',
            horizonColor: '#3a3a5a',
            mountains: '#2a2a4a'
        }
    },

    // ─── START ───
    start(playerTeam, cpuTeam, canvasW, canvasH, stageId) {
        this.active = true;
        this._w = canvasW;
        this._h = canvasH;
        this._stageId = stageId || 'villaggio';

        // Deep copy teams so we don't mutate originals
        this.playerTeam = playerTeam.map(c => ({...c, currentHp: c.maxHp, usedOneshot: false}));
        this.cpuTeam = cpuTeam.map(c => ({...c, currentHp: c.maxHp, usedOneshot: false}));

        this.playerRoundWins = 0;
        this.cpuRoundWins = 0;
        this.turnHistory = [];

        this.phase = 'unit_select';
        this.selectIndex = -1; // Nothing pre-selected
        this.phaseTimer = 0;
        this.cameraZoom = 1.0;
        this.cameraZoomTarget = 1.0;

        // Reset per-match special moves
        this.playerUsedPowerUp = false;
        this.playerUsedElementSwap = false;
        this.playerNextAttackBuff = 1.0;
        this._powerUpAuraMs = 0;
        this._elementSwapMs = 0;
    },

    // ─── UPDATE ───
    update(dt) {
        if (!this.active) return;
        this.phaseTimer += dt;
        this.animTimer += dt;
        this._updateTransition(dt);

        // Decay screen effects globally (not just in resolve phase)
        if (this.screenFlash > 0) {
            this.screenFlash -= dt;
            if (this.screenFlash < 0) this.screenFlash = 0;
        }
        if (this.screenShake > 0) {
            this.screenShake *= 0.9;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }
        if (this._elementSwapMs > 0) this._elementSwapMs = Math.max(0, this._elementSwapMs - dt);

        // Camera zoom: ease toward phase target, with a small punch boost from shake
        const baseZoom = this._phaseZoomTargets[this.phase] ?? 1.0;
        const punchBoost = Math.min(0.12, this.screenShake * 0.006);
        this.cameraZoomTarget = baseZoom + punchBoost;
        this.cameraZoom += (this.cameraZoomTarget - this.cameraZoom) * Math.min(1, dt * 0.012);

        switch (this.phase) {
            case 'unit_select': this._updateUnitSelect(); break;
            case 'tap_to_play': this._updateTapToPlay(); break;
            case 'action_select': this._updateActionSelect(); break;
            case 'element_pick': this._updateElementPick(); break;
            case 'morra_choice': this._updateMorraChoice(); break;
            case 'countdown': this._updateCountdown(dt); break;
            case 'reveal': this._updateReveal(dt); break;
            case 'resolve': this._updateResolve(dt); break;
            case 'between_turns': this._updateBetweenTurns(); break;
            case 'round_end': this._updateRoundEnd(); break;
            case 'match_end': this._updateMatchEnd(); break;
        }

        // Update creature animations
        this._updateCreatureAnims(dt);
    },

    // ─── PHASE: UNIT SELECT ───
    _selectFlash: 0,
    _selectFlashIndex: -1,

    _updateUnitSelect() {
        if (Input.wasPressed('left')) {
            this.selectIndex = Math.max(0, this.selectIndex - 1);
            this._onSelect(this.selectIndex);
        }
        if (Input.wasPressed('right')) {
            this.selectIndex = Math.min(2, this.selectIndex + 1);
            this._onSelect(this.selectIndex);
        }

        // Decay selection flash
        if (this._selectFlash > 0) this._selectFlash -= 16;

        if (Input.wasPressed('confirm') && this.selectIndex >= 0) {
            Audio.play('confirm');
            this._vibrate(50);
            this.screenFlash = 200;
            this.screenFlashColor = '#60b0ff';
            this.playerCreatureIndex = this.selectIndex;
            this.playerCreature = this.playerTeam[this.selectIndex];
            this.playerCreature.currentHp = this.playerCreature.maxHp;

            // CPU picks random
            this.cpuCreatureIndex = Math.floor(Math.random() * this.cpuTeam.length);
            this.cpuCreature = this.cpuTeam[this.cpuCreatureIndex];
            this.cpuCreature.currentHp = this.cpuCreature.maxHp;

            // Transition into battle
            this._startTransition('#0a0a20', () => {
                this.currentTurn = 0;
                this.playerMorraWins = 0;
                this.cpuMorraWins = 0;
                this.turnHistory = [];
            });
            this.phase = 'tap_to_play';
            this.phaseTimer = 0;
        }
    },

    // ─── PHASE: TAP TO PLAY ───
    _updateTapToPlay() {
        if (this.phaseTimer > 500 && Input.wasPressed('confirm')) {
            this.phase = 'action_select';
            this.phaseTimer = 0;
            this.playerChoice = -1;
            this.cpuChoice = -1;
            this.selectIndex = -1;
        }
    },

    // ─── PHASE: ACTION SELECT (Attacco / Potenziamento / Cambio elemento) ───
    ACTIONS: [
        { id: 'attack', label: 'Attacco', icon: '⚔️', color: '#4488ff' },
        { id: 'powerup', label: 'Potenziamento', icon: '💥', color: '#ff8844', hint: (c) => `-${Math.round(c.maxHp * Combat.powerUpHpCostPct)} HP, +80% danno` },
        { id: 'element', label: 'Cambio elemento', icon: '🌀', color: '#aa66ff', hint: () => 'Scegli nuovo elemento' }
    ],

    _updateActionSelect() {
        const maxIdx = this.ACTIONS.length - 1;
        if (Input.wasPressed('left')) {
            this.selectIndex = Math.max(0, (this.selectIndex < 0 ? 0 : this.selectIndex - 1));
        }
        if (Input.wasPressed('right')) {
            this.selectIndex = Math.min(maxIdx, (this.selectIndex < 0 ? 0 : this.selectIndex + 1));
        }
        if (Input.wasPressed('confirm') && this.selectIndex >= 0) {
            this._commitAction(this.selectIndex);
        }
    },

    _isActionAvailable(id) {
        if (id === 'powerup') return !this.playerUsedPowerUp && this.playerCreature.currentHp > this.playerCreature.maxHp * this.powerUpHpCostPct + 1;
        if (id === 'element') return !this.playerUsedElementSwap;
        return true;
    },

    _commitAction(index) {
        const action = this.ACTIONS[index];
        if (!action || !this._isActionAvailable(action.id)) return;
        Audio.play('confirm');
        this._vibrate(40);

        if (action.id === 'attack') {
            this._gotoMorraChoice();
            return;
        }
        if (action.id === 'powerup') {
            this.playerUsedPowerUp = true;
            const cost = Math.round(this.playerCreature.maxHp * this.powerUpHpCostPct);
            this.playerCreature.currentHp = Math.max(1, this.playerCreature.currentHp - cost);
            this.playerNextAttackBuff = this.powerUpDamageMult;
            this.screenFlash = 200;
            this.screenFlashColor = '#ff8844';
            this.screenShake = 6;
            this.floatingTexts.push({
                text: `-${cost} HP`, x: this._w * 0.25, y: this._h * 0.35,
                color: '#ff8844', size: 22, life: 0, maxLife: 1200, vy: -1.2
            });
            this.floatingTexts.push({
                text: 'CARICO!', x: this._w * 0.25, y: this._h * 0.3,
                color: '#ffcc00', size: 22, life: 0, maxLife: 1400, vy: -0.8
            });
            this._gotoMorraChoice();
            return;
        }
        if (action.id === 'element') {
            this.phase = 'element_pick';
            this.phaseTimer = 0;
            this.selectIndex = 0;
            return;
        }
    },

    _gotoMorraChoice() {
        this.phase = 'morra_choice';
        this.phaseTimer = 0;
        this.playerChoice = -1;
        this.cpuChoice = -1;
        this.selectIndex = -1;
    },

    // ─── PHASE: ELEMENT PICK ───
    _updateElementPick() {
        const elementIds = Object.keys(Creatures.ELEMENTS);
        if (Input.wasPressed('left')) this.selectIndex = Math.max(0, this.selectIndex - 1);
        if (Input.wasPressed('right')) this.selectIndex = Math.min(elementIds.length - 1, this.selectIndex + 1);
        if (Input.wasPressed('cancel')) {
            this.phase = 'action_select';
            this.selectIndex = 0;
            return;
        }
        if (Input.wasPressed('confirm')) {
            const newEl = elementIds[this.selectIndex];
            if (!newEl) return;
            this.playerCreature.element = newEl;
            this.playerUsedElementSwap = true;
            Audio.play('confirm');
            this._vibrate(40);
            const color = Creatures.ELEMENTS[newEl].color;
            this.screenFlash = 180;
            this.screenFlashColor = color;
            // Swirl + flash FX on player creature
            this._elementSwapMs = 1200;
            this._elementSwapColor = color;
            this.screenShake = 6;
            this.floatingTexts.push({
                text: `Elemento → ${Creatures.ELEMENTS[newEl].name.toUpperCase()}`,
                x: this._w / 2, y: this._h * 0.3,
                color, size: 22, life: 0, maxLife: 1600, vy: -0.6
            });
            // Swap takes the turn — skip straight to between_turns so CPU gets a free tempo
            this.phase = 'between_turns';
            this.phaseTimer = 0;
            this._betweenTransitionFired = false;
        }
    },

    // ─── PHASE: MORRA CHOICE ───
    _updateMorraChoice() {
        if (Input.wasPressed('left')) {
            this.selectIndex = Math.max(0, this.selectIndex - 1);
            this._onSelect(this.selectIndex);
        }
        if (Input.wasPressed('right')) {
            this.selectIndex = Math.min(2, this.selectIndex + 1);
            this._onSelect(this.selectIndex);
        }

        if (this._selectFlash > 0) this._selectFlash -= 16;

        if (Input.wasPressed('confirm') && this.selectIndex >= 0) {
            Audio.play('confirm');
            this._vibrate(80);
            this.screenFlash = 150;
            this.screenFlashColor = ['#4488ff', '#ff4444', '#44cc66'][this.selectIndex] || '#fff';
            this.playerChoice = this.selectIndex;
            this.cpuChoice = this._aiChoose();
            this.playerAnim = 'idle';
            this.cpuAnim = 'idle';
            this.phase = 'countdown';
            this.phaseTimer = 0;
            this._countdownBeat = 0;
        }
    },

    // ─── PHASE: COUNTDOWN (3-2-1) ───
    _countdownBeat: 0,
    _updateCountdown(dt) {
        const beat = this.phaseTimer < 400 ? 0 : this.phaseTimer < 800 ? 1 : 2;
        if (beat > this._countdownBeat) {
            this._countdownBeat = beat;
            Audio.play(beat < 2 ? 'countdown' : 'countdownGo');
        }
        if (this.phaseTimer > 1200) {
            this._countdownBeat = 0;
            // Trigger attack anims
            const pAnims = ['carta', 'sasso', 'forbice'];
            this.playerAnim = pAnims[this.playerChoice];
            this.cpuAnim = pAnims[this.cpuChoice];
            this.playerAnimTimer = 0;
            this.cpuAnimTimer = 0;
            this.phase = 'reveal';
            this.phaseTimer = 0;
        }
    },

    // ─── PHASE: REVEAL (flip cards) ───
    _updateReveal(dt) {
        // Card flip sound
        if (this.phaseTimer > 250 && this.phaseTimer < 300) Audio.play('reveal');

        // At 600ms: cards fully revealed, resolve
        if (this.phaseTimer > 800) {
            this._resolveMorra();

            // Audio + haptic feedback
            if (this.turnCrit) { Audio.play('crit'); this._vibrate([50, 30, 100]); }
            else if (this.turnEvade) { Audio.play('evade'); this._vibrate(30); }
            else if (this.turnResult === 'draw') { Audio.play('draw'); }
            else if (this.turnDamage > 0) { Audio.play('hit'); this._vibrate(40); }

            // Screen effects based on result
            if (this.turnCrit) {
                this.screenShake = 15;
                this.screenFlash = 300;
                this.screenFlashColor = '#ffcc00';
            } else if (this.turnDamage > 0) {
                this.screenShake = 8;
                this.screenFlash = 150;
                this.screenFlashColor = this.morraWinner === 1 ? '#60b0ff' : '#ff6080';
            } else if (this.turnResult === 'evas') {
                this.screenFlash = 100;
                this.screenFlashColor = '#a060ff';
            }

            // Floating damage text
            if (this.turnDamage > 0) {
                const targetX = this.morraWinner === 1 ? this._w * 0.75 : this._w * 0.25;
                this.floatingTexts.push({
                    text: `-${this.turnDamage}`,
                    x: targetX,
                    y: this._h * 0.35,
                    color: this.turnCrit ? '#ffcc00' : '#ff4444',
                    size: this.turnCrit ? 32 : 24,
                    life: 0,
                    maxLife: 1200,
                    vy: -1.5
                });
                if (this.turnCrit) {
                    this.floatingTexts.push({
                        text: 'CRITICO!',
                        x: this._w / 2,
                        y: this._h * 0.28,
                        color: '#ffcc00',
                        size: 20,
                        life: 0,
                        maxLife: 1500,
                        vy: -0.8
                    });
                }
                if (this.turnElementMult && this.turnElementMult !== 1) {
                    const superEff = this.turnElementMult > 1;
                    this.floatingTexts.push({
                        text: superEff ? 'SUPER!' : 'RESISTE',
                        x: this._w / 2,
                        y: this._h * 0.32,
                        color: superEff ? '#44ff88' : '#ff8844',
                        size: 18,
                        life: 0,
                        maxLife: 1300,
                        vy: -0.7
                    });
                }
            } else if (this.turnResult === 'evas') {
                const evaderX = this.morraWinner === 1 ? this._w * 0.75 : this._w * 0.25;
                this.floatingTexts.push({
                    text: 'SCHIVATA!',
                    x: evaderX,
                    y: this._h * 0.35,
                    color: '#a060ff',
                    size: 18,
                    life: 0,
                    maxLife: 1200,
                    vy: -1
                });
            }

            this.phase = 'resolve';
            this.phaseTimer = 0;
        }
    },

    // ─── PHASE: RESOLVE ───
    _updateResolve(dt) {
        // Screen effects now decay globally in update()

        // Update floating texts
        this.floatingTexts.forEach(ft => {
            ft.life += dt;
            ft.y += ft.vy;
        });
        this.floatingTexts = this.floatingTexts.filter(ft => ft.life < ft.maxLife);

        if (this.phaseTimer > 1800) {
            this.playerAnim = 'idle';
            this.cpuAnim = 'idle';
        }

        if (this.phaseTimer > 2400) {
            this.floatingTexts = [];
            const roundEnd = this._checkRoundEnd();
            if (roundEnd) {
                this.phase = 'round_end';
                this.phaseTimer = 0;
                // KO sound
                if ((this.playerCreature && this.playerCreature.currentHp <= 0) ||
                    (this.cpuCreature && this.cpuCreature.currentHp <= 0)) {
                    Audio.play('ko');
                    this._vibrate([100, 50, 100]);
                }
            } else {
                this.phase = 'between_turns';
                this.phaseTimer = 0;
                this._betweenTransitionFired = false;
            }
        }
    },

    // ─── PHASE: BETWEEN TURNS ───
    _betweenTransitionFired: false,
    _updateBetweenTurns() {
        // Quick smooth transition — no polka dots, just a fast camera-style cut
        if (this.phaseTimer > 400) {
            this.phase = 'tap_to_play';
            this.phaseTimer = 0;
        }
    },

    // ─── PHASE: ROUND END ───
    _roundEndSoundPlayed: false,
    _updateRoundEnd() {
        if (!this._roundEndSoundPlayed) {
            // Check who won this round
            const playerWonRound = (this.cpuCreature && this.cpuCreature.currentHp <= 0) ||
                this.playerMorraWins >= 3 ||
                (this.playerCreature && this.cpuCreature &&
                 this.playerCreature.currentHp > this.cpuCreature.currentHp);
            Audio.play(playerWonRound ? 'win' : 'lose');
            this._roundEndSoundPlayed = true;
        }
        if (this.phaseTimer > 2000 && Input.wasPressed('confirm')) {
            this._roundEndSoundPlayed = false;
            if (this._checkMatchEnd()) {
                this._startTransition('#ffcc00');
                this.phase = 'match_end';
                this.phaseTimer = 0;
            } else {
                this._startTransition('#0a0a20');
                this.phase = 'unit_select';
                this.selectIndex = -1; // No pre-selection
                this.phaseTimer = 0;
            }
        }
    },

    // ─── PHASE: MATCH END ───
    _matchEndSoundPlayed: false,
    // Match results data
    _matchResults: null,

    _updateMatchEnd() {
        if (!this._matchEndSoundPlayed) {
            const playerWon = this.playerRoundWins >= this.roundsToWin;
            Audio.play(playerWon ? 'victory' : 'defeat');
            this._matchEndSoundPlayed = true;

            // Calculate results
            if (playerWon) {
                this._matchResults = this._calculateMatchResults();
            } else {
                this._matchResults = { won: false, xpGained: 0, levelUps: [], captured: null };
            }
        }
        if (this.phaseTimer > 2000 && Input.wasPressed('confirm')) {
            this._matchEndSoundPlayed = false;
            this._matchResults = null;
            this.active = false;
        }
    },

    _calculateMatchResults() {
        const results = { won: true, xpGained: 0, levelUps: [], captured: null };

        // XP based on enemy team average level (or base 30)
        const baseXP = 30;
        results.xpGained = baseXP;

        // Give XP to all team creatures
        const team = TeamBuilder.currentTeam;
        team.forEach(id => {
            const res = Creatures.addXP(id, baseXP);
            if (res.leveledUp) {
                const name = Creatures.getById(id).creatureName;
                results.levelUps.push({ id, name, newLevel: res.newLevel });
            }
        });

        // Try to capture a random enemy creature
        const enemyIds = this.cpuTeam.map(c => c.id).filter(id => id && !Creatures.isUnlocked(id));
        if (enemyIds.length > 0) {
            const targetId = enemyIds[Math.floor(Math.random() * enemyIds.length)];
            const isBoss = false; // TODO: detect boss from NPC data
            const caught = Creatures.tryCapture(targetId, isBoss);
            if (caught) {
                results.captured = Creatures.getById(targetId);
                Audio.play('victory');
            }
        }

        return results;
    },

    // ─── MORRA LOGIC ───
    _resolveMorra() {
        const p = this.playerChoice;
        const c = this.cpuChoice;

        // Carta(0) beats Sasso(1), Sasso(1) beats Forbice(2), Forbice(2) beats Carta(0)
        if (p === c) {
            this.morraWinner = 0;
            this.turnResult = 'draw';
            this.turnDamage = 0;
            this.turnCrit = false;
            this.turnEvade = false;
            this.playerAnim = 'draw';
            this.cpuAnim = 'draw';
            // Draw doesn't count as turn
            return;
        }

        const playerWins = (p === 0 && c === 1) || (p === 1 && c === 2) || (p === 2 && c === 0);

        if (playerWins) {
            this.morraWinner = 1;
            this.playerMorraWins++;
            this.currentTurn++;
            this.turnHistory.push(1);
            this._applyDamage(this.playerCreature, this.cpuCreature);
        } else {
            this.morraWinner = 2;
            this.cpuMorraWins++;
            this.currentTurn++;
            this.turnHistory.push(2);
            this._applyDamage(this.cpuCreature, this.playerCreature);
        }
    },

    _applyDamage(attacker, defender) {
        // Step 1: Evasion
        if (Math.random() < (defender.evasionChance || 0.05)) {
            this.turnDamage = 0;
            this.turnCrit = false;
            this.turnEvade = true;
            this.turnResult = 'evas';

            if (this.morraWinner === 1) {
                this.playerAnim = 'win';
                this.cpuAnim = 'evas';
            } else {
                this.cpuAnim = 'win';
                this.playerAnim = 'evas';
            }
            return;
        }

        // Step 2: Base damage (DEF x0.3 = low defense, high damage)
        let damage = attacker.atk - (defender.def * 0.3);
        damage = Math.max(5, damage); // minimum 5 damage always

        // Step 3: Element matchup multiplier
        let elementMult = 1.0;
        if (attacker.element && defender.element && Creatures.ELEMENTS) {
            const atkEl = Creatures.ELEMENTS[attacker.element];
            if (atkEl) {
                if (atkEl.strong === defender.element) elementMult = 1.5;
                else if (atkEl.weak === defender.element) elementMult = 0.67;
            }
        }
        this.turnElementMult = elementMult;
        damage *= elementMult;

        // Step 4: Player Potenziamento buff (consumed on first player attack)
        if (attacker === this.playerCreature && this.playerNextAttackBuff > 1) {
            damage *= this.playerNextAttackBuff;
            this.playerNextAttackBuff = 1.0;
        }

        // Step 5: Crit
        this.turnCrit = Math.random() < (attacker.critChance || 0.1);
        if (this.turnCrit) {
            damage *= 2;
        }

        // Step 6: Round
        damage = Math.round(damage);
        this.turnDamage = damage;
        this.turnEvade = false;

        // Step 5: Apply
        defender.currentHp = Math.max(0, defender.currentHp - damage);

        // Set result and animations
        if (this.morraWinner === 1) {
            this.turnResult = this.turnCrit ? 'crit' : 'win';
            this.playerAnim = this.turnCrit ? 'crit' : 'win';
            this.cpuAnim = 'lose';
        } else {
            this.turnResult = this.turnCrit ? 'crit' : 'lose';
            this.cpuAnim = this.turnCrit ? 'crit' : 'win';
            this.playerAnim = 'lose';
        }

        // Check KO / death
        if (defender.currentHp <= 0) {
            if (this.morraWinner === 1) this.cpuAnim = 'death';
            else this.playerAnim = 'death';
        }
    },

    _checkRoundEnd() {
        // KO
        if (this.playerCreature.currentHp <= 0) {
            this.cpuRoundWins++;
            return true;
        }
        if (this.cpuCreature.currentHp <= 0) {
            this.playerRoundWins++;
            return true;
        }

        // Morra majority (3/5)
        if (this.playerMorraWins >= 3) {
            this.playerRoundWins++;
            return true;
        }
        if (this.cpuMorraWins >= 3) {
            this.cpuRoundWins++;
            return true;
        }

        // 5 turns done
        if (this.currentTurn >= 5) {
            if (this.playerCreature.currentHp > this.cpuCreature.currentHp) {
                this.playerRoundWins++;
            } else if (this.cpuCreature.currentHp > this.playerCreature.currentHp) {
                this.cpuRoundWins++;
            } else {
                // Sudden death: random morra
                const sd = Math.random();
                if (sd < 0.5) this.playerRoundWins++;
                else this.cpuRoundWins++;
            }
            return true;
        }

        return false;
    },

    _checkMatchEnd() {
        return this.playerRoundWins >= this.roundsToWin || this.cpuRoundWins >= this.roundsToWin;
    },

    // ─── AI ───
    // ─── FEEDBACK HELPERS ───
    _onSelect(index) {
        Audio.play('select');
        this._vibrate(20);
        this._selectFlash = 300;
        this._selectFlashIndex = index;
    },

    _vibrate(ms) {
        if (navigator.vibrate) {
            navigator.vibrate(ms);
        }
    },

    _aiChoose() {
        // Weighted random with slight bias against player's last choice
        return Math.floor(Math.random() * 3);
    },

    // ─── CREATURE ANIMATIONS ───
    _updateCreatureAnims(dt) {
        this.playerAnimTimer += dt;
        this.cpuAnimTimer += dt;
    },

    // ─── RENDER ───
    render(ctx, w, h) {
        if (!this.active) return;

        // Background
        ctx.fillStyle = '#0a0a20';
        ctx.fillRect(0, 0, w, h);

        // Screen shake offset
        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0.5) {
            shakeX = (Math.random() - 0.5) * this.screenShake;
            shakeY = (Math.random() - 0.5) * this.screenShake;
        }

        ctx.save();
        ctx.translate(shakeX, shakeY);

        switch (this.phase) {
            case 'unit_select': this._renderUnitSelect(ctx, w, h); break;
            case 'tap_to_play': this._renderCombatScene(ctx, w, h); this._renderTapToPlay(ctx, w, h); break;
            case 'action_select': this._renderCombatScene(ctx, w, h); this._renderActionSelect(ctx, w, h); break;
            case 'element_pick': this._renderCombatScene(ctx, w, h); this._renderElementPick(ctx, w, h); break;
            case 'morra_choice': this._renderCombatScene(ctx, w, h); this._renderMorraButtons(ctx, w, h); break;
            case 'countdown': this._renderCombatScene(ctx, w, h); this._renderCountdown(ctx, w, h); break;
            case 'reveal': this._renderCombatScene(ctx, w, h); this._renderRevealEpic(ctx, w, h); break;
            case 'resolve': this._renderCombatScene(ctx, w, h); this._renderResolveEpic(ctx, w, h); break;
            case 'between_turns': this._renderCombatScene(ctx, w, h); this._renderBetweenTurns(ctx, w, h); break;
            case 'round_end': this._renderCombatScene(ctx, w, h); this._renderRoundEnd(ctx, w, h); break;
            case 'match_end': this._renderCombatScene(ctx, w, h); this._renderMatchEnd(ctx, w, h); break;
        }

        ctx.restore();

        // Screen flash overlay (after restore so it covers everything)
        if (this.screenFlash > 0) {
            ctx.fillStyle = this.screenFlashColor;
            ctx.globalAlpha = Math.min(0.4, this.screenFlash / 300);
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
        }

        // Floating texts (after restore)
        this._renderFloatingTexts(ctx);

        // Polka-dot transition (on top of everything)
        this._renderTransition(ctx, w, h);

        // Score always visible (except unit select)
        if (this.phase !== 'unit_select') {
            this._renderScore(ctx, w);
        }
    },

    // ─── RENDER: UNIT SELECT ───
    _renderUnitSelect(ctx, w, h) {
        // Background gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#1a1040');
        bgGrad.addColorStop(0.5, '#0f0a2a');
        bgGrad.addColorStop(1, '#1a1040');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        // Decorative circles
        ctx.fillStyle = 'rgba(100,100,255,0.04)';
        ctx.beginPath(); ctx.arc(w * 0.2, h * 0.3, 100, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w * 0.8, h * 0.7, 80, 0, Math.PI * 2); ctx.fill();

        // Title
        UI.text(ctx, 'SCEGLI UNITA', w / 2, 70, {
            color: '#ffcc00', size: 30, bold: true, align: 'center'
        });
        UI.text(ctx, `Round: ${this.playerRoundWins} - ${this.cpuRoundWins}`, w / 2, 105, {
            color: '#aaa', size: 18, align: 'center'
        });

        // CPU team
        UI.text(ctx, '— AVVERSARIO —', w / 2, 185, {
            color: '#ff6060', size: 16, bold: true, align: 'center'
        });

        const cardW = 140;
        const cardH = 170;
        const gap = 20;
        const totalW = cardW * 3 + gap * 2;
        const startX = (w - totalW) / 2;

        for (let i = 0; i < this.cpuTeam.length; i++) {
            const c = this.cpuTeam[i];
            const bx = startX + i * (cardW + gap);
            const by = 220;

            // Card with gradient
            const cardGrad = ctx.createLinearGradient(bx, by, bx, by + cardH);
            cardGrad.addColorStop(0, 'rgba(150,40,40,0.3)');
            cardGrad.addColorStop(1, 'rgba(80,20,20,0.4)');
            ctx.fillStyle = cardGrad;
            UI.roundRect(ctx, bx, by, cardW, cardH, 14);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,80,80,0.4)';
            ctx.lineWidth = 1.5;
            UI.roundRect(ctx, bx, by, cardW, cardH, 14);
            ctx.stroke();

            Creatures.drawCreature(ctx, bx + cardW / 2, by + 60, c, 32, 'idle', this.animTimer);
            UI.text(ctx, c.creatureName, bx + cardW / 2, by + cardH - 40, {
                color: '#fff', size: 14, bold: true, align: 'center'
            });
            UI.text(ctx, `HP:${c.maxHp} ATK:${c.atk}`, bx + cardW / 2, by + cardH - 18, {
                color: '#aaa', size: 12, align: 'center'
            });
        }

        // Player team
        UI.text(ctx, '— IL TUO TEAM —', w / 2, h * 0.44, {
            color: '#60b0ff', size: 16, bold: true, align: 'center'
        });

        for (let i = 0; i < this.playerTeam.length; i++) {
            const c = this.playerTeam[i];
            const bx = startX + i * (cardW + gap);
            const by = h * 0.48;
            const selected = i === this.selectIndex;

            // Card with gradient
            const pGrad = ctx.createLinearGradient(bx, by, bx, by + cardH);
            if (selected) {
                pGrad.addColorStop(0, 'rgba(60,120,255,0.4)');
                pGrad.addColorStop(1, 'rgba(30,60,150,0.5)');
            } else {
                pGrad.addColorStop(0, 'rgba(40,60,120,0.25)');
                pGrad.addColorStop(1, 'rgba(20,30,80,0.3)');
            }
            ctx.fillStyle = pGrad;
            UI.roundRect(ctx, bx, by, cardW, cardH, 14);
            ctx.fill();

            if (selected) {
                ctx.save();
                const flashIntensity = Math.max(20, this._selectFlash * 0.15);
                ctx.shadowColor = '#80ccff';
                ctx.shadowBlur = flashIntensity;
                ctx.strokeStyle = '#80ccff';
                ctx.lineWidth = 3 + (this._selectFlash > 0 ? 2 : 0);
                UI.roundRect(ctx, bx, by, cardW, cardH, 14);
                ctx.stroke();
                // Selection flash overlay
                if (this._selectFlash > 0 && this._selectFlashIndex === i) {
                    ctx.fillStyle = `rgba(100,180,255,${this._selectFlash / 800})`;
                    UI.roundRect(ctx, bx, by, cardW, cardH, 14);
                    ctx.fill();
                }
                ctx.restore();
            } else {
                ctx.strokeStyle = 'rgba(60,120,255,0.3)';
                ctx.lineWidth = 1.5;
                UI.roundRect(ctx, bx, by, cardW, cardH, 14);
                ctx.stroke();
            }

            Creatures.drawCreature(ctx, bx + cardW / 2, by + 60, c, 32, 'idle', this.animTimer);
            UI.text(ctx, c.creatureName, bx + cardW / 2, by + cardH - 40, {
                color: '#fff', size: 14, bold: true, align: 'center'
            });
            UI.text(ctx, `HP:${c.maxHp} ATK:${c.atk}`, bx + cardW / 2, by + cardH - 18, {
                color: '#aaa', size: 12, align: 'center'
            });
        }

        // Hint
        UI.text(ctx, 'Tocca per scegliere', w / 2, h - 80, {
            color: '#667', size: 16, align: 'center'
        });
    },

    // ─── RENDER: COMBAT SCENE ───
    _renderCombatScene(ctx, w, h) {
        // Camera zoom (center-anchored) — only wraps the scene, not UI overlays.
        ctx.save();
        if (Math.abs(this.cameraZoom - 1) > 0.001) {
            ctx.translate(w / 2, h / 2);
            ctx.scale(this.cameraZoom, this.cameraZoom);
            ctx.translate(-w / 2, -h / 2);
        }

        const stage = this.STAGES[this._stageId] || this.STAGES.villaggio;
        const t = this.animTimer;

        // ── SKY ──
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
        stage.sky.forEach((c, i) => skyGrad.addColorStop(i / (stage.sky.length - 1), c));
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h * 0.55);

        // ── MOUNTAINS / HORIZON ──
        ctx.fillStyle = stage.mountains;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.38);
        ctx.lineTo(w * 0.1, h * 0.28);
        ctx.lineTo(w * 0.22, h * 0.32);
        ctx.lineTo(w * 0.35, h * 0.2);
        ctx.lineTo(w * 0.5, h * 0.3);
        ctx.lineTo(w * 0.65, h * 0.18);
        ctx.lineTo(w * 0.78, h * 0.3);
        ctx.lineTo(w * 0.9, h * 0.25);
        ctx.lineTo(w, h * 0.35);
        ctx.lineTo(w, h * 0.45);
        ctx.lineTo(0, h * 0.45);
        ctx.closePath();
        ctx.fill();

        // Horizon strip
        ctx.fillStyle = stage.horizonColor;
        ctx.fillRect(0, h * 0.42, w, h * 0.13);

        // ── GROUND ──
        const groundGrad = ctx.createLinearGradient(0, h * 0.52, 0, h);
        groundGrad.addColorStop(0, stage.ground);
        groundGrad.addColorStop(1, stage.groundAccent);
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, h * 0.52, w, h * 0.48);

        // Ground texture lines
        ctx.strokeStyle = stage.groundAccent;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            const gy = h * 0.55 + i * 20;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy + 3);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // ── STAGE DETAILS ──
        this._renderStageDetails(ctx, w, h, stage, t);

        // ── ARENA CIRCLE (on ground) ──
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(w / 2, h * 0.6, w * 0.38, 28, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Inner circle
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.ellipse(w / 2, h * 0.6, w * 0.25, 18, 0, 0, Math.PI * 2);
        ctx.stroke();

        // HP Bars (compact, above creatures) — hide during morra to avoid clutter
        if (this.phase !== 'morra_choice') {
            this._renderHPBars(ctx, w, h);
        }

        // Draw creatures — HD sizes
        const playerX = w * 0.25;
        const cpuX = w * 0.75;
        const creatureY = h * 0.42;
        const creatureSize = 55; // Much bigger for HD

        if (this.playerCreature) {
            // Power-up aura (behind creature)
            if (this.playerNextAttackBuff > 1) {
                this._drawPowerUpAura(ctx, playerX, creatureY, creatureSize);
            }
            const pOff = this._getAnimOffset(this.playerAnim, this.playerAnimTimer, false);
            ctx.save();
            ctx.translate(playerX + pOff.x, creatureY + pOff.y);
            if (pOff.rotation) ctx.rotate(pOff.rotation);
            Creatures.drawCreature(ctx, 0, 0, this.playerCreature, creatureSize * pOff.scale, this.playerAnim, this.playerAnimTimer);
            ctx.restore();
            // Element-swap swirl (on top of creature)
            if (this._elementSwapMs > 0) {
                this._drawElementSwap(ctx, playerX, creatureY, creatureSize);
            }
            // Name + element
            ctx.textAlign = 'center';
            UI.textOutline(ctx, this.playerCreature.creatureName, playerX, creatureY + 80, {
                color: '#fff', size: 20, bold: true, align: 'center'
            });
            if (this.playerCreature.element) {
                const el = Creatures.ELEMENTS[this.playerCreature.element];
                UI.textOutline(ctx, el.name, playerX, creatureY + 105, {
                    color: el.color, size: 16, bold: true, align: 'center'
                });
            }
        }
        if (this.cpuCreature) {
            const cOff = this._getAnimOffset(this.cpuAnim, this.cpuAnimTimer, true);
            ctx.save();
            ctx.translate(cpuX + cOff.x, creatureY + cOff.y);
            if (cOff.rotation) ctx.rotate(cOff.rotation);
            Creatures.drawCreature(ctx, 0, 0, this.cpuCreature, creatureSize * cOff.scale, this.cpuAnim, this.cpuAnimTimer);
            ctx.restore();
            UI.textOutline(ctx, this.cpuCreature.creatureName, cpuX, creatureY + 80, {
                color: '#fff', size: 20, bold: true, align: 'center'
            });
            if (this.cpuCreature.element) {
                const el = Creatures.ELEMENTS[this.cpuCreature.element];
                UI.textOutline(ctx, el.name, cpuX, creatureY + 105, {
                    color: el.color, size: 16, bold: true, align: 'center'
                });
            }
            ctx.textAlign = 'left';
        }

        // Turn counter — positioned around 3/4 height so it reads clearly.
        this._renderTurnCounter(ctx, w, h);

        ctx.restore(); // End camera-zoom wrapper
    },

    _renderTurnCounter(ctx, w, h) {
        const maxTurns = 5;
        const centerY = Math.round(h * 0.55);

        // Panel behind the counter
        const panelW = 280;
        const panelH = 92;
        const panelX = (w - panelW) / 2;
        const panelY = centerY - panelH / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        UI.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 2;
        UI.roundRect(ctx, panelX, panelY, panelW, panelH, 16);
        ctx.stroke();

        // Big "Turno X / 5" text
        UI.textOutline(ctx, `Turno ${Math.min(this.currentTurn + (this.currentTurn < maxTurns ? 1 : 0), maxTurns)} / ${maxTurns}`, w / 2, centerY - 12, {
            color: '#fff', size: 26, bold: true, align: 'center'
        });

        // Dots row — one per turn. Filled blue/red based on who won; outline-gray if not yet played.
        const dotR = 10;
        const gap = 18;
        const totalW = maxTurns * (dotR * 2) + (maxTurns - 1) * gap;
        const startX = (w - totalW) / 2 + dotR;
        const dotY = centerY + 20;

        for (let i = 0; i < maxTurns; i++) {
            const cx = startX + i * (dotR * 2 + gap);
            const winner = this.turnHistory[i]; // 1, 2, or undefined
            const isCurrent = i === this.turnHistory.length && (this.phase === 'tap_to_play' || this.phase === 'action_select' || this.phase === 'element_pick' || this.phase === 'morra_choice' || this.phase === 'countdown' || this.phase === 'reveal');

            // Base
            if (winner === 1) {
                ctx.fillStyle = '#60b0ff';
                ctx.beginPath(); ctx.arc(cx, dotY, dotR, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#2060a0';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else if (winner === 2) {
                ctx.fillStyle = '#ff6080';
                ctx.beginPath(); ctx.arc(cx, dotY, dotR, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#a02040';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.beginPath(); ctx.arc(cx, dotY, dotR, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = isCurrent ? '#ffcc44' : 'rgba(255,255,255,0.3)';
                ctx.lineWidth = isCurrent ? 3 : 1.5;
                ctx.stroke();
                if (isCurrent) {
                    // Pulsing halo for the current turn
                    const pulse = 0.5 + Math.sin(this.animTimer * 0.006) * 0.5;
                    ctx.strokeStyle = `rgba(255,204,68,${0.4 * pulse})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(cx, dotY, dotR + 4 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
                }
            }
        }

        // Tiny legend
        UI.text(ctx, `${this.playerMorraWins}`, panelX + 24, centerY + 26, {
            color: '#60b0ff', size: 16, bold: true, align: 'center'
        });
        UI.text(ctx, `${this.cpuMorraWins}`, panelX + panelW - 24, centerY + 26, {
            color: '#ff6080', size: 16, bold: true, align: 'center'
        });
    },

    // Orange/yellow pulsing rings behind the creature while Potenziamento buff is armed.
    _drawPowerUpAura(ctx, cx, cy, size) {
        const t = this.animTimer * 0.006;
        ctx.save();
        for (let i = 0; i < 3; i++) {
            const phase = (t + i * 0.33) % 1;
            const r = size * (0.9 + phase * 1.4);
            const alpha = (1 - phase) * 0.55;
            ctx.strokeStyle = i === 0 ? `rgba(255,204,68,${alpha})` : `rgba(255,140,40,${alpha})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        // Charge particles rising
        ctx.fillStyle = 'rgba(255,220,100,0.8)';
        for (let i = 0; i < 8; i++) {
            const a = t * 2 + i * 0.8;
            const rr = size * 0.9;
            const px = cx + Math.cos(a) * rr;
            const py = cy + Math.sin(a) * rr * 0.6 - ((t * 40 + i * 20) % 80);
            ctx.fillRect(Math.round(px), Math.round(py), 3, 3);
        }
        ctx.restore();
    },

    // Rotating element-coloured ring + flash overlay on the creature when element is swapped.
    _drawElementSwap(ctx, cx, cy, size) {
        const progress = 1 - (this._elementSwapMs / 1200);
        const color = this._elementSwapColor || '#ffffff';
        const t = this.animTimer * 0.02;
        ctx.save();
        // Expanding ring
        const r1 = size * (0.5 + progress * 1.3);
        const alpha1 = Math.max(0, 1 - progress);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha1;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cx, cy, r1, 0, Math.PI * 2);
        ctx.stroke();
        // Rotating dashed ring
        ctx.setLineDash([10, 10]);
        ctx.lineDashOffset = -t * 30;
        ctx.lineWidth = 3;
        ctx.globalAlpha = alpha1 * 0.9;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // Creature tint flash
        ctx.globalAlpha = alpha1 * 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.85, 0, Math.PI * 2);
        ctx.fill();
        // Sparks
        ctx.globalAlpha = alpha1;
        ctx.fillStyle = color;
        for (let i = 0; i < 12; i++) {
            const a = i * Math.PI * 2 / 12 + t;
            const rr = size * (0.5 + progress * 1.6);
            const px = cx + Math.cos(a) * rr;
            const py = cy + Math.sin(a) * rr;
            ctx.fillRect(Math.round(px - 2), Math.round(py - 2), 4, 4);
        }
        ctx.restore();
    },

    _renderStageDetails(ctx, w, h, stage, t) {
        switch (stage.details) {
            case 'sakura':
                // Cherry blossom trees on sides
                this._drawTree(ctx, 30, h * 0.32, '#5a3a2a', '#ffaacc', 0.8);
                this._drawTree(ctx, w - 35, h * 0.34, '#5a3a2a', '#ffbbcc', 0.7);
                // Falling petals
                ctx.fillStyle = '#ffaacc';
                for (let i = 0; i < 12; i++) {
                    const px = (i * 67 + t * 0.02) % w;
                    const py = (i * 43 + t * 0.04 + Math.sin(t * 0.002 + i) * 20) % (h * 0.55);
                    ctx.globalAlpha = 0.5 + Math.sin(t * 0.003 + i) * 0.3;
                    ctx.beginPath();
                    ctx.ellipse(px, py, 3, 2, t * 0.002 + i, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
                break;

            case 'trees':
                // Dense forest trees
                for (let i = 0; i < 8; i++) {
                    const tx = i * (w / 7) - 10;
                    const ty = h * 0.3 + Math.sin(i * 2) * 15;
                    this._drawTree(ctx, tx, ty, '#2a3a1a', '#1a5a0a', 0.6 + i * 0.05);
                }
                // Fog
                ctx.fillStyle = 'rgba(100,150,100,0.08)';
                ctx.fillRect(0, h * 0.35, w, h * 0.15);
                // Fireflies
                for (let i = 0; i < 6; i++) {
                    const fx = w * 0.2 + Math.sin(t * 0.001 + i * 1.5) * w * 0.3;
                    const fy = h * 0.3 + Math.cos(t * 0.0015 + i) * 30;
                    ctx.fillStyle = `rgba(200,255,100,${0.3 + Math.sin(t * 0.005 + i) * 0.3})`;
                    ctx.beginPath();
                    ctx.arc(fx, fy, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'rocks':
                // Snow-capped peaks (brighter mountain tips)
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.beginPath();
                ctx.moveTo(w * 0.33, h * 0.2);
                ctx.lineTo(w * 0.37, h * 0.23);
                ctx.lineTo(w * 0.29, h * 0.23);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(w * 0.63, h * 0.18);
                ctx.lineTo(w * 0.67, h * 0.22);
                ctx.lineTo(w * 0.59, h * 0.22);
                ctx.closePath();
                ctx.fill();
                // Boulders on ground
                ctx.fillStyle = '#8a8a7a';
                ctx.beginPath(); ctx.ellipse(w * 0.1, h * 0.58, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(w * 0.85, h * 0.62, 14, 8, 0.3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(w * 0.92, h * 0.56, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
                // Wind lines
                ctx.strokeStyle = 'rgba(255,255,255,0.08)';
                ctx.lineWidth = 1;
                for (let i = 0; i < 3; i++) {
                    const wx = (t * 0.05 + i * 120) % (w + 80) - 40;
                    ctx.beginPath();
                    ctx.moveTo(wx, h * 0.25 + i * 25);
                    ctx.lineTo(wx + 40, h * 0.25 + i * 25 - 3);
                    ctx.stroke();
                }
                break;

            case 'lanterns':
                // Temple pillars
                ctx.fillStyle = '#6a2a1a';
                ctx.fillRect(15, h * 0.2, 12, h * 0.35);
                ctx.fillRect(w - 27, h * 0.2, 12, h * 0.35);
                // Pillar tops
                ctx.fillStyle = '#8a3a2a';
                ctx.fillRect(10, h * 0.18, 22, 8);
                ctx.fillRect(w - 32, h * 0.18, 22, 8);
                // Hanging lanterns
                for (let i = 0; i < 3; i++) {
                    const lx = w * 0.25 + i * (w * 0.25);
                    const ly = h * 0.15 + Math.sin(t * 0.002 + i) * 3;
                    // String
                    ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(lx, h * 0.08); ctx.lineTo(lx, ly); ctx.stroke();
                    // Lantern
                    ctx.fillStyle = '#ff4422';
                    ctx.beginPath(); ctx.ellipse(lx, ly + 8, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
                    // Glow
                    ctx.fillStyle = `rgba(255,100,50,${0.1 + Math.sin(t * 0.003 + i) * 0.05})`;
                    ctx.beginPath(); ctx.arc(lx, ly + 8, 18, 0, Math.PI * 2); ctx.fill();
                }
                // Torii gate silhouette in background
                ctx.fillStyle = 'rgba(100,30,20,0.3)';
                ctx.fillRect(w * 0.4, h * 0.1, 4, h * 0.25);
                ctx.fillRect(w * 0.6, h * 0.1, 4, h * 0.25);
                ctx.fillRect(w * 0.38, h * 0.1, w * 0.24, 5);
                ctx.fillRect(w * 0.36, h * 0.15, w * 0.28, 4);
                break;

            case 'buildings':
                // City skyline
                const buildingColors = ['#3a3a5a', '#2a2a4a', '#4a4a6a', '#353555'];
                const buildings = [
                    {x: 0, w: 35, h: 80}, {x: 30, w: 25, h: 55}, {x: 50, w: 40, h: 95},
                    {x: 85, w: 30, h: 65}, {x: 110, w: 45, h: 110}, {x: 150, w: 30, h: 70},
                    {x: 175, w: 35, h: 85}, {x: 205, w: 50, h: 100}, {x: 250, w: 30, h: 60},
                    {x: 275, w: 40, h: 90}, {x: 310, w: 30, h: 75}
                ];
                buildings.forEach((b, i) => {
                    const by = h * 0.42 - b.h;
                    ctx.fillStyle = buildingColors[i % buildingColors.length];
                    ctx.fillRect(b.x, by, b.w, b.h + 5);
                    // Windows
                    ctx.fillStyle = `rgba(255,255,150,${0.2 + Math.sin(t * 0.001 + i * 2) * 0.15})`;
                    for (let wy = by + 8; wy < by + b.h - 5; wy += 12) {
                        for (let wx = b.x + 5; wx < b.x + b.w - 5; wx += 8) {
                            ctx.fillRect(wx, wy, 4, 4);
                        }
                    }
                });
                // Neon signs
                ctx.fillStyle = `rgba(255,60,100,${0.3 + Math.sin(t * 0.004) * 0.2})`;
                ctx.fillRect(115, h * 0.42 - 108, 35, 6);
                ctx.fillStyle = `rgba(60,200,255,${0.3 + Math.sin(t * 0.003 + 1) * 0.2})`;
                ctx.fillRect(210, h * 0.42 - 98, 40, 6);
                break;
        }
    },

    _drawTree(ctx, x, y, trunk, foliage, scale) {
        const s = scale || 1;
        // Trunk
        ctx.fillStyle = trunk;
        ctx.fillRect(x - 3 * s, y, 6 * s, 25 * s);
        // Foliage
        ctx.fillStyle = foliage;
        ctx.beginPath(); ctx.arc(x, y - 5 * s, 18 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x - 10 * s, y + 2 * s, 14 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 10 * s, y + 2 * s, 14 * s, 0, Math.PI * 2); ctx.fill();
    },

    _renderHPBars(ctx, w, h) {
        if (!this.playerCreature || !this.cpuCreature) return;
        // Compact HP bars above each creature (solidali con il mostro).
        const playerX = w * 0.25;
        const cpuX = w * 0.75;
        const creatureY = h * 0.42;
        const barW = 130;
        const barH = 12;
        const offsetY = 84; // how far above the creature center

        // Player
        this._drawMiniHPBar(ctx, playerX, creatureY - offsetY, barW, barH, this.playerCreature);
        // CPU
        this._drawMiniHPBar(ctx, cpuX, creatureY - offsetY, barW, barH, this.cpuCreature);
    },

    _drawMiniHPBar(ctx, cx, y, barW, barH, creature) {
        const x = cx - barW / 2;
        const ratio = Math.max(0, Math.min(1, creature.currentHp / creature.maxHp));
        // Name
        UI.textOutline(ctx, creature.creatureName, cx, y - 8, {
            color: '#fff', size: 15, bold: true, align: 'center'
        });
        // Bar (reuse UI.drawHPBar if available, else fallback)
        if (UI.drawHPBar) {
            UI.drawHPBar(ctx, x, y, barW, barH, ratio);
        } else {
            ctx.fillStyle = '#222';
            UI.roundRect(ctx, x, y, barW, barH, 4);
            ctx.fill();
            ctx.fillStyle = ratio > 0.5 ? '#44dd66' : ratio > 0.25 ? '#ffaa33' : '#dd3333';
            UI.roundRect(ctx, x, y, barW * ratio, barH, 4);
            ctx.fill();
        }
        // HP number
        UI.textOutline(ctx, `${creature.currentHp}/${creature.maxHp}`, cx, y + barH + 12, {
            color: '#eee', size: 12, bold: true, align: 'center'
        });
    },

    // ─── RENDER: TAP TO PLAY ───
    _renderTapToPlay(ctx, w, h) {
        const blink = Math.sin(this.animTimer * 0.004) > 0;
        if (blink) {
            // Swipe up indicator
            ctx.save();
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 15;
            UI.text(ctx, 'TOCCA PER GIOCARE', w / 2, h * 0.75, {
                color: '#ffcc00', size: 26, bold: true, align: 'center'
            });
            ctx.restore();
            // Arrow up hint
            const arrowBob = Math.sin(this.animTimer * 0.005) * 8;
            UI.text(ctx, '▲', w / 2, h * 0.7 + arrowBob, {
                color: 'rgba(255,204,0,0.5)', size: 30, align: 'center'
            });
        }
    },

    // ─── RENDER: ACTION SELECT ───
    _renderActionSelect(ctx, w, h) {
        // Darken the scene under the action picker
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, h * 0.52, w, h * 0.48);

        // Title
        UI.text(ctx, 'AZIONE', w / 2, h * 0.58, {
            color: '#ffcc00', size: 26, bold: true, align: 'center'
        });

        // Element matchup hint
        if (this.playerCreature && this.cpuCreature && this.playerCreature.element && this.cpuCreature.element) {
            const atkEl = Creatures.ELEMENTS[this.playerCreature.element];
            let hintText = '', hintColor = '#aaa';
            if (atkEl && atkEl.strong === this.cpuCreature.element) { hintText = 'Super efficace!'; hintColor = '#44ff88'; }
            else if (atkEl && atkEl.weak === this.cpuCreature.element) { hintText = 'Poco efficace...'; hintColor = '#ff8844'; }
            if (hintText) {
                UI.text(ctx, hintText, w / 2, h * 0.62, {
                    color: hintColor, size: 15, bold: true, align: 'center'
                });
            }
        }

        // Cards: 3 stacked buttons
        const cardW = w - 60;
        const cardH = 64;
        const gap = 12;
        const startY = h * 0.66;
        const startX = 30;

        for (let i = 0; i < this.ACTIONS.length; i++) {
            const a = this.ACTIONS[i];
            const available = this._isActionAvailable(a.id);
            const selected = i === this.selectIndex;
            const y = startY + i * (cardH + gap);

            // Background
            ctx.fillStyle = !available ? 'rgba(40,40,60,0.5)'
                          : selected ? 'rgba(160,160,255,0.25)'
                          : 'rgba(20,20,50,0.75)';
            UI.roundRect(ctx, startX, y, cardW, cardH, 14);
            ctx.fill();
            ctx.strokeStyle = selected ? a.color : 'rgba(255,255,255,0.2)';
            ctx.lineWidth = selected ? 3 : 1.5;
            UI.roundRect(ctx, startX, y, cardW, cardH, 14);
            ctx.stroke();

            // Icon
            ctx.font = '28px Nunito, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(a.icon, startX + 36, y + 42);

            // Label + hint
            UI.text(ctx, a.label + (available ? '' : '  (usato)'), startX + 72, y + 26, {
                color: available ? '#fff' : '#888', size: 18, bold: true
            });
            if (a.hint && available) {
                UI.text(ctx, a.hint(this.playerCreature), startX + 72, y + 48, {
                    color: '#bbb', size: 13
                });
            }
        }
    },

    // ─── RENDER: ELEMENT PICK ───
    _renderElementPick(ctx, w, h) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, h * 0.5, w, h * 0.5);
        UI.text(ctx, 'SCEGLI ELEMENTO', w / 2, h * 0.58, {
            color: '#ffcc00', size: 24, bold: true, align: 'center'
        });
        UI.text(ctx, 'Tocca Indietro per annullare', w / 2, h * 0.63, {
            color: '#889', size: 13, align: 'center'
        });

        const elementIds = Object.keys(Creatures.ELEMENTS);
        const btnSize = 96;
        const gap = 10;
        const totalW = btnSize * elementIds.length + gap * (elementIds.length - 1);
        const startX = (w - totalW) / 2;
        const btnY = h * 0.68;

        for (let i = 0; i < elementIds.length; i++) {
            const el = Creatures.ELEMENTS[elementIds[i]];
            const bx = startX + i * (btnSize + gap);
            const selected = i === this.selectIndex;

            ctx.fillStyle = selected ? el.color : 'rgba(20,20,50,0.8)';
            UI.roundRect(ctx, bx, btnY, btnSize, btnSize, 14);
            ctx.fill();
            ctx.strokeStyle = selected ? '#fff' : 'rgba(255,255,255,0.25)';
            ctx.lineWidth = selected ? 3 : 1.5;
            UI.roundRect(ctx, bx, btnY, btnSize, btnSize, 14);
            ctx.stroke();

            ctx.font = '36px Nunito, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(el.icon, bx + btnSize / 2, btnY + btnSize * 0.55);
            UI.text(ctx, el.name, bx + btnSize / 2, btnY + btnSize - 10, {
                color: '#fff', size: 12, bold: true, align: 'center'
            });
        }
    },

    // ─── RENDER: MORRA BUTTONS ───
    _renderMorraButtons(ctx, w, h) {
        const btnSize = 160;
        const gap = 20;
        const totalW = btnSize * 3 + gap * 2;
        const startX = (w - totalW) / 2;
        const btnY = h * 0.6; // Centered vertically in lower half
        const t = this.phaseTimer;

        // Pop-in animation for each button (staggered)
        const popDuration = 300;
        const stagger = 80;

        // Title with glow
        ctx.save();
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 12;
        UI.text(ctx, 'SCEGLI LA MORRA!', w / 2, btnY - 20, {
            color: '#ffcc00', size: 16, bold: true, align: 'center', noShadow: true
        });
        ctx.restore();

        const colors = [
            { bg: '#2244aa', glow: '#4488ff', border: '#6699ff', name: 'CARTA' },    // Blue
            { bg: '#aa4422', glow: '#ff6644', border: '#ff8866', name: 'SASSO' },    // Red
            { bg: '#228844', glow: '#44cc66', border: '#66ee88', name: 'FORBICE' }   // Green
        ];

        for (let i = 0; i < 3; i++) {
            const bx = startX + i * (btnSize + gap) + btnSize / 2;
            const by = btnY + btnSize / 2;
            const selected = i === this.selectIndex;
            const col = colors[i];

            // Pop-in bounce (easeOutBack)
            const popT = Math.min(1, Math.max(0, (t - i * stagger) / popDuration));
            const popScale = popT < 1 ? this._easeOutBack(popT) : 1;

            if (popScale <= 0) continue;

            // Selected: continuous juice
            let scale = popScale;
            let yOff = 0;
            if (selected) {
                scale *= 1.08 + Math.sin(this.animTimer * 0.008) * 0.05;
                yOff = Math.sin(this.animTimer * 0.006) * 4;
            } else {
                scale *= 0.92;
            }

            ctx.save();
            ctx.translate(bx, by + yOff);
            ctx.scale(scale, scale);

            // Glow behind selected
            if (selected) {
                const flashGlow = this._selectFlash > 0 && this._selectFlashIndex === i ? 40 : 20;
                ctx.shadowColor = col.glow;
                ctx.shadowBlur = flashGlow;
            }

            // Button background — gradient circle
            const grad = ctx.createRadialGradient(0, -10, 5, 0, 10, btnSize * 0.55);
            grad.addColorStop(0, col.border);
            grad.addColorStop(1, col.bg);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, btnSize * 0.44, 0, Math.PI * 2);
            ctx.fill();

            // Border
            ctx.strokeStyle = selected ? '#fff' : col.border;
            ctx.lineWidth = selected ? 3 : 1.5;
            ctx.stroke();

            ctx.shadowBlur = 0;

            // Selection flash pulse
            if (selected && this._selectFlash > 0 && this._selectFlashIndex === i) {
                ctx.fillStyle = `rgba(255,255,255,${this._selectFlash / 600})`;
                ctx.beginPath();
                ctx.arc(0, 0, btnSize * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Sparkles on selected
            if (selected) {
                for (let s = 0; s < 4; s++) {
                    const angle = (this.animTimer * 0.003 + s * Math.PI / 2);
                    const sr = btnSize * 0.5 + Math.sin(this.animTimer * 0.005 + s) * 5;
                    const sx = Math.cos(angle) * sr;
                    const sy = Math.sin(angle) * sr;
                    const sparkAlpha = 0.4 + Math.sin(this.animTimer * 0.008 + s * 2) * 0.4;
                    ctx.fillStyle = `rgba(255,255,255,${sparkAlpha})`;
                    ctx.beginPath();
                    ctx.arc(sx, sy, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Draw icon
            this._drawMorraIcon(ctx, i, selected);

            // Label below
            ctx.fillStyle = selected ? '#fff' : '#aaa';
            ctx.font = selected ? 'bold 18px Nunito, sans-serif' : '16px Nunito, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(col.name, 0, btnSize * 0.44 + 16);

            ctx.restore();
        }

        ctx.textAlign = 'left';
    },

    _easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },

    // Draw hand-drawn style morra icons
    _drawMorraIcon(ctx, type, selected) {
        const size = 40;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        switch (type) {
            case 0: // CARTA — open hand / paper sheet
                ctx.fillStyle = '#e8e0d0';
                // Paper sheet
                this._roundRect(ctx, -size * 0.6, -size * 0.7, size * 1.2, size * 1.4, 4);
                ctx.fill();
                ctx.strokeStyle = '#aaa';
                ctx.lineWidth = 1;
                ctx.stroke();
                // Lines on paper
                ctx.strokeStyle = '#bbb';
                ctx.lineWidth = 1;
                for (let l = 0; l < 4; l++) {
                    const ly = -size * 0.4 + l * size * 0.3;
                    ctx.beginPath();
                    ctx.moveTo(-size * 0.35, ly);
                    ctx.lineTo(size * 0.35, ly);
                    ctx.stroke();
                }
                // Fold corner
                ctx.fillStyle = '#d0c8b8';
                ctx.beginPath();
                ctx.moveTo(size * 0.6, -size * 0.7);
                ctx.lineTo(size * 0.25, -size * 0.7);
                ctx.lineTo(size * 0.6, -size * 0.35);
                ctx.closePath();
                ctx.fill();
                break;

            case 1: // SASSO — fist / rock
                // Rock shape
                ctx.fillStyle = '#8a7a6a';
                ctx.beginPath();
                ctx.moveTo(-size * 0.5, size * 0.3);
                ctx.quadraticCurveTo(-size * 0.7, -size * 0.2, -size * 0.3, -size * 0.6);
                ctx.quadraticCurveTo(0, -size * 0.8, size * 0.3, -size * 0.6);
                ctx.quadraticCurveTo(size * 0.7, -size * 0.2, size * 0.5, size * 0.3);
                ctx.quadraticCurveTo(0, size * 0.6, -size * 0.5, size * 0.3);
                ctx.closePath();
                ctx.fill();
                // Highlight
                ctx.fillStyle = '#a09080';
                ctx.beginPath();
                ctx.ellipse(-size * 0.15, -size * 0.2, size * 0.25, size * 0.2, -0.3, 0, Math.PI * 2);
                ctx.fill();
                // Cracks
                ctx.strokeStyle = '#6a5a4a';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-size * 0.1, -size * 0.1);
                ctx.lineTo(size * 0.15, size * 0.15);
                ctx.lineTo(size * 0.05, size * 0.1);
                ctx.stroke();
                // Shadow
                ctx.fillStyle = '#5a4a3a';
                ctx.beginPath();
                ctx.ellipse(0, size * 0.35, size * 0.4, size * 0.08, 0, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 2: // FORBICE — scissors
                ctx.strokeStyle = '#ccc';
                ctx.lineWidth = 3;
                // Left blade
                ctx.beginPath();
                ctx.moveTo(0, size * 0.1);
                ctx.lineTo(-size * 0.45, -size * 0.6);
                ctx.stroke();
                // Right blade
                ctx.beginPath();
                ctx.moveTo(0, size * 0.1);
                ctx.lineTo(size * 0.45, -size * 0.6);
                ctx.stroke();
                // Blade tips (triangles)
                ctx.fillStyle = '#ddd';
                ctx.beginPath();
                ctx.moveTo(-size * 0.45, -size * 0.6);
                ctx.lineTo(-size * 0.55, -size * 0.5);
                ctx.lineTo(-size * 0.35, -size * 0.5);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(size * 0.45, -size * 0.6);
                ctx.lineTo(size * 0.55, -size * 0.5);
                ctx.lineTo(size * 0.35, -size * 0.5);
                ctx.closePath();
                ctx.fill();
                // Handles (circles)
                ctx.strokeStyle = '#ff6060';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.ellipse(-size * 0.18, size * 0.35, size * 0.15, size * 0.2, -0.2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(size * 0.18, size * 0.35, size * 0.15, size * 0.2, 0.2, 0, Math.PI * 2);
                ctx.stroke();
                // Pivot screw
                ctx.fillStyle = '#aaa';
                ctx.beginPath();
                ctx.arc(0, size * 0.1, size * 0.06, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    },

    // ─── RENDER: COUNTDOWN ───
    _renderCountdown(ctx, w, h) {
        // Darken
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, w, h);

        const t = this.phaseTimer;
        let num = t < 400 ? '3' : t < 800 ? '2' : '1';
        const phaseInCount = t % 400;
        const scale = 1.5 - (phaseInCount / 400) * 0.5; // Start big, shrink
        const alpha = 1 - (phaseInCount / 400) * 0.3;

        ctx.save();
        ctx.translate(w / 2, h * 0.4);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 60px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(num, 0, 20);
        ctx.restore();
        ctx.globalAlpha = 1;

        // Two card backs sliding in
        const slideProgress = Math.min(1, t / 800);
        const cardW = 120;
        const cardH = 160;
        const cardY = h * 0.62;

        // Player card from left
        const pCardX = -cardW + slideProgress * (w * 0.3);
        ctx.fillStyle = '#2244aa';
        this._roundRect(ctx, pCardX, cardY, cardW, cardH, 8);
        ctx.fill();
        ctx.strokeStyle = '#4466cc'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#3355bb';
        ctx.font = '24px Nunito, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('?', pCardX + cardW / 2, cardY + cardH / 2 + 8);

        // CPU card from right
        const cX = w - pCardX - cardW;
        ctx.fillStyle = '#aa2244';
        this._roundRect(ctx, cX, cardY, cardW, cardH, 8);
        ctx.fill();
        ctx.strokeStyle = '#cc4466'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#bb3355';
        ctx.font = '24px Nunito, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('?', cX + cardW / 2, cardY + cardH / 2 + 8);

        ctx.textAlign = 'left';
    },

    // ─── RENDER: EPIC REVEAL ───
    _renderRevealEpic(ctx, w, h) {
        const t = this.phaseTimer;
        const flipProgress = Math.min(1, t / 500); // 0 to 1 over 500ms
        const cardW = 130;
        const cardH = 170;
        const cardY = h * 0.58;
        const pCardX = w * 0.5 - cardW - 15;
        const cCardX = w * 0.5 + 15;

        // Darkened overlay
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, h * 0.52, w, cardH + 60);

        // VS text pulsing
        const vsScale = 0.8 + flipProgress * 0.4;
        ctx.save();
        ctx.translate(w / 2, cardY + cardH / 2);
        ctx.scale(vsScale, vsScale);
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 16px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('VS', 0, 6);
        ctx.restore();

        // Player card - flip animation
        const pScaleX = flipProgress < 0.5
            ? 1 - flipProgress * 2  // Shrink to 0
            : (flipProgress - 0.5) * 2; // Grow back
        const showFront = flipProgress > 0.5;

        ctx.save();
        ctx.translate(pCardX + cardW / 2, cardY + cardH / 2);
        ctx.scale(pScaleX, 1);

        if (showFront) {
            // Front - show choice with drawn icon
            ctx.fillStyle = '#1a2a5a';
            this._roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 8);
            ctx.fill();
            ctx.strokeStyle = '#60b0ff'; ctx.lineWidth = 2; ctx.stroke();
            ctx.save();
            ctx.scale(1.2, 1.2);
            this._drawMorraIcon(ctx, this.playerChoice, true);
            ctx.restore();
            ctx.fillStyle = '#60b0ff';
            ctx.font = 'bold 18px Nunito, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(this.CHOICE_NAMES[this.playerChoice], 0, cardH / 2 - 12);
        } else {
            // Back
            ctx.fillStyle = '#2244aa';
            this._roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 8);
            ctx.fill();
            ctx.strokeStyle = '#4466cc'; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.restore();

        // CPU card - flip animation (slightly delayed)
        const cFlip = Math.min(1, Math.max(0, (t - 100) / 500));
        const cScaleX = cFlip < 0.5
            ? 1 - cFlip * 2
            : (cFlip - 0.5) * 2;
        const cShowFront = cFlip > 0.5;

        ctx.save();
        ctx.translate(cCardX + cardW / 2, cardY + cardH / 2);
        ctx.scale(cScaleX, 1);

        if (cShowFront) {
            ctx.fillStyle = '#5a1a2a';
            this._roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 8);
            ctx.fill();
            ctx.strokeStyle = '#ff6080'; ctx.lineWidth = 2; ctx.stroke();
            ctx.save();
            ctx.scale(1.2, 1.2);
            this._drawMorraIcon(ctx, this.cpuChoice, true);
            ctx.restore();
            ctx.fillStyle = '#ff6080';
            ctx.font = 'bold 18px Nunito, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(this.CHOICE_NAMES[this.cpuChoice], 0, cardH / 2 - 12);
        } else {
            ctx.fillStyle = '#aa2244';
            this._roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 8);
            ctx.fill();
            ctx.strokeStyle = '#cc4466'; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.restore();

        // After both revealed: show winner arrow
        if (flipProgress >= 1 && t > 650) {
            const arrowAlpha = Math.min(1, (t - 650) / 200);
            ctx.globalAlpha = arrowAlpha;

            if (this.playerChoice !== this.cpuChoice) {
                const p = this.playerChoice;
                const c = this.cpuChoice;
                const playerWins = (p === 0 && c === 1) || (p === 1 && c === 2) || (p === 2 && c === 0);
                const fromX = playerWins ? pCardX + cardW : cCardX;
                const toX = playerWins ? cCardX : pCardX + cardW;
                const arrowY = cardY + cardH / 2;

                // Arrow
                ctx.strokeStyle = playerWins ? '#4cff4c' : '#ff4c4c';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(fromX + 5, arrowY);
                ctx.lineTo(toX - 5, arrowY);
                ctx.stroke();
                // Arrowhead
                const dir = playerWins ? 1 : -1;
                ctx.fillStyle = ctx.strokeStyle;
                ctx.beginPath();
                ctx.moveTo(toX - 5, arrowY);
                ctx.lineTo(toX - 15 * dir, arrowY - 8);
                ctx.lineTo(toX - 15 * dir, arrowY + 8);
                ctx.closePath();
                ctx.fill();
            } else {
                // Draw - show = sign
                ctx.fillStyle = '#888';
                ctx.font = 'bold 24px Nunito, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('=', w / 2, cardY + cardH / 2 + 8);
            }

            ctx.globalAlpha = 1;
        }

        ctx.textAlign = 'left';
    },

    // ─── RENDER: EPIC RESOLVE ───
    _renderResolveEpic(ctx, w, h) {
        // Keep showing the revealed cards briefly
        if (this.phaseTimer < 600) {
            this._renderRevealEpic(ctx, w, h);
        }

        // Big result text
        let text = '';
        let color = '#fff';
        let size = 22;

        switch (this.turnResult) {
            case 'win': text = 'VINCI!'; color = '#4cff4c'; break;
            case 'lose': text = 'PERDI!'; color = '#ff4c4c'; break;
            case 'crit': text = this.morraWinner === 1 ? 'CRITICO!!' : 'CRITICO!!'; color = '#ffcc00'; size = 28; break;
            case 'evas': text = 'SCHIVATA!'; color = '#a060ff'; break;
            case 'draw': text = 'PAREGGIO'; color = '#888888'; break;
        }

        if (this.phaseTimer > 200) {
            const popScale = Math.min(1.2, 0.5 + (this.phaseTimer - 200) / 200);
            const settle = this.phaseTimer > 500 ? 1 : popScale;

            ctx.save();
            ctx.translate(w / 2, h * 0.35);
            ctx.scale(settle, settle);

            // Glow behind text
            ctx.shadowColor = color;
            ctx.shadowBlur = 20;
            ctx.fillStyle = color;
            ctx.font = `bold ${size}px Nunito, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(text, 0, 0);
            ctx.shadowBlur = 0;

            ctx.restore();
        }

        ctx.textAlign = 'left';
    },

    // ─── RENDER: FLOATING TEXTS ───
    _renderFloatingTexts(ctx) {
        this.floatingTexts.forEach(ft => {
            const alpha = 1 - (ft.life / ft.maxLife);
            const scale = ft.life < 200 ? 0.5 + (ft.life / 200) * 0.5 : 1;

            ctx.save();
            ctx.translate(ft.x, ft.y);
            ctx.scale(scale, scale);
            ctx.globalAlpha = alpha;
            ctx.shadowColor = ft.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = ft.color;
            ctx.font = `bold ${ft.size}px Nunito, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
        });
        ctx.globalAlpha = 1;
    },

    // ─── POLKA-DOT TRANSITION ───
    _startTransition(color, onMidCallback) {
        this._transition = {
            active: true,
            timer: 0,
            duration: 600,
            color: color || '#000',
            expanding: true,
            onMid: onMidCallback || null,
            midFired: false
        };
    },

    _updateTransition(dt) {
        if (!this._transition.active) return;
        this._transition.timer += dt;

        // Fire callback at midpoint
        if (!this._transition.midFired && this._transition.timer >= this._transition.duration / 2) {
            this._transition.midFired = true;
            if (this._transition.onMid) this._transition.onMid();
        }

        if (this._transition.timer >= this._transition.duration) {
            this._transition.active = false;
        }
    },

    _renderTransition(ctx, w, h) {
        if (!this._transition.active) return;

        const t = this._transition.timer;
        const dur = this._transition.duration;
        const half = dur / 2;

        // Progress: 0→1 expanding, then 1→0 shrinking
        let progress;
        if (t < half) {
            progress = t / half; // 0→1
        } else {
            progress = 1 - (t - half) / half; // 1→0
        }

        // Easing (ease in-out)
        progress = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const maxRadius = Math.max(w, h) * 0.08;
        const radius = maxRadius * progress;
        const spacing = maxRadius * 1.8;
        const cols = Math.ceil(w / spacing) + 2;
        const rows = Math.ceil(h / spacing) + 2;

        ctx.fillStyle = this._transition.color;
        for (let r = -1; r < rows; r++) {
            for (let c = -1; c < cols; c++) {
                const cx = c * spacing + (r % 2) * spacing * 0.5;
                const cy = r * spacing;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    // OLD render methods (kept for reference)
    // ─── RENDER: REVEAL ───
    _renderReveal(ctx, w, h) {
        // Show both choices
        ctx.textAlign = 'center';

        // Player choice
        ctx.font = '20px serif';
        ctx.fillText(this.CHOICE_ICONS[this.playerChoice], w * 0.25, h * 0.72);
        ctx.fillStyle = '#60b0ff';
        ctx.font = '18px Nunito, sans-serif';
        ctx.fillText(this.CHOICE_NAMES[this.playerChoice], w * 0.25, h * 0.72 + 20);

        // CPU choice
        ctx.font = '20px serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(this.CHOICE_ICONS[this.cpuChoice], w * 0.75, h * 0.72);
        ctx.fillStyle = '#ff6080';
        ctx.font = '18px Nunito, sans-serif';
        ctx.fillText(this.CHOICE_NAMES[this.cpuChoice], w * 0.75, h * 0.72 + 20);

        // VS
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 14px Nunito, sans-serif';
        ctx.fillText('VS', w / 2, h * 0.72 + 5);

        ctx.textAlign = 'left';
    },

    // ─── RENDER: RESOLVE ───
    _renderResolve(ctx, w, h) {
        // Show choices still
        this._renderReveal(ctx, w, h);

        // Result text
        let text = '';
        let color = '#fff';

        switch (this.turnResult) {
            case 'win':
                text = `VINCI! -${this.turnDamage} HP`;
                color = '#4caf50';
                break;
            case 'lose':
                text = `PERDI! -${this.turnDamage} HP`;
                color = '#f44336';
                break;
            case 'crit':
                if (this.morraWinner === 1) {
                    text = `CRITICO! -${this.turnDamage} HP`;
                    color = '#ffcc00';
                } else {
                    text = `CRITICO! -${this.turnDamage} HP`;
                    color = '#ff6600';
                }
                break;
            case 'evas':
                text = 'SCHIVATA!';
                color = '#a060ff';
                break;
            case 'draw':
                text = 'PAREGGIO!';
                color = '#888';
                break;
        }

        // Big feedback text
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, h * 0.35, w, 40);
        ctx.fillStyle = color;
        ctx.font = 'bold 18px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, w / 2, h * 0.35 + 28);
        ctx.textAlign = 'left';
    },

    // ─── RENDER: BETWEEN TURNS ───
    _renderBetweenTurns(ctx, w, h) {
        // Transition effect
        const alpha = Math.min(1, this.phaseTimer / 300);
        ctx.fillStyle = `rgba(10,10,30,${0.3 * (1 - alpha)})`;
        ctx.fillRect(0, 0, w, h);
    },

    // ─── RENDER: ROUND END ───
    _renderRoundEnd(ctx, w, h) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, w, h);

        const playerWon = this.playerRoundWins > this.cpuRoundWins ||
            (this.playerCreature && this.cpuCreature && this.cpuCreature.currentHp <= 0);

        // Check who actually won this round
        let lastWinner = '';
        if (this.cpuCreature && this.cpuCreature.currentHp <= 0) lastWinner = 'player';
        else if (this.playerCreature && this.playerCreature.currentHp <= 0) lastWinner = 'cpu';
        else if (this.playerMorraWins >= 3) lastWinner = 'player';
        else if (this.cpuMorraWins >= 3) lastWinner = 'cpu';
        else lastWinner = this.playerCreature.currentHp > this.cpuCreature.currentHp ? 'player' : 'cpu';

        const text = lastWinner === 'player' ? 'ROUND VINTO!' : 'ROUND PERSO!';
        const color = lastWinner === 'player' ? '#44ee66' : '#ff4444';

        UI.textOutline(ctx, text, w / 2, h / 2 - 20, {
            color: color, size: 40, bold: true, align: 'center', outlineWidth: 5
        });

        UI.textOutline(ctx, `${this.playerRoundWins} - ${this.cpuRoundWins}`, w / 2, h / 2 + 30, {
            color: '#fff', size: 28, bold: true, align: 'center'
        });

        if (this.phaseTimer > 2000) {
            UI.textOutline(ctx, 'Tocca per continuare', w / 2, h / 2 + 80, {
                color: '#ccc', size: 20, align: 'center'
            });
        }
    },

    // ─── RENDER: MATCH END ───
    _renderMatchEnd(ctx, w, h) {
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, w, h);

        const playerWon = this.playerRoundWins >= this.roundsToWin;
        const text = playerWon ? 'VITTORIA!' : 'SCONFITTA!';
        const color = playerWon ? '#ffcc00' : '#f44336';

        // Big title
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 25;
        UI.text(ctx, text, w / 2, h * 0.2, {
            color: color, size: 46, bold: true, align: 'center', noShadow: true
        });
        ctx.restore();

        UI.text(ctx, `Round: ${this.playerRoundWins} - ${this.cpuRoundWins}`, w / 2, h * 0.27, {
            color: '#ccc', size: 20, align: 'center'
        });

        // Match results
        const r = this._matchResults;
        if (r && r.won) {
            let resultY = h * 0.35;

            // XP gained
            UI.drawCard(ctx, 40, resultY, w - 80, 60, { bgColor: 'rgba(255,200,50,0.12)', borderColor: '#ffcc00' });
            UI.text(ctx, `+${r.xpGained} XP guadagnati!`, w / 2, resultY + 38, {
                color: '#ffcc00', size: 22, bold: true, align: 'center'
            });
            resultY += 80;

            // Level ups
            r.levelUps.forEach(lu => {
                UI.drawCard(ctx, 40, resultY, w - 80, 50, { bgColor: 'rgba(100,200,255,0.12)', borderColor: '#60b0ff' });
                UI.text(ctx, `${lu.name} sale a Lv.${lu.newLevel}!`, w / 2, resultY + 32, {
                    color: '#60b0ff', size: 20, bold: true, align: 'center'
                });
                resultY += 60;
            });

            // Capture
            if (r.captured) {
                UI.drawCard(ctx, 40, resultY, w - 80, 80, { bgColor: 'rgba(100,255,100,0.15)', borderColor: '#44cc66' });
                Creatures.drawCreature(ctx, 90, resultY + 40, r.captured, 22, 'idle', this.animTimer);
                UI.text(ctx, `${r.captured.creatureName} catturato!`, w / 2 + 20, resultY + 35, {
                    color: '#44cc66', size: 22, bold: true, align: 'center'
                });
                UI.text(ctx, 'Aggiunto alla collezione!', w / 2 + 20, resultY + 58, {
                    color: '#aaa', size: 14, align: 'center'
                });
                resultY += 90;
            }
        }

        if (this.phaseTimer > 2000) {
            UI.text(ctx, 'Tocca per continuare', w / 2, h - 80, {
                color: '#888', size: 18, align: 'center'
            });
        }
    },

    // ─── RENDER: SCORE ───
    _renderScore(ctx, w) {
        // Match score in top bar
    },

    _getAnimOffset(anim, animTimer, flipped) {
        let x = 0, y = 0, scale = 1, rotation = 0;
        const t = animTimer;
        const dir = flipped ? -1 : 1;

        switch (anim) {
            case 'sasso':
                // SASSO: Earthquake slam! Jump high → slam down → ground shake
                if (t < 150) {
                    // Crouch
                    y = 15 * (t / 150);
                    scale = 0.8;
                } else if (t < 400) {
                    // LAUNCH into the sky
                    const p = (t - 150) / 250;
                    y = -80 * Math.sin(p * Math.PI);
                    x = dir * 30 * p;
                    scale = 1.3;
                    rotation = dir * p * Math.PI; // Half spin
                } else if (t < 500) {
                    // SLAM DOWN
                    const p = (t - 400) / 100;
                    y = -80 * (1 - p) * (1 - p);
                    x = dir * 30;
                    scale = 1.3 - 0.2 * p;
                    rotation = dir * Math.PI * (1 - p * 0.5);
                } else if (t < 700) {
                    // Ground vibration
                    const p = (t - 500) / 200;
                    x = dir * 30 * (1 - p);
                    y = Math.sin(p * Math.PI * 8) * 6 * (1 - p);
                    scale = 1.1;
                    rotation = Math.sin(p * Math.PI * 6) * 0.08;
                } else {
                    x = dir * 5;
                    scale = 1;
                }
                break;

            case 'carta':
                // CARTA: Elegant sweep! Spin like paper in wind → wrap around
                if (t < 100) {
                    // Float up
                    y = -20 * (t / 100);
                    scale = 1.1;
                } else if (t < 400) {
                    // Spiral forward like paper caught in wind
                    const p = (t - 100) / 300;
                    x = dir * 60 * p;
                    y = -20 + Math.sin(p * Math.PI * 3) * 25;
                    rotation = dir * p * Math.PI * 3; // 1.5 full spins!
                    scale = 1 + Math.sin(p * Math.PI) * 0.2;
                } else if (t < 600) {
                    // Float back gracefully
                    const p = (t - 400) / 200;
                    x = dir * 60 * (1 - p);
                    y = -10 * (1 - p);
                    rotation = dir * Math.PI * 3 * (1 - p * 0.7);
                    scale = 1.05;
                } else {
                    x = dir * 5;
                    scale = 1;
                }
                break;

            case 'forbice':
                // FORBICE: Lightning dash! Zip forward → slice → zip back
                if (t < 80) {
                    // Crouch then DASH
                    y = 5;
                    scale = 0.9;
                } else if (t < 200) {
                    // LIGHTNING DASH forward
                    const p = (t - 80) / 120;
                    x = dir * 90 * p;
                    y = -15;
                    scale = 0.85;
                    rotation = dir * 0.3;
                } else if (t < 350) {
                    // SLASH! Zigzag
                    const p = (t - 200) / 150;
                    x = dir * 90;
                    y = -15 + Math.sin(p * Math.PI * 4) * 20;
                    rotation = Math.sin(p * Math.PI * 4) * 0.4;
                    scale = 1.15;
                } else if (t < 550) {
                    // Zip back
                    const p = (t - 350) / 200;
                    x = dir * 90 * (1 - p);
                    y = -5 * (1 - p);
                    rotation = 0;
                    scale = 1;
                } else {
                    x = 0;
                    scale = 1;
                }
                break;

            case 'win':
                // VICTORY: Triple backflip celebration!
                if (t < 200) {
                    // Launch
                    const p = t / 200;
                    y = -60 * p;
                    scale = 1 + 0.3 * p;
                } else if (t < 700) {
                    // TRIPLE BACKFLIP
                    const p = (t - 200) / 500;
                    y = -60 + 20 * Math.sin(p * Math.PI);
                    rotation = dir * p * Math.PI * 6; // 3 full flips!
                    scale = 1.2 + Math.sin(p * Math.PI * 6) * 0.1;
                    x = Math.sin(p * Math.PI * 2) * 15;
                } else if (t < 900) {
                    // Land with bounce
                    const p = (t - 700) / 200;
                    y = -10 * Math.sin(p * Math.PI * 2) * (1 - p);
                    scale = 1.15 - 0.15 * p;
                    rotation = 0;
                    x = Math.sin(p * Math.PI * 3) * 8 * (1 - p);
                } else {
                    y = 0;
                    scale = 1.05;
                }
                break;

            case 'lose':
                // LOSE: Violent knockback + tumble
                if (t < 100) {
                    // Impact frame — squish
                    scale = 0.7;
                    x = -dir * 10;
                } else if (t < 350) {
                    // Launched backwards tumbling
                    const p = (t - 100) / 250;
                    x = -dir * 70 * p;
                    y = -30 * Math.sin(p * Math.PI);
                    rotation = -dir * p * Math.PI * 2; // Full tumble
                    scale = 0.85;
                } else if (t < 600) {
                    // Bounce on ground
                    const p = (t - 350) / 250;
                    x = -dir * 70 * (1 - p * 0.5);
                    y = Math.abs(Math.sin(p * Math.PI * 3)) * 15 * (1 - p);
                    rotation = -dir * Math.PI * 2 * (1 - p);
                    scale = 0.9 + 0.1 * p;
                } else {
                    x = -dir * 35;
                    y = 0;
                    scale = 0.95;
                }
                break;

            case 'crit':
                // CRITICAL: Teleport behind + MEGA slam
                if (t < 100) {
                    // Vanish (shrink to nothing)
                    scale = 1 - t / 100;
                } else if (t < 200) {
                    // Reappear BEHIND enemy
                    const p = (t - 100) / 100;
                    x = dir * 120;
                    scale = p;
                    y = -20;
                } else if (t < 350) {
                    // MEGA SLAM with double spin
                    const p = (t - 200) / 150;
                    x = dir * 120 * (1 - p);
                    y = -20 - 50 * Math.sin(p * Math.PI);
                    rotation = dir * p * Math.PI * 4; // DOUBLE 360!
                    scale = 1.4;
                } else if (t < 500) {
                    // Impact shockwave
                    const p = (t - 350) / 150;
                    x = dir * 15 * Math.sin(p * Math.PI * 6) * (1 - p);
                    y = 5 * (1 - p);
                    scale = 1.4 - 0.3 * p;
                    rotation = Math.sin(p * Math.PI * 4) * 0.15 * (1 - p);
                } else {
                    x = 0;
                    scale = 1.1;
                }
                break;

            case 'evas':
                // EVADE: Matrix dodge + backflip return
                if (t < 100) {
                    // Lean back (matrix style)
                    rotation = -dir * 0.5 * (t / 100);
                    y = 10 * (t / 100);
                } else if (t < 250) {
                    // DASH sideways
                    const p = (t - 100) / 150;
                    x = -dir * 80 * p;
                    y = 10 - 30 * p;
                    rotation = -dir * 0.5;
                    scale = 0.9;
                } else if (t < 500) {
                    // Flip back to position
                    const p = (t - 250) / 250;
                    x = -dir * 80 * (1 - p);
                    y = -20 + 20 * p;
                    rotation = -dir * (0.5 - p * 0.5) + dir * p * Math.PI * 2;
                    scale = 1;
                } else {
                    x = 0; y = 0; scale = 1; rotation = 0;
                }
                break;

            case 'draw':
                // DRAW: Confused wobble dance
                y = Math.sin(t * 0.015) * 15;
                x = Math.cos(t * 0.01) * 12;
                scale = 1 + Math.sin(t * 0.012) * 0.1;
                rotation = Math.sin(t * 0.008) * 0.3;
                break;

            case 'death':
                // DEATH: Dramatic spiral into the ground
                if (t < 200) {
                    // Float up
                    y = -25 * (t / 200);
                    scale = 1.2;
                } else if (t < 600) {
                    // Spiral down
                    const p = (t - 200) / 400;
                    y = -25 + 50 * p;
                    rotation = dir * p * Math.PI * 4; // 2 full spins
                    scale = 1.2 - 0.7 * p;
                    x = Math.sin(p * Math.PI * 4) * 20 * (1 - p);
                } else {
                    y = 25;
                    scale = 0.5;
                    rotation = dir * Math.PI * 4;
                }
                break;
        }

        return { x, y, scale, rotation };
    },

    // DEPRECATED - now uses Creatures.drawCreature
    _renderCreature_old(ctx, x, y, creature, anim, animTimer, flipped) {
        const bob = anim === 'idle' ? Math.sin(animTimer * 0.003) * 3 : 0;
        let offsetX = 0;
        let offsetY = 0;
        let scale = 1;

        // Animation offsets
        switch (anim) {
            case 'carta':
            case 'sasso':
            case 'forbice':
                offsetX = flipped ? -10 : 10;
                break;
            case 'win':
                offsetY = -8;
                scale = 1.1;
                break;
            case 'lose':
                offsetX = flipped ? 5 : -5;
                offsetY = 3;
                scale = 0.95;
                break;
            case 'crit':
                offsetX = flipped ? -15 : 15;
                offsetY = -10;
                scale = 1.15;
                break;
            case 'evas':
                offsetX = flipped ? 20 : -20;
                offsetY = -5;
                break;
            case 'draw':
                offsetY = Math.sin(animTimer * 0.01) * 5;
                break;
            case 'death':
                offsetY = 15;
                scale = 0.7;
                break;
        }

        const cx = x + offsetX;
        const cy = y + bob + offsetY;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(flipped ? -scale : scale, scale);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 35, 22, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = creature.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 25, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Face
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-7, -5, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(7, -5, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(-5, -4, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(9, -4, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Mouth
        if (anim === 'win' || anim === 'crit') {
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 5, 6, 0, Math.PI);
            ctx.stroke();
        } else if (anim === 'lose' || anim === 'death') {
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 10, 5, Math.PI, 0);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.ellipse(0, 6, 3, 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Death X eyes
        if (anim === 'death') {
            ctx.strokeStyle = '#f44';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(-4, -2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(-10, -2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(4, -8); ctx.lineTo(10, -2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(4, -2); ctx.stroke();
        }

        // Crit effect
        if (anim === 'crit') {
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 2;
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2 + animTimer * 0.005;
                const r = 30;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * (r - 5), Math.sin(angle) * (r - 5) - 5);
                ctx.lineTo(Math.cos(angle) * (r + 5), Math.sin(angle) * (r + 5) - 5);
                ctx.stroke();
            }
        }

        ctx.restore();

        // Name below
        ctx.fillStyle = '#fff';
        ctx.font = '16px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(creature.creatureName, x, y + 50);
        ctx.textAlign = 'left';
    },

    // ─── HELPERS ───
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
    },

    _drawCreatureIcon(ctx, x, y, color, size) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x - 5, y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 5, y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(x - 4, y - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 6, y - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
};
