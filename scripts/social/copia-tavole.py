#!/usr/bin/env python3
"""Copie per i social delle tavole del blog, per un carosello «Come funziona» (Federico, 03/11/2026: le tavole si
generano insieme al contenuto che deve uscire e le approva con il carosello).

  python3 scripts/social/copia-tavole.py copia <sito> <cartella> <n>... <lavoro>/tavole
      copia gli SVG originali delle tavole n (posizione in tavole.json, come in <Tavola articolo=… n=…>) in
      <lavoro>/tavole/<cartella>/ e controlla che le loro classi siano nel kit dei social (kit-disegni.css)
  python3 scripts/social/copia-tavole.py cambi <sito> <lavoro>/tavole
      elenca ogni cambio delle copie rispetto al blog (scritte tolte, aggiunte, disegno modificato): va nella scheda
      del post, perché Federico approva le copie insieme al carosello

Le scritte non si ingrandiscono qui: lo fa il render in base alla scala vera del disegno (campo "scritte" della slide
tavola, Tavole.tsx). L'originale del blog (scripts/blog/illustrazioni/) non si tocca mai.
"""
import json
import re
import shutil
import sys
from pathlib import Path

# kit dei social nel progetto privato, accanto a questo progetto (in locale ~/, nella routine /home/user/)
KIT_SOCIAL = Path(__file__).resolve().parents[3] / "video-guide-media" / "social" / "tavole" / "kit-disegni.css"


def originali(sito: Path) -> Path:
    return sito / "scripts" / "blog" / "illustrazioni"


def scritte(svg: str) -> list[str]:
    """Testi visibili del disegno, uno per <text> (con i <tspan> uniti)."""
    voci = []
    for m in re.finditer(r"<text\b[^>]*>(.*?)</text>", svg, re.S):
        t = re.sub(r"<[^>]+>", "", m.group(1))
        t = re.sub(r"\s+", " ", t).strip()
        if t:
            voci.append(t)
    return voci


def forme(svg: str) -> str:
    """Il disegno senza scritte né spazi: serve a capire se le forme sono cambiate."""
    return re.sub(r"\s+", "", re.sub(r"<text\b.*?</text>", "", svg, flags=re.S))


def classi_kit(kit: Path) -> set[str]:
    return set(re.findall(r"\.([a-zA-Z][\w-]*)", kit.read_text())) if kit.exists() else set()


def copia(sito: Path, cartella: str, numeri: list[str], uscita: Path) -> None:
    sorgente = originali(sito) / cartella
    tavole = json.loads((sorgente / "tavole.json").read_text())["tavole"]
    dest = uscita / cartella
    dest.mkdir(parents=True, exist_ok=True)
    nel_kit = classi_kit(KIT_SOCIAL)
    errori = []
    for n in numeri:
        t = tavole[int(n) - 1]
        svg = (sorgente / t["file"]).read_text()
        (dest / t["file"]).write_text(svg)
        # file usati dalla tavola (es. 4-scapole-base.svg) e classi da avere nel kit dei social
        for extra in re.findall(r'href="([\w.-]+\.svg)"', svg):
            if (sorgente / extra).exists():
                shutil.copy(sorgente / extra, dest / extra)
        mancanti = sorted({c for attr in re.findall(r'class="([^"]+)"', svg) for c in attr.split()} - nel_kit) if nel_kit else []
        if mancanti:
            errori.append(f"{t['file']}: classi non nel kit dei social ({', '.join(mancanti)}): copiale da scripts/blog/illustrazioni/kit.css in social/tavole/kit-disegni.css")
        print(f"{cartella}/{t['file']} · tipo {t.get('tipo', '?')} · {t.get('titolo', '')}")
    for e in errori:
        print("ERRORE " + e)
    sys.exit(1 if errori else 0)


def cambi(sito: Path, uscita: Path) -> None:
    righe = []
    for copia_svg in sorted(uscita.glob("*/*.svg")):
        cartella = copia_svg.parent.name
        orig = originali(sito) / cartella / copia_svg.name
        if not orig.exists():
            righe.append(f"{cartella}/{copia_svg.name}: tavola nuova, non c'è nel blog")
            continue
        a, b = orig.read_text(), copia_svg.read_text()
        prima, dopo = scritte(a), scritte(b)
        tolte = [s for s in prima if s not in dopo]
        aggiunte = [s for s in dopo if s not in prima]
        voci = [f"tolta «{s}»" for s in tolte] + [f"aggiunta «{s}»" for s in aggiunte]
        if forme(a) != forme(b):
            voci.append("disegno modificato")
        if voci:
            righe.append(f"{cartella}/{copia_svg.name}: " + "; ".join(voci))
    print("Tavole, cambi rispetto al blog: " + (" · ".join(righe) if righe else "nessuno (scritte solo ingrandite)"))


def main() -> None:
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    cmd = sys.argv[1]
    sito = Path(sys.argv[2])
    if cmd == "copia" and len(sys.argv) >= 6:
        copia(sito, sys.argv[3], sys.argv[4:-1], Path(sys.argv[-1]))
    elif cmd == "cambi":
        cambi(sito, Path(sys.argv[3]))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
