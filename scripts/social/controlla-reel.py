"""Controlli di un Reel "momenti" prima del render (audit del 29/10/2026, skill reel-social, "Prima del render").

Uso: python3 scripts/social/controlla-reel.py <dati.json> [--clip <sorgente>] [--qualita <clip-qualita.json>] [--posa <posa.json>]
     python3 scripts/social/controlla-reel.py --misura <clip> [--qualita | --scrivi <clip-qualita.json>]   # voce di qualità
Righe "✗" = da correggere (il render si ferma e la routine corregge una volta), "!" = avviso. Esce con 1 se c'è una ✗.
1. Bordi neri: in ogni piano (allo zoom più basso, camera a mano compresa) e nella copertina la clip copre lo schermo
   sui 4 lati. Prima si guardava solo il bordo alto: ginocchio, collo, gobba e TRX avevano bande da 10 a 84 px.
2. Lettura: ogni testo resta almeno il tempo di leggerlo, al massimo 20 caratteri al secondo (skill, Leggibilità).
3. Nitidezza: lo zoom di ogni piano resta entro il massimo della clip. Sullo schermo il dettaglio reale D/zoom deve
   restare ≥ 350 px nei piani e ≥ 300 nel gancio; per le clip compresse (blocchi ≥ 1,30, D < 600, scaricate da
   Instagram) ≥ 450 e ≥ 400 (soglie tarate sull'anca a5b3c116, che sgranava a zoom 2,0). Con --clip il dettaglio si
   misura sui soli tratti usabili (fuori da `evita`, dentro `solo`) e sul tratto usato da ogni piano; in ogni caso vale
   anche lo zoom massimo scritto in clip-qualita.json, che va scritto con --misura (gli stessi numeri del render).
4. Tratti da non usare, da clip-qualita.json: `evita` [[da, a]] e `solo` [[da, a]] in secondi della clip,
   `evita_zone` [{da, a, x0, y0, x1, y1, zoom_oltre?}] = riquadro della clip (pixel 1080×1920) rovinato dalla pulizia
   in quei secondi, `tratti_deboli` [{da, a, zoom_max, zoom_max_gancio, accettato?}] = secondi della clip più morbidi
   della media; con `accettato` (il motivo, solo con l'ok di Federico) vale il loro limite anche se la misura è più bassa.
5. Con --posa (posa.py), avvisi: viso sotto un testo, gesto fuori dalla zona visibile o sotto il riquadro del passo,
   pulsante dell'invito sopra mani o piedi (audit del 29/10: gomito, stacco su una gamba, anca, lento avanti).
6. Frecce che traballano (Federico, 30/10/2026, sul bacino di 98c9b323: "la freccia che muove il bacino traballa"): la
   direzione della freccia, fotogramma per fotogramma come la disegna il modello, non deve girare avanti e indietro.
   Si conta l'andirivieni in gradi (giri totali meno il giro netto): il bacino bocciato faceva 82°, le frecce approvate
   fino al 03/11 al massimo 29°. Da 45° è una ✗, da 30° un avviso.
7. Misure dei testi (11/11/2026): righe del gancio ≤ 13 caratteri, del perché ≤ 24, al massimo 3 passi,
   nessuna promessa a schermo (✗); seconda riga dell'invito ≤ 18, parole del gancio, sottotitolo di copertina, durata e parola del
   problema uguale in copertina, gancio e invito (avvisi); dall'11/11/2026 anche il perché che ripete le parole del gancio (avviso).
"""
import json
import math
import subprocess
import sys
from pathlib import Path


def opzione(nome):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else None


def tratti_utili(lunghezza, Q):
    """Secondi che un piano può usare: dentro `solo`, fuori da `evita` (30/10/2026: i primi 2 s sfocati della cervicale,
    da evitare, portavano il dettaglio di tutta la clip da 623 a 596 px, sotto i 600 delle clip compresse)."""
    tratti = [(0.4, max(0.5, lunghezza - 0.4))]
    if Q.get("solo"):
        tratti = [(max(a, s0), min(b, s1)) for a, b in tratti for s0, s1 in Q["solo"] if min(b, s1) > max(a, s0)]
    for e0, e1 in Q.get("evita", []):
        tratti = [(a2, b2) for a, b in tratti for a2, b2 in ((a, min(b, e0)), (max(a, e1), b)) if b2 > a2]
    return [(a, b) for a, b in tratti if b - a >= 0.2] or [(0.4, max(0.5, lunghezza - 0.4))]


