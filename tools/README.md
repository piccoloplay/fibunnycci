# tools/

Script di utilità per asset pipeline FiBunnyCci.

## split_tileset.py

Taglia una tileset / spritesheet generata (es. da ChatGPT / DALL·E)
in singoli PNG ridimensionati e — opzionalmente — con chroma-key
trasparente sul magenta.

### Installazione

```bash
pip install Pillow
```

### Uso

**Modalità 1 — griglia uniforme** (quando GPT produce davvero una
griglia pulita):

```bash
python tools/split_tileset.py \
    --image assets/sprites/raw/urban_4x4.png \
    --grid 4 4 \
    --names tools/names_textures_4x4.txt \
    --resize 64 \
    --out assets/tiles/urban/
```

Produce 16 file `assets/tiles/urban/grass.png`, `dirt.png`, ecc.,
ciascuno 64×64 px.

**Modalità 2 — bounding box manuali** (quando GPT produce celle
non uniformi — il caso reale attuale):

```bash
python tools/split_tileset.py \
    --image assets/sprites/raw/traditional_mixed.png \
    --boxes tools/traditional_boxes.json \
    --chroma ff00ff \
    --out assets/sprites/props/
```

Il JSON elenca ogni tile/prop con `{name, x, y, w, h}` in pixel
sull'immagine originale. Vedi `boxes_example.json`.

### Flag utili

| Flag | Cosa fa |
|---|---|
| `--resize N` | ridimensiona ogni output a N×N pixel con **nearest-neighbour** (mantiene crisp il pixel art) |
| `--chroma HEX` | rende trasparenti tutti i pixel vicini al colore (tolleranza ±12), es. `--chroma ff00ff` per il magenta dei nostri sprite |
| `--trim` | dopo il taglio, rimuove i bordi completamente trasparenti |
| `--out DIR` | directory di output (default `./out`) |

### Workflow tipico

1. Carichi il PNG grezzo generato da GPT in `assets/sprites/raw/`.
2. Apri l'immagine in un editor qualsiasi (Preview, GIMP, Photoshop,
   squoosh.app) e annoti le coordinate di ogni tile/prop.
3. Scrivi `tools/<pack>_boxes.json` seguendo `boxes_example.json`.
4. Lanci lo script.
5. I PNG finiti vanno referenziati dal `AssetLoader` nel gioco
   (prossimo passo del codice).

### Tip: trovare le coordinate velocemente

Con macOS Preview → **Tools → Show Inspector → Crop Tool**: selezioni
il tile, in basso leggi `Position: X Y` e `Size: W × H`. Annoti.

Alternativamente con Python veloce (in un notebook):

```python
from PIL import Image
im = Image.open('raw.png')
print(im.size)  # totale canvas
# poi stampi regioni: im.crop((x,y,x+w,y+h)).show()
```
