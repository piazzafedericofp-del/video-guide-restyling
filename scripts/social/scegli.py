"""Sceglie il prossimo lavoro con i dati pronti (il più vecchio). Con --resto stampa quanti sono ancora in lavorazione.
Uso: python3 scegli.py <cartella media> [--resto]"""
import sys
from pathlib import Path

radice = Path(sys.argv[1]) / "social" / "lavori"
stati = {d.name: (d / "stato").read_text().strip() for d in radice.iterdir() if (d / "stato").exists()} if radice.exists() else {}
if "--resto" in sys.argv:
    print(sum(s in ("da_fare", "in_preparazione", "dati_pronti", "in_render") for s in stati.values()))
else:
    pronti = sorted((i for i, s in stati.items() if s == "dati_pronti"), key=lambda i: (radice / i / "stato").stat().st_mtime)
    print(pronti[0] if pronti else "")
