# assets/

Immagini del gioco. Struttura:

```
assets/
├── sprites/
│   ├── raw/             ← CARICA QUI le PNG generate da ChatGPT
│   ├── characters/      ← sprite player + NPC (ritagliati da raw/)
│   ├── creatures/       ← 12 creature zodiaco (ritagliate da raw/)
│   ├── props/           ← oggetti decorativi (edifici, lanterne, ecc.)
│   └── backgrounds/     ← sfondi combattimento
└── tiles/
    ├── urban/           ← texture base città moderna
    ├── traditional/     ← texture base villaggio/foresta/tempio
    └── …
```

## Convenzione nomi file in `sprites/raw/`

Carica ogni PNG in `sprites/raw/` con **questi nomi esatti**
(minuscolo, underscore, niente spazi):

### Tileset / props già generati
- `tileset_urban.png` — il tuo pack urbano
- `tileset_traditional.png` — il tuo pack tradizionale (villaggio/props)

### Texture base (quando ri-generi con prompt corretto)
- `textures_natural_4x4.png` — 4×4 di 256×256: erba, sterrato, sabbia, acqua, pietra, legno…
- `textures_urban_4x4.png` — 4×4 urbane: asfalto, marciapiede, strisce, rotaie…

### Player
- `player_piccoloplay.png` — sprite sheet 1024×1024, 4×3, Piccoloplay

### 12 Creature dello zodiaco (un file ciascuna)
Stato attuale:
- ✅ `creature_coniglio.png` → processato in `creatures/creature_coniglio_{acqua,fuoco,legno,metallo,terra}.png`
- 🟡 Nella root del repo, ancora da spostare in `sprites/raw/` e processare con `tools/split_creature_variants.py`:
  - `Dog.png` → `creature_cane.png`
  - `Dragon.png` → `creature_drago.png`
  - `Horse.png` → `creature_cavallo.png`
  - `Monkey.png` → `creature_scimmia.png`
  - `Oz.png` → `creature_bue.png`
  - `Tiger.png` → `creature_tigre.png`
- ⬜ Da creare: `creature_topo.png`, `creature_serpente.png`, `creature_maiale.png`, `creature_gallo.png`, `creature_capra.png`

Nomi "brand" (Aqualop, Ironrat, Pyropony, Dracofibo, Vinesnake, Terrabull,
Emberclaw, Bambooki, Flamepig, Goldcluck, Sandpup, Lunabaa) sono i nomi
elementali: la stessa base animale cambia nome a seconda dell'elemento.

### NPC principali
- `npc_kebabbaro.png`       — il kebabbaro di Arezzo
- `npc_lucertola_sensei.png` — maestro lucertola
- `npc_bulla_reale.png`     — bulla del cap 1
- `npc_anticristo.png`      — boss finale (cap 4)

### Boss
- `boss_shawarmon.png`      — alieno kebab cap 2
- `boss_basilisko.png`      — drago-server cap 3

### Sfondi combattimento (1536×1024, landscape)
- `bg_villaggio.png`
- `bg_foresta.png`
- `bg_montagna.png`
- `bg_tempio.png`
- `bg_citta.png`

## Workflow

1. Carichi un file in `sprites/raw/` via GitHub web UI.
2. Mi dici "caricato X".
3. Io scrivo il `.json` delle bounding box (per tileset/spritesheet)
   o configuro il `--grid` (per file uniformi).
4. Lancio `tools/split_tileset.py` e il ritaglio finisce nelle
   cartelle `tiles/`, `sprites/characters/`, `sprites/creatures/`…
5. Quando abbiamo abbastanza asset, aggiungo `AssetLoader` al
   gioco che li preloada e li usa al posto degli sprite procedurali.
