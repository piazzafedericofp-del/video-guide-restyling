#!/bin/bash
# Uso (sul Mac): scripts/prepara-caricamento.sh <cartella_lavoro> <girato1> [girato2 ...]
# Per ogni girato: anteprima 1280x720 (per guardare e decidere il montaggio), trascrizione whisper,
# firma sha256 e, se supera 1,9 GB, pezzi tagliati senza ricodifica (limite 2 GB delle release GitHub).
# Riprende da dove si era fermato: salta i girati già pronti.
set -uo pipefail
W="$1"; shift
DIR="$(cd "$(dirname "$0")" && pwd)"
for SRC in "$@"; do
  N="$(basename "$SRC")"; N="${N// /_}"; O="$W/girati/${N%.*}"
  [ -f "$O/pronto" ] && continue
  mkdir -p "$O"
  echo "== $N"
  ffmpeg -v error -y -i "$SRC" -map 0:v:0 -map 0:a:0 -vf scale=1280:720 -c:v libx264 -crf 24 -preset veryfast \
    -c:a aac -b:a 96k -movflags +faststart "$O/anteprima.mp4" || { echo "ERRORE anteprima $N"; continue; }
  "$DIR/trascrivi.sh" "$SRC" "$O/trascrizione" >/dev/null || { echo "ERRORE trascrizione $N"; continue; }
  cp "$O/trascrizione/parole-tempi.json" "$O/parole.json"; cp "$O/trascrizione/frasi.srt" "$O/frasi.srt"
  rm -rf "$O/trascrizione"
  ffprobe -v error -show_entries format=duration,size:stream=width,height,codec_name -of json "$SRC" > "$O/info.json"
  shasum -a 256 "$SRC" | awk '{print $1}' > "$O/sha256"
  DIM=$(stat -f %z "$SRC")
  if [ "$DIM" -gt 1900000000 ]; then
    # Pezzi da ~4 minuti, copia senza ricodifica: riuniti con il concat demuxer tornano identici nei fotogrammi
    mkdir -p "$O/pezzi"
    ffmpeg -v error -y -i "$SRC" -map 0 -c copy -f segment -segment_time 240 -reset_timestamps 0 \
      "$O/pezzi/${N%.*}.parte%02d.mov" || { echo "ERRORE pezzi $N"; continue; }
  fi
  echo "$SRC" > "$O/sorgente"
  touch "$O/pronto"
done
echo FINE
