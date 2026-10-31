#!/usr/bin/env python3
"""Sveglia delle routine Claude (24/10/2026): decide su GitHub, senza consumare token, se c'è davvero un lavoro
da preparare, e solo allora sveglia la routine con una release "turno-social-…" o "turno-lezione-…" nel progetto
privato (l'evento release.published fa partire la routine). Applica le stesse regole del §1 delle istruzioni.
Inoltre: avvia i render quando ci sono dati pronti e nessun render in corso, rimette in coda gli stati fermi,
cancella i segnali vecchi. Quando una pausa (render fallito da poco, segnale già mandato) ferma un lavoro pronto, si fa
richiamare allo scadere da richiamo.yml. Stampa solo id e stati, mai contenuti (il repo del codice è pubblico).
Uso: python3 sveglia.py <cartella media> [--prova]   (--prova: decide e stampa, ma non cambia niente)"""
import datetime as dt
import json
import math
import os
import subprocess
import sys
from pathlib import Path

M = Path(sys.argv[1])
PROVA = "--prova" in sys.argv
DOPO_ROUTINE = "--dopo-routine" in sys.argv  # avviata da attesa.yml: la routine ha finito, il segnale successivo può partire subito
MEDIA = os.environ.get("MEDIA_REPO", "piazzafedericofp-del/video-guide-media")
CODICE = os.environ.get("GITHUB_REPOSITORY", "piazzafedericofp-del/video-guide-restyling")
# Nessun orizzonte di giorni (Federico, 28/10/2026): in lavori/ arriva solo ciò che Federico ha approvato in dashboard
# (proposta approvata o brief), quindi si prepara tutto, dal più vicino all'uscita
MAX_NUOVI_GIORNO = 4    # contenuti nuovi preparati al giorno: l'arretrato si spalma e non consuma in un colpo il limite di 5 ore
PAUSA_SEGNALE = 20      # minuti: niente secondo segnale dello stesso tipo prima di così
PAUSA_FALLITO = 30      # minuti: dopo un render fallito il successivo parte solo dopo così
FERMO_RENDER = 6 * 60   # minuti in "in_render" senza un render in corso → di nuovo "dati_pronti"
FERMO_PREP = 3 * 60     # minuti in "in_preparazione" → la routine si è interrotta
ADESSO = dt.datetime.now(dt.timezone.utc)
OGGI = ADESSO.date()
cambiati = []
pausa_render = {}  # flusso → minuti che mancano alla fine della pausa dopo un render fallito
richiami = []      # minuti alla fine delle pause che fermano un lavoro pronto (vedi richiamo.yml in fondo)


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
    """True se un render è in corso o in coda, oppure se l'ultimo è fallito da meno di PAUSA_FALLITO minuti (niente giri
    a catena su un errore che si ripete: riprova allo scadere della pausa)."""
    runs = json.loads(gh("run", "list", "-R", CODICE, "-w", flusso, "-L", "10", "--json", "status,conclusion,updatedAt", codice=True) or "[]")
    if any(r["status"] != "completed" for r in runs):
        return True
    finiti = [r["conclusion"] for r in runs[:3]]
    if len(finiti) == 3 and all(c == "failure" for c in finiti):
        print(f"{flusso}: ultimi 3 render falliti, fermo finché non si guarda in una sessione")
        return True
    if runs and runs[0]["conclusion"] == "failure":
        fine = dt.datetime.fromisoformat(runs[0]["updatedAt"].replace("Z", "+00:00"))
        mancano = PAUSA_FALLITO - (ADESSO - fine).total_seconds() / 60
        if mancano > 0:
            print(f"{flusso}: ultimo render fallito da poco, non lo riavvio ora")
            pausa_render[flusso] = mancano
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
    if s == "da_verificare":   # copertina IA appena generata: la routine la guarda prima della consegna
        return True
    if s == "errore":   # controllo automatico non superato: la routine lo corregge una volta sola
        return int(leggi(d / "tentativi") or 0) < 1
    if s != "da_fare":
        return False
    try:
        l = json.loads((d / "lavoro.json").read_text())
    except Exception:
        return False
    return bool(l.get("lavoro"))   # approvato da Federico in dashboard: sempre (i nuovi al massimo MAX_NUOVI_GIORNO al giorno)


in_coda_s = sum(s in ("dati_pronti", "in_render") for s in stato_s.values())
prep_s = sum(s == "in_preparazione" for s in stato_s.values())
cand_s = [i for i, s in stato_s.items() if candidato_social(i, s)]
sveglia_social = in_coda_s < 2 and prep_s == 0 and bool(cand_s)
# Correzioni, copertine da verificare e modifiche di Federico passano sempre; i contenuti nuovi al massimo
# MAX_NUOVI_GIORNO al giorno (conteggio in social/sveglie.json, scritto quando parte un segnale per un contenuto nuovo)


def urgente_s(i):
    if stato_s[i] in ("da_verificare", "errore"):
        return True
    try:
        return json.loads((lavori[i] / "lavoro.json").read_text()).get("lavoro") == "modifica"
    except Exception:
        return False


