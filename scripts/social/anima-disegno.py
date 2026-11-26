#!/usr/bin/env python3
"""Disegno animato della slide «esercizio» per Instagram, fatto da solo nel render (22/11/2026).

Federico: «rendilo automatico… le video-illustrazioni vengono comunque salvate giusto?». Per un carosello con la slide
`esercizio` disegnata (`disegnoSvg`, senza `clip`) e senza `disegnoVideo`:
  1. controlla che i due disegni si possano animare (stessi elementi nello stesso ordine, cambiano solo i numeri;
     la freccia può esserci solo nel secondo tempo; niente pezzi specchiati);
  2. fa i fotogrammi a 30 fps con i tempi dei passi (andata, tenuta, ritorno — più lento se il passo dice «piano» —,
     pausa; respiro più lento), nella scena allargata alle proporzioni del riquadro della slide (900x346);
  3. li trasforma in PNG con Chrome e controlla che non ci siano scatti tra un fotogramma e l'altro;
  4. salva il video in social/disegni/animati/<disegno>-<impronta>.mp4 dell'archivio, scrive `disegnoVideo` e `durata`
     nel dati.json dell'archivio e in public/dati.json, e lo copia in public/esercizio.mp4.
Se un controllo non passa la slide resta ferma anche su Instagram (come su Facebook e TikTok) e il motivo va in
social/lavori/<id>/animazione.txt: mai un'animazione difettosa, mai un render fermo per questo.

Uso: python3 scripts/social/anima-disegno.py <dati.json dell'archivio> [--controlla]
  --controlla: solo il punto 1, senza Chrome (per la routine, prima di consegnare un disegno nuovo). Esce con 1 se non va.
"""
import concurrent.futures as cf
import hashlib, json, math, os, re, shutil, statistics, subprocess, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import morph_disegno as morph  # noqa: E402

FPS = 30
W_PX, H_PX = 1888, 726
VB_W = 300 * 900 / 346


def ease(x):
    x = max(0.0, min(1.0, x)); return 0.5 - 0.5 * math.cos(math.pi * x)


def tempi(passi: list[str]):
    """(andata, tenuta, ritorno, pausa, ripetizioni) dai passi della slide."""
    testo = " ".join(passi).lower()
    if re.search(r"respir|inspir|espir|butta fuori l.aria", testo):
        return 2.2, 0.25, 2.8, 0.25, 2
    tenuta = 0.6 if re.search(r"\btieni|stringi|mantieni|fermati", testo) else 0.4
    ritorno = 1.8 if re.search(r"\bpiano\b|lentamente|con calma", testo) else 1.4
    return 1.2, tenuta, ritorno, 0.4, 3


def allarga(svg):
    x0 = -(VB_W - 447) / 2
    svg = re.sub(r'viewBox="0 0 447 300"', f'viewBox="{x0:.1f} 0 {VB_W:.1f} 300"', svg, count=1)
    svg = re.sub(r'<rect x="0" ([^>]*?)width="447"', r'<rect x="-300" \1width="1047"', svg)
    svg = re.sub(r'<rect x="-20" ([^>]*?)width="500"', r'<rect x="-320" \1width="1087"', svg)
    svg = re.sub(r'<line x1="0" ([^>]*?)x2="447"', r'<line x1="-300" \1x2="747"', svg)
    return svg


