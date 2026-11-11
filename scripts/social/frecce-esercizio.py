"""Frecce del movimento sui due fotogrammi fermi della slide «esercizio» di un carosello (Federico, 11/11/2026: «puoi mettere
delle frecce per capire meglio il movimento?»). Le calcola dalla posa della clip (MediaPipe, social/posa/<clip>.json), non a occhio.

Uso: python3 scripts/social/frecce-esercizio.py <dati.json> <posa.json> <punto> [--scosta N] [--lunga P] [--scrivi]
  punto     il punto del corpo che fa il gesto (naso per la testa, polso_d, ginocchio_s…: i nomi sono in posa.json)
  --scosta  pixel della clip tra il punto e la freccia, in perpendicolare al gesto (default 330: sopra la testa per la
            testa che va avanti e indietro). Positivo = verso l'alto o verso sinistra. La freccia va nello spazio libero,
            mai sul viso né su ciò che si muove: guarda la slide renderizzata
  --lunga   lunghezza della freccia in % della larghezza del fotogramma (default 55): il gesto vero spesso è di pochi
            pixel e una freccia lunga quanto il gesto non si vedrebbe al telefono
  --scrivi  scrive `frecce` nella slide «esercizio» del dati.json (senza, stampa soltanto)

Ogni fotogramma ha la sua freccia nel verso del gesto che mostra: dal punto dell'altro fotogramma verso il suo
("Avanti" → freccia in avanti, "Indietro" → freccia indietro). Formato: [x1, y1, x2, y2] in % del fotogramma.
La geometria è quella di prepara-esercizio.sh: ritaglio in pixel dell'anteprima a 480 px, poi metà riquadro centrata.
"""
import json
import math
import sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opz = {sys.argv[i][2:]: sys.argv[i + 1] for i in range(1, len(sys.argv) - 1) if sys.argv[i] in ("--scosta", "--lunga")}
if len(args) < 3:
    sys.exit(__doc__)
dati_p, posa_p, punto = args[:3]
scosta = float(opz.get("scosta", 330))
lunga = float(opz.get("lunga", 55))
dati = json.load(open(dati_p))
posa = json.load(open(posa_p))
slide = next(s for s in dati["props"]["slide"] if s.get("tipo") == "esercizio")
if posa["clip"] != slide["clip"]:
    sys.exit(f"La posa è di {posa['clip']}, la slide usa {slide['clip']}")

LARGA = 1080  # clip dell'archivio clip-social: 1080×1920
k = LARGA / 480
rw, rh, rx, ry = (float(v) * k for v in slide["ritaglio"].split(":"))
fw = rh * 208 / 560  # fotogramma fermo: metà del riquadro 420×560, ritagliato al centro del ritaglio
fx, fy = rx + (rw - fw) / 2, ry


def dove(t):
    i = min(range(len(posa["t"])), key=lambda j: abs(posa["t"][j] - t))
    x, y, vis = posa["xy"][i][posa["punti"].index(punto)]
    if vis < 0.5:
        sys.exit(f"{punto} poco visibile a {t} s ({vis}): scegli un altro punto")
    return x, y


p = [dove(t) for t in slide["secondi"]]
frecce = []
for i in (0, 1):
    (ax, ay), (bx, by) = p[1 - i], p[i]
    dx, dy = bx - ax, by - ay
    n = math.hypot(dx, dy)
    if n < 15:
        sys.exit(f"{punto} si sposta solo di {n:.0f} px tra i due fotogrammi: scegli il punto che fa il gesto")
    ux, uy = dx / n, dy / n
    px, py = (uy, -ux) if ux >= 0 else (-uy, ux)  # perpendicolare verso l'alto (o verso sinistra se il gesto è verticale)
    if abs(ux) < 0.5:
        px, py = (-abs(uy), 0)
    cx, cy = (ax + bx) / 2 + px * scosta, (ay + by) / 2 + py * scosta
    meta = lunga / 100 * fw / 2
    x1, y1, x2, y2 = cx - ux * meta, cy - uy * meta, cx + ux * meta, cy + uy * meta
    pc = lambda x, y: [round((x - fx) / fw * 100, 1), round((y - fy) / rh * 100, 1)]
    # Il punto che si muove sta spesso sul bordo (il naso davanti al viso): si fa scorrere la freccia lungo il gesto
    # finché sta dentro il fotogramma, tra l'8 e il 92%
    for _ in range(200):
        xs = [pc(x1, y1)[0], pc(x2, y2)[0]]
        ys = [pc(x1, y1)[1], pc(x2, y2)[1]]
        sx = -1 if max(xs) > 92 else 1 if min(xs) < 8 else 0
        sy = -1 if max(ys) > 92 else 1 if min(ys) < 8 else 0
        if not sx and not sy:
            break
        x1, x2, y1, y2 = x1 + sx * fw / 100, x2 + sx * fw / 100, y1 + sy * rh / 100, y2 + sy * rh / 100
    f = pc(x1, y1) + pc(x2, y2)
    if not all(3 <= v <= 97 for v in f):
        print(f"! fotogramma {i + 1}: la freccia esce dal fotogramma ({f}): cambia --scosta o --lunga")
    frecce.append(f)
    print(f"fotogramma {i + 1} ({slide.get('scritte', ['', ''])[i]}, {slide['secondi'][i]} s): {punto} si sposta di "
          f"{n:.0f} px, freccia {f}")
if "--scrivi" in sys.argv:
    slide["frecce"] = frecce
    json.dump(dati, open(dati_p, "w"), ensure_ascii=False, indent=2)
    print("frecce scritte in", dati_p)
