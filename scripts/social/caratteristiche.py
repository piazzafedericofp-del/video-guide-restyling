"""Come è fatto un contenuto social (piano "robot che imparano dai dati", 29/10/2026).

Calcola da dati.json (il file del montaggio) e lavoro.json (il lavoro della dashboard) un piccolo JSON di
caratteristiche oggettive: niente giudizi, solo ciò che si può contare. La dashboard lo salva sul post e la
revisione del mese confronta i risultati tra contenuti fatti in modo diverso (ed esperimenti A/B: campo
"esperimento" nel dati.json, se la routine sta provando una versione). 0 token: lo fa lo script alla consegna.

Uso come modulo: calcola(dati, lavoro, uscite=None, regole="") -> dict
Uso da riga di comando (prova): python3 caratteristiche.py <cartella del lavoro>
"""
import json
import sys
from pathlib import Path

SCHIENA = ("schiena", "lombare", "dorsale", "colonna", "bacino", "sciatica", "sciatalgia")


def _brief(lavoro):
    b = lavoro.get("brief") or {}
    if isinstance(b, str):
        try:
            b = json.loads(b or "{}")
        except json.JSONDecodeError:
            b = {}
    return b if isinstance(b, dict) else {}


def _guida(distretto):
    d = (distretto or "").lower()
    if "spalla" in d:
        return "spalla"
    if any(s in d for s in SCHIENA):
        return "schiena"
    return ""


def _reel(p, dati, lavoro):
    brief = _brief(lavoro)
    clip = str(dati.get("clip") or lavoro.get("clip_id") or "")
    if brief.get("assaggio_guida"):
        tipo = "assaggio_guida"
    elif brief.get("vecchio_reel") or clip.startswith("vecchio-reel"):
        tipo = "vecchio_reel"
    elif p.get("sottotitoli") or p.get("parole"):
        tipo = "parlato"
    else:
        tipo = "esercizio"
    righe = (p.get("gancio") or {}).get("righe") or []
    gancio = " ".join(righe).strip()
    passi = (p.get("passi") or {}).get("voci") or []
    copertina = p.get("copertina") or {}
    return {
        "tipo": tipo,
        "gancio_domanda": gancio.endswith("?"),
        "gancio_righe": len(righe),
        "passi": len(passi),
        "errore_comune": bool(p.get("errore")),
        "dosaggio": bool(p.get("dosaggio")),
        "durata_s": round(float(dati.get("durata") or 0), 1) or None,
        "piani": len(p.get("piani") or []),
        "copertina_domanda": " ".join(copertina.get("righe") or []).strip().endswith("?"),
        "brano": dati.get("brano", ""),
    }


def _carosello(p, uscite):
    slide = p.get("slide") or []
    tipi = {}
    for s in slide:
        tipi[s.get("tipo", "?")] = tipi.get(s.get("tipo", "?"), 0) + 1
    copertina = next((s for s in slide if s.get("tipo") == "copertina"), {})
    illustrazioni = sorted({(s.get("illustrazione") or {}).get("tipo") for s in slide if isinstance(s.get("illustrazione"), dict)} - {None})
    chiusura = next((s for s in slide if s.get("tipo") == "chiusura"), {})
    allarmi = next((s for s in slide if s.get("segno") == "attenzione"), {})
    animate = len(list((Path(uscite) / "c45").glob("slide-*.mp4"))) if uscite and (Path(uscite) / "c45").exists() else None
    return {
        "slide": len(slide),
        "tipi_slide": tipi,
        "titolo_domanda": (copertina.get("titolo") or "").strip().endswith("?"),
        "occhiello": copertina.get("occhiello", ""),
        "copertina_ia": str(copertina.get("fotoIA", "")).lower() in ("true", "1"),
        "illustrazioni": illustrazioni,
        "numeri_grandi": sum(1 for s in slide if s.get("tipo") == "dato" and s.get("numero")),
        "chiusura_guida": bool(chiusura.get("guida")),
        "campanelli": len(allarmi.get("voci") or []),
        "slide_animate": animate,
    }


def calcola(dati, lavoro, uscite=None, regole=""):
    p = dati.get("props") or {}
    formato = dati.get("formato") or lavoro.get("formato") or ""
    distretto = lavoro.get("distretto") or ""
    c = {
        "formato": formato,
        "distretto": distretto,
        "guida": _guida(distretto),
        "pilastro": lavoro.get("pilastro", ""),
        "variante": int(lavoro.get("variante") or 0),
        "tema": lavoro.get("tema_titolo") or "",
        "regole": (regole or "").strip().splitlines()[0][:80] if regole else "",
    }
    c |= _reel(p, dati, lavoro) if formato == "reel" else _carosello(p, uscite) if formato == "carosello" else {}
    if dati.get("esperimento"):
        c["esperimento"] = dati["esperimento"]
    return c


def da_cartella(cartella, uscite=None):
    """Caratteristiche di un lavoro dalla sua cartella in video-guide-media/social/lavori/<id>/."""
    d = Path(cartella)
    dati = json.loads((d / "dati.json").read_text())
    lavoro = json.loads((d / "lavoro.json").read_text()) if (d / "lavoro.json").exists() else {}
    regole = (d / "regole.txt").read_text() if (d / "regole.txt").exists() else ""
    return calcola(dati, lavoro, uscite, regole)


if __name__ == "__main__":
    print(json.dumps(da_cartella(sys.argv[1]), ensure_ascii=False, indent=1))
