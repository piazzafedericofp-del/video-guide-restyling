#!/usr/bin/env python3
"""Ciclo di revisione dei Reel: il conto dei giri, senza IA (skill reel-social, "Ciclo di revisione", 03/11/2026).

Stesso schema dei cicli del blog e dei caroselli (federicopiazza.com/scripts/carosello-social/revisione-carosello.py),
con un solo revisore in contesto pulito (`revisore-reel`) e al massimo 2 giri: nei Reel i testi sono pochi e le
correzioni di Federico del 24-30/10 erano soprattutto su grafiche ed esercizio che non si capiva, cose che si vedono
nei fotogrammi. Le misure (bordi, lettura, zoom, zone, frecce che traballano) restano a controlla-reel.py e controlla-zone.py.

  revisione-reel.py prepara <giro> <dati.json> [<lavoro.json>] [--lezioni <social/lezioni.json>]
      testi.md (con le lezioni approvate da Federico per i Reel), telefono.jpg e griglia.jpg per il revisore
      (dopo fotogrammi-revisione.mjs nella stessa cartella)
  revisione-reel.py giro <ciclo> <dati.json> <testi.md> <verdetto.json>
      registra il giro N: scarta le critiche senza appiglio, conta blocchi/importanti/minori, salva una copia di dati e
      testi e stampa PASSA | CONTINUA | FERMATI (perché) — uscita 0, 10, 20
  revisione-reel.py risposta <ciclo> <risposta.json>             {"applicate": ["F3", …], "rifiutate": [{"id": …, "motivo": …}]}
  revisione-reel.py chiudi <ciclo> <dati.json>                   rimette il giro migliore se l'ultimo non è passato e
                                                                 scrive il riassunto in dati.json["revisione"]
  revisione-reel.py rapporto <ciclo> [--json]

Verdetto del revisore:
  {"revisore": "reel", "lettura": "i testi di fila come un paragrafo",
   "criteri": [{"id": "F3", "esito": "ok" | "no" | "dubbio", "gravita": "blocca" | "importante" | "minore",
                "citazione": "testo copiato da testi.md", "visivo": false, "secondo": 5.4, "dove": "perché | passo 2 | freccia 1 | copertina …",
                "manca": false, "correzione": "testo nuovo intero o istruzione precisa", "fonte": "griglia-reel.md F3 | skill …"}],
   "domande_federico": ["domanda a cui si risponde in una riga"]}
Una critica "no"/"dubbio" vale se la citazione si trova alla lettera in testi.md, se "manca" è vero, oppure se è
"visivo" con "dove" e un "secondo" dentro il Reel (o "dove" sulla copertina). Le altre si scartano.
"""
import json
import os
import re
import shutil
import sys
from pathlib import Path

MAX_GIRI = 2
PESO = {"blocca": 0, "importante": 1, "minore": 2}


def leggi(p):
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def scrivi(p, d):
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, indent=2)


def normale(s):
    """Confronto delle citazioni: spazi, a capo (anche " / " di testi.md), virgolette e asterischi non contano."""
    s = re.sub(r"[*_`/]", " ", s or "")
    s = s.replace("’", "'").replace("“", '"').replace("”", '"').replace("«", '"').replace("»", '"')
    return re.sub(r"\s+", " ", s).strip().lower()


def righe(t):
    return " / ".join(r.strip() for r in str(t or "").split("\n") if r.strip())


def secondi(a, b=None):
    return f"{a:.1f}–{b:.1f} s".replace(".", ",") if b is not None else f"{a:.1f} s".replace(".", ",")


# ─── prepara: il materiale del giro per il revisore ───

