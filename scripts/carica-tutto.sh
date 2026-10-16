#!/bin/bash
# Uso (sul Mac): scripts/carica-tutto.sh <cartella_lavoro>
# Carica ogni girato preparato da prepara-caricamento.sh:
#   - originale (o i suoi pezzi) nella release "girati" del progetto privato, senza ricodifica
#   - anteprima, trascrizione, info e firma nell'archivio R2 (girati/<nome>/)
# Riprende da dove si era fermato (segna "caricato" in ogni cartella). Credenziali in ~/.config/video-guide/r2.env
set -uo pipefail
W="$1"; REPO=piazzafedericofp-del/video-guide-media
set -a; . "$HOME/.config/video-guide/r2.env"; set +a
export AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY AWS_DEFAULT_REGION=auto
s3() { aws s3 --endpoint-url "$R2_ENDPOINT" "$@"; }
PRESENTI=$(gh release view girati -R "$REPO" --json assets -q '.assets[] | "\(.name) \(.size)"')
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
      gh release upload girati "$F" -R "$REPO" --clobber >/dev/null || { echo "ERRORE upload $B"; OK=0; continue; }
    fi
  done
  rm -f "$O/$N.MOV" "$O/$N.mov" "$O/$N.MP4" "$O/$N.mp4"
  [ $OK = 1 ] || continue
  printf '%s\n' "${NOMI[@]}" > "$O/file-release.txt"
  for f in anteprima.mp4 parole.json frasi.srt info.json sha256 file-release.txt; do
    s3 cp "$O/$f" "s3://video-guide-restyling/girati/$N/$f" --only-show-errors || OK=0
  done
  [ $OK = 1 ] && touch "$O/caricato" && echo "ok  $N"
done
echo FINE
