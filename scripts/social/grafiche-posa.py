"""Punti del corpo dalla posa (posa.py) per le grafiche di un Reel "momenti" (skill reel-social, "Grafiche di movimento").

La routine non stima più i punti a occhio sull'anteprima (audit del 29/10/2026: per questo metteva quasi solo un cerchio):
li legge dalla posa calcolata sulla clip, in pixel 1080×1920. I secondi da/a sono del Reel: lo script li porta nella clip
con i piani del dati.json (secondo della clip = clip + (t − da) del piano attivo), quindi i piani vanno scritti prima.
Punti: naso, occhio, orecchio, bocca, spalla, gomito, polso, indice, anca, ginocchio, caviglia, tallone, punta, con "_s" o
"_d" (sinistra/destra DELLA PERSONA) oppure senza suffisso = punto medio dei due lati; "a+b" = punto medio di due punti.
Uso (stampa il JSON da mettere nei dati; avvisi su stderr):
  grafiche-posa.py <posa.json> punti <secondo della CLIP>                            tutti i punti e il riquadro del viso
  grafiche-posa.py <posa.json> <dati.json> segnale <punto> <da> <a>                  cerchio (posizione media nel tratto)
  grafiche-posa.py <posa.json> <dati.json> zona <punto> <da> <a> <rosso|giallo>      zona del problema che segue il corpo
  grafiche-posa.py <posa.json> <dati.json> freccia <punto> <da> <a>                  percorso del punto, per la freccia
  grafiche-posa.py <posa.json> <dati.json> asse <punto,punto,punto> <da> <a>         asse del corpo, con lo scarto dalla linea
  grafiche-posa.py <posa.json> <dati.json> battute <punto> <x|y> <max|min> <da> <a>  secondi in cui ogni ripetizione arriva in fondo
"""
import json
import math
import sys


def carica(percorso):
    d = json.load(open(percorso))
    return d, {n: i for i, n in enumerate(d["punti"])}


def grezzo(posa, indici, nome, tc):
    """Punto (x, y) nella clip al secondo tc, interpolato tra i fotogrammi vicini; None se non visibile."""
    if "+" in nome:
        parti = [grezzo(posa, indici, n, tc) for n in nome.split("+")]
        return None if None in parti else (sum(p[0] for p in parti) / len(parti), sum(p[1] for p in parti) / len(parti))
    if nome not in indici:
        if f"{nome}_s" in indici:
            return grezzo(posa, indici, f"{nome}_s+{nome}_d", tc)
        sys.exit(f"Punto sconosciuto: {nome}")
    k, fps, xy = indici[nome], posa["fps"], posa["xy"]
    i0 = max(0, min(len(xy) - 1, int(math.floor(tc * fps))))
    i1 = min(len(xy) - 1, i0 + 1)
    buoni = [(i, xy[i][k]) for i in (i0, i1) if xy[i] and xy[i][k][2] >= 0.5]
    if len(buoni) == 2:
        w = tc * fps - i0
        return (buoni[0][1][0] * (1 - w) + buoni[1][1][0] * w, buoni[0][1][1] * (1 - w) + buoni[1][1][1] * w)
    if buoni:
        return tuple(buoni[0][1][:2])
    for j in range(1, 3):  # fino a 0,2 s di distanza
        for i in (i0 - j, i1 + j):
            if 0 <= i < len(xy) and xy[i] and xy[i][k][2] >= 0.5:
                return tuple(xy[i][k][:2])
    return None


