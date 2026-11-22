"""Animazione tra le due pose di un disegno dell'esercizio (22/11/2026). Modulo usato da anima-disegno.py.

Uso: python3 morph.py <cartella con 0.svg e 1.svg> <t> <opacità frecce> > fotogramma.svg
t = 0 posa 1, t = 1 posa 2. Le due pose hanno gli stessi elementi con numeri diversi:
- i numeri si interpolano; i nomi interni (id) della posa 2 si riportano a quelli della posa 1;
- le catene a segmenti (braccia, gambe: «M a L b L c») si piegano alle articolazioni con la lunghezza che cambia piano;
- i punti vicini alla fine di una catena (mano, elastico, riflessi) restano attaccati a quella fine;
- gli elementi che ci sono in una sola posa (frecce) compaiono o spariscono in dissolvenza;
- un «L» contro un «Q» nello stesso punto diventa un «Q» col controllo a metà.
"""
import difflib, math, re, sys

NUM = re.compile(r"-?\d+(?:\.\d+)?(?:e-?\d+)?")


def leggi(cart):
    a = open(f"{cart}/0.svg").read()
    b = open(f"{cart}/1.svg").read()
    ida = re.findall(r'id="([^"]+)"', a)
    idb = re.findall(r'id="([^"]+)"', b)
    for x, y in sorted(zip(ida, idb), key=lambda p: -len(p[1])):
        if x != y:
            b = b.replace(f'id="{y}"', f'id="__{x}"').replace(f"url(#{y})", f"url(#__{x})").replace(f'href="#{y}"', f'href="#__{x}"')
    b = b.replace('id="__', 'id="').replace("url(#__", "url(#").replace('href="#__', 'href="#')
    return a, b


def tags(x):
    return re.findall(r"<[^>]+>|[^<]+", x)


def scheletro(t):
    return NUM.sub("#", t)


def fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def comandi(d):
    return [(c, [float(n) for n in NUM.findall(p)]) for c, p in re.findall(r"([MLQCAZHVSTmlqcazhvst])([^MLQCAZHVSTmlqcazhvst]*)", d)]


def unisci_comandi(da, db):
    """Rende confrontabili due path con L/Q nello stesso posto (assoluti)."""
    ca, cb = comandi(da), comandi(db)
    if len(ca) != len(cb):
        return None
    outa, outb = [], []
    pa = pb = (0.0, 0.0)
    for (xa, na), (xb, nb) in zip(ca, cb):
        if xa == xb and len(na) == len(nb):
            outa.append((xa, na)); outb.append((xb, nb))
        elif {xa, xb} == {"L", "Q"}:
            if xa == "L":
                na = [(pa[0] + na[0]) / 2, (pa[1] + na[1]) / 2] + na
            else:
                nb = [(pb[0] + nb[0]) / 2, (pb[1] + nb[1]) / 2] + nb
            outa.append(("Q", na)); outb.append(("Q", nb))
        else:
            return None
        if len(na) >= 2: pa = (na[-2], na[-1])
        if len(nb) >= 2: pb = (nb[-2], nb[-1])
    return outa, outb


def cmd_str(cs):
    return " ".join(c + " ".join(f"{fmt(cs_[i])},{fmt(cs_[i+1])}" for i in range(0, len(cs_) - 1, 2)) if cs_ else c for c, cs_ in cs)


def campiona(d, n=180):
    """Contorno assoluto (M L C Q Z) → n punti equidistanti lungo il tratto; None se ci sono altri comandi."""
    pts, cur, start, chiuso = [], (0.0, 0.0), (0.0, 0.0), False
    for c, v in comandi(d):
        if c == "M":
            cur = start = (v[0], v[1]); pts.append(cur)
            for i in range(2, len(v) - 1, 2): cur = (v[i], v[i + 1]); pts.append(cur)
        elif c == "L":
            for i in range(0, len(v) - 1, 2): cur = (v[i], v[i + 1]); pts.append(cur)
        elif c == "C":
            for i in range(0, len(v) - 5, 6):
                p0, p1, p2, p3 = cur, (v[i], v[i+1]), (v[i+2], v[i+3]), (v[i+4], v[i+5])
                for k in range(1, 25):
                    u = k / 24; w = 1 - u
                    pts.append((w**3*p0[0] + 3*w*w*u*p1[0] + 3*w*u*u*p2[0] + u**3*p3[0], w**3*p0[1] + 3*w*w*u*p1[1] + 3*w*u*u*p2[1] + u**3*p3[1]))
                cur = p3
        elif c == "Q":
            for i in range(0, len(v) - 3, 4):
                p0, p1, p2 = cur, (v[i], v[i+1]), (v[i+2], v[i+3])
                for k in range(1, 17):
                    u = k / 16; w = 1 - u
                    pts.append((w*w*p0[0] + 2*w*u*p1[0] + u*u*p2[0], w*w*p0[1] + 2*w*u*p1[1] + u*u*p2[1]))
                cur = p2
        elif c in "Zz":
            chiuso = True; pts.append(start); cur = start
        else:
            return None
    if len(pts) < 2: return None
    acc = [0.0]
    for i in range(1, len(pts)): acc.append(acc[-1] + math.dist(pts[i-1], pts[i]))
    tot = acc[-1] or 1.0
    out, j = [], 0
    for k in range(n):
        s_ = tot * k / (n - 1)
        while j < len(acc) - 2 and acc[j + 1] < s_: j += 1
        seg = acc[j + 1] - acc[j] or 1.0
        u = (s_ - acc[j]) / seg
        out.append((pts[j][0] + (pts[j+1][0] - pts[j][0]) * u, pts[j][1] + (pts[j+1][1] - pts[j][1]) * u))
    return out, chiuso


