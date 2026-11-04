"""Chiamate alla dashboard social con il token ristretto della generazione (GENERATORE_TOKEN).
Il token può solo leggere i lavori, caricare file in post/ e libreria/ e consegnare i contenuti: mai approvare o pubblicare."""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("DASHBOARD", "https://fisioconfede-social.fisioconfede-social.workers.dev")
TOKEN = os.environ["GENERATORE_TOKEN"]
# Errori passeggeri della dashboard (04/11/2026: due 502 sul caricamento della slide 1 hanno fermato il carosello
# ca7529c8 con render e controlli già riusciti): le chiamate che si possono ripetere senza effetti doppi (GET e PUT,
# o ripeti=True) riprovano prima di far fallire il render, e il motivo dell'errore finisce nel log.
TENTATIVI = 3


def chiama(percorso, metodo="GET", corpo=None, dati=None, tipo="application/json", ripeti=None):
    if corpo is not None:
        dati = json.dumps(corpo).encode()
    if ripeti is None:
        ripeti = metodo in ("GET", "HEAD", "PUT")
    for prova in range(1, TENTATIVI + 1):
        r = urllib.request.Request(BASE + percorso, method=metodo, data=dati,
                                   headers={"authorization": f"Bearer {TOKEN}", "content-type": tipo, "user-agent": "render-social"})
        try:
            with urllib.request.urlopen(r, timeout=300) as x:
                corpo = x.read()
                return json.loads(corpo) if corpo[:1] in (b"{", b"[") else corpo
        except urllib.error.HTTPError as e:
            motivo = f"HTTP {e.code} {e.read()[:200].decode(errors='replace')}"
            print(f"{metodo} {percorso}: {motivo}", file=sys.stderr)
            if e.code < 500 or not ripeti or prova == TENTATIVI:
                raise
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"{metodo} {percorso}: {e}", file=sys.stderr)
            if not ripeti or prova == TENTATIVI:
                raise
        print(f"riprovo tra {10 * prova} s ({prova}/{TENTATIVI})", file=sys.stderr)
        time.sleep(10 * prova)


def carica(file, chiave, tipo):
    with open(file, "rb") as f:
        return chiama(f"/api/media/{urllib.parse.quote(chiave, safe='')}", "PUT", dati=f.read(), tipo=tipo)


def scarica(chiave, file):
    with open(file, "wb") as f:
        f.write(chiama(f"/api/media/{urllib.parse.quote(chiave, safe='')}"))
