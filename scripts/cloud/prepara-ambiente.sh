#!/usr/bin/env bash
# Prepara il sandbox delle routine Claude in cloud (social e lezioni) con un solo comando, così la routine non
# spende passaggi a sistemarlo ogni volta (24/10/2026). Da lanciare solo quando c'è un lavoro da preparare.
# Scrive /tmp/ambiente.sh: le routine lo richiamano all'inizio di ogni comando con  . /tmp/ambiente.sh && …
#  - Python: numpy, Pillow, librosa in /tmp/py (il Python di sistema ha un PIL rotto e numpy non c'è)
#  - Remotion: Chromium preinstallato che passa dal proxy della sessione (Remotion forza la connessione diretta,
#    che nel sandbox non arriva né al download del browser né ai font Google)
#  - npm ci nel codice, se manca node_modules
# Uso: bash /home/user/video-guide-restyling/scripts/cloud/prepara-ambiente.sh
#
# Anche lanciato in sottofondo (30/10/2026, carosello ca7529c8 bloccato): la routine l'aveva avviato con "&" e caricato
# /tmp/ambiente.sh subito, ancora vuoto (niente browser: Remotion scaricava da remotion.media e falliva); rilanciato,
# vedeva /tmp/py già creato a metà, saltava l'installazione e diceva "numpy/Pillow non installati". Ora:
#  - /tmp/ambiente.sh aspetta da solo che la preparazione sia finita (file /tmp/ambiente-pronto.sh), al massimo 10 minuti;
#  - due lanci insieme non si pestano i piedi (il secondo aspetta il primo);
#  - un'installazione a metà si ripara invece di essere saltata, e se non riesce si vedono le ultime righe del log.
set -uo pipefail
CODICE="$(cd "$(dirname "$0")/../.." && pwd)"
PRONTO=/tmp/ambiente-pronto.sh
LOG=/tmp/prepara-ambiente.log

# Un lancio alla volta (mkdir è atomico; un lucchetto più vecchio di 15 minuti è di un lancio interrotto)
for _ in $(seq 1 450); do
  mkdir /tmp/prepara-ambiente.lock 2>/dev/null && break
  [ -n "$(find /tmp/prepara-ambiente.lock -maxdepth 0 -mmin +15 2>/dev/null)" ] && { rmdir /tmp/prepara-ambiente.lock; continue; }
  sleep 2
done
trap 'rmdir /tmp/prepara-ambiente.lock 2>/dev/null' EXIT
rm -f "$PRONTO"
cat > /tmp/ambiente.sh <<'EOF'
# Scritto da prepara-ambiente.sh: aspetta che la preparazione sia finita (anche se lanciata in sottofondo)
for _ in $(seq 1 600); do [ -f /tmp/ambiente-pronto.sh ] && break; sleep 1; done
if [ -f /tmp/ambiente-pronto.sh ]; then . /tmp/ambiente-pronto.sh; else echo "ATTENZIONE: ambiente non pronto dopo 10 minuti (/tmp/prepara-ambiente.log)" >&2; false; fi
EOF
VARIABILI=$(mktemp)

# Python: si controlla l'import, non la cartella (una cartella creata a metà va riparata)
py_ok() { /tmp/py/bin/python -c "import numpy, PIL" 2>/dev/null; }
installa() {
  uv pip install -q --python /tmp/py/bin/python "$@" >>"$LOG" 2>&1 || /tmp/py/bin/python -m pip install -q "$@" >>"$LOG" 2>&1
}
if ! py_ok; then
  [ -x /tmp/py/bin/python ] || uv venv -q /tmp/py --python "$(command -v python3)" >>"$LOG" 2>&1 || python3 -m venv /tmp/py >>"$LOG" 2>&1
  installa numpy pillow librosa || installa numpy pillow   # librosa serve solo alla musica: non deve fermare il resto
fi
if py_ok; then
  echo 'export PATH=/tmp/py/bin:$PATH' >> "$VARIABILI"
else
  echo "ATTENZIONE: numpy/Pillow non installati. Ultime righe di $LOG:"; tail -5 "$LOG"
fi

# Chromium per Remotion, attraverso il proxy della sessione
CHROME=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell 2>/dev/null | tail -1)
PROXY="${HTTPS_PROXY:-${https_proxy:-}}"
if [ -n "$CHROME" ]; then
  cat > /tmp/chrome-proxy.sh <<EOF
#!/bin/bash
args=()
for a in "\$@"; do case "\$a" in --no-proxy-server|--proxy-server=*|--proxy-bypass-list=*) ;; *) args+=("\$a");; esac; done
exec "$CHROME" ${PROXY:+--proxy-server=$PROXY} "\${args[@]}"
EOF
  chmod +x /tmp/chrome-proxy.sh
  echo "export BROWSER_EXECUTABLE=/tmp/chrome-proxy.sh" >> "$VARIABILI"
else
  echo "ATTENZIONE: Chromium preinstallato non trovato in /opt/pw-browsers"
fi

# Dipendenze del codice: si controlla che ci siano davvero, non la cartella. Il 30/10/2026 un npm ci interrotto
# ("ENOTEMPTY" nella pulizia) aveva lasciato node_modules a metà e il lancio successivo lo saltava: niente @remotion/bundler
npm_ok() { [ -x "$CODICE/node_modules/.bin/remotion" ] && [ -d "$CODICE/node_modules/@remotion/bundler" ]; }
if ! npm_ok; then
  for _ in 1 2; do
    (cd "$CODICE" && npm ci --no-audit --no-fund >>/tmp/npm.log 2>&1) && npm_ok && break
    sleep 5
  done
  npm_ok || { echo "ATTENZIONE: npm ci non riuscito. Ultime righe di /tmp/npm.log:"; tail -5 /tmp/npm.log; }
fi

mv "$VARIABILI" "$PRONTO"   # da qui /tmp/ambiente.sh smette di aspettare
echo "ambiente pronto: . /tmp/ambiente.sh && <comando>"
