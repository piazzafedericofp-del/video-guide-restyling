"""Posa del corpo su una clip dei Reel, una volta per clip (audit del 29/10/2026, skill reel-social, "Grafiche di movimento").

MediaPipe Pose Landmarker (Apache 2.0, gira sui server di GitHub) su 10 fotogrammi al secondo della clip preparata come nel
render (1080×1920, stesso ritaglio): con i punti esatti la routine aggancia cerchio, asse, zona, freccia e contatore al corpo
invece di stimarli a occhio sull'anteprima, e controlla-reel.py vede se il gesto esce dalla zona visibile o se il pulsante
copre le mani. La posa si calcola sul girato, non sul Reel montato: nelle inquadrature strette MediaPipe perde il corpo.

Uso: python3 scripts/social/posa.py <clip> <modello pose_landmarker_full.task> <uscita.json>
Uscita: {clip, fps, punti: [nomi], t: [secondi della clip], xy: [per fotogramma [[x, y, visibilità], …] oppure null]}
in pixel della clip 1080×1920; "_s"/"_d" = sinistra/destra DELLA PERSONA (di fronte alla camera la sinistra sta a destra).
"""
import json
import subprocess
import sys
from pathlib import Path

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

clip, modello, uscita = sys.argv[1], sys.argv[2], sys.argv[3]
FPS, W, H = 10, 540, 960
PUNTI = {0: "naso", 2: "occhio_s", 5: "occhio_d", 7: "orecchio_s", 8: "orecchio_d", 9: "bocca_s", 10: "bocca_d",
         11: "spalla_s", 12: "spalla_d", 13: "gomito_s", 14: "gomito_d", 15: "polso_s", 16: "polso_d", 19: "indice_s", 20: "indice_d",
         23: "anca_s", 24: "anca_d", 25: "ginocchio_s", 26: "ginocchio_d", 27: "caviglia_s", 28: "caviglia_d",
         29: "tallone_s", 30: "tallone_d", 31: "punta_s", 32: "punta_d"}

# Stesso ritaglio del render (social.yml), a metà misura: MediaPipe lavora comunque a 256 px
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", clip, "-an", "-vf",
                      f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps={FPS},scale={W}:{H}",
                      "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, stdin=subprocess.DEVNULL, check=True).stdout
fotogrammi = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
opzioni = vision.PoseLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=modello),
                                       running_mode=vision.RunningMode.VIDEO, num_poses=1)
t, xy = [], []
with vision.PoseLandmarker.create_from_options(opzioni) as rileva:
    for i, f in enumerate(fotogrammi):
        r = rileva.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(f)), int(i * 1000 / FPS))
        t.append(round(i / FPS, 2))
        if not r.pose_landmarks:
            xy.append(None)
            continue
        lm = r.pose_landmarks[0]
        xy.append([[round(lm[k].x * 1080), round(lm[k].y * 1920), round(lm[k].visibility, 1)] for k in PUNTI])
Path(uscita).write_text(json.dumps({"clip": Path(clip).stem, "fps": FPS, "punti": list(PUNTI.values()), "t": t, "xy": xy},
                                   separators=(",", ":")))
print(f"{len(t)} fotogrammi, corpo trovato in {sum(v is not None for v in xy)}")
