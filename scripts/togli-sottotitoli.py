#!/usr/bin/env python3
"""Toglie i sottotitoli impressi (testo bianco) da un video con sfondo fermo, ricostruendo ogni pixel
coperto con lo stesso pixel preso dal fotogramma più vicino nel tempo in cui era libero.

Uso: togli-sottotitoli.py <ingresso> <uscita.mp4> [--da S] [--durata S]
Lavora solo sulla fascia dei sottotitoli (y 0,68–0,94 dell'altezza). Uscita: H.264 CRF 12, audio copiato.
Pensato per "Push up su rialzo", di cui esiste solo il montato con i sottotitoli impressi.
"""
import argparse
import json
import subprocess
from collections import deque

import numpy as np

p = argparse.ArgumentParser()
p.add_argument("ingresso")
p.add_argument("uscita")
p.add_argument("--da", type=float, default=0)
p.add_argument("--durata", type=float, default=0)
a = p.parse_args()

info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                           "stream=width,height", "-of", "json", a.ingresso]))["streams"][0]
W, H = info["width"], info["height"]
Y0, Y1 = int(H * 0.68), int(H * 0.94)
X0, X1 = int(W * 0.05), int(W * 0.95)
BH = Y1 - Y0
FINESTRA = 150  # fotogrammi prima e dopo (5 s a 30 fps)

taglio = (["-ss", str(a.da)] if a.da else []) + (["-t", str(a.durata)] if a.durata else [])
lettore = subprocess.Popen(["ffmpeg", "-nostdin", "-v", "error", *taglio, "-i", a.ingresso, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                           stdout=subprocess.PIPE)
scrittore = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", "30",
                              "-i", "-", *taglio, "-i", a.ingresso, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264",
                              "-crf", "12", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", a.uscita],
                             stdin=subprocess.PIPE)


def bianco(fascia: np.ndarray) -> np.ndarray:
    f = fascia.astype(np.int16)
    return (f.min(axis=2) > 185) & ((f.max(axis=2) - f.min(axis=2)) < 45)


# Bianco FISSO (muro, porta, vaso): bianco in almeno l'85% di 60 fotogrammi presi lungo tutto il video.
# Non è scritta: va escluso, altrimenti viene "ricostruito" con colori sbagliati.
durata_tot = float(json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                                        "-of", "json", a.ingresso]))["format"]["duration"])
conta = np.zeros((BH, W), np.int32)
campioni = 60
for i in range(campioni):
    t = durata_tot * (i + 0.5) / campioni
    b = subprocess.check_output(["ffmpeg", "-nostdin", "-v", "error", "-ss", f"{t:.2f}", "-i", a.ingresso, "-frames:v", "1",
                                 "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    fr = np.frombuffer(b, np.uint8).reshape(H, W, 3)
    conta += bianco(fr[Y0:Y1])
FISSO = conta >= int(campioni * 0.5)


def maschera(fascia: np.ndarray) -> np.ndarray:
    """Pixel di testo: quasi bianchi, poco saturi e NON bianchi fissi; allargati di 5 px per bordo e ombra."""
    m = bianco(fascia) & ~FISSO
    m[:, : X0] = False
    m[:, X1:] = False
    k = 7
    out = m.copy()
    for dy in range(-k, k + 1):
        for dx in range(-k, k + 1):
            if dy * dy + dx * dx <= k * k:
                out |= np.roll(np.roll(m, dy, axis=0), dx, axis=1)
    return out


dimensione = W * H * 3
buffer: deque = deque()  # (fotogramma intero, fascia, maschera)
fine = False
indice_uscita = 0
letti = 0


def leggi():
    global fine, letti
    b = lettore.stdout.read(dimensione)
    if len(b) < dimensione:
        fine = True
        return
    fr = np.frombuffer(b, np.uint8).reshape(H, W, 3).copy()
    fascia = fr[Y0:Y1]
    buffer.append((fr, fascia, maschera(fascia)))
    letti += 1


while not fine and len(buffer) < FINESTRA + 1:
    leggi()
centro = 0  # posizione nel buffer del fotogramma da scrivere
while centro < len(buffer):
    fr, fascia, m = buffer[centro]
    rimasti = m.copy()
    nuova = fascia.copy()
    for k in range(1, FINESTRA + 1):
        if not rimasti.any():
            break
        for j in (centro - k, centro + k):
            if 0 <= j < len(buffer):
                _, f2, m2 = buffer[j]
                prendi = rimasti & ~m2
                if prendi.any():
                    nuova[prendi] = f2[prendi]
                    rimasti &= ~prendi
    # Nessun fotogramma libero nella finestra: il pixel è bianco per tutto il tempo, quindi è sfondo e resta com'è
    out = fr.copy()
    out[Y0:Y1] = nuova
    scrittore.stdin.write(out.tobytes())
    indice_uscita += 1
    # avanza la finestra
    if not fine:
        leggi()
    if centro >= FINESTRA:
        buffer.popleft()
    else:
        centro += 1
    if fine and centro >= len(buffer):
        break
scrittore.stdin.close()
scrittore.wait()
print(f"fotogrammi: {indice_uscita}")