def catena(d):
    m = re.fullmatch(r"\s*M\s*([-\d.]+),([-\d.]+)((?:\s*L\s*[-\d.]+,[-\d.]+)+)\s*", d)
    if not m:
        return None
    pts = [(float(m.group(1)), float(m.group(2)))] + [(float(x), float(y)) for x, y in re.findall(r"L\s*([-\d.]+),([-\d.]+)", m.group(3))]
    return pts


def angolo_interp(a0, a1, t):
    d = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
    return a0 + d * t


def catena_t(pa, pb, t):
    p = [(pa[0][0] + (pb[0][0] - pa[0][0]) * t, pa[0][1] + (pb[0][1] - pa[0][1]) * t)]
    for i in range(1, len(pa)):
        va = (pa[i][0] - pa[i-1][0], pa[i][1] - pa[i-1][1]); vb = (pb[i][0] - pb[i-1][0], pb[i][1] - pb[i-1][1])
        la, lb = math.hypot(*va), math.hypot(*vb)
        ang = angolo_interp(math.atan2(va[1], va[0]), math.atan2(vb[1], vb[0]), t)
        l = la + (lb - la) * t
        p.append((p[-1][0] + l * math.cos(ang), p[-1][1] + l * math.sin(ang)))
    return p


def ease(x):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, x)))


PROBLEMI = set()