def testi_md(dati, lavoro, lezioni=()):
    p, t = dati.get("props") or {}, dati.get("testi") or {}
    brief = (lavoro or {}).get("brief") or {}
    if isinstance(brief, str):
        try:
            brief = json.loads(brief or "{}")
        except json.JSONDecodeError:
            brief = {}
    durata = float(dati.get("durata") or 0)
    out = [f"# Reel: {t.get('titolo', '')}", "", "## Brief di Federico (fonte di esercizio, problema e dosaggio)", ""]
    for k, nome in (("esercizio", "Esercizio"), ("problema", "Problema"), ("dosaggio", "Dosaggio")):
        if brief.get(k):
            out.append(f"- {nome}: {brief[k]}")
    if (lavoro or {}).get("richiesta_modifica"):
        out.append(f"- Richiesta di modifica di Federico: {lavoro['richiesta_modifica']}")
    out += ["", f"## Testi a schermo, in ordine (durata {secondi(durata)}; \" / \" = a capo)", ""]
    momenti = []  # (inizio, riga): in ordine di tempo (l'errore comune può stare prima dei passi)
    g = p.get("gancio") or {}
    if g.get("parlato"):
        momenti.append((0, f"- Gancio parlato (0,0–{g.get('a', 0):.1f} s)".replace(".", ",")))
    else:
        gialle = g.get("gialla", [])
        gialle = gialle if isinstance(gialle, list) else [gialle]
        momenti.append((0, f"- Gancio ({secondi(0, g.get('a', 0))}): {' / '.join(g.get('righe') or [])}"
                   + (f" (in giallo: {', '.join((g.get('righe') or [''])[i] for i in gialle if i < len(g.get('righe') or []))})" if gialle else "")))
    pe = p.get("perche") or {}
    momenti.append((pe.get("da", 0), f"- Perché ({secondi(pe.get('da', 0), pe.get('a', 0))}): {righe(pe.get('testo'))}"))
    voci = (p.get("passi") or {}).get("voci") or []
    for i, v in enumerate(voci):
        a = voci[i + 1]["da"] if i + 1 < len(voci) else p["passi"]["a"]
        momenti.append((v["da"], f"- Passo {i + 1} ({secondi(v['da'], a)}): {righe(v['testo'])}"))
    e = p.get("errore")
    if e:
        momenti.append((e["da"], f"- Errore comune ({secondi(e['da'], e['a'])}): Così no: {righe(e['no'])} · Così sì: {righe(e['si'])}"))
    d = p.get("dosaggio") or {}
    parole = d.get("parole") or ["ripetizioni", "serie"]
    momenti.append((d.get("da", 0), f"- Dosaggio ({secondi(d.get('da', 0), d.get('a', 0))}): {d.get('ripetizioni')} {parole[0]} × {d.get('serie')} {parole[1]} · {d.get('etichetta', '')}"
               + (" (anello della tenuta)" if d.get("anello") else "")))
    inv = p.get("invito") or {}
    momenti.append((inv.get("da", 0), f"- Invito ({secondi(inv.get('da', 0), durata)}, pulsante a y {inv.get('y', 1175)}): {righe(inv.get('testo'))}"))
    out += [r for _, r in sorted(momenti, key=lambda m: m[0])]
    out += ["", "## Grafiche sul corpo", ""]
    graf = []
    if p.get("segnale"):
        graf.append(f"- Cerchio ({secondi(p['segnale']['da'], p['segnale']['a'])})")
    for nome, chiave in (("Arco", "archi"), ("Asse", "assi"), ("Freccia", "frecce")):
        for i, x in enumerate(p.get(chiave) or []):
            graf.append(f"- {nome} {i + 1} ({secondi(x['da'], x['a'])})")
    out += graf or ["- nessuna"]
    c = p.get("copertina") or {}
    if c:
        gc = c.get("gialla", [])
        gc = gc if isinstance(gc, list) else [gc]
        out += ["", "## Copertina", "", f"- Titolo: {' / '.join(c.get('righe') or [])}"
                + (f" (in giallo: {', '.join((c.get('righe') or [''])[i] for i in gc if i < len(c.get('righe') or []))})" if gc else ""),
                f"- Sottotitolo: {righe(c.get('sotto'))}"]
    if t.get("didascalia_ig"):
        out += ["", "## Didascalia di Instagram", "", t["didascalia_ig"].strip()]
    # Lezioni approvate da Federico per i Reel (03/11/2026): sono sue decisioni, il revisore non chiede il contrario
    if lezioni:
        out += ["", "## Lezioni approvate da Federico (sono sue decisioni: non chiedere il contrario)", ""]
        out += [f"- {l.get('testo', '')}" + (f" (nota di Federico: {l['nota_di_federico']})" if l.get("nota_di_federico") else "") for l in lezioni]
    return "\n".join(out) + "\n"


