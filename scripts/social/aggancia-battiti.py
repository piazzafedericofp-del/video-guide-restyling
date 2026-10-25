"""Porta gli stacchi del Reel (modello "momenti") sul battito più vicino del tratto di brano scelto (skill reel-social, ritmo).

Uso: python3 scripts/social/aggancia-battiti.py <dati.json> <brano.mp3> <secondo di inizio del brano>
Riscrive il file: per ogni piano dopo il primo sposta `da` (e `clip` dello stesso tanto, così il movimento resta continuo)
sul battito più vicino entro 0,35 s. Non sposta uno stacco se finirebbe durante una grafica (cerchio o arco),
oltre il piano precedente/successivo, o se la clip dovrebbe partire prima del suo inizio. I testi non si toccano: restano legati al movimento.
Il modello del 17/10 (senza "modello": "momenti") passa senza modifiche.
"""
import json, sys
import librosa
import numpy as np

percorso, brano, inizio = sys.argv[1], sys.argv[2], float(sys.argv[3])
dati = json.load(open(percorso))
p = dati["props"]
if p.get("modello") != "momenti":
    print("Modello del 17/10: stacchi lasciati come sono.")
    sys.exit(0)

durata = float(dati["durata"])
# Battiti sul brano intero (stessa analisi di taglio-musica.py: su un tratto corto la fase è instabile), poi nel tratto
y, sr = librosa.load(brano, sr=22050, mono=True)
_, battiti = librosa.beat.beat_track(y=y, sr=sr)
t_batt = librosa.frames_to_time(battiti, sr=sr) - inizio
t_batt = t_batt[(t_batt > 0) & (t_batt < durata)]
grafiche = [(g["da"], g["a"]) for g in ([p["segnale"]] if p.get("segnale") else []) + p.get("archi", []) + p.get("assi", [])]
dentro = lambda t: any(a < t < b for a, b in grafiche)

piani = p["piani"]
for i in range(1, len(piani)):
    q = piani[i]
    vicino = float(t_batt[np.argmin(np.abs(t_batt - q["da"]))]) if len(t_batt) else q["da"]
    delta = vicino - q["da"]
    prima = piani[i - 1]["da"] + 0.5
    dopo = piani[i + 1]["da"] - 0.5 if i + 1 < len(piani) else durata - 0.5
    # Un piano che parte dall'inizio della clip non può essere anticipato: la clip partirebbe prima di 0 (dorsale 24/10)
    if abs(delta) > 0.35 or dentro(vicino) or not (prima < vicino < dopo) or q["clip"] + delta < 0:
        print(f"piano {i + 1}: {q['da']:.2f} s lasciato (battito {vicino:.2f} s non adatto)")
        continue
    q["da"] = round(vicino, 3)
    q["clip"] = round(q["clip"] + delta, 3)
    print(f"piano {i + 1}: {q['da'] - delta:.2f} → {q['da']:.2f} s")
json.dump(dati, open(percorso, "w"), ensure_ascii=False)
