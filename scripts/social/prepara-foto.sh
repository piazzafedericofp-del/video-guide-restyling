#!/usr/bin/env bash
# Foto di un carosello in public/ (dalla cartella del codice): fotogramma di un girato delle guide o di una clip
# dell'archivio, immagine in dashboard (r2:), oppure immagine generata con l'IA dalla descrizione della routine (ia).
# Uso: bash scripts/social/prepara-foto.sh <id post> <dati.json> [--senza-ia]
#   --senza-ia (flusso storie.yml): una foto "ia" non ancora confermata ferma tutto invece di generarne una nuova
set -euo pipefail
ID=$1; D=$2; SENZA_IA=${3:-}
mkdir -p girato
N=$(jq '.foto | length' "$D")
for ((i=0; i<N; i++)); do
  FILE=$(jq -r ".foto[$i].file" "$D"); SORG=$(jq -r ".foto[$i].sorgente" "$D")
  CROP=$(jq -r ".foto[$i].crop // empty" "$D"); SEC=$(jq -r ".foto[$i].secondo // 0" "$D")
  case "$SORG" in
    ia)   [ -z "$SENZA_IA" ] || { echo "Foto IA non ancora confermata"; exit 1; }
          python3 -c "import sys; sys.path.insert(0,'scripts/social'); from dashboard import chiama, scarica; chiama('/api/generatore/immagine', 'POST', {'prompt': sys.argv[1], 'chiave': sys.argv[2]}); scarica(sys.argv[2], 'girato/ia')" \
            "$(jq -r ".foto[$i].prompt" "$D")" "post/$ID/copertina-ia-$i.jpg"
          ffmpeg -nostdin -v error -y -i girato/ia -vf "${CROP:+crop=$CROP,}scale=1080:840:force_original_aspect_ratio=increase,crop=1080:840" -q:v 2 "public/$FILE"
          cp "public/$FILE" "$(dirname "$D")/copertina-ia-$i.jpg" ;;
    r2:*) python3 -c "import sys; sys.path.insert(0,'scripts/social'); from dashboard import scarica; scarica(sys.argv[1], 'girato/ia')" "${SORG#r2:}"
          ffmpeg -nostdin -v error -y -i girato/ia -vf "${CROP:+crop=$CROP,}scale=1080:840:force_original_aspect_ratio=increase,crop=1080:840" -q:v 2 "public/$FILE" ;;
    girati:*|clip:*)
          REL=girati; PAT="${SORG#girati:}"; [ "${SORG%%:*}" = clip ] && { REL=clip-social; PAT="${SORG#clip:}.*"; }
          gh release download "$REL" -R "$MEDIA_REPO" -p "$PAT" -D girato --clobber < /dev/null
          SRC=$(ls -t girato/* | head -1)
          ffmpeg -nostdin -v error -y -ss "$SEC" -i "$SRC" -frames:v 1 -vf "${CROP:+crop=$CROP,}scale=1080:840:force_original_aspect_ratio=increase,crop=1080:840,eq=contrast=1.07:saturation=1.1:gamma=0.97,colorbalance=rs=0.03:bs=-0.03:rm=0.02:bm=-0.02,unsharp=5:5:0.4" -q:v 2 "public/$FILE"
          rm -f girato/* ;;
  esac
done
