#!/bin/bash
# Uso: scripts/colonna.sh <nome> <musica.mp3> <durata_totale_s> <inizio_finale_s> "<a1:b1> <a2:b2> ..." [uscita.wav]
# Monta la voce (<nome>-voce.wav) sui tratti indicati (secondi del file voce, cioè girato - inizioFile),
# aggiunge la musica a -22 LUFS (ripetuta se la lezione è più lunga del brano) abbassata sotto la voce (gap ~12 LU) e che risale sulla scheda finale.
set -euo pipefail
NOME="$1"; MUS="$2"; TOT="$3"; FIN="$4"; TRATTI=($5)
P="$(cd "$(dirname "$0")/.." && pwd)/public"
USCITA="${6:-$P/$NOME-colonna.wav}"
F=""; L=""; i=0
for tr in "${TRATTI[@]}"; do
  F+="[0:a]atrim=${tr%%:*}:${tr##*:},asetpts=PTS-STARTPTS,afade=t=in:d=0.04[v$i];"; L+="[v$i]"; i=$((i+1))
done
ffmpeg -v error -y -i "$P/$NOME-voce.wav" -stream_loop -1 -i "$MUS" -filter_complex "
$F${L}concat=n=$i:v=0:a=1,apad=whole_dur=$TOT,aformat=sample_rates=48000:channel_layouts=stereo,asplit[voce][chiave];
[1:a]atrim=0:$TOT,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-22:TP=-3:LRA=7,volume='1+0.7*min(max((t-($FIN-0.5))/0.8,0),1)':eval=frame,afade=t=in:d=1.5,afade=t=out:st=$(python3 -c "print($TOT-2.8)"):d=2.8[mus];
[mus][chiave]sidechaincompress=threshold=0.015:ratio=8:attack=40:release=600:makeup=1[duck];
[voce][duck]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89[out]" -map "[out]" -t "$TOT" -ar 48000 "$USCITA"
echo "ok: $USCITA"
