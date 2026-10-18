"""Chiamate alla dashboard social con il token ristretto della generazione (GENERATORE_TOKEN).
Il token può solo leggere i lavori, caricare file in post/ e libreria/ e consegnare i contenuti: mai approvare o pubblicare."""
import json
import os
import urllib.parse
import urllib.request

BASE = os.environ.get("DASHBOARD", "https://fisioconfede-social.fisioconfede-social.workers.dev")
TOKEN = os.environ["GENERATORE_TOKEN"]


def chiama(percorso, metodo="GET", corpo=None, dati=None, tipo="application/json"):
    if corpo is not None:
        dati = json.dumps(corpo).encode()
    r = urllib.request.Request(BASE + percorso, method=metodo, data=dati,
                               headers={"authorization": f"Bearer {TOKEN}", "content-type": tipo, "user-agent": "render-social"})
    with urllib.request.urlopen(r, timeout=300) as x:
        corpo = x.read()
        return json.loads(corpo) if corpo[:1] in (b"{", b"[") else corpo


def carica(file, chiave, tipo):
    with open(file, "rb") as f:
        return chiama(f"/api/media/{urllib.parse.quote(chiave, safe='')}", "PUT", dati=f.read(), tipo=tipo)


def scarica(chiave, file):
    with open(file, "wb") as f:
        f.write(chiama(f"/api/media/{urllib.parse.quote(chiave, safe='')}"))
