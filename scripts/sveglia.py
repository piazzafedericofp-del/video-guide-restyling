#!/usr/bin/env python3
"""Sveglia delle routine Claude (24/10/2026): decide su GitHub, senza consumare token, se c'è davvero un lavoro
da preparare, e solo allora sveglia la routine con una release "turno-social-…" o "turno-lezione-…" nel progetto
privato (l'evento release.published fa partire la routine). Applica le stesse regole del §1 delle istruzioni.
Inoltre: avvia i render quando ci sono dati pronti e nessun render in corso, rimette in coda gli stati fermi,
cancella i segnali vecchi. Stampa solo id e stati, mai contenuti (il repo del codice è pubblico).
Uso: python3 sveglia.py <cartella media> [--prova]   (--prova: decide e stampa, ma non cambia niente)"""
import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path

M = Path(sys.argv[1])
PROVA = "--prova" in sys.argv
MEDIA = os.environ.get("MEDIA_REPO", "piazzafedericofp-del/video-guide-media")
CODICE = os.environ.get("GITHUB_REPOSITORY", "piazzafedericofp-del/video-guide-restyling")
ORIZZONTE = 21          # giorni: contenuti social "genera"/"variante" preparati solo se escono entro 3 settimane
PAUSA_SEGNALE = 20      # minuti: niente secondo segnale dello stesso tipo prima di così
FERMO_RENDER = 6 * 60   # minuti in "in_render" senza un render in corso → di nuovo "dati_pronti"
FERMO_PREP = 3 * 60     # minuti in "in_preparazione" → la routine si è interrotta
ADESSO = dt.datetime.now(dt.timezone.utc)
OGGI = ADESSO.date()
cambiati = []


def gh(*args, codice=False):
    """codice=True: chiamate al repo del codice (avvio dei flussi) con il token del flusso, il resto con MEDIA_TOKEN."""
    env = dict(os.environ, GH_TOKEN=os.environ["GH_TOKEN_CODICE"]) if codice and os.environ.get("GH_TOKEN_CODICE") else None
    r = subprocess.run(["gh", *args], capture_output=True, text=True, env=env)
    return r.stdout.strip() if r.returncode == 0 else ""


def minuti_da_ultima_modifica(percorso):
    """Minuti dall'ultimo commit che ha toccato il file (API: il checkout è parziale e senza storia)."""
    d = gh("api", f"repos/{MEDIA}/commits?path={percorso}&per_page=1", "-q", ".[0].commit.committer.date")
    if not d:
        return 0
    return (ADESSO - dt.datetime.fromisoformat(d.replace("Z", "+00:00"))).total_seconds() / 60


def render_in_corso(flusso):
    """True se un render è in corso o in coda, oppure se l'ultimo è fallito da meno di 30 minuti (niente giri a catena
    su un errore che si ripete: riprova dopo)."""
    runs = json.loads(gh("run", "list", "-R", CODICE, "-w", flusso, "-L", "10", "--json", "status,conclusion,updatedAt", codice=True) or "[]")
    if any(r["status"] != "completed" for r in runs):
        return True
    finiti = [r["conclusion"] for r in runs[:3]]
    if len(finiti) == 3 and all(c == "failure" for c in finiti):
        print(f"{flusso}: ultimi 3 render falliti, fermo finché non si guarda in una sessione")
        return True
    if runs and runs[0]["conclusion"] == "failure":
        fine = dt.datetime.fromisoformat(runs[0]["updatedAt"].replace("Z", "+00:00"))
        if (ADESSO - fine).total_seconds() < 30 * 60:
            print(f"{flusso}: ultimo render fallito da poco, non lo riavvio ora")
            return True
    return False


def scrivi(percorso, testo):
    if not PROVA:
        (M / percorso).write_text(testo)
    cambiati.append(percorso)


def leggi(p):
    return p.read_text().strip() if p.exists() else ""


# ---------------- Social ----------------
radice = M / "social" / "lavori"
lavori = {d.name: d for d in sorted(radice.iterdir()) if (d / "stato").exists()} if radice.exists() else {}
stato_s = {i: leggi(d / "stato") for i, d in lavori.items()}
render_social = render_in_corso("social.yml")

for i, s in stato_s.items():
    if s == "in_render" and not render_social and minuti_da_ultima_modifica(f"social/lavori/{i}/stato") > FERMO_RENDER:
        print(f"social {i}: in_render fermo → dati_pronti"); scrivi(f"social/lavori/{i}/stato", "dati_pronti"); stato_s[i] = "dati_pronti"
    elif s == "in_preparazione" and minuti_da_ultima_modifica(f"social/lavori/{i}/stato") > FERMO_PREP:
        # Una sola ripresa: se la routine si interrompe di nuovo sullo stesso lavoro, si ferma e lo segnala
        n = int(leggi(lavori[i] / "interruzioni") or 0)
        scrivi(f"social/lavori/{i}/interruzioni", str(n + 1))
        if n < 1:
            print(f"social {i}: preparazione interrotta → da_fare (una ripresa)"); scrivi(f"social/lavori/{i}/stato", "da_fare"); stato_s[i] = "da_fare"
        else:
            print(f"social {i}: preparazione interrotta due volte → bloccato")
            scrivi(f"social/lavori/{i}/nota.txt", "La preparazione in cloud si è interrotta due volte su questo contenuto: "
                   "l'ho fermato per non consumare altri giri. Va guardato in una sessione con Claude.")
            scrivi(f"social/lavori/{i}/stato", "bloccato"); stato_s[i] = "bloccato"