def chrome():
    for c in (os.environ.get("CHROME"), shutil.which("google-chrome"), shutil.which("google-chrome-stable"), shutil.which("chromium"),
              shutil.which("chromium-browser"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"):
        if c and os.path.exists(c):
            return c
    return None


def png(cr, cart, n):
    html = cart / f"{n:04d}.html"
    html.write_text(f'<html><body style="margin:0;overflow:hidden"><img src="{n:04d}.svg" width="{W_PX}" height="{H_PX}" style="display:block"></body></html>')
    prof = tempfile.mkdtemp(prefix="chr")
    subprocess.run([cr, "--headless=new", "--disable-gpu", "--no-sandbox", f"--user-data-dir={prof}", f"--screenshot={cart}/{n:04d}.png",
                    f"--window-size={W_PX},{H_PX}", "--hide-scrollbars", f"file://{html}"], capture_output=True, timeout=60)
    shutil.rmtree(prof, ignore_errors=True)


def scatti(cart, n):
    """Differenza media tra fotogrammi consecutivi (decodificati in grigio, piccoli): None se va bene, se no il motivo."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-framerate", str(FPS), "-i", f"{cart}/%04d.png", "-vf", "scale=236:91,format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    F = 236 * 91
    fr = [raw[i * F:(i + 1) * F] for i in range(len(raw) // F)]
    if len(fr) != n:
        return f"fotogrammi mancanti ({len(fr)} su {n})"
    d = [sum(abs(a - b) for a, b in zip(fr[i], fr[i + 1])) / F for i in range(len(fr) - 1)]
    mov = [x for x in d if x > 0.05]
    if not mov:
        return "il disegno non si muove"
    m = statistics.median(mov)
    salti = [i for i, x in enumerate(d) if x > 4 * m and x > 1.5]
    giro = sum(abs(a - b) for a, b in zip(fr[-1], fr[0])) / F
    if salti:
        return f"scatto tra i fotogrammi {salti[:3]} (differenza {max(d):.2f}, movimento normale {m:.2f})"
    if giro > 4 * m and giro > 1.5:
        return "scatto tra una ripetizione e l'altra"
    return None


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(2)
    dati_p = Path(sys.argv[1]); solo_controllo = "--controlla" in sys.argv
    dati = json.loads(dati_p.read_text())
    sl = [s for s in dati.get("props", {}).get("slide", []) if s.get("tipo") == "esercizio"]
    if not sl or sl[0].get("clip") or not sl[0].get("disegnoSvg"):
        print("anima-disegno: niente da animare (nessuna slide esercizio disegnata)"); return
    s = sl[0]
    # Il video si salta solo se esiste davvero: un render fermato dopo l'animazione (controllo dei testi) lasciava
    # disegnoVideo nel dati.json senza il file, e i render dopo uscivano con la slide ferma (ca7529c8, 26/11/2026)
    if s.get("disegnoVideo") and not solo_controllo:
        if (dati_p.parent.parent.parent / "disegni" / "animati" / s["disegnoVideo"]).exists():
            print(f"anima-disegno: c'è già {s['disegnoVideo']}"); return
        print(f"anima-disegno: {s['disegnoVideo']} non c'è nell'archivio, lo rifaccio")
        s.pop("disegnoVideo", None); s.pop("durata", None)
    a, b = s["disegnoSvg"]
    cart_disegno = Path(tempfile.mkdtemp(prefix="pose"))
    (cart_disegno / "0.svg").write_text(a); (cart_disegno / "1.svg").write_text(b)
    A, B = morph.leggi(cart_disegno)
    # 1. struttura: si prova su tutto il movimento
    morph.PROBLEMI.clear()
    for k in range(11):
        morph.fotogramma(A, B, k / 10, 1.0)
    lavoro = dati_p.parent
    if morph.PROBLEMI:
        motivo = "; ".join(sorted(morph.PROBLEMI))
        print(f"::warning::disegno non animabile, la slide resta ferma: {motivo}")
        if not solo_controllo:
            (lavoro / "animazione.txt").write_text(f"Disegno «{s.get('disegno', '')}» non animato: {motivo}. La slide esercizio resta ferma anche su Instagram.\n")
        sys.exit(1 if solo_controllo else 0)
    if solo_controllo:
        print("anima-disegno: i due disegni si possono animare"); return
    cr = chrome()
    if not cr:
        print("::warning::Chrome non trovato: la slide esercizio resta ferma"); return
    # 2. fotogrammi
    andata, tenuta, ritorno, pausa, rip = tempi(s.get("passi", []))
    cart = Path(tempfile.mkdtemp(prefix="anima"))
    n = 0
    for fase, dur in (("andata", andata), ("tenuta", tenuta), ("ritorno", ritorno), ("pausa", pausa)):
        k = round(dur * FPS)
        for i in range(k):
            u = i / k
            t, fo = {"andata": (ease(u), min(1.0, u / 0.3)), "tenuta": (1.0, 1.0), "ritorno": (1 - ease(u), max(0.0, 1 - u / 0.25)), "pausa": (0.0, 0.0)}[fase]
            (cart / f"{n:04d}.svg").write_text(allarga(morph.fotogramma(A, B, t, fo)))
            n += 1
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        list(ex.map(lambda i: png(cr, cart, i), range(n)))
    # 3. scatti
    problema = scatti(cart, n)
    if problema:
        print(f"::warning::animazione scartata, la slide resta ferma: {problema}")
        (lavoro / "animazione.txt").write_text(f"Disegno «{s.get('disegno', '')}» non animato: {problema}. La slide esercizio resta ferma anche su Instagram.\n")
        return
    # 4. video, salvataggio, dati
    impronta = hashlib.sha1((a + b).encode()).hexdigest()[:8]
    nome = f"{s.get('disegno') or 'disegno'}-{impronta}.mp4"
    animati = lavoro.parent.parent / "disegni" / "animati"
    animati.mkdir(parents=True, exist_ok=True)
    ciclo = cart / "ciclo.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-i", f"{cart}/%04d.png", "-vf", "format=yuv420p",
                    "-c:v", "libx264", "-crf", "16", "-bf", "0", "-g", "30", str(ciclo)], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-stream_loop", str(rip - 1), "-i", str(ciclo), "-c", "copy", str(animati / nome)], check=True)
    durata = round(n / FPS * rip, 1)
    for p in (dati_p, Path("public/dati.json")):
        if not p.exists():
            continue
        raw = p.read_text()
        d = json.loads(raw)
        for x in d["props"]["slide"]:
            if x.get("tipo") == "esercizio":
                x["disegnoVideo"], x["durata"] = nome, durata
        rientro = len(raw.split("\n")[1]) - len(raw.split("\n")[1].lstrip(" ")) if "\n" in raw.strip() else None
        p.write_text(json.dumps(d, ensure_ascii=False, indent=rientro) + ("\n" if raw.endswith("\n") else ""))
    if Path("public").is_dir():
        shutil.copy(animati / nome, "public/esercizio.mp4")
    (lavoro / "animazione.txt").unlink(missing_ok=True)
    print(f"anima-disegno: {nome}, {n} fotogrammi, {durata} s ({rip} ripetizioni)")


if __name__ == "__main__":
    main()
