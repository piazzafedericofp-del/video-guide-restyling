"""Controlli di un Reel "momenti" prima del render (audit del 29/10/2026, skill reel-social, "Prima del render").

Uso: python3 scripts/social/controlla-reel.py <dati.json> [--clip <sorgente>] [--qualita <clip-qualita.json>]
Righe "✗" = da correggere (il render si ferma e la routine corregge una volta), "!" = avviso. Esce con 1 se c'è una ✗.
1. Bordi neri: in ogni piano (allo zoom più basso, camera a mano compresa) e nella copertina la clip copre lo schermo
   sui 4 lati. Prima si guardava solo il bordo alto: ginocchio, collo, gobba e TRX avevano bande da 10 a 84 px.
2. Lettura: ogni testo resta almeno il tempo di leggerlo, al massimo 20 caratteri al secondo (skill, Leggibilità).
3. Nitidezza: lo zoom di ogni piano resta entro il massimo della clip. Sullo schermo il dettaglio reale D/zoom deve
   restare ≥ 350 px nei piani e ≥ 300 nel gancio; per le clip compresse (blocchi ≥ 1,30, D < 600, scaricate da
   Instagram) ≥ 450 e ≥ 400 (soglie tarate sull'anca a5b3c116, che sgranava a zoom 2,0). Con --clip il dettaglio si
   misura sul tratto usato da ogni piano; in ogni caso vale anche lo zoom massimo scritto in clip-qualita.json.
4. Tratti da non usare, da clip-qualita.json: `evita` [[da, a]] e `solo` [[da, a]] in secondi della clip,
   `evita_zone` [{da, a, x0, y0, x1, y1, zoom_oltre?}] = riquadro della clip (pixel 1080×1920) rovinato dalla pulizia
   in quei secondi, `tratti_deboli` [{da, a, zoom_max, zoom_max_gancio}] = secondi della clip più morbidi della media.
"""
import json
import subprocess
import sys
from pathlib import Path


def opzione(nome):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else None


dati = json.load(open(sys.argv[1]))
p = dati.get("props", dati)
if p.get("modello") != "momenti":
    print("Modello del 17/10: controlli non previsti.")
    sys.exit(0)
durata = float(dati.get("durata", 0))
W, H = p["larghezza"], p["altezza"]
k = 1920 / H
piani = p["piani"]
fine = [piani[i + 1]["da"] if i + 1 < len(piani) else durata for i in range(len(piani))]
fq = opzione("--qualita")
Q = json.load(open(fq)).get("clip", {}).get(dati.get("clip", ""), {}) if fq and Path(fq).exists() else {}
errori, avvisi = [], []

# ─── 1. Bordi neri sui 4 lati ───
# Il modello muove la camera "a mano" fino a 5 px in orizzontale e 4,2 in verticale; una banda fino a 6 px non si vede
MANO_X, MANO_Y, TOLLERA = 5.0, 4.2, 6.0


def bande(z, cx, cy, ay):
    s = z * k
    return {"sinistra": 540 - cx * s + MANO_X, "destra": 540 + MANO_X - (W - cx) * s,
            "alto": ay - cy * s + MANO_Y, "basso": 1920 + MANO_Y - ay - (H - cy) * s}


def zoom_minimo(cx, cy, ay):
    serve = [(540 + MANO_X - TOLLERA) / (cx * k) if cx > 0 else 99, (540 + MANO_X - TOLLERA) / ((W - cx) * k) if W > cx else 99,
             (1920 - TOLLERA + MANO_Y - ay) / ((H - cy) * k) if H > cy else 99]
    if cy > 0:
        serve.append((ay + MANO_Y - TOLLERA) / (cy * k))
    return max(serve)


def controlla_bordi(nome, z, cx, cy, ay):
    b = {lato: v for lato, v in bande(z, cx, cy, ay).items() if v > TOLLERA}
    if not b:
        return
    zm = zoom_minimo(cx, cy, ay)
    consiglio = f"serve zoom ≥ {zm:.2f} con questi cx/cy/ay, oppure sposta cx/ay" if zm < 3 else "sposta cx o ay verso il centro della clip"
    if "alto" in b and cy == 0:
        consiglio = "con cy 0 il bordo alto resta fuori solo se ay ≤ 0; " + consiglio
    errori.append(f"{nome}: banda nera " + ", ".join(f"{lato} {v:.0f} px" for lato, v in b.items()) + f" ({consiglio})")


for i, q in enumerate(piani):
    controlla_bordi(f"piano {i + 1} ({q['da']:.2f}-{fine[i]:.2f} s)", min(q["z0"], q["z1"]), q["cx"], q["cy"], q["ay"])
c = p.get("copertina")
if isinstance(c, dict):
    controlla_bordi("copertina", c["z"], c["cx"], c["cy"], c["ay"])

