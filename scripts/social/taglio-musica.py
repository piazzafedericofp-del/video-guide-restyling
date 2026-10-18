"""Sceglie nel brano il tratto più pieno e stabile lungo quanto il Reel, che parte su un battito.

Uso: uv run -q --with librosa --with numpy python3 scripts/taglio-musica.py <brano.mp3> <durata_s>
Stampa: secondo di inizio, BPM. Poi colonna_reel: ffmpeg -ss <inizio> -t <durata> … (vedi skill reel-social).
"""
import sys, librosa, numpy as np
f, durata = sys.argv[1], float(sys.argv[2])
y, sr = librosa.load(f, sr=22050, mono=True)
tempo, battiti = librosa.beat.beat_track(y=y, sr=sr)
t_batt = librosa.frames_to_time(battiti, sr=sr)
rms = librosa.feature.rms(y=y, hop_length=512)[0]
t_rms = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512)
migliore = None
for i in range(0, len(t_batt), 4):  # ogni 4 battiti ≈ inizio di battuta
    s = t_batt[i]
    if s < 8 or s + durata > t_rms[-1] - 3: continue  # salta l'intro e il finale
    m = rms[(t_rms >= s) & (t_rms < s + durata)]
    punteggio = m.mean() - 0.8 * m.std()  # pieno ma regolare
    if migliore is None or punteggio > migliore[0]: migliore = (punteggio, s)
print(f"{migliore[1]:.3f} {float(np.atleast_1d(tempo)[0]):.1f}")
