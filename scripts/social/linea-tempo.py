"""Linea del tempo del movimento di una clip, dalla posa misurata (audit dei Reel dell'11/11/2026, skill reel-social, Pipeline punto 3).

Prima la routine la scriveva a occhio su miniature larghe 160 px: da lì venivano passi fuori tempo ed esercizi che non si
capivano. Qui i secondi li dà la posa (posa.py, 10 fotogrammi al secondo, pixel 1080×1920). È una base da confermare
guardando i fogli, non li sostituisce: la posa non sa che esercizio è, e nelle inquadrature strette perde il corpo.

Uso: python3 scripts/social/linea-tempo.py <posa.json> [--punto <nome>]
Stampa, in secondi della CLIP:
  - quanta parte della clip ha la posa e i cambi di scena (vecchi Reel: un esercizio per scena);
  - per ogni scena i punti che si muovono di più (il gesto) e, per il primo o per --punto, i punti di svolta del gesto;
  - le pause (il gesto fermo almeno 0,4 s: tenute, posizioni da far vedere);
  - il mezzo secondo con il gesto più ampio (per l'apertura stretta del gancio);
  - quando il viso è di fronte alla camera (copertina, finale);
  - cima della testa e viso (per tenere il viso sotto i testi).
"""
import json
import math
import sys

posa = json.load(open(sys.argv[1]))
idx = {n: i for i, n in enumerate(posa["punti"])}
fps, xy = posa["fps"], posa["xy"]
N = len(xy)
s = lambda i: f"{i / fps:.1f}".replace(".", ",")


def p(nome, i):
    if not xy[i]:
        return None
    x, y, v = xy[i][idx[nome]]
    return (x, y) if v >= 0.5 else None


def tratti(buoni, minimo):
    """Intervalli [da, a] di indici consecutivi dove buoni[i] è vero, lunghi almeno `minimo` fotogrammi."""
    out, da = [], None
    for i, b in enumerate(list(buoni) + [False]):
        if b and da is None:
            da = i
        elif not b and da is not None:
            if i - da >= minimo:
                out.append((da, i - 1))
            da = None
    return out


def liscia(v, n=2):
    out = []
    for i in range(len(v)):
        w = [x for x in v[max(0, i - n): i + n + 1] if x is not None]
        out.append(sum(w) / len(w) if w else None)
    return out


con_posa = [bool(f) for f in xy]
print(f"Clip di {N / fps:.1f} s; posa in {100 * sum(con_posa) // max(1, N)}% dei fotogrammi".replace(".", ","))
for da, a in tratti([not b for b in con_posa], 5):
    print(f"  senza posa {s(da)}–{s(a)} s (inquadratura stretta o nessuno in quadro: guarda il foglio)")