def prepara(giro, dati_p, lavoro_p=None, lezioni_p=None):
    from PIL import Image, ImageDraw, ImageFont

    giro = Path(giro)
    dati = leggi(dati_p)
    lavoro = leggi(lavoro_p) if lavoro_p and os.path.exists(lavoro_p) else {}
    tutte = leggi(lezioni_p) if lezioni_p and os.path.exists(lezioni_p) else []
    lezioni = [l for l in (tutte if isinstance(tutte, list) else tutte.get("lezioni", [])) if "reel-social" in str(l.get("dove", "")) or str(l.get("dove", "")) == "social"]
    (giro / "testi.md").write_text(testi_md(dati, lavoro, lezioni), encoding="utf-8")
    foto = sorted(giro.glob("t*.jpg"))
    if not foto:
        sys.exit(f"Nessun fotogramma in {giro}: prima `node scripts/social/fotogrammi-revisione.mjs {giro}`")
    try:
        carattere = ImageFont.load_default(size=20)
    except TypeError:
        carattere = ImageFont.load_default()
    # Telefono: ogni fotogramma largo 360 px, come lo vede chi scorre, con il secondo e il momento sotto
    L, A, F, col = 360, 640, 30, 5
    file_ = (len(foto) + col - 1) // col
    foglio = Image.new("RGB", (col * L, file_ * (A + F)), "white")
    disegna = ImageDraw.Draw(foglio)
    for i, f in enumerate(foto):
        x, y = (i % col) * L, (i // col) * (A + F)
        foglio.paste(Image.open(f).convert("RGB").resize((L, A)), (x, y))
        disegna.text((x + 8, y + A + 4), f.stem[1:].replace("-", " · ", 1), fill="black", font=carattere)
    foglio.save(giro / "telefono.jpg", quality=85)
    # Griglia del profilo: la copertina ritagliata 3:4 al centro e larga 390 px (prova della griglia della skill)
    if (giro / "copertina.jpg").exists():
        c = Image.open(giro / "copertina.jpg").convert("RGB").resize((1080, 1920))
        c.crop((0, 240, 1080, 1680)).resize((390, 520)).save(giro / "griglia.jpg", quality=90)
    print(f"Giro pronto: testi.md, telefono.jpg ({len(foto)} fotogrammi)" + (", griglia.jpg" if (giro / "griglia.jpg").exists() else ""))


# ─── i giri ───

def stato(ciclo):
    p = os.path.join(ciclo, "stato.json")
    return leggi(p) if os.path.exists(p) else {"giri": []}


def conta(criteri):
    c = {"blocca": 0, "importante": 0, "minore": 0}
    for k in criteri:
        g = k.get("gravita", "minore")
        c[g] = c.get(g, 0) + 1
    return c


def giro(ciclo, dati_p, testi_p, verdetto_p):
    os.makedirs(ciclo, exist_ok=True)
    st = stato(ciclo)
    n = len(st["giri"]) + 1
    testo = normale(open(testi_p, encoding="utf-8").read())
    durata = float(leggi(dati_p).get("durata") or 0)
    v = leggi(verdetto_p)
    validi, scartati = [], []
    for k in v.get("criteri", []):
        if k.get("esito", "ok") == "ok":
            continue
        cit = normale(k.get("citazione", ""))
        dove = str(k.get("dove") or "")
        try:
            s = float(k.get("secondo"))
        except (TypeError, ValueError):
            s = None
        visivo = k.get("visivo") and dove and ((s is not None and 0 <= s <= durata + 0.1) or "copertina" in dove.lower())
        (validi if (cit and cit in testo) or k.get("manca") or visivo else scartati).append(k)
    shutil.copy(dati_p, os.path.join(ciclo, f"dati-giro-{n}.json"))
    shutil.copy(testi_p, os.path.join(ciclo, f"testi-giro-{n}.md"))
    c = conta(validi)
    st["giri"].append({"giro": n, "conti": c, "critiche": validi, "scartate": scartati,
                       "domande_federico": v.get("domande_federico", []), "lettura": v.get("lettura", "")})
    scrivi(os.path.join(ciclo, "stato.json"), st)
    print(f"Giro {n}: {c['blocca']} blocchi, {c['importante']} importanti, {c['minore']} minori ({len(scartati)} critiche scartate senza appiglio)")
    for k in sorted(validi, key=lambda k: (PESO.get(k.get("gravita"), 2), k.get("secondo") or 0)):
        dove = f"{k.get('dove', '')}" + (f" a {k['secondo']} s" if k.get("secondo") is not None else "")
        print(f"  [{k.get('gravita')}] {k.get('id')}{' ' + dove.strip() if dove.strip() else ''}: {k.get('correzione', '')}")
    if c["blocca"] == 0 and c["importante"] == 0:
        print("PASSA")
        return 0
    if n >= MAX_GIRI:
        print(f"FERMATI: {MAX_GIRI} giri fatti; usa `chiudi`")
        return 20
    print("CONTINUA")
    return 10


def risposta(ciclo, file):
    st = stato(ciclo)
    st["giri"][-1]["risposta"] = leggi(file)
    scrivi(os.path.join(ciclo, "stato.json"), st)
    r = st["giri"][-1]["risposta"]
    print(f"Giro {st['giri'][-1]['giro']}: {len(r.get('applicate', []))} correzioni applicate, {len(r.get('rifiutate', []))} rifiutate")


def migliore(st):
    """Vince l'ultimo giro, che contiene le correzioni dei giri prima, a meno che abbia più blocchi del giro prima o riapra
    una critica già corretta (stesso id e stesso punto). Contare solo i difetti sceglieva male: il 03/11/2026, sul carosello
    dell'ernia, il giro dopo aveva tutte le correzioni e difetti nuovi, visti per la prima volta (lezione del ciclo dei caroselli)."""
    ultimo = st["giri"][-1]
    if len(st["giri"]) == 1:
        return ultimo
    prima = st["giri"][-2]
    corrette = set(prima.get("risposta", {}).get("applicate", []))
    punto = lambda k: (k.get("id"), str(k.get("dove") or "").lower(), k.get("secondo"))
    riaperte = {punto(k) for k in prima["critiche"] if k.get("id") in corrette} & {punto(k) for k in ultimo["critiche"]}
    if ultimo["conti"]["blocca"] <= prima["conti"]["blocca"] and not riaperte:
        return ultimo
    return min(st["giri"], key=lambda g: (g["conti"]["blocca"], g["conti"]["importante"], g["conti"]["minore"], -g["giro"]))


def riassunto(st, scelto):
    ultimo = st["giri"][-1]
    passato = ultimo["conti"]["blocca"] == 0 and ultimo["conti"]["importante"] == 0
    corrette = [x for g in st["giri"] if g["giro"] < scelto["giro"] for x in g.get("risposta", {}).get("applicate", [])]
    rifiutate = [x for g in st["giri"] if g["giro"] <= scelto["giro"] for x in g.get("risposta", {}).get("rifiutate", [])]
    domande = list(dict.fromkeys(d for g in st["giri"] for d in g.get("domande_federico", [])))
    # Registro delle critiche (03/11/2026): i codici della griglia che restano aperti nel giro scelto, perché la revisione
    # del mese veda quali domande tornano in tutti i Reel e le trasformi in lezioni per chi scrive
    chiuse = set(scelto.get("risposta", {}).get("applicate", [])) | {x.get("id") for x in scelto.get("risposta", {}).get("rifiutate", [])}
    aperte = [k.get("id") for k in scelto.get("critiche", []) if k.get("id") not in chiuse]
    return {"giri": len(st["giri"]), "giro_scelto": scelto["giro"],
            "esito": f"superata al giro {ultimo['giro']}" if passato else f"fermata: giro migliore {scelto['giro']}",
            "restano": scelto["conti"], "corrette": corrette, "aperte": aperte, "rifiutate": rifiutate, "domande_federico": domande[:8],
            "scartate": sum(len(g.get("scartate", [])) for g in st["giri"])}


def chiudi(ciclo, dati_p):
    st = stato(ciclo)
    if not st["giri"]:
        sys.exit("Nessun giro registrato")
    ultimo = st["giri"][-1]
    passato = ultimo["conti"]["blocca"] == 0 and ultimo["conti"]["importante"] == 0
    senza_revisione = lambda d: {k: v for k, v in d.items() if k != "revisione"}
    # Corretto dopo l'ultimo giro senza farne un altro (la modifica di Federico ha un giro solo): si tiene così com'è,
    # rimettere il giro migliore cancellerebbe le correzioni
    corretto_dopo = senza_revisione(leggi(dati_p)) != senza_revisione(leggi(os.path.join(ciclo, f"dati-giro-{ultimo['giro']}.json")))
    scelto = ultimo if passato or corretto_dopo else migliore(st)
    if scelto["giro"] != ultimo["giro"]:
        shutil.copy(os.path.join(ciclo, f"dati-giro-{scelto['giro']}.json"), dati_p)
        print(f"Rimesso il giro {scelto['giro']} ({scelto['conti']}): rifai controlla-reel.py e i fotogrammi di controllo su questo dati.json")
    dati = leggi(dati_p)
    dati["revisione"] = riassunto(st, scelto)
    if corretto_dopo and not passato:
        applicate = ultimo.get("risposta", {}).get("applicate", [])
        dati["revisione"]["esito"] = f"corretto dopo il giro {ultimo['giro']}, senza un altro giro"
        dati["revisione"]["corrette"] += applicate
        dati["revisione"]["aperte"] = [x for x in dati["revisione"]["aperte"] if x not in applicate]
    scrivi(dati_p, dati)
    r = dati["revisione"]
    print(f"Ciclo chiuso: {r['esito']}, restano {r['restano']['importante']} importanti e {r['restano']['minore']} minori")
    if r["domande_federico"]:
        print("Domande per Federico (in nota_routine):")
        for d in r["domande_federico"]:
            print("  - " + d)


def rapporto(ciclo, come_json=False):
    st = stato(ciclo)
    if come_json:
        print(json.dumps(riassunto(st, migliore(st)) if st["giri"] else {}, ensure_ascii=False, indent=2))
        return
    for g in st["giri"]:
        c = g["conti"]
        print(f"Giro {g['giro']}: {c['blocca']} blocchi, {c['importante']} importanti, {c['minore']} minori")
        r = g.get("risposta", {})
        if r:
            print(f"  corrette: {', '.join(r.get('applicate', [])) or '—'}; rifiutate: "
                  f"{', '.join(x['id'] + ' (' + x['motivo'] + ')' for x in r.get('rifiutate', [])) or '—'}")
    d = list(dict.fromkeys(d for g in st["giri"] for d in g.get("domande_federico", [])))
    if d:
        print("Domande per Federico:")
        for x in d:
            print("  - " + x)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        sys.exit(1)
    if a[0] == "prepara":
        lez = a[a.index("--lezioni") + 1] if "--lezioni" in a else None
        pos = [x for i, x in enumerate(a) if x != "--lezioni" and (i == 0 or a[i - 1] != "--lezioni")]
        prepara(pos[1], pos[2], pos[3] if len(pos) > 3 else None, lez)
    elif a[0] == "giro":
        sys.exit(giro(a[1], a[2], a[3], a[4]))
    elif a[0] == "risposta":
        risposta(a[1], a[2])
    elif a[0] == "chiudi":
        chiudi(a[1], a[2])
    elif a[0] == "rapporto":
        rapporto(a[1], "--json" in a)
    else:
        print(__doc__)
        sys.exit(1)