def istanti(tratti, n=8):
    """n istanti equidistanti lungo i tratti messi in fila (con un tratto solo sono quelli di np.linspace)."""
    tot = sum(b - a for a, b in tratti)
    out = []
    for j in range(n):
        s = tot * j / (n - 1)
        for a, b in tratti:
            if s <= b - a + 1e-9:
                out.append(a + min(s, b - a))
                break
            s -= b - a
        else:
            out.append(tratti[-1][1])
    return out


def misura_clip(sorgente, Q):
    """Dettaglio reale D e blocchi B della clip, come li misura il render. Una funzione sola anche per --misura, così
    clip-qualita.json ha gli stessi numeri del render (30/10/2026: la voce del gomito diceva 765 px, il render ne ha
    misurati 668 e ha fermato un Reel che il controllo della routine aveva passato)."""
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
    campioni = [leggi(t) for t in istanti(tratti_utili(lunghezza, Q))]
    D = float(np.median([dettaglio(a) for a in campioni]))
    B = float(np.median([blocchi(a) for a in campioni]))
    compressa = bool(Q.get("compressa")) or B >= 1.30 or D < 600
    return {"D": D, "B": B, "compressa": compressa, "soglie": (450, 400) if compressa else (350, 300),
            "lunghezza": lunghezza, "dettaglio_a": lambda t: dettaglio(leggi(t))}


if "--misura" in sys.argv:
    # Voce di clip-qualita.json con i numeri del render:
    #   --misura <clip> [--qualita <clip-qualita.json>]  la stampa (con --qualita conta `evita`, `solo` e `compressa` già scritti)
    #   --misura <clip> --scrivi <clip-qualita.json>     la aggiunge se la clip non ce l'ha (posa.yml); le altre non si toccano
    clip = opzione("--misura")
    id_clip = Path(clip).stem
    fq = opzione("--scrivi") or opzione("--qualita")
    tutte = json.load(open(fq)) if fq and Path(fq).exists() else {}
    m = misura_clip(clip, tutte.get("clip", {}).get(id_clip, {}))
    giu = lambda x: math.floor(round(min(2.3, x) * 100, 6)) / 100  # per difetto, ma 2,3 resta 2,3 (non 2,29)
    voce = {"dettaglio": round(m["D"]), "blocchi": round(m["B"], 2), "compressa": m["compressa"],
            "zoom_max": giu(m["D"] / m["soglie"][0]), "zoom_max_gancio": giu(m["D"] / m["soglie"][1])}
    print(json.dumps(voce))
    if opzione("--scrivi") and id_clip not in tutte.get("clip", {}):
        voce.update(esito="misura", nota="Misura automatica del render (controlla-reel.py --misura): nessuno ha ancora guardato la clip.")
        tutte.setdefault("clip", {})[id_clip] = voce
        Path(fq).write_text(json.dumps(tutte, indent=1, ensure_ascii=False))  # stesso formato del file, diff di poche righe
    sys.exit(0)

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
    m = misura_clip(sorgente, Q)
    D, B, lunghezza = m["D"], m["B"], m["lunghezza"]
    soglia_p, soglia_g = m["soglie"]
    print(f"Dettaglio reale {D:.0f} px, blocchi {B:.2f}: clip {'compressa' if m['compressa'] else 'pulita'}; "
          f"zoom massimo {min(2.3, D / soglia_p):.2f} nei piani, {min(2.3, D / soglia_g):.2f} nel gancio")
    if D / soglia_p < 1.15:
        avvisi.append("clip troppo morbida anche a zoom 1: da scartare o rigirare")
    for i, q in enumerate(piani):
        c0 = q["clip"]
        c1 = min(lunghezza - 0.05, c0 + fine[i] - q["da"])
        Dp = min(D, *(m["dettaglio_a"](t) for t in (c0 + 0.05, (c0 + c1) / 2)))
        misurati[i] = (min(2.3, Dp / (soglia_g if gancio[i] else soglia_p)), Dp)