def candidato_social(i, s):
    d = lavori[i]
    if s == "errore":   # controllo automatico non superato: la routine lo corregge una volta sola
        return int(leggi(d / "tentativi") or 0) < 1
    if s != "da_fare":
        return False
    try:
        l = json.loads((d / "lavoro.json").read_text())
    except Exception:
        return False
    if l.get("lavoro") == "modifica":   # richiesta esplicita di Federico: sempre
        return True
    data = (l.get("data") or "")[:10]
    if not data:
        return True
    try:
        return dt.date.fromisoformat(data) <= OGGI + dt.timedelta(days=ORIZZONTE)
    except ValueError:
        return True


in_coda_s = sum(s in ("dati_pronti", "in_render") for s in stato_s.values())
prep_s = sum(s == "in_preparazione" for s in stato_s.values())
cand_s = [i for i, s in stato_s.items() if candidato_social(i, s)]
futuri_s = sum(s == "da_fare" for s in stato_s.values()) - sum(stato_s[i] == "da_fare" for i in cand_s)
sveglia_social = in_coda_s < 2 and prep_s == 0 and bool(cand_s)
print(f"social: in coda al render {in_coda_s}, in preparazione {prep_s}, da preparare ora {len(cand_s)}, "
      f"oltre {ORIZZONTE} giorni {futuri_s} → {'sveglia' if sveglia_social else 'niente'}")

# ---------------- Lezioni ----------------
cat = sorted(json.loads((M / "catalogo.json").read_text())["lezioni"], key=lambda l: l["ordine"]) if (M / "catalogo.json").exists() else []
stato_l = {l["id"]: leggi(M / "lezioni" / l["id"] / "stato") for l in cat}
render_lezioni = render_in_corso("render.yml")
prep_ferme = set()
for i, s in stato_l.items():
    if s == "in_render" and not render_lezioni and minuti_da_ultima_modifica(f"lezioni/{i}/stato") > FERMO_RENDER:
        print(f"lezione {i}: in_render fermo → dati_pronti"); scrivi(f"lezioni/{i}/stato", "dati_pronti"); stato_l[i] = "dati_pronti"
    elif s == "in_preparazione" and minuti_da_ultima_modifica(f"lezioni/{i}/stato") > FERMO_PREP:
        print(f"lezione {i}: preparazione interrotta da più di 3 ore, da controllare (resta com'è)"); prep_ferme.add(i)

in_coda_l = sum(s in ("dati_pronti", "in_render") for s in stato_l.values())
blocco_l = sum(s == "da_verificare" or (s == "in_preparazione" and i not in prep_ferme) for i, s in stato_l.items())
cand_l = [i for i, s in stato_l.items() if s in ("da_rivedere", "da_montare")]
sveglia_lezioni = in_coda_l < 2 and blocco_l == 0 and bool(cand_l)
print(f"lezioni: in coda al render {in_coda_l}, in preparazione o da verificare {blocco_l}, da preparare {len(cand_l)} "
      f"→ {'sveglia' if sveglia_lezioni else 'niente'}")

# ---------------- Salva gli stati sbloccati ----------------
if cambiati and not PROVA:
    subprocess.run(["git", "-C", str(M), "add", *cambiati], check=True)
    subprocess.run(["git", "-C", str(M), "commit", "-q", "-m", "sveglia: stati fermi rimessi in coda"], check=True)
    for _ in range(5):
        if subprocess.run(["git", "-C", str(M), "pull", "-q", "--rebase"]).returncode == 0 and \
           subprocess.run(["git", "-C", str(M), "push", "-q"]).returncode == 0:
            break

# ---------------- Render con dati pronti e nessun render in corso ----------------
for flusso, pronti, attivo in (("social.yml", any(s == "dati_pronti" for s in stato_s.values()), render_social),
                               ("render.yml", any(s == "dati_pronti" for s in stato_l.values()), render_lezioni)):
    if pronti and not attivo:
        print(f"avvio {flusso} (dati pronti, nessun render in corso)")
        if not PROVA:
            gh("workflow", "run", flusso, "-R", CODICE, codice=True)

# ---------------- Segnali alle routine ----------------
release = json.loads(gh("release", "list", "-R", MEDIA, "--limit", "100", "--json", "tagName,createdAt") or "[]")


def eta(r):
    return (ADESSO - dt.datetime.fromisoformat(r["createdAt"].replace("Z", "+00:00"))).total_seconds() / 60


for tipo, sveglia in (("social", sveglia_social), ("lezione", sveglia_lezioni)):
    recenti = [r for r in release if r["tagName"].startswith(f"turno-{tipo}-") and eta(r) < PAUSA_SEGNALE]
    if sveglia and recenti:
        print(f"{tipo}: segnale già mandato {int(eta(recenti[0]))} minuti fa, aspetto")
    elif sveglia:
        tag = f"turno-{tipo}-{ADESSO:%Y%m%d-%H%M}"
        print(f"{tipo}: sveglio la routine ({tag})")
        if not PROVA:
            # Due eventi diversi, così una routine non si sveglia per il segnale dell'altra:
            # social = pre-release (evento "prereleased"), lezioni = release normale (evento "released")
            tipo_rel = ["--prerelease"] if tipo == "social" else ["--latest=false"]
            gh("release", "create", tag, "-R", MEDIA, *tipo_rel, "--target", "main",
               "--title", tag, "--notes", "Segnale per la routine (si cancella da solo dopo 2 ore).")

for r in release:
    if r["tagName"].startswith("turno-") and eta(r) > 120 and not PROVA:
        gh("release", "delete", r["tagName"], "-R", MEDIA, "--yes", "--cleanup-tag")
