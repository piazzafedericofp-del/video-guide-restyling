#!/bin/bash
# Sul Mac (ogni 30 minuti via launchd): scarica le lezioni restaurate nuove o cambiate
# direttamente nella cartella "video definitivi" della guida, divise per fase
# (la Scrivania è su iCloud). Un file con lo stesso nome viene sostituito quando cambia dimensione.
# Non cancella niente in cloud: la release "restaurati" resta come copia di sicurezza.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
REPO=piazzafedericofp-del/video-guide-media
BASE="$HOME/Desktop/VIDEO GUIDE"

# nome release (es. spalla-subacuta-06-rotazione-dorsale-seduto.mp4) -> cartella e nome locale
destinazione() {
  case "$1" in
    spalla-acuta-*)      echo "$BASE/GUIDA DOLORE DI SPALLA/video definitivi/1 - Fase acuta|${1#spalla-acuta-}" ;;
    spalla-subacuta-*)   echo "$BASE/GUIDA DOLORE DI SPALLA/video definitivi/2 - Fase subacuta|${1#spalla-subacuta-}" ;;
    spalla-guarigione-*) echo "$BASE/GUIDA DOLORE DI SPALLA/video definitivi/3 - Fase guarigione|${1#spalla-guarigione-}" ;;
    schiena-sblocco-*)   echo "$BASE/GUIDA SBLOCCO SCHIENA DI EMERGENZA/video definitivi|${1#schiena-sblocco-}" ;;
    *)                   echo "$BASE/_restaurati/altro|$1" ;;
  esac
}

gh release view restaurati -R "$REPO" --json assets -q '.assets[] | "\(.name) \(.size)"' 2>/dev/null |
while read -r NOME DIM; do
  D="$(destinazione "$NOME")"; DIR="${D%%|*}"; F="$DIR/${D#*|}"
  [ -f "$F" ] && [ "$(stat -f %z "$F")" = "$DIM" ] && continue
  mkdir -p "$DIR"
  TMP="$(mktemp -d "$DIR/.scarico.XXXXXX")"
  gh release download restaurati -R "$REPO" -p "$NOME" -D "$TMP" --clobber < /dev/null &&
    [ "$(stat -f %z "$TMP/$NOME")" = "$DIM" ] && mv -f "$TMP/$NOME" "$F" &&
    echo "$(date '+%F %T') scaricato $NOME -> ${F#$BASE/}"
  rm -rf "$TMP"
done

exit 0