for i, q in enumerate(piani):
    z = max(q["z0"], q["z1"])
    lim, perche = limite_q[1 if gancio[i] else 0], "clip-qualita.json"
    accettato = False
    # Tratti più deboli della media (es. gli ultimi secondi dell'alluce): vale il loro limite
    for t in Q.get("tratti_deboli", []):
        c0, c1 = q["clip"], q["clip"] + fine[i] - q["da"]
        if min(c1, t["a"]) - max(c0, t["da"]) > 0.05:
            tl = t["zoom_max_gancio" if gancio[i] else "zoom_max"]
            # `accettato` (con il motivo): morbido già nella sorgente e tenuto per scelta di Federico; vale il suo limite
            # (di solito 1, nessuno zoom) al posto della misura, solo per i piani tutti dentro il tratto (alluce, 30/10/2026)
            if t.get("accettato") and c0 >= t["da"] - 0.05 and c1 <= t["a"] + 0.05:
                lim, perche, accettato = tl, f"tratto {t['da']}-{t['a']} s accettato: {t['accettato']}", True
                break
            if lim is None or tl < lim:
                lim, perche = tl, f"tratto debole {t['da']}-{t['a']} s della clip, clip-qualita.json"
    if misurati[i] and not accettato and (lim is None or misurati[i][0] < lim):
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

