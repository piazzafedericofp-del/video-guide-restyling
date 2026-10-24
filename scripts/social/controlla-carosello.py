"""Controlla le slide di un carosello prima della pubblicazione.

Uso (dopo misura-carosello.mjs):
  uv run -q --with pillow --with numpy python3 scripts/controlla-carosello.py <cartella>

Legge <cartella>/misure.json (testi misurati nella pagina) e le slide JPEG, poi verifica:
- dimensione: ogni testo almeno 28 px (sotto si legge male sul telefono);
- contrasto (WCAG): 4,5:1 sotto i 48 px, 3:1 per i titoli grandi. Lo sfondo si ricava dai
  pixel dell'immagine dentro il riquadro del testo, quindi vale anche sopra le foto;
- margini: testi dentro x 60–1020 e y 40–1290 (la griglia del profilo taglia la copertina
  in 3:4, circa 34 px per lato);
- sovrapposizioni: due testi che si toccano, o un testo a meno di 12 px dal ritratto della firma
  (il 23/10 la fonte della fascite finiva sulla tessera del ritratto).
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

MIN_PX = 28
MARGINE_X = (60, 1020)
MARGINE_Y = (40, 1290)
# Versione 9:16 per TikTok: zona libera dall'interfaccia (come i Reel) e testo minimo 25 px
# (la slide è ridotta a 0,9: i 28 px diventano 25,2, circa quanto un 4:5 sul telefono).
MIN_PX_VERTICALE = 25
MARGINE_X_VERTICALE = (90, 900)
MARGINE_Y_VERTICALE = (250, 1420)


def rgb(stringa):
    v = stringa[stringa.index("(") + 1 : stringa.index(")")].split(",")
    return np.array([float(x) for x in v[:3]])


def luminanza(c):
    c = c / 255.0
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrasto(a, b):
    la, lb = sorted([luminanza(a), luminanza(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def sfondo(img, voce, colore_testo):
    x0, y0 = max(int(voce["x"]), 0), max(int(voce["y"]), 0)
    x1, y1 = min(int(voce["x"] + voce["w"]), img.shape[1]), min(int(voce["y"] + voce["h"]), img.shape[0])
    zona = img[y0:y1, x0:x1].reshape(-1, 3).astype(float)
    if len(zona) == 0:
        return None
    lontani = zona[np.linalg.norm(zona - colore_testo, axis=1) > 80]
    if len(lontani) < len(zona) * 0.2:
        return None  # quasi solo lettere: sfondo non stimabile
    # Sfondo = colore più frequente (a gruppi di 8 livelli): i pixel sfumati ai bordi delle
    # lettere sono pochi e tutti diversi, lo sfondo pieno domina. Sopra una foto nessun
    # colore domina: si prende il caso peggiore (i pixel più simili al testo).
    gruppi = (lontani // 8).astype(int)
    valori, conti = np.unique(gruppi, axis=0, return_counts=True)
    # Il gruppo più frequente si allarga ai pixel vicini (±14): un colore pieno al confine tra due gruppi
    # (la sabbia #F7F3EC, rosso 247) col rumore JPEG si divide a metà e non deve passare per "foto" (23/10/2026)
    centro = valori[conti.argmax()] * 8 + 4
    vicini = lontani[np.linalg.norm(lontani - centro, axis=1) <= 14]
    if len(vicini) >= len(lontani) * 0.3:
        return vicini.mean(axis=0)
    distanze = np.linalg.norm(lontani - colore_testo, axis=1)
    return lontani[distanze <= np.percentile(distanze, 25)].mean(axis=0)


def sovrapposti(a, b, tolleranza=2):
    ox = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
    oy = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
    return ox > tolleranza and oy > tolleranza


def main():
    cartella = Path(sys.argv[1])
    misure = json.loads((cartella / "misure.json").read_text())
    problemi = 0
    for slide in misure:
        img = np.array(Image.open(slide["file"]).convert("RGB"))
        n = slide["slide"] + 1
        vert = slide.get("verticale", False)
        minimo = MIN_PX_VERTICALE if vert else MIN_PX
        mx = MARGINE_X_VERTICALE if vert else MARGINE_X
        my = MARGINE_Y_VERTICALE if vert else MARGINE_Y
        for v in slide["voci"]:
            nome = f"slide {n} «{v['testo'][:28]}»"
            px = v["px"] * slide.get("scala", 1)
            if px < minimo:
                print(f"✗ {nome}: {px:.0f} px (minimo {minimo})")
                problemi += 1
            if v["x"] < mx[0] or v["x"] + v["w"] > mx[1] or v["y"] < my[0] or v["y"] + v["h"] > my[1]:
                print(f"✗ {nome}: fuori margine (x {v['x']:.0f}–{v['x'] + v['w']:.0f}, y {v['y']:.0f}–{v['y'] + v['h']:.0f})")
                problemi += 1
            c_testo = rgb(v["colore"])
            c_sfondo = sfondo(img, v, c_testo)
            if c_sfondo is None:
                continue
            soglia = 3.0 if px >= 48 else 4.5
            r = contrasto(c_testo, c_sfondo)
            if r < soglia:
                print(f"✗ {nome}: contrasto {r:.1f}:1 (minimo {soglia}:1)")
                problemi += 1
        vs = slide["voci"]
        for i in range(len(vs)):
            for j in range(i + 1, len(vs)):
                if vs[i].get("blocco", i) != vs[j].get("blocco", j) and sovrapposti(vs[i], vs[j]):
                    print(f"✗ slide {n}: «{vs[i]['testo'][:24]}» e «{vs[j]['testo'][:24]}» si sovrappongono")
                    problemi += 1
        for o in slide.get("ostacoli", []):
            for v in vs:
                if sovrapposti(v, o, tolleranza=-12):
                    print(f"✗ slide {n}: «{v['testo'][:28]}» tocca il ritratto della firma (serve almeno 12 px di aria)")
                    problemi += 1
    voci = sum(len(s["voci"]) for s in misure)
    if problemi:
        print(f"\n{problemi} problemi su {voci} testi in {len(misure)} slide.")
        sys.exit(1)
    print(f"Tutto a posto: {voci} testi in {len(misure)} slide (dimensione, contrasto, margini, sovrapposizioni).")


if __name__ == "__main__":
    main()
