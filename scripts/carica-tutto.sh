#!/bin/bash
# Uso (sul Mac): scripts/carica-tutto.sh <cartella_lavoro> [clone_di_video-guide-media]
# Carica ogni girato preparato da prepara-caricamento.sh, solo su GitHub:
#   - originale (o i suoi pezzi oltre 2 GB) nella release "girati" del progetto privato, senza ricodifica
#   - anteprima 720p, trascrizione, info e firma in girati/<nome>/ del progetto privato (git)
# Riprende da dove si era fermato (segna "caricato" in ogni cartella). Serve `gh auth login`.
set -uo pipefail
W="$1"; M="${2:-$HOME/video-guide-media}"; REPO=piazzafedericofp-del/video-guide-media
[ -d "$M/.git" ] || gh repo clone "$REPO" "$M" -- -q
PRESENTI=$(gh release view girati -R "$REPO" --json assets -q '.assets[] | "\(.name) \(.size)"')
NUOVI=0
for O in "$W"/girati/*/; do
  O="${O%/}"; N="$(basename "$O")"
  [ -f "$O/pronto" ] || continue
  [ -f "$O/caricato" ] && continue
  SRC="$(cat "$O/sorgente")"
  case "$SRC" in /*) ;; *) SRC="$HOME/Desktop/VIDEO GUIDE/$SRC";; esac
  if [ -d "$O/pezzi" ]; then FILES=("$O"/pezzi/*); else
    EXT="${SRC##*.}"; ln -f "$SRC" "$O/$N.$EXT"; FILES=("$O/$N.$EXT"); fi
  OK=1; NOMI=()
  for F in "${FILES[@]}"; do
    B="$(basename "$F")"; DIM=$(stat -f %z "$F"); NOMI+=("$B")
    if ! grep -qx "$B $DIM" <<< "$PRESENTI"; then
      echo "su  $B ($((DIM/1000000)) MB)"
      gh release upload girati "$F" -R "$REPO" --clobber >/dev/null || { echo "ERRORE upload $B"; OK=0; }
    fi
  done
  rm -f "$O/$N.MOV" "$O/$N.mov" "$O/$N.MP4" "$O/$N.mp4"
  [ $OK = 1 ] || continue
  printf '%s\n' "${NOMI[@]}" > "$O/file-release.txt"
  mkdir -p "$M/girati/$N"
  cp "$O"/{anteprima.mp4,parole.json,frasi.srt,info.json,sha256,file-release.txt} "$M/girati/$N/"
  touch "$O/caricato"; NUOVI=$((NUOVI+1)); echo "ok  $N"
done
if [ $NUOVI -gt 0 ]; then
  cd "$M" && git add girati && git commit -q -m "Anteprime e trascrizioni di $NUOVI girati" && \
    for i in 1 2 3 4 5; do git pull -q --rebase && git push -q && break; sleep 5; done
fi
echo FINE