# ─── 5. Dalla posa (posa.py): viso sotto i testi, gesto fuori dalla zona visibile, pulsante sopra mani o piedi ───
# Avvisi, non errori: la posa è una stima. Nell'audit del 29/10 il pulsante copriva le mani nell'80-93% del finale in 4 Reel
fp = opzione("--posa")
if fp and Path(fp).exists():
    posa = json.load(open(fp))
    idx = {n: i for i, n in enumerate(posa["punti"])}

    def punto(nome, tc):
        i = round(tc * posa["fps"])
        if not 0 <= i < len(posa["xy"]) or not posa["xy"][i]:
            return None
        x, y, v = posa["xy"][i][idx[nome]]
        return (x, y) if v >= 0.5 else None

    def schermo(t, P):
        i = max(j for j, q in enumerate(piani) if q["da"] <= t + 1e-6) if any(q["da"] <= t + 1e-6 for q in piani) else 0
        q = piani[i]
        z = (q["z0"] + (q["z1"] - q["z0"]) * min(1, max(0, (t - q["da"]) / max(0.01, fine[i] - q["da"])))) * k
        return 540 + (P[0] - q["cx"]) * z, q["ay"] + (P[1] - q["cy"]) * z, q["clip"] + t - q["da"]

    def campioni(da, a):
        return [da + j * 0.1 for j in range(max(1, int((a - da) / 0.1)))]

    righe = lambda testo, al_rigo: sum(max(1, math.ceil(len(r) / al_rigo)) for r in str(testo).split("\n"))
    riquadri = [("gancio", 0, g["a"], (180, 270, 900, 270 + 95 * len(g["righe"])))] if not g.get("parlato") else []
    riquadri.append(("perché", p["perche"]["da"], p["perche"]["a"], (180, 286, 900, 322 + 70 * righe(p["perche"]["testo"], 24))))
    for i, v in enumerate(voci):
        a = voci[i + 1]["da"] if i + 1 < len(voci) else p["passi"]["a"]
        riquadri.append((f"passo {i + 1}", v["da"], a, (180, 272, 900, 346 + 54 * righe(v["testo"], 22))))
    riquadri.append(("dosaggio", d["da"], d["a"], (180, 262 if not d.get("anello") else 286, 900, 480 if not d.get("anello") else 590)))
    yi = p["invito"].get("y", 1175)
    pulsante = (195, yi, 885, yi + 170)
    riquadri.append(("invito", p["invito"]["da"], durata, pulsante))
    for nome, da, a, (x0, y0, x1, y1) in riquadri:
        coperto = []
        for t in campioni(da, a):
            pt = [punto(n, schermo(t, (0, 0))[2]) for n in ("occhio_s", "occhio_d", "naso", "bocca_s", "bocca_d", "orecchio_s", "orecchio_d")]
            pt = [schermo(t, q)[:2] for q in pt if q]
            if len(pt) < 3:
                continue
            xs, ys = [q[0] for q in pt], [q[1] for q in pt]
            h = max(20, (max(ys) - min(ys)))
            vx0, vy0, vx1, vy1 = min(xs) - 0.4 * h, min(ys) - 1.2 * h, max(xs) + 0.4 * h, max(ys) + 0.8 * h
            inter = max(0, min(vx1, x1) - max(vx0, x0)) * max(0, min(vy1, y1) - max(vy0, y0))
            if inter > 0.25 * (vx1 - vx0) * (vy1 - vy0):
                coperto.append(t)
        if len(coperto) >= 2:
            avvisi.append(f"viso sotto {nome} a {coperto[0]:.1f}-{coperto[-1]:.1f} s: il viso non va mai coperto (zoom o ay del piano)")

    ESTREMI = ("polso_s", "polso_d", "indice_s", "indice_d", "gomito_s", "gomito_d", "ginocchio_s", "ginocchio_d",
               "caviglia_s", "caviglia_d", "tallone_s", "tallone_d", "punta_s", "punta_d")
    # Il gesto di ogni passo = i 2 punti che si muovono di più; "fuori" = oltre il bordo, sotto la barra in alto (250),
    # sotto la didascalia in basso (1700) o sotto il riquadro del passo
    for nome, da, a, box in [r for r in riquadri if r[0].startswith("passo")]:
        tt = campioni(da, a)
        gesto = []
        for n in ESTREMI:
            vis = [(t, q) for t in tt if (q := punto(n, schermo(t, (0, 0))[2]))]
            if len(vis) >= max(3, len(tt) // 2):
                escursione = max(max(q[0] for _, q in vis) - min(q[0] for _, q in vis), max(q[1] for _, q in vis) - min(q[1] for _, q in vis))
                gesto.append((escursione, n, vis))
        for escursione, n, vis in sorted(gesto, reverse=True)[:2]:
            if escursione < 60:
                continue
            fuori = [t for t, q in vis if (s := schermo(t, q)) and (s[0] < 40 or s[0] > 1040 or s[1] < 250 or s[1] > 1700
                                                                    or (box[0] < s[0] < box[2] and box[1] < s[1] < box[3]))]
            if len(fuori) > 0.3 * len(vis):
                avvisi.append(f"{nome}: il gesto ({n}) esce dallo schermo o finisce sotto barra, didascalia o testo per "
                              f"{100 * len(fuori) // len(vis)}% del passo ({fuori[0]:.1f}-{fuori[-1]:.1f} s): piano più largo o cx/ay diversi")
                break

    sopra = []
    tt = campioni(p["invito"]["da"], durata)
    for t in tt:
        tc = schermo(t, (0, 0))[2]
        if any((q := punto(n, tc)) and pulsante[0] < (s := schermo(t, q))[0] < pulsante[2] and pulsante[1] < s[1] < pulsante[3]
               for n in ("polso_s", "polso_d", "indice_s", "indice_d", "ginocchio_s", "ginocchio_d", "caviglia_s", "caviglia_d",
                         "tallone_s", "tallone_d", "punta_s", "punta_d")):
            sopra.append(t)
    if len(sopra) > 0.3 * max(1, len(tt)):
        avvisi.append(f"invito: il pulsante a y {yi} copre mani o piedi nel {100 * len(sopra) // max(1, len(tt))}% del finale: "
                      "spostalo in alto (invito.y ~300, se lì non c'è il viso)")

# ─── 6. Frecce che traballano ───
# Stessa geometria di FrecciaMisurata (ReelMomenti.tsx): freccia dritta dal primo punto al punto di adesso, allungata
# all'indietro fino a lunghezzaMin, disegnata da 12 px. Lo zoom del piano non cambia gli angoli, solo le lunghezze
def interpola(xs, t):
    if t <= xs[0][0]:
        return xs[0][1]
    for (t0, v0), (t1, v1) in zip(xs, xs[1:]):
        if t0 <= t <= t1:
            return v0 + (v1 - v0) * (t - t0) / max(1e-9, t1 - t0)
    return xs[-1][1]


for n, fr in enumerate(p.get("frecce") or [], 1):
    pt = fr["punti"]
    if len(pt) < 2:
        continue
    angoli = []
    for j in range(int((fr["a"] - fr["da"]) * 30) + 1):
        t = fr["da"] + j / 30
        i = max([m for m, q in enumerate(piani) if q["da"] <= t + 1e-6] or [0])
        z = (piani[i]["z0"] + (piani[i]["z1"] - piani[i]["z0"]) * min(1, max(0, (t - piani[i]["da"]) / max(0.01, fine[i] - piani[i]["da"])))) * k
        ax, ay = interpola([(q["t"], q["x"]) for q in pt], t), interpola([(q["t"], q["y"]) for q in pt], t)
        prima = [(q["x"], q["y"]) for q in pt if q["t"] < t] + [(ax, ay)]
        if len(prima) < 2:
            continue
        percorso = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(prima, prima[1:])) * z
        dx, dy = (ax - pt[0]["x"]) * z, (ay - pt[0]["y"]) * z
        pieno = min(1, (t - fr["da"]) / max(0.01, pt[-1]["t"] - fr["da"]))
        allungo = max(0, fr.get("lunghezzaMin", 0) - percorso) * pieno
        if math.hypot(dx, dy) < 1e-6 or math.hypot(dx, dy) + allungo < 12:
            continue
        a = math.degrees(math.atan2(dy, dx))
        if angoli:
            a += 360 * round((angoli[-1] - a) / 360)
        angoli.append(a)
    if len(angoli) < 3:
        continue
    andirivieni = sum(abs(b - a) for a, b in zip(angoli, angoli[1:])) - abs(angoli[-1] - angoli[0])
    nome = f"freccia {n} ({fr['da']:.2f}-{fr['a']:.2f} s)"
    rimedio = ("rifai i punti con `grafiche-posa.py <posa> <dati> freccia <punto> <da> <a> --dritta` (sulla linea dall'inizio "
               "alla fine del gesto, solo in avanti, come il bacino di 98c9b323) o scegli un tratto dove il gesto è più ampio")
    if andirivieni >= 45:
        errori.append(f"{nome}: la punta gira avanti e indietro di {andirivieni:.0f}° mentre avanza, traballa: {rimedio}")
    elif andirivieni >= 30:
        avvisi.append(f"{nome}: la punta gira avanti e indietro di {andirivieni:.0f}°, al limite (il bacino bocciato ne faceva 82): {rimedio}")