# Cambi di scena: il bacino (o le spalle) salta di oltre 150 px in un decimo di secondo
centro = lambda i: next((((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) for n in ("anca", "spalla") if (a := p(n + "_s", i)) and (b := p(n + "_d", i))), None)
scene = [0]
for i in range(1, N):
    a, b = centro(i - 1), centro(i)
    if a and b and math.hypot(b[0] - a[0], b[1] - a[1]) > 150:
        scene.append(i)
if len(scene) > 1:
    print("Cambi di scena a " + ", ".join(s(i) for i in scene[1:]) + " s (un esercizio o un'inquadratura per scena)")

# Il gesto, scena per scena: i punti con più escursione (5°-95° percentile, per non contare un fotogramma sbagliato)
ESTREMI = ["polso_s", "polso_d", "gomito_s", "gomito_d", "ginocchio_s", "ginocchio_d", "caviglia_s", "caviglia_d",
           "punta_s", "punta_d", "spalla_s", "spalla_d", "anca_s", "anca_d", "naso"]
scelto = sys.argv[sys.argv.index("--punto") + 1] if "--punto" in sys.argv else None
for k, i0 in enumerate(scene):
    i1 = scene[k + 1] if k + 1 < len(scene) else N
    if i1 - i0 < fps:
        continue
    if len(scene) > 1:
        print(f"— Scena {s(i0)}–{s(i1)} s")
    gesti = []
    for n in ESTREMI:
        for asse in (0, 1):
            v = sorted(q[asse] for i in range(i0, i1) if (q := p(n, i)))
            if len(v) >= max(8, (i1 - i0) // 3):
                gesti.append((v[int(0.95 * (len(v) - 1))] - v[int(0.05 * (len(v) - 1))], n, asse))
    gesti.sort(reverse=True)
    if not gesti:
        print("  la posa non vede abbastanza punti: linea del tempo a occhio, sui fogli")
        continue
    print("  Punti che si muovono di più: " + "; ".join(f"{n} {'in orizzontale' if a == 0 else 'in verticale'} {e:.0f} px" for e, n, a in gesti[:4]))
    esc, nome, asse = next((g for g in gesti if g[1] == scelto), gesti[0])
    serie = liscia([q[asse] if (q := p(nome, i)) else None for i in range(i0, i1)])
    if esc < 40:
        print(f"  Gesto piccolo ({esc:.0f} px): probabile tenuta o movimento verso la camera, niente ripetizioni da misurare")
    else:
        # Punti di svolta: il punto inverte la marcia di almeno 1/4 dell'escursione (come `battute` di grafiche-posa.py)
        nomi = ("a sinistra", "a destra") if asse == 0 else ("in alto", "in basso")
        svolte, verso, estremo = [], 0, None
        for j, x in enumerate(serie):
            if x is None:
                continue
            if estremo is None:
                estremo, primo = (j, x), x
                continue
            if verso == 0:
                if abs(x - primo) >= 0.25 * esc:
                    verso = 1 if x > primo else -1
                    svolte.append((estremo[0], nomi[0 if verso > 0 else 1]))
                    estremo = (j, x)
                elif (x - primo) * (estremo[1] - primo) >= 0 and abs(x - primo) > abs(estremo[1] - primo):
                    pass
                continue
            if verso * (x - estremo[1]) > 0:
                estremo = (j, x)
            elif verso * (estremo[1] - x) >= 0.25 * esc:
                svolte.append((estremo[0], nomi[1 if verso > 0 else 0]))
                verso, estremo = -verso, (j, x)
        if verso:
            svolte.append((estremo[0], nomi[1 if verso > 0 else 0]))
        print(f"  Gesto di {nome} ({esc:.0f} px), punti di svolta: " + (" → ".join(f"{dove} a {s(i0 + j)} s" for j, dove in svolte[:24]) or "nessuno"))
        print(f"  (circa {max(0, len(svolte) - 1) // 2} ripetizioni; tra due svolte c'è mezza ripetizione, buona per una freccia)")
    # Pause: il gesto fermo (meno di 12 px al secondo) per almeno 0,4 s. I salti della posa (oltre 150 px in un decimo) non contano
    vel = [None] * (i1 - i0)
    for i in range(i0 + 1, i1):
        a, b = p(nome, i - 1), p(nome, i)
        if a and b and math.hypot(b[0] - a[0], b[1] - a[1]) <= 150:
            vel[i - i0] = math.hypot(b[0] - a[0], b[1] - a[1]) * fps
    ferme = tratti([v is not None and v < 12 for v in liscia(vel, 1)], int(0.4 * fps))
    if ferme:
        print("  Pause (gesto fermo): " + ", ".join(f"{s(i0 + a)}–{s(i0 + b)} s" for a, b in ferme[:12]))
    # Gesto più ampio: il mezzo secondo in cui il punto percorre più strada (apertura stretta del gancio)
    fin = int(0.5 * fps)
    meglio = max(((sum(v or 0 for v in vel[i:i + fin]) / fps, i) for i in range(1, max(2, len(vel) - fin))), default=(0, 0))
    print(f"  Gesto più ampio: {s(i0 + meglio[1])}–{s(i0 + meglio[1] + fin)} s ({meglio[0]:.0f} px in mezzo secondo)")


# Viso di fronte: tutte e due le orecchie visibili e il naso a metà tra le due
def di_fronte(i):
    a, b, n = p("orecchio_s", i), p("orecchio_d", i), p("naso", i)
    if not (a and b and n):
        return False
    larghezza = abs(a[0] - b[0])
    return larghezza > 25 and abs(n[0] - (a[0] + b[0]) / 2) < 0.2 * larghezza


fronte = tratti([di_fronte(i) for i in range(N)], int(0.3 * fps))
print("Viso di fronte alla camera: " + (", ".join(f"{s(a)}–{s(b)} s" for a, b in fronte[:12]) if fronte else "mai (ripresa di profilo: copertina sul gesto intero)"))

# Cima della testa (stima: sopra gli occhi di 1,6 volte la distanza occhi-bocca), per la formula del viso sotto i testi
cime = []
for i in range(N):
    o, b = p("occhio_s", i) or p("occhio_d", i), p("bocca_s", i) or p("bocca_d", i)
    if o and b:
        cime.append((o[1] - 1.6 * max(20.0, b[1] - o[1]), o[1]))
if cime:
    cime.sort()
    print(f"Cima della testa: da y {cime[0][0]:.0f} a y {cime[-1][0]:.0f} (stima; occhi da y {min(c[1] for c in cime):.0f} a y {max(c[1] for c in cime):.0f}); "
          "pixel della clip, da confermare sul fotogramma con la griglia")
