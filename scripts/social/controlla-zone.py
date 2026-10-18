"""Controlla che i testi di un Reel stiano nella zona libera di tutti i social (margini più severi tra le fonti, 17/10/2026).

Uso: uv run -q --with pillow python3 scripts/controlla-zone.py <cartella con fotogrammi PNG 1080x1920 dei soli testi su nero>
I fotogrammi si fanno con la composizione di misura (video nero al posto della clip): vedi skill reel-social.
Margini: alto 250 px, basso 500 px (Instagram, stima più prudente), sinistra 90 px (TikTok), destra 180 px.
"""
import sys
from pathlib import Path
from PIL import Image

ALTO, BASSO, SINISTRA, DESTRA = 250, 1920 - 500, 90, 1080 - 180
errori = 0
for f in sorted(Path(sys.argv[1]).glob("*.png")):
    im = Image.open(f).convert("L"); w, h = im.size; px = im.load()
    righe = [y for y in range(h) if any(px[x, y] > 40 for x in range(0, w, 2))]
    gruppi = []
    for y in righe:
        if gruppi and y - gruppi[-1][1] <= 12: gruppi[-1][1] = y
        else: gruppi.append([y, y])
    for a, b in gruppi:
        xs = [x for y in range(a, b + 1, 2) for x in range(w) if px[x, y] > 40]
        x0, x1 = min(xs), max(xs)
        fuori = [m for m, c in [("alto", a < ALTO), ("basso", b > BASSO), ("sinistra", x0 < SINISTRA), ("destra", x1 > DESTRA)] if c]
        errori += bool(fuori)
        print(f"{f.name:12s} y {a}-{b}  x {x0}-{x1}  {'FUORI: ' + ', '.join(fuori) if fuori else 'ok'}")
print("Tutto dentro la zona libera." if not errori else f"{errori} testi fuori zona.")
sys.exit(1 if errori else 0)