# ─── 7. Misure dei testi scritte nella skill (audit dell'11/11/2026) ───
# Erano regole controllate solo a occhio e dal revisore (170-190 mila token a giro): qui costano zero. ✗ solo dove la
# misura è netta (il testo si rimpicciolisce o tocca la firma, promesse vietate); il resto è un avviso, perché decide chi legge.
import re

parole_di = lambda t: re.findall(r"[a-zà-ù']+", str(t).lower())
if not g.get("parlato"):
    for r in g["righe"]:
        if len(r) > 13:
            errori.append(f"gancio: la riga «{r}» ha {len(r)} caratteri, al massimo 13 (oltre il titolo scende sotto ~60 px e sembra "
                          "una didascalia): spezzala, anche su 3 righe")
    n = len(parole_di(" ".join(g["righe"])))
    if not 3 <= n <= 8:
        avvisi.append(f"gancio: {n} parole, la skill ne chiede 3-8")
rp = [r for r in str(p["perche"]["testo"]).split("\n") if r.strip()]
for r in rp:
    if len(r) > 24:
        errori.append(f"perché: la riga «{r}» ha {len(r)} caratteri, al massimo 24 (rimando al video compreso)")
if len(rp) > 2:
    avvisi.append(f"perché: {len(rp)} righe, la skill ne chiede due")
