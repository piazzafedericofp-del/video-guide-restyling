#!/usr/bin/env python3
"""Abbina ogni lezione montata al suo girato 4K e al tratto usato.

Uso: python3 scripts/catalogo.py <cartella_lavoro> <uscita.json>

Confronta le parole pronunciate nel montato attuale (trascrizione whisper) con quelle
di ogni girato: il girato con più parole in sequenza in comune è la sorgente, e i tempi
della prima e dell'ultima parola in comune danno il tratto. Lavora solo su trascrizioni:
nessun contenuto esce dal Mac.
"""
import json
import re
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path


def norm(p: str) -> str:
    p = unicodedata.normalize("NFD", p.lower())
    p = "".join(c for c in p if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", p)


def parole(path: Path):
    out = []
    for w in json.load(open(path)):
        n = norm(w["testo"])
        if n:
            out.append((n, float(w["da"])))
    return out


def main() -> None:
    W = Path(sys.argv[1]).expanduser()
    girati = {d.name: parole(d / "parole.json") for d in sorted((W / "girati").iterdir()) if (d / "parole.json").exists()}
    risultati = {}
    for g in ("spalla", "schiena"):
        for d in sorted((W / "montati" / g).iterdir()):
            m = parole(d / "parole.json")
            if len(m) < 3:
                risultati[f"{g}/{d.name}"] = {"girato": None, "nota": "senza parlato"}
                continue
            mt = [x[0] for x in m]
            migliori = []
            for nome, gw in girati.items():
                sm = SequenceMatcher(None, [x[0] for x in gw], mt, autojunk=False)
                blocchi = [b for b in sm.get_matching_blocks() if b.size >= 3]
                comuni = sum(b.size for b in blocchi)
                if comuni:
                    migliori.append((comuni, nome, blocchi))
            migliori.sort(reverse=True)
            if not migliori:
                risultati[f"{g}/{d.name}"] = {"girato": None, "nota": "nessuna corrispondenza"}
                continue
            comuni, nome, blocchi = migliori[0]
            gw = girati[nome]
            primo, ultimo = blocchi[0], blocchi[-1]
            inizio = gw[primo.a][1]
            fine_idx = ultimo.a + ultimo.size - 1
            fine = gw[fine_idx + 1][1] if fine_idx + 1 < len(gw) else gw[fine_idx][1] + 1.0
            risultati[f"{g}/{d.name}"] = {
                "girato": nome,
                "copertura": round(comuni / len(mt), 2),
                "parlato_da": round(inizio, 2),
                "parlato_a": round(fine, 2),
                "durata_montato": float(open(d / "durata").read().strip() or 0),
                "alternative": [(n, c) for c, n, _ in migliori[1:3]],
            }
    json.dump(risultati, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
    for k, v in risultati.items():
        print(k, "→", v.get("girato"), v.get("copertura"), v.get("parlato_da"), v.get("parlato_a"), v.get("alternative"))


if __name__ == "__main__":
    main()
