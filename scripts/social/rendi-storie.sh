#!/usr/bin/env bash
# Storie di un post (skill storie-social): 3 varianti × Instagram e Facebook, zero token, solo materiale già approvato.
# Uso (dalla cartella del codice, dopo il render del post): bash scripts/social/rendi-storie.sh <reel|carosello> <uscite> [dati.json]
#   carosello: public/dati.json e le foto in public/ già pronte (render del post appena fatto); <uscite>/c45/slide-NN.jpg
#   reel:      <uscite>/video.mp4 e <uscite>/copertina.jpg; dati.json facoltativo (props.perche.a = fine del pezzo nel riquadro)
# Uscita: <uscite>/storie/{ig,fb}-{1,2,3}.{jpg,mp4} (+ slide.jpg per il carosello), solo se tutto è riuscito.
set -euo pipefail
FORMATO=$1; USCITE=$2; DATI=${3:-}
TMP=$(mktemp -d)
CONTROLLO="$(dirname "$0")/controlla-storia.py"

if [ "$FORMATO" = carosello ]; then
  npx remotion still src/social/index.ts CaroselloStoria "$TMP/slide.jpg" --image-format=jpeg --jpeg-quality=92 --log=error
  cp "$TMP/slide.jpg" public/storia-slide.jpg
  N=$(ls "$USCITE"/c45/slide-*.jpg | wc -l | tr -d ' ')
  BASE="{\"formato\":\"carosello\",\"immagine\":\"storia-slide.jpg\",\"slide\":$N"
else
  cp "$USCITE/video.mp4" public/storia-video.mp4
  cp "$USCITE/copertina.jpg" public/storia-copertina.jpg
  # Fine del pezzo del Reel nel riquadro: fine del perché; senza file dati fine del gancio + 3 s; altrimenti 5,5 s
  FINE=5.5
  if [ -n "$DATI" ] && [ -f "$DATI" ]; then
    FINE=$(jq -r '(.props.perche.a // ((.props.gancio.a // empty) + 3) // 5.5) | if . > 1 and . < 7 then . else 5.5 end' "$DATI")
  fi
  BASE="{\"formato\":\"reel\",\"immagine\":\"storia-copertina.jpg\",\"video\":\"storia-video.mp4\",\"fineVideo\":$FINE"
fi

for SOCIAL in instagram facebook; do
  S=ig; [ "$SOCIAL" = facebook ] && S=fb
  for V in 1 2 3; do
    for SCURO in 0.65 0.8 0.9; do
      PROPS="$BASE,\"social\":\"$SOCIAL\",\"variante\":$V,\"scuro\":$SCURO}"
      if [ "$FORMATO" = carosello ]; then
        OUT="$TMP/$S-$V.jpg"
        npx remotion still src/social/index.ts Storia "$OUT" --props="$PROPS" --image-format=jpeg --jpeg-quality=92 --log=error
        PROVA="$OUT"
      else
        OUT="$TMP/$S-$V.mp4"
        npx remotion render src/social/index.ts StoriaVideo "$OUT" --props="$PROPS" --codec=h264 --crf=20 --log=error
        PROVA="$TMP/prova.png"
        ffmpeg -nostdin -v error -y -ss 7 -i "$OUT" -frames:v 1 "$PROVA"
      fi
      # Contrasto della frase piccola: conta solo per la variante 2 (sfondo = il post sfocato); se non basta si scurisce
      [ "$V" != 2 ] && break
      python3 "$CONTROLLO" contrasto "$PROVA" "$FORMATO" && break
      [ "$SCURO" = 0.9 ] && { echo "Storia: contrasto insufficiente anche con lo sfondo scurito"; exit 1; }
    done
    [ "$FORMATO" = reel ] && python3 "$CONTROLLO" video "$OUT"
  done
done
rm -f "$TMP/prova.png"
mkdir -p "$USCITE/storie"
mv "$TMP"/* "$USCITE/storie/"
echo "Storie: $(ls "$USCITE/storie" | tr '\n' ' ')"