def viso(posa, indici, tc):
    """Riquadro del viso stimato da occhi, orecchie, naso e bocca (fronte e mento compresi), pixel della clip."""
    pt = [grezzo(posa, indici, n, tc) for n in ("occhio_s", "occhio_d", "orecchio_s", "orecchio_d", "naso", "bocca_s", "bocca_d")]
    pt = [p for p in pt if p]
    occhi = [p for p in (grezzo(posa, indici, "occhio_s", tc), grezzo(posa, indici, "occhio_d", tc)) if p]
    bocca = [p for p in (grezzo(posa, indici, "bocca_s", tc), grezzo(posa, indici, "bocca_d", tc)) if p]
    if len(pt) < 3 or not occhi or not bocca:
        return None
    h = max(20.0, sum(p[1] for p in bocca) / len(bocca) - sum(p[1] for p in occhi) / len(occhi))
    xs, ys = [p[0] for p in pt], [p[1] for p in pt]
    return [round(min(xs) - 0.4 * h), round(min(ys) - 1.6 * h), round(max(xs) + 0.4 * h), round(max(ys) + 1.1 * h)]


def nella_clip(piani, t):
    q = [p for p in piani if p["da"] <= t + 1e-6][-1] if any(p["da"] <= t + 1e-6 for p in piani) else piani[0]
    return q["clip"] + (t - q["da"])


def passi_di(da, a, passo=0.1):
    n = max(1, round((a - da) / passo))
    return [round(da + i * (a - da) / n, 3) for i in range(n + 1)]


