"""Porta i lavori della dashboard nel progetto privato (media/social/lavori/<id post>/).

Ogni post "in preparazione" della dashboard diventa una cartella con lavoro.json e stato "da_fare".
Se Federico cambia brief o chiede una modifica dopo una consegna, il lavoro torna "da_fare".
Se un post non è più in preparazione (rifiutato, spostato su un'altra clip), il lavoro diventa "annullato".
Stampa solo conteggi: i log del progetto pubblico non mostrano contenuti.
Uso: python3 sincronizza.py <cartella media>
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dashboard import chiama  # noqa: E402

media = Path(sys.argv[1])
radice = media / "social" / "lavori"
radice.mkdir(parents=True, exist_ok=True)
risposta = chiama("/api/generatore/lavori")
lavori = {l["id"]: l for l in risposta["lavori"]}
(media / "social" / "recenti.json").write_text(json.dumps(risposta["recenti"], ensure_ascii=False, indent=1))

nuovi = rifatti = annullati = 0
firma = lambda l: json.dumps([l.get("lavoro"), l.get("richiesta_modifica"), l.get("brief"), l.get("clip_id"), l.get("tema_id")], ensure_ascii=False)
for pid, l in lavori.items():
    d = radice / pid
    stato_f = d / "stato"
    precedente = json.loads((d / "lavoro.json").read_text()) if (d / "lavoro.json").exists() else None
    stato = stato_f.read_text().strip() if stato_f.exists() else ""
    if precedente is None:
        d.mkdir(exist_ok=True)
        nuovi += 1
    elif firma(precedente) == firma(l) and stato not in ("consegnato", "annullato"):
        continue  # già in lavorazione con le stesse istruzioni
    elif stato in ("in_preparazione", "dati_pronti", "in_render"):
        continue  # cambiato durante la lavorazione: si riprende dopo la consegna
    else:
        rifatti += 1
    (d / "lavoro.json").write_text(json.dumps(l, ensure_ascii=False, indent=1))
    stato_f.write_text("da_fare")
    (d / "tentativi").write_text("0")
for d in radice.iterdir():
    if d.is_dir() and d.name not in lavori and (d / "stato").exists():
        if (d / "stato").read_text().strip() in ("da_fare", "in_preparazione", "dati_pronti", "errore"):
            (d / "stato").write_text("annullato")
            annullati += 1
print(f"lavori in dashboard: {len(lavori)} · nuovi {nuovi} · da rifare {rifatti} · annullati {annullati}")