# ─── 2. Velocità di lettura ───
LIMITE = 20.0
car = lambda t: len(" ".join(str(t).split()))
testi = []
g = p["gancio"]
if not g.get("parlato"):
    testi.append(("gancio", car(" ".join(g["righe"])), 0.0, g["a"]))
testi.append(("perché", car(p["perche"]["testo"]), p["perche"]["da"], p["perche"]["a"]))
voci = p["passi"]["voci"]
for i, v in enumerate(voci):
    testi.append((f"passo {i + 1}", car(v["testo"]), v["da"], voci[i + 1]["da"] if i + 1 < len(voci) else p["passi"]["a"]))
e = p.get("errore")
if e:
    testi += [("così no", car(e["no"]), e["da"], e["meta"]), ("così sì", car(e["si"]), e["meta"], e["a"])]
d = p["dosaggio"]
parole = d.get("parole") or ["ripetizioni", "serie"]
testi.append(("dosaggio", car(f"{d['ripetizioni']} {parole[0]} {d['serie']} {parole[1]} {d['etichetta']}"), d["da"], d["a"]))
testi.append(("invito", car(p["invito"]["testo"]), p["invito"]["da"], durata))
for nome, n, da, a in testi:
    t = a - da
    if t <= 0:
        errori.append(f"{nome}: dura 0 s")
    elif n / t > LIMITE + 0.5:
        # Il dosaggio si allunga a spese dell'invito, che resta fino alla fine (audit 29/10: era il tratto più lungo senza novità)
        come = (f"porta dosaggio.a e invito.da a {da + n / LIMITE:.2f}" if nome == "dosaggio"
                else "allunga il tratto o accorcia il testo")
        errori.append(f"{nome} ({da:.2f}-{a:.2f} s): {n} caratteri in {t:.2f} s = {n / t:.0f} al secondo; "
                      f"deve restare almeno {n / LIMITE:.2f} s ({come})")

# ─── 3. Nitidezza: zoom massimo della clip ───
limite_q = (Q.get("zoom_max"), Q.get("zoom_max_gancio"))
gancio = [q["da"] == 0 and fine[i] - q["da"] <= 0.6 for i, q in enumerate(piani)]
misurati = [None] * len(piani)
sorgente = opzione("--clip")
if sorgente:
    import numpy as np
    from PIL import Image

    def leggi(t):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", sorgente, "-frames:v", "1", "-vf",
                              "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=gray", "-f", "rawvideo", "-"],
                             capture_output=True, stdin=subprocess.DEVNULL).stdout
        return np.frombuffer(raw[: 1080 * 1920], np.uint8).reshape(1920, 1080).astype(np.float64)

    def media(a, n):
        c = np.cumsum(np.cumsum(np.pad(a, ((1, 0), (1, 0))), 0), 1)
        return (c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]) / (n * n)

    def ssim(x, y, n=7):
        mx, my = media(x, n), media(y, n)
        sxx, syy, sxy = media(x * x, n) - mx * mx, media(y * y, n) - my * my, media(x * y, n) - mx * my
        return ((2 * mx * my + 6.5025) * (2 * sxy + 58.5225)) / ((mx * mx + my * my + 6.5025) * (sxx + syy + 58.5225))

    def bordi(a, n=7):
        gy, gx = np.gradient(media(a, 5))
        g = np.hypot(gx, gy)
        m = g > max(4.0, np.percentile(g, 85))
        f = np.zeros(a.shape, bool)
        f[2:2 + m.shape[0], 2:2 + m.shape[1]] = m
        return f[3:3 + a.shape[0] - n + 1, 3:3 + a.shape[1] - n + 1]

    riduci = lambda a, w, h: np.asarray(Image.fromarray(a.astype(np.float32), mode="F").resize((w, h), Image.LANCZOS), dtype=np.float64)

    # Dettaglio reale D: la larghezza più piccola a cui il fotogramma si riduce e torna a 1080 quasi uguale (SSIM ≥ 0,99 sui bordi)
    def dettaglio(a):
        m, prima = bordi(a), None
        for w in (270, 360, 432, 540, 648, 720, 864):
            s = float(ssim(a, riduci(riduci(a, w, round(1920 * w / 1080)), 1080, 1920))[m].mean())
            if s >= 0.99:
                return float(w) if prima is None else prima[0] + (0.99 - prima[1]) / (s - prima[1]) * (w - prima[0])
            prima = (w, s)
        return 1080.0

    # Blocchi della compressione: salto medio sulla griglia di 8 px rispetto alle altre colonne e righe (1,00 = nessuno)
    def blocchi(a):
        r = []
        for dd in (np.abs(np.diff(a, axis=1)).mean(0), np.abs(np.diff(a, axis=0)).mean(1)):
            i = np.arange(len(dd))
            r.append(dd[(i + 1) % 8 == 0].mean() / dd[(i + 1) % 8 != 0].mean())
        return float(np.mean(r))

    lunghezza = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", sorgente],
                                     capture_output=True, text=True).stdout.strip() or 0)
    campioni = [leggi(t) for t in np.linspace(0.4, max(0.5, lunghezza - 0.4), 8)]
    D = float(np.median([dettaglio(a) for a in campioni]))
    B = float(np.median([blocchi(a) for a in campioni]))
    compressa = bool(Q.get("compressa")) or B >= 1.30 or D < 600
    soglia_p, soglia_g = (450, 400) if compressa else (350, 300)
    print(f"Dettaglio reale {D:.0f} px, blocchi {B:.2f}: clip {'compressa' if compressa else 'pulita'}; "
          f"zoom massimo {min(2.3, D / soglia_p):.2f} nei piani, {min(2.3, D / soglia_g):.2f} nel gancio")
    if D / soglia_p < 1.15:
        avvisi.append("clip troppo morbida anche a zoom 1: da scartare o rigirare")
    for i, q in enumerate(piani):
        c0 = q["clip"]
        c1 = min(lunghezza - 0.05, c0 + fine[i] - q["da"])
        Dp = min(D, *(dettaglio(leggi(t)) for t in (c0 + 0.05, (c0 + c1) / 2)))
        misurati[i] = (min(2.3, Dp / (soglia_g if gancio[i] else soglia_p)), Dp)