CONTEGGIO = M / "social" / "sveglie.json"
conteggio = json.loads(CONTEGGIO.read_text()) if CONTEGGIO.exists() else {}
solo_nuovi_s = sveglia_social and not any(urgente_s(i) for i in cand_s)
if solo_nuovi_s and conteggio.get(str(OGGI), 0) >= MAX_NUOVI_GIORNO:
    print(f"social: già {conteggio[str(OGGI)]} contenuti nuovi oggi (massimo {MAX_NUOVI_GIORNO}), riprendo domani")
    sveglia_social = False
print(f"social: in coda al render {in_coda_s}, in preparazione {prep_s}, da preparare {len(cand_s)} "
      f"→ {'sveglia' if sveglia_social else 'niente'}")

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
def salva(file, messaggio):
    subprocess.run(["git", "-C", str(M), "add", *file], check=True)
    subprocess.run(["git", "-C", str(M), "commit", "-q", "-m", messaggio], check=True)
    for _ in range(5):
        if subprocess.run(["git", "-C", str(M), "pull", "-q", "--rebase"]).returncode == 0 and \
           subprocess.run(["git", "-C", str(M), "push", "-q"]).returncode == 0:
            break


if cambiati and not PROVA:
    salva(cambiati, "sveglia: stati fermi rimessi in coda")

# ---------------- Render con dati pronti e nessun render in corso ----------------
for flusso, pronti, attivo in (("social.yml", any(s == "dati_pronti" for s in stato_s.values()), render_social),
                               ("render.yml", any(s == "dati_pronti" for s in stato_l.values()), render_lezioni)):
    if pronti and not attivo:
        print(f"avvio {flusso} (dati pronti, nessun render in corso)")
        if not PROVA:
            gh("workflow", "run", flusso, "-R", CODICE, codice=True)
    elif pronti and flusso in pausa_render:
        richiami.append(pausa_render[flusso])

# ---------------- Segnali alle routine ----------------
release = json.loads(gh("release", "list", "-R", MEDIA, "--limit", "100", "--json", "tagName,createdAt") or "[]")


def eta(r):
    return (ADESSO - dt.datetime.fromisoformat(r["createdAt"].replace("Z", "+00:00"))).total_seconds() / 60


for tipo, sveglia in (("social", sveglia_social), ("lezione", sveglia_lezioni)):
    recenti = [] if DOPO_ROUTINE else [r for r in release if r["tagName"].startswith(f"turno-{tipo}-") and eta(r) < PAUSA_SEGNALE]
    if sveglia and recenti:
        ultimo = min(eta(r) for r in recenti)
        print(f"{tipo}: segnale già mandato {int(ultimo)} minuti fa, aspetto")
        richiami.append(PAUSA_SEGNALE - ultimo)
    elif sveglia:
        tag = f"turno-{tipo}-{ADESSO:%Y%m%d-%H%M}"
        print(f"{tipo}: sveglio la routine ({tag})")
        if not PROVA:
            # Due eventi diversi, così una routine non si sveglia per il segnale dell'altra:
            # social = pre-release (evento "prereleased"), lezioni = release normale (evento "released")
            tipo_rel = ["--prerelease"] if tipo == "social" else ["--latest=false"]
            gh("release", "create", tag, "-R", MEDIA, *tipo_rel, "--target", "main",
               "--title", tag, "--notes", "Segnale per la routine (si cancella da solo dopo 2 ore).")
            # Chi aspetta la fine della routine e poi rilancia la Sveglia (render e lavoro successivo): attesa.yml
            gh("workflow", "run", "attesa.yml", "-R", CODICE, "-f", f"tipo={tipo}", codice=True)
            if tipo == "social" and solo_nuovi_s:
                conteggio = {k: v for k, v in conteggio.items() if k >= str(OGGI - dt.timedelta(days=7))}
                conteggio[str(OGGI)] = conteggio.get(str(OGGI), 0) + 1
                CONTEGGIO.write_text(json.dumps(conteggio))
                salva(["social/sveglie.json"], "sveglia: conteggio dei contenuti nuovi del giorno")

for r in release:
    if r["tagName"].startswith("turno-") and eta(r) > 120 and not PROVA:
        gh("release", "delete", r["tagName"], "-R", MEDIA, "--yes", "--cleanup-tag")

# ---------------- Richiamo allo scadere della pausa ----------------
# Un lavoro pronto fermo solo per una pausa: allo scadere nessun evento richiamava la Sveglia (dal 27 al 31/10/2026
# 16 fermi oltre 40 minuti, 47 ore in tutto, finché non passava il timer della dashboard o Federico). richiamo.yml
# aspetta la fine della pausa più vicina e la riavvia; ne resta in attesa uno solo, l'ultimo.
if richiami:
    minuti = math.ceil(min(richiami)) + 1
    print(f"richiamo la Sveglia tra {minuti} minuti (fine della pausa)")
    if not PROVA:
        gh("workflow", "run", "richiamo.yml", "-R", CODICE, "-f", f"minuti={minuti}", codice=True)
