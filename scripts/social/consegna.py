"""Consegna un contenuto finito alla dashboard: carica i file in R2 (post/<id>/…) e i testi, poi lo mette "Da approvare".
Uso: python3 consegna.py <id post> <cartella uscite> <dati.json>
Uscite attese: Reel → video.mp4, copertina.jpg · Carosello → c45/slide-NN.jpg, c916/slide-NN.jpg
(+ c45/slide-NN.mp4 per le slide animate: la dashboard le usa su Instagram al posto della JPEG con lo stesso nome)
+ storie/ facoltativa (rendi-storie.sh): storie di Instagram e Facebook, caricate con storie.py
Con i testi manda anche le "caratteristiche" (come è fatto il contenuto, caratteristiche.py)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dashboard import carica, chiama  # noqa: E402
from storie import carica_storie  # noqa: E402
from caratteristiche import calcola  # noqa: E402

pid, uscite, dati = sys.argv[1], Path(sys.argv[2]), json.loads(Path(sys.argv[3]).read_text())
t = dati["testi"]
campi = {k: t[k] for k in ("titolo", "testo_schermo", "didascalia_ig", "didascalia_fb", "titolo_yt", "descrizione_yt", "didascalia_tt") if k in t}
if dati["formato"] == "reel":
    carica(uscite / "video.mp4", f"post/{pid}/video.mp4", "video/mp4")
    carica(uscite / "copertina.jpg", f"post/{pid}/copertina.jpg", "image/jpeg")
    campi |= {"media_key": f"post/{pid}/video.mp4", "copertina_key": f"post/{pid}/copertina.jpg", "media_key_tt": "", "brano": dati.get("brano", "")}
else:
    k45, k916 = [], []
    for f in sorted((uscite / "c45").glob("slide-*.jpg")):
        carica(f, f"post/{pid}/{f.name}", "image/jpeg"); k45.append(f"post/{pid}/{f.name}")
    for f in sorted((uscite / "c45").glob("slide-*.mp4")):
        carica(f, f"post/{pid}/{f.name}", "video/mp4")
    for f in sorted((uscite / "c916").glob("slide-*.jpg")):
        carica(f, f"post/{pid}/tt/{f.name}", "image/jpeg"); k916.append(f"post/{pid}/tt/{f.name}")
    campi |= {"slide_keys": json.dumps(k45), "slide_keys_tt": json.dumps(k916), "media_key": k45[0], "copertina_key": k45[0],
              "media_key_tt": k916[0] if k916 else "", "slide_alt": json.dumps(t.get("slide_alt", []), ensure_ascii=False)}
# "Come è fatto" il contenuto (piano "robot che imparano dai dati"): calcolato da dati.json e lavoro.json, 0 token.
# Se il calcolo fallisce il contenuto viene consegnato lo stesso, senza caratteristiche
try:
    cartella = Path(sys.argv[3]).parent
    lavoro = json.loads((cartella / "lavoro.json").read_text()) if (cartella / "lavoro.json").exists() else {}
    regole = (cartella / "regole.txt").read_text() if (cartella / "regole.txt").exists() else ""
    campi["caratteristiche"] = json.dumps(calcola(dati, lavoro, uscite, regole), ensure_ascii=False)
except Exception as e:  # noqa: BLE001
    print(f"Caratteristiche non calcolate: {e}", file=sys.stderr)
# Storie (skill storie-social): se il render delle storie non è riuscito il post esce lo stesso, senza storia
try:
    campi |= carica_storie(pid, uscite)
except Exception as e:  # noqa: BLE001
    print(f"Storie non caricate: {e}", file=sys.stderr)
print(chiama(f"/api/generatore/post/{pid}", "POST", {**campi, "fase": "pronto"}))
