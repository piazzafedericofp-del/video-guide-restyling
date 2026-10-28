"""Storie di un post (skill storie-social): carica in R2 i file di rendi-storie.sh e restituisce i campi del post.
Da solo (flusso storie.yml, post già consegnati): python3 storie.py <id post> <uscite> → li salva anche in dashboard.
File attesi: <uscite>/storie/{ig,fb}-{1,2,3}.{jpg,mp4} (+ slide.jpg per il carosello). Se ne manca uno, nessuna storia."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from dashboard import carica, chiama  # noqa: E402

SOCIAL = {"instagram": "ig", "facebook": "fb"}


def carica_storie(pid, uscite):
    cartella = Path(uscite) / "storie"
    chiavi = {}
    for social, sigla in SOCIAL.items():
        file = [next(iter(cartella.glob(f"{sigla}-{v}.*")), None) for v in (1, 2, 3)]
        if not all(file):
            return {}
        chiavi[social] = []
        for f in file:
            tipo = "video/mp4" if f.suffix == ".mp4" else "image/jpeg"
            carica(f, f"post/{pid}/storia-{f.name}", tipo)
            chiavi[social].append(f"post/{pid}/storia-{f.name}")
    campi = {"storie_keys": json.dumps(chiavi)}
    if (cartella / "slide.jpg").exists():
        carica(cartella / "slide.jpg", f"post/{pid}/storia-slide.jpg", "image/jpeg")
        campi["slide_key_storia"] = f"post/{pid}/storia-slide.jpg"
    return campi


if __name__ == "__main__":
    pid, uscite = sys.argv[1], sys.argv[2]
    campi = carica_storie(pid, uscite)
    if not campi:
        sys.exit("Storie incomplete: niente caricato.")
    print(chiama(f"/api/generatore/storia/{pid}", "POST", campi))
