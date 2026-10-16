#!/bin/bash
# Uso: scripts/trascrivi.sh <girato.MOV> <cartella_uscita>
# Trascrizione italiana con whisper.cpp: <uscita>/frasi.srt (frasi), <uscita>/parole.txt (una parola per riga: inizio fine testo)
# e <uscita>/parole-tempi.json ([{da, testo}], da importare nel file dati della clip come paroleVoce)
set -euo pipefail
SRC="$1"; OUT="$2"; mkdir -p "$OUT"
M="$HOME/.cache/whisper-models/ggml-large-v3-turbo.bin"
[ -f "$M" ] || curl -sSL -o "$M" https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin
ffmpeg -v error -y -i "$SRC" -ar 16000 -ac 1 "$OUT/audio.wav"
whisper-cli -m "$M" -l it -f "$OUT/audio.wav" -osrt -of "$OUT/frasi" >/dev/null 2>&1
whisper-cli -m "$M" -l it -f "$OUT/audio.wav" -ml 1 -sow -ojf -of "$OUT/parole" >/dev/null 2>&1
python3 -c "
import json,sys
d=json.load(open('$OUT/parole.json'))
for s in d['transcription']:
  t=s['text'].strip()
  if t: print(f\"{s['offsets']['from']/1000:.2f} {s['offsets']['to']/1000:.2f} {t}\")
" > "$OUT/parole.txt"
python3 -c "
import json
d=json.load(open('$OUT/parole.json'))
out=[{'da':round(s['offsets']['from']/1000,2),'testo':s['text'].strip()} for s in d['transcription'] if s['text'].strip()]
json.dump(out,open('$OUT/parole-tempi.json','w'),ensure_ascii=False)
"
echo "ok: $OUT/frasi.srt, $OUT/parole.txt, $OUT/parole-tempi.json"