if len(voci) > 3:
    errori.append(f"passi: sono {len(voci)}, al massimo 3")
ri = [r for r in str(p["invito"]["testo"]).split("\n") if r.strip()]
for r in ri[1:]:
    if len(r) > 18:
        # Avviso e non ✗: se tocca davvero la firma lo ferma controlla-zone.py (3 Reel approvati hanno righe da 19-20)
        avvisi.append(f"invito: la riga «{r}» ha {len(r)} caratteri, la skill ne chiede al massimo 18 (oltre può andare a capo e toccare la firma)")
VIETATE = re.compile(r"\b(elimin\w+|risolv\w+|guari\w+|addio)\b", re.I)
a_schermo = [("gancio", " ".join(g.get("righe") or [])), ("perché", p["perche"]["testo"]), ("invito", p["invito"]["testo"])] + \
            [(f"passo {i + 1}", v["testo"]) for i, v in enumerate(voci)]
if isinstance(c, dict):
    a_schermo += [("titolo di copertina", " ".join(c.get("righe") or [])), ("sottotitolo di copertina", c.get("sotto") or "")]
    if len(parole_di(c.get("sotto") or "")) > 6:
        avvisi.append(f"copertina: il sottotitolo ha {len(parole_di(c['sotto']))} parole, al massimo 6")
    # Prova del filo, punto 1: la parola del problema (riga gialla della copertina) torna uguale in gancio e invito
    gc = c.get("gialla", 0)
    gialle = [(c.get("righe") or [])[i] for i in (gc if isinstance(gc, list) else [gc]) if i < len(c.get("righe") or [])]
    problema = [w for w in parole_di(" ".join(gialle)) if len(w) > 3]
    for dove, testo in (("gancio", " ".join(g.get("righe") or [])), ("invito", p["invito"]["testo"])):
        mancano = [w for w in problema if w not in parole_di(testo)]
        if problema and mancano and not g.get("parlato"):
            avvisi.append(f"filo: «{' '.join(mancano)}» è il problema in giallo sulla copertina ma non c'è nel testo di {dove} "
                          "(una sola parola del problema, identica in gancio, invito e copertina: skill, prova del filo punto 1)")
# Il perché non ripete le parole del titolo (Federico, 11/11/2026: «nel testo dopo non ripetere sempre le stesse parole del
# titolo sennò diventa ridondante»): riprende il problema con un pronome o nomina la parte allenata. Avviso, non ✗: i Reel
# approvati prima di questa regola si rifanno solo col tasto «Rigeneralo», e il render li ricontrolla.
if not g.get("parlato"):
    vuote = {"hai", "quando", "dopo", "senti", "stai", "sono", "molto", "anche", "così", "questo", "questi", "modo", "come"}
    nel_gancio = {w for w in parole_di(" ".join(g.get("righe") or [])) if len(w) > 3 and w not in vuote}
    radice = lambda w: w[:5]  # spalla/spalle, rigido/rigida: stessa parola con un'altra desinenza
    ripetute = [w for w in parole_di(p["perche"]["testo"]) if len(w) > 3 and radice(w) in {radice(x) for x in nel_gancio}]
    if ripetute:
        avvisi.append(f"perché: ripete «{' '.join(dict.fromkeys(ripetute))}» del gancio; riprendi il problema con un pronome "
                      "(«Rinforzale in questo modo») o nomina la parte allenata (skill, momento 2, regola dell'11/11/2026)")
for dove, testo in a_schermo:
    if (m := VIETATE.search(str(testo))):
        errori.append(f"{dove}: «{m.group(0)}» è una promessa di risultato, vietata (skill: mai elimina, risolve, guarisce)")
if durata and not 12 <= durata <= 45:
    avvisi.append(f"durata {durata:.1f} s: la skill chiede 15-30 s (25-45 per parlato e assaggio della guida)")

for r in errori:
    print("  ✗ " + r)
for r in avvisi:
    print("  ! " + r)
print("Reel: tutto a posto." if not errori else f"Reel: {len(errori)} problemi da correggere.")
sys.exit(1 if errori else 0)
