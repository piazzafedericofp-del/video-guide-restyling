#!/usr/bin/env bash
# Slide «esercizio» di un carosello «Cosa dicono gli studi» (11/11/2026): dal girato di Federico (clip dell'archivio)
# prepara in public/ il video per Instagram (esercizio.mp4) e i due fotogrammi fermi per Facebook e TikTok
# (esercizio-1.jpg, esercizio-2.jpg). Senza una slide «esercizio» non fa niente.
# Uso: bash scripts/social/prepara-esercizio.sh <dati.json>
#   CLIP_LOCALE=<file.mp4> per le prove sul Mac (salta lo scaricamento dall'archivio)
# Campi della slide: clip (id nell'archivio clip-social), da e durata (secondi del video), ritaglio ("larghezza:altezza:x:y"
# in pixel dell'anteprima a 480 px di social/clip/, proporzioni 3:4: qui si riporta alla misura della clip vera),
# secondi ([t1, t2] dei due fotogrammi, nell'ordine dei passi).
set -euo pipefail
D=$1
E=$(jq -c '[.props.slide[]? | select(.tipo == "esercizio")] | .[0] // empty' "$D")
[ -n "$E" ] || exit 0
CLIP=$(jq -r .clip <<< "$E"); DA=$(jq -r .da <<< "$E"); DUR=$(jq -r .durata <<< "$E")
RIT=$(jq -r '.ritaglio // empty | split(":") | map("iw*\(.)/480") | join(":")' <<< "$E"); T1=$(jq -r '.secondi[0]' <<< "$E"); T2=$(jq -r '.secondi[1]' <<< "$E")
if [ -n "${CLIP_LOCALE:-}" ]; then SRC=$CLIP_LOCALE; else
  mkdir -p girato
  gh release download clip-social -R "$MEDIA_REPO" -p "$CLIP.*" -D girato --clobber < /dev/null
  SRC=$(ls -t girato/"$CLIP".* | head -1)
fi
# Video: riquadro 3:4 (420x560 nella slide), reso a 840x1120 al massimo, senza ingrandire oltre la clip
ffmpeg -nostdin -v error -y -ss "$DA" -t "$DUR" -i "$SRC" -an -vf "${RIT:+crop=$RIT,}scale='min(840,iw)':-2" -c:v libx264 -crf 16 -preset fast -pix_fmt yuv420p public/esercizio.mp4
# Fotogrammi: metà riquadro ciascuno (208x560), ritagliati al centro del ritaglio
N=1
for T in "$T1" "$T2"; do
  ffmpeg -nostdin -v error -y -ss "$T" -i "$SRC" -frames:v 1 -vf "${RIT:+crop=$RIT,}crop=ih*208/560:ih" -q:v 2 "public/esercizio-$N.jpg"
  N=$((N + 1))
done
[ -n "${CLIP_LOCALE:-}" ] || rm -f girato/"$CLIP".*
echo "esercizio pronto: $CLIP da $DA s per $DUR s"
