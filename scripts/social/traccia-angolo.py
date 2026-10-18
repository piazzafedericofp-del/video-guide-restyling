"""Misura fotogramma per fotogramma l'angolo di un attrezzo che ruota attorno a un punto (es. bastone attorno alla mano).

Uso: ffmpeg -ss <inizio> -t <durata> -i public/<clip>.mp4 -vf fps=30 <cartella>/%03d.png
     uv run -q --with pillow --with numpy python3 scripts/traccia-angolo.py <cartella> <x perno> <y perno> <secondo iniziale>
Coordinate del perno in pixel della clip (1080×1920). Stampa: secondo, angolo sullo schermo (0 destra, 270 su, 180 sinistra), pixel trovati.
Conta solo i pixel del colore dell'attrezzo che si muovono rispetto allo sfondo (mediana dei fotogrammi): lo sfondo dello
stesso colore non inganna. Le soglie del colore sono per il legno chiaro: per un elastico o un manubrio vanno cambiate.
Ogni Reel con un arco usa questi valori come "traccia" (un punto ogni 0,1 s): così la grafica coincide con il video.
"""
import sys, math, glob
import numpy as np
from PIL import Image
cartella, gx, gy, t0 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
file = sorted(glob.glob(cartella + "/*.png"))
fot = np.stack([np.asarray(Image.open(f).convert("RGB"), dtype=np.int16) for f in file])
sfondo = np.median(fot, axis=0)
for i, im in enumerate(fot):
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    legno = (r > 140) & (g > 95) & (b < 160) & (r - b > 45) & (r > g + 8)
    mosso = np.abs(im - sfondo).sum(axis=2) > 60
    m = legno & mosso
    h, w = m.shape
    migliore = (0, None)
    for a10 in range(1750, 3651, 10):
        a = math.radians(a10 / 10)
        n = 0
        for rr in range(150, 560, 5):
            x, y = int(gx + rr * math.cos(a)), int(gy + rr * math.sin(a))
            if 0 <= x < w and 0 <= y < h and m[y, x]: n += 1
        if n > migliore[0]: migliore = (n, a10 / 10)
    print(f"{t0 + i / 30:.2f} {migliore[1]} {migliore[0]}")
