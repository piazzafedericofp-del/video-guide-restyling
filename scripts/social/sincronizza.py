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

avvisi = 0

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
        # Post spostato in un altro giorno: aggiorna la data (la Sveglia prepara prima i lavori che escono prima)
        if precedente.get("data") != l.get("data"):
            (d / "lavoro.json").write_text(json.dumps({**precedente, "data": l.get("data")}, ensure_ascii=False, indent=1))
        continue  # già in lavorazione con le stesse istruzioni
    elif stato in ("in_preparazione", "dati_pronti", "in_render", "da_verificare"):
        continue  # cambiato durante la lavorazione: si riprende dopo la consegna
    else:
        rifatti += 1
    (d / "lavoro.json").write_text(json.dumps(l, ensure_ascii=False, indent=1))
    stato_f.write_text("da_fare")
    (d / "tentativi").write_text("0")
    for vecchio in ("nota.txt", "nota-inviata"):
        (d / vecchio).unlink(missing_ok=True)
for d in radice.iterdir():
    if d.is_dir() and d.name not in lavori and (d / "stato").exists():
        if (d / "stato").read_text().strip() in ("da_fare", "in_preparazione", "dati_pronti", "da_verificare", "errore", "errore_render", "bloccato"):
            (d / "stato").write_text("annullato")
            annullati += 1
# Note della routine per Federico (lavoro bloccato: tema senza fonti, clip inadatta…): una volta sola, nella scheda del post
for d in radice.iterdir():
    nota = d / "nota.txt"
    if d.is_dir() and nota.exists() and not (d / "nota-inviata").exists() and d.name in lavori:
        chiama(f"/api/generatore/post/{d.name}", "POST", {"nota_routine": nota.read_text()[:500]})
        (d / "nota-inviata").write_text("1")
        avvisi += 1
print(f"note inviate: {avvisi}")
print(f"lavori in dashboard: {len(lavori)} · nuovi {nuovi} · da rifare {rifatti} · annullati {annullati}")
