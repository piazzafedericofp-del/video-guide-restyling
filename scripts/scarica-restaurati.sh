#!/bin/bash
# Sul Mac (ogni 30 minuti via launchd): scarica le lezioni restaurate non ancora presenti
# in ~/Desktop/VIDEO GUIDE/_restaurati/<guida>/ (la Scrivania è su iCloud) e ne controlla la dimensione.
# Non cancella niente in cloud: la release "restaurati" resta come copia di sicurezza.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO=piazzafedericofp-del/video-guide-media
DEST="$HOME/Desktop/VIDEO GUIDE/_restaurati"
gh release view restaurati -R "$REPO" --json assets -q '.assets[] | "\(.name) \(.size)"' 2>/dev/null |
while read -r NOME DIM; do
  GUIDA="${NOME%%-*}"; mkdir -p "$DEST/$GUIDA"
  F="$DEST/$GUIDA/$NOME"
  [ -f "$F" ] && [ "$(stat -f %z "$F")" = "$DIM" ] && continue
  gh release download restaurati -R "$REPO" -p "$NOME" -D "$DEST/$GUIDA" --clobber &&
    [ "$(stat -f %z "$F")" = "$DIM" ] && echo "$(date '+%F %T') scaricato $NOME"
done
