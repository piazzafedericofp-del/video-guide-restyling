#!/usr/bin/env bash
# Prepara il sandbox delle routine Claude in cloud (social e lezioni) con un solo comando, così la routine non
# spende passaggi a sistemarlo ogni volta (24/10/2026). Da lanciare solo quando c'è un lavoro da preparare.
# Scrive /tmp/ambiente.sh: le routine lo richiamano all'inizio di ogni comando con  . /tmp/ambiente.sh && …
#  - Python: numpy, Pillow, librosa in /tmp/py (il Python di sistema ha un PIL rotto e numpy non c'è)
#  - Remotion: Chromium preinstallato che passa dal proxy della sessione (Remotion forza la connessione diretta,
#    che nel sandbox non arriva né al download del browser né ai font Google)
#  - npm ci nel codice, se manca node_modules
# Uso: bash /home/user/video-guide-restyling/scripts/cloud/prepara-ambiente.sh
set -uo pipefail
CODICE="$(cd "$(dirname "$0")/../.." && pwd)"
ENV=/tmp/ambiente.sh
: > "$ENV"

# Python
if [ ! -x /tmp/py/bin/python ]; then
  uv venv -q /tmp/py --python "$(command -v python3)" >/dev/null 2>&1 || python3 -m venv /tmp/py
  uv pip install -q --python /tmp/py/bin/python numpy pillow librosa >/dev/null 2>&1 \
    || /tmp/py/bin/python -m pip install -q numpy pillow librosa >/dev/null 2>&1
fi
/tmp/py/bin/python -c "import numpy, PIL" 2>/dev/null && echo 'export PATH=/tmp/py/bin:$PATH' >> "$ENV" \
  || echo "ATTENZIONE: numpy/Pillow non installati"

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
  echo "export BROWSER_EXECUTABLE=/tmp/chrome-proxy.sh" >> "$ENV"
else
  echo "ATTENZIONE: Chromium preinstallato non trovato in /opt/pw-browsers"
fi

# Dipendenze del codice
if [ ! -d "$CODICE/node_modules" ]; then
  (cd "$CODICE" && npm ci --no-audit --no-fund >/tmp/npm.log 2>&1) || echo "ATTENZIONE: npm ci non riuscito (/tmp/npm.log)"
fi

echo "ambiente pronto: . $ENV && <comando>"
