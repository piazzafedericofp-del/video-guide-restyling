# video-guide-restyling

Codice di montaggio (Remotion) delle lezioni delle video guide di federicopiazza.com.
Contiene solo il codice: girati, trascrizioni, testi delle lezioni e musica stanno in archivi privati
e vengono scaricati solo durante il render (`.github/workflows/render.yml`).

Licenza: tutti i diritti riservati. Il font Inter è distribuito con licenza SIL Open Font License.

## Flussi (GitHub Actions, gratis: repo pubblico)

- `sveglia.yml` + `scripts/sveglia.py` (ogni 10 minuti): decide se c'è lavoro. Quando c'è, sveglia le routine Claude con una
  release `turno-social-*` (pre-release) o `turno-lezione-*` nel progetto privato, e avvia i render quando ci sono dati pronti.
  Rimette in coda gli stati fermi. Nei log compaiono solo id e conteggi.
- `render.yml` (lezioni) e `social.yml` (Reel e caroselli): li avvia la Sveglia, senza timer propri. Un render annullato
  torna in coda. Un guasto tecnico si riprova una volta e poi si ferma.
- `revisione.yml`, `azioni.yml`: spenti dal 24/10/2026.
- `scripts/cloud/prepara-ambiente.sh`: prepara il sandbox delle routine (Python, Chromium col proxy).