for i, q in enumerate(piani):
    z = max(q["z0"], q["z1"])
    lim, perche = limite_q[1 if gancio[i] else 0], "clip-qualita.json"
    # Tratti più deboli della media (es. gli ultimi secondi dell'alluce): vale il loro limite
    for t in Q.get("tratti_deboli", []):
        if min(q["clip"] + fine[i] - q["da"], t["a"]) - max(q["clip"], t["da"]) > 0.05:
            tl = t["zoom_max_gancio" if gancio[i] else "zoom_max"]
            if lim is None or tl < lim:
                lim, perche = tl, f"tratto debole {t['da']}-{t['a']} s della clip, clip-qualita.json"
    if misurati[i] and (lim is None or misurati[i][0] < lim):
        lim, perche = misurati[i][0], f"dettaglio del tratto {misurati[i][1]:.0f} px, sullo schermo {misurati[i][1] / z:.0f}"
    if lim is not None and z > lim + 0.02:
        errori.append(f"piano {i + 1} ({q['da']:.2f}-{fine[i]:.2f} s, {'gancio' if gancio[i] else 'piano'}): zoom {z} oltre il "
                      f"massimo {lim:.2f} della clip ({perche}): sgrana")

# ─── 4. Tratti della clip da non usare ───
sovrappone = lambda a0, a1, b0, b1: min(a1, b1) - max(a0, b0) > 0.05
for i, q in enumerate(piani):
    c0, c1 = q["clip"], q["clip"] + fine[i] - q["da"]
    nome = f"piano {i + 1} ({q['da']:.2f}-{fine[i]:.2f} s, clip {c0:.1f}-{c1:.1f} s)"
    for a0, a1 in Q.get("evita", []):
        if sovrappone(c0, c1, a0, a1):
            errori.append(f"{nome}: usa il tratto {a0}-{a1} s della clip, da evitare ({Q.get('nota', '')})")
    if Q.get("solo") and not any(c0 >= a0 - 0.05 and c1 <= a1 + 0.05 for a0, a1 in Q["solo"]):
        errori.append(f"{nome}: esce dai tratti usabili {Q['solo']} ({Q.get('nota', '')})")
    s = min(q["z0"], q["z1"]) * k
    vista = (q["cx"] - 540 / s, q["cy"] - q["ay"] / s, q["cx"] + 540 / s, q["cy"] + (1920 - q["ay"]) / s)
    for z in Q.get("evita_zone", []):
        # `zoom_oltre`: la zona si nota solo da quello zoom in su (a quadro largo la ricostruzione non si vede)
        if max(q["z0"], q["z1"]) <= z.get("zoom_oltre", 0):
            continue
        if sovrappone(c0, c1, z["da"], z["a"]) and vista[0] < z["x1"] and vista[2] > z["x0"] and vista[1] < z["y1"] and vista[3] > z["y0"]:
            errori.append(f"{nome}: mostra la zona x {z['x0']}-{z['x1']}, y {z['y0']}-{z['y1']} della clip, rovinata dalla pulizia "
                          f"tra {z['da']} e {z['a']} s ({Q.get('nota', '')})")
if isinstance(c, dict):
    for a0, a1 in Q.get("evita", []):
        if a0 <= c["clip"] <= a1:
            errori.append(f"copertina: fotogramma a {c['clip']} s della clip, nel tratto da evitare {a0}-{a1} s")

for r in errori:
    print("  ✗ " + r)
for r in avvisi:
    print("  ! " + r)
print("Reel: tutto a posto." if not errori else f"Reel: {len(errori)} problemi da correggere.")
sys.exit(1 if errori else 0)