if __name__ == "__main__":
    posa, indici = carica(sys.argv[1])
    if sys.argv[2] == "punti":
        tc = float(sys.argv[3])
        fuori = {n: [round(v) for v in p] if (p := grezzo(posa, indici, n, tc)) else None for n in posa["punti"]}
        print(json.dumps({"secondo_clip": tc, "punti": fuori, "viso": viso(posa, indici, tc)}, ensure_ascii=False))
        sys.exit(0)
    dati = json.load(open(sys.argv[2]))
    piani = dati.get("props", dati)["piani"]
    cosa, nome = sys.argv[3], sys.argv[4]
    lettura = lambda n, t: grezzo(posa, indici, n, nella_clip(piani, t))
    if cosa == "battute":
        asse, verso, da, a = sys.argv[5], sys.argv[6], float(sys.argv[7]), float(sys.argv[8])
    else:
        da, a = float(sys.argv[5]), float(sys.argv[6])
    tempi = passi_di(da, a)
    serie = [(t, lettura(nome.split(",")[0], t)) for t in tempi]
    buoni = [(t, p) for t, p in serie if p]
    if len(buoni) < max(2, len(serie) // 2):
        sys.exit(f"{nome}: la posa non vede il punto in più di metà del tratto {da}-{a} s (inquadratura o clip da guardare)")
    if cosa == "segnale":
        mx, my = sum(p[0] for _, p in buoni) / len(buoni), sum(p[1] for _, p in buoni) / len(buoni)
        spread = max(math.hypot(p[0] - mx, p[1] - my) for _, p in buoni)
        if spread > 25:
            print(f"! il punto si sposta fino a {spread:.0f} px nel tratto: il cerchio sta fermo, meglio una freccia o un tratto più corto", file=sys.stderr)
        print(json.dumps({"da": da, "a": a, "x": round(mx), "y": round(my)}))
    elif cosa == "zona":
        colore = sys.argv[7]
        # Misura della zona dal corpo: lunghezza del tronco (spalle → anche) all'inizio del tratto
        sp, an = lettura("spalla", da), lettura("anca", da)
        tronco = math.hypot(sp[0] - an[0], sp[1] - an[1]) if sp and an else 300
        centrale = nome.split("_")[0] in ("anca", "spalla", "bacino") and not nome.endswith(("_s", "_d")) or "+" in nome
        # Ellisse allungata lungo il tronco (plank laterale approvato: rx lungo il corpo, inclinata come il corpo)
        rot = math.degrees(math.atan2(sp[1] - an[1], sp[0] - an[0])) if sp and an else 0
        rot = ((rot + 90) % 180) - 90
        rx, ry = (0.45 * tronco, 0.24 * tronco) if centrale else (0.22 * tronco, 0.22 * tronco)
        print(json.dumps({"da": da, "a": a, "colore": colore, **({"pulsa": True} if colore == "rosso" else {}),
                          "rx": round(rx), "ry": round(ry), "rot": round(rot if centrale else 0),
                          "chiavi": [{"t": t, "x": round(p[0]), "y": round(p[1])} for t, p in buoni]}))
    elif cosa == "freccia":
        lungo = sum(math.hypot(q[1][0] - p[1][0], q[1][1] - p[1][1]) for p, q in zip(buoni, buoni[1:]))
        dritto = math.hypot(buoni[-1][1][0] - buoni[0][1][0], buoni[-1][1][1] - buoni[0][1][1])
        print(f"percorso {lungo:.0f} px, dall'inizio alla fine {dritto:.0f} px (pixel della clip)", file=sys.stderr)
        if dritto < 0.6 * lungo:
            print("! il gesto torna indietro: la freccia va su metà ripetizione (da partenza a punto massimo)", file=sys.stderr)
        print(json.dumps({"da": da, "a": a, "lunghezzaMin": 150, "punti": [{"t": t, "x": round(p[0]), "y": round(p[1])} for t, p in buoni]}))
    elif cosa == "asse":
        nomi = nome.split(",")
        medi = []
        for n in nomi:
            v = [p for t in tempi if (p := lettura(n, t))]
            if not v:
                sys.exit(f"{n}: non visibile nel tratto")
            medi.append((sum(p[0] for p in v) / len(v), sum(p[1] for p in v) / len(v)))
        (x0, y0), (x1, y1) = medi[0], medi[-1]
        L = math.hypot(x1 - x0, y1 - y0) or 1
        scarti = [abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / L for x, y in medi[1:-1]]
        scarto = 100 * max(scarti, default=0) / L
        print(f"scarto dalla linea {scarto:.1f}% della lunghezza", file=sys.stderr)
        if scarto > 6:
            print("! i punti non sono in linea: l'asse mostrerebbe un errore che il testo non dice (skill, punto 5b): niente asse", file=sys.stderr)
        # Punti intermedi portati sulla linea (scarto ≤ 6%): la linea resta dritta, come nell'esempio approvato del plank laterale
        proietta = lambda x, y: (x0 + ((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / L ** 2 * (x1 - x0),
                                 y0 + ((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / L ** 2 * (y1 - y0))
        punti = [medi[0], *[proietta(*m) for m in medi[1:-1]], medi[-1]]
        uscita = {"da": da, "a": a, "punti": [{"x": round(x), "y": round(y)} for x, y in punti]}
        # Il corpo si sposta durante l'asse: punti misurati ogni 0,5 s
        mosso = max(math.hypot(p[0] - medi[0][0], p[1] - medi[0][1]) for t in tempi if (p := lettura(nomi[0], t)))
        if mosso > 15:
            uscita["movimento"] = [{"t": t, "punti": [{"x": round(p[0]), "y": round(p[1])} for p in pp]}
                                   for t in passi_di(da, a, 0.5) if None not in (pp := [lettura(n, t) for n in nomi])]
        print(json.dumps(uscita))
    elif cosa == "battute":
        i = 0 if asse == "x" else 1
        v = [(t, p[i]) for t, p in buoni]
        lo, hi = min(x for _, x in v), max(x for _, x in v)
        soglia = 0.25 * (hi - lo)
        segno = 1 if verso == "max" else -1
        picchi, inizio = [], 0
        for j in range(1, len(v) - 1):
            t, x = v[j]
            if segno * x >= segno * v[j - 1][1] and segno * x > segno * v[j + 1][1]:
                # Un picco conta se sporge di almeno 1/4 dell'escursione dal punto più basso dopo il picco precedente
                if segno * x - min(segno * y for _, y in v[inizio:j + 1]) >= soglia:
                    picchi.append(t)
                    inizio = j
        print(f"escursione {hi - lo:.0f} px, {len(picchi)} ripetizioni", file=sys.stderr)
        print(json.dumps([round(t, 2) for t in picchi]))
    else:
        sys.exit(__doc__)
