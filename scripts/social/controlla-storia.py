"""Controlli automatici delle storie (skill storie-social).
  contrasto <immagine> <reel|carosello>: frase piccola (#CBD5E1) sullo sfondo accanto ≥ 4,5:1 (conta nella variante 2,
      dove lo sfondo è il post sfocato e cambia a ogni post)
  video <file.mp4>: durata tra 3 e 60 s (limite di Instagram e Facebook) e audio presente
Esce con 1 se il controllo non passa. Nei log nessun testo del contenuto."""
import json
import subprocess
import sys

from PIL import Image


def luminanza(rgb):
    def c(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (c(x) for x in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrasto(file, formato):
    img = Image.open(file).convert("RGB")
    alto = 1100 if formato == "reel" else 1125
    y = 352 + alto + 34 + 63  # riga della frase piccola (Storia.tsx: frase grande 44 px + 10 px)
    # sfondo ai lati della frase, dove non c'è testo
    px = [img.getpixel((x, yy)) for yy in range(y, y + 38, 3) for x in list(range(30, 140, 6)) + list(range(940, 1050, 6))]
    peggiore = max(luminanza(p) for p in px)  # il punto più chiaro accanto alla frase
    testo = luminanza((0xCB, 0xD5, 0xE1))
    rapporto = (max(testo, peggiore) + 0.05) / (min(testo, peggiore) + 0.05)
    print(f"contrasto frase piccola: {rapporto:.1f}:1")
    return rapporto >= 4.5


def video(file):
    info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", file]))
    durata = float(info["format"]["duration"])
    audio = any(s["codec_type"] == "audio" for s in info["streams"])
    print(f"storia video: {durata:.1f} s, audio {'sì' if audio else 'no'}")
    return 3 <= durata <= 60 and audio


if __name__ == "__main__":
    ok = contrasto(sys.argv[2], sys.argv[3]) if sys.argv[1] == "contrasto" else video(sys.argv[2])
    sys.exit(0 if ok else 1)