def fotogramma(a, b, t, frecce_op):
    A, B = tags(a), tags(b)
    sm = difflib.SequenceMatcher(None, [scheletro(x) for x in A], [scheletro(x) for x in B], autojunk=False)
    coppie = []  # (tagA, tagB) oppure (tag, None, lato)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            coppie += [(A[i1 + k], B[j1 + k], "=") for k in range(i2 - i1)]
        elif op == "replace" and i2 - i1 == j2 - j1:
            coppie += [(A[i1 + k], B[j1 + k], "~") for k in range(i2 - i1)]
        else:
            # blocchi di lunghezza diversa: si abbinano per tipo di elemento (contorno con contorno), il resto entra o esce
            nome = lambda t_: re.match(r"</?\w+", t_).group(0) if t_.startswith("<") else "#testo"
            sub = difflib.SequenceMatcher(None, [nome(x) for x in A[i1:i2]], [nome(x) for x in B[j1:j2]], autojunk=False)
            for op2, a1, a2, b1, b2 in sub.get_opcodes():
                if op2 == "equal":
                    coppie += [(A[i1 + a1 + k], B[j1 + b1 + k], "~") for k in range(a2 - a1)]
                else:
                    coppie += [(x, None, "A") for x in A[i1 + a1:i1 + a2]] + [(None, x, "B") for x in B[j1 + b1:j1 + b2]]

    # catene (braccia, gambe) presenti nelle due pose: le fini servono per attaccarci mani ed elastico
    catene = []
    for ta, tb, k in coppie:
        if ta and tb:
            da, db = re.search(r' d="([^"]+)"', ta), re.search(r' d="([^"]+)"', tb)
            if da and db:
                ca, cb = catena(da.group(1)), catena(db.group(1))
                if ca and cb and len(ca) == len(cb) >= 3:
                    w = re.search(r'stroke-width="([\d.]+)"', ta)
                    if w and float(w.group(1)) >= 10:
                        catene.append((ca, cb, catena_t(ca, cb, t)))

    def attacca(pa, pb, lin):
        """Punto vicino alla fine di una catena in tutte e due le pose: segue quella fine."""
        for ca, cb, ct in catene:
            for j in range(1, len(ca)):
                if math.dist(pa, ca[j]) < 16 and math.dist(pb, cb[j]) < 16:
                    off = ((pa[0] - ca[j][0]) * (1 - t) + (pb[0] - cb[j][0]) * t, (pa[1] - ca[j][1]) * (1 - t) + (pb[1] - cb[j][1]) * t)
                    return (ct[j][0] + off[0], ct[j][1] + off[1])
        return lin

    out, profondita_solo = [], 0
    for ta, tb, k in coppie:
        if ta is not None and tb is not None:
            if ta == tb:
                out.append(ta); continue
            x = ta
            # path: catena, L/Q, oppure numeri uguali in numero
            ma, mb = re.search(r' d="([^"]+)"', ta), re.search(r' d="([^"]+)"', tb)
            if ma and mb and ma.group(1) != mb.group(1):
                ca, cb = catena(ma.group(1)), catena(mb.group(1))
                if ca and cb and len(ca) == len(cb):
                    if len(ca) >= 3:
                        pts = catena_t(ca, cb, t)
                    else:
                        pts = [attacca(pa_, pb_, (pa_[0] + (pb_[0] - pa_[0]) * t, pa_[1] + (pb_[1] - pa_[1]) * t)) for pa_, pb_ in zip(ca, cb)]
                    nuovo = "M" + " L".join(f"{fmt(p[0])},{fmt(p[1])}" for p in pts)
                else:
                    u = unisci_comandi(ma.group(1), mb.group(1)) if scheletro(ma.group(1)) != scheletro(mb.group(1)) else None
                    if u:
                        ia, ib = u
                        nuovo = cmd_str([(c, [p + (q - p) * t for p, q in zip(na, nb)]) for (c, na), (_, nb) in zip(ia, ib)])
                    else:
                        na, nb = NUM.findall(ma.group(1)), NUM.findall(mb.group(1))
                        ra_, rb_ = (campiona(ma.group(1)), campiona(mb.group(1))) if len(na) != len(nb) else (None, None)
                        if ra_ and rb_:
                            pts = [(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t) for p, q in zip(ra_[0], rb_[0])]
                            nuovo = "M" + " L".join(f"{fmt(x_)},{fmt(y_)}" for x_, y_ in pts) + (" Z" if ra_[1] else "")
                        elif len(na) != len(nb):
                            PROBLEMI.add("un contorno cambia forma in modo che non si può interpolare: scatterebbe a metà")
                            nuovo = ma.group(1) if t < 0.5 else mb.group(1)
                        else:
                            it = iter(fmt(float(p) + (float(q) - float(p)) * t) if p != q else p for p, q in zip(na, nb))
                            nuovo = NUM.sub(lambda _m: next(it), ma.group(1))
                x = x.replace(f' d="{ma.group(1)}"', f' d="{nuovo}"')
                # resto del tag (es. transform) con i numeri dell'altra posa
                ra, rb = ta.replace(ma.group(1), ""), tb.replace(mb.group(1), "")
                if ra != rb and len(NUM.findall(ra)) == len(NUM.findall(rb)):
                    it = iter(fmt(float(p) + (float(q) - float(p)) * t) if p != q else p for p, q in zip(NUM.findall(ra), NUM.findall(rb)))
                    resto = NUM.sub(lambda _m: next(it), ra)
                    x = resto.replace(' d=""', f' d="{nuovo}"')
            else:
                na, nb = NUM.findall(ta), NUM.findall(tb)
                sa_, sb_ = re.search(r"scale\((-?[\d.]+)", ta), re.search(r"scale\((-?[\d.]+)", tb)
                if sa_ and sb_ and float(sa_.group(1)) * float(sb_.group(1)) < 0:
                    PROBLEMI.add("un pezzo è specchiato tra le due pose (scala che cambia segno): si schiaccerebbe a metà")
                if len(na) == len(nb):
                    # gruppo spostato (mano): se il suo translate sta alla fine di una catena, la segue
                    tr_a = re.search(r"translate\(([-\d.]+),([-\d.]+)\)", ta); tr_b = re.search(r"translate\(([-\d.]+),([-\d.]+)\)", tb)
                    it = iter(fmt(float(p) + (float(q) - float(p)) * t) if p != q else p for p, q in zip(na, nb))
                    x = NUM.sub(lambda _m: next(it), ta)
                    if tr_a and tr_b and ta.startswith("<g"):
                        pa_, pb_ = (float(tr_a.group(1)), float(tr_a.group(2))), (float(tr_b.group(1)), float(tr_b.group(2)))
                        p = attacca(pa_, pb_, None)
                        if p:
                            x = re.sub(r"translate\([-\d.]+,[-\d.]+\)", f"translate({fmt(p[0])},{fmt(p[1])})", x, count=1)
                else:
                    PROBLEMI.add("un elemento cambia struttura tra le due pose: scatterebbe a metà")
                    x = ta if t < 0.5 else tb
            # riflessi sottili a un segmento che non stanno su una catena: sfumano a metà del movimento
            out.append(x)
        else:
            tag = ta if ta is not None else tb
            if ta is not None and tag.startswith("<") and not tag.startswith("</") and not re.match(r"<(stop|linearGradient|radialGradient|clipPath|defs)\b", tag):
                PROBLEMI.add("c'è un elemento solo nella prima posa: sparirebbe invece di muoversi")
            op = (1 - ease(t * 1.6)) if ta is not None else frecce_op
            if tag.startswith("</"):
                out.append(tag)
            elif tag.startswith("<") and not tag.startswith("<stop") and not tag.startswith("<linearGradient") and not tag.startswith("<radialGradient"):
                out.append(tag.replace("<", f'<g opacity="{op:.3f}"><', 1).replace("/>", "/></g>") if tag.endswith("/>") else re.sub(r"^<(\w+)", lambda m: f'<{m.group(1)} opacity="{op:.3f}"', tag, count=1))
            else:
                out.append(tag)
    return "".join(out)


if __name__ == "__main__":
    cart, t, fo = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    a, b = leggi(cart)
    sys.stdout.write(fotogramma(a, b, t, fo))
