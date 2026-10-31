# video-guide-restyling

Codice di montaggio (Remotion) delle lezioni delle video guide di federicopiazza.com.
Contiene solo il codice: girati, trascrizioni, testi delle lezioni e musica stanno in archivi privati
e vengono scaricati solo durante il render (`.github/workflows/render.yml`).

Licenza: tutti i diritti riservati. Il font Inter è distribuito con licenza SIL Open Font License.

## Flussi (GitHub Actions, gratis: repo pubblico)

- `sveglia.yml` + `scripts/sveglia.py`: decide se c'è lavoro. La avviano (dal 24/10/2026, a eventi) la dashboard social
  dopo le azioni di Federico e 3 volte al giorno, la fine di ogni render e `attesa.yml`; il suo timer (ogni ora) è solo
  una riserva, perché il timer di GitHub salta giri per ore. Quando c'è, sveglia le routine Claude con una
  release `turno-social-*` (pre-release) o `turno-lezione-*` nel progetto privato, e avvia i render quando ci sono dati pronti.
  Rimette in coda gli stati fermi. Nei log compaiono solo id e conteggi.
- `render.yml` (lezioni) e `social.yml` (Reel e caroselli): li avvia la Sveglia, senza timer propri. Un render annullato
  torna in coda. Un guasto tecnico si riprova una volta e poi si ferma.
- `attesa.yml`: lo avvia la Sveglia quando sveglia una routine; aspetta che la routine cominci e finisca (controllo ogni
  2 minuti, al massimo 30 + 90 minuti), poi rilancia la Sveglia per il render e il lavoro successivo.
- `richiamo.yml` (31/10/2026): lo avvia la Sveglia quando una pausa ferma un lavoro pronto (30 minuti dopo un render
  fallito, 20 minuti tra due segnali alla stessa routine); aspetta la fine della pausa e la riavvia. Uno solo alla volta.
- Lezioni con più riprese: `render.yml` prende solo il pezzo usato di ogni ripresa e `prepara-girato.sh` lo taglia, lo
  porta a 4K 30 fps e corregge il colore in un passaggio (`girato/riprese.txt`). Copertine IA dei caroselli: `social.yml`,
  sorgente `ia`, generate dalla dashboard con Workers AI.
- `revisione.yml`, `azioni.yml`: spenti dal 24/10/2026.
- `scripts/cloud/prepara-ambiente.sh`: prepara il sandbox delle routine (Python, Chromium col proxy).
