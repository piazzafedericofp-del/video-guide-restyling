#!/bin/bash
# Uso: scripts/prepara-girato.sh <girato.MOV> <inizio_s> <durata_s> <nome>
# Crea in public/: <nome>-4k.mp4 (colore corretto, senza audio), <nome>-voce.wav (voce pulita, -16 LUFS),
# <nome>-ultimo.jpg (ultimo fotogramma per la scheda finale)
set -euo pipefail
SRC="$1"; DA="$2"; DUR="$3"; NOME="$4"
P="$(cd "$(dirname "$0")/.." && pwd)/public"
# Mac: encoder hardware; Linux (cloud): x264 quasi trasparente, qualità pari o superiore
if [ "$(uname)" = "Darwin" ]; then CODIFICA="-c:v h264_videotoolbox -b:v 70M"; else CODIFICA="-c:v libx264 -crf 12 -preset fast"; fi
ffmpeg -v error -y -ss "$DA" -t "$DUR" -i "$SRC" -map 0:v:0 -an \
  -vf "eq=contrast=1.07:saturation=1.1:gamma=0.97,colorbalance=rs=0.03:bs=-0.03:rm=0.02:bm=-0.02,unsharp=5:5:0.4" \
  $CODIFICA -pix_fmt yuv420p "$P/$NOME-4k.mp4"
ffmpeg -v error -y -ss "$DA" -t "$DUR" -i "$SRC" -vn \
  -af "highpass=f=80,afftdn=nf=-25,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=9" \
  -ar 48000 "$P/$NOME-voce.wav"
ffmpeg -v error -y -sseof -0.15 -i "$P/$NOME-4k.mp4" -frames:v 1 -vf scale=1920:1080 "$P/$NOME-ultimo.jpg"
echo "ok: $P/$NOME-4k.mp4, $NOME-voce.wav, $NOME-ultimo.jpg"
