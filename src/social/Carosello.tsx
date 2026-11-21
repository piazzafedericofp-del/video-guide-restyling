import { loadFont } from "@remotion/fonts";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Img, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

loadFont({ family: "Inter", url: staticFile("Inter.woff2"), weight: "100 900" });

// Carosello 1080x1350 (4:5): ogni fotogramma della composizione è una slide.
// Tre stili da confrontare (prova del 17/10/2026), colori dai token del sito.
const NAVY_800 = "#0B2447";
const NAVY_900 = "#081A33";
const BRAND_700 = "#0B6BD3";
const SAND_50 = "#F7F3EC";
const SLATE_600 = "#475569";
const SLATE_500 = "#5B6472";
const AMBER_400 = "#FBBF24";
const AMBER_100 = "#FEF3C7";

export type Stile = "sito" | "navy" | "foto";

// Illustrazioni che spiegano il testo (Houts 2006: figure legate al testo aumentano attenzione e ricordo;
// le decorative no). Approvate da Federico il 23/10/2026.
export type NomeIcona = "letto" | "cammina" | "posizione" | "casa" | "pillola" | "clessidra" | "pesi" | "telefono" | "referto" | "risonanza";
export type PartePratica = { titolo: string; voci: string[]; disegni: string[] };
export type Illustrazione =
  | { tipo: "pittogramma"; su: number; totale: number }
  // effetto (05/11/2026, Federico, variante A su 3): cosa migliora con il trattamento, una freccia giù per voce
  // («arriva meno spesso», «fa meno male»); al posto di «tempi» quando il tempo conta meno del risultato
  // frecce (06/11/2026, anca): "su" per ciò che migliora salendo («si muove meglio»); senza, tutte giù
  | { tipo: "effetto"; titolo: string; voci: string[]; frecce?: ("giu" | "su")[] }
  | { tipo: "confronto"; a: { icona: NomeIcona; testo: string; esito?: string }; b: { icona: NomeIcona; testo: string; esito: string } }
  // Risultato che cambia nel tempo (fascite 23/10: "meglio prima, non di più" non si capiva con il confronto):
  // una scheda per controllo, i due gruppi in ogni scheda, evidenziato quello che sta meglio (nessuno se pari).
  | { tipo: "tempi"; a: string; b: string; tappe: { quando: string; esito: string; meglio?: "a" | "b" }[] }
  // Proporzioni a confronto (es. per età): barre su 100, il valore detto a parole accanto
  // scala (04/11/2026, Federico: «non si capisce subito che il numero è riferito alla scala di dolore»): per un punteggio
  // (dolore da 0 a 100) titolo sopra le barre e righello sotto, con gli estremi detti a parole; mai «52 su 100»
  | { tipo: "barre"; righe: { etichetta: string; valore: number; testo: string; evidenza?: boolean }[]; scala?: { titolo?: string; da?: string; a?: string } };

// Icone a tratto in stile Lucide (viewBox 24), disegnate qui per non aggiungere dipendenze.
const TRATTI: Record<NomeIcona, React.ReactNode> = {
  letto: (<><path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" /></>),
  cammina: (<><circle cx="13.5" cy="3.5" r="2.2" /><path d="M12.8 7.5 11 14.5" /><path d="M11 14.5 7 22" /><path d="M11 14.5l3.5 3.5.5 4" /><path d="M12.4 9 8 12.5" /><path d="M12.4 9l3.3 3h2.8" /></>),
  posizione: (<><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></>),
  casa: (<><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>),
  pillola: (<><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></>),
  clessidra: (<><path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></>),
  pesi: (<><path d="M6 6v12" /><path d="M18 6v12" /><path d="M3 9v6" /><path d="M21 9v6" /><path d="M6 12h12" /></>),
  telefono: (<><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>),
  // il foglio del referto e la macchina della risonanza (anello con il lettino), 28/10/2026
  referto: (<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M8 13h8" /><path d="M8 17h5" /></>),
  risonanza: (<><circle cx="12" cy="10.5" r="8.5" /><circle cx="12" cy="10.5" r="3.6" /><path d="M1.5 14.5h21" /><path d="M5 14.5V21" /><path d="M19 14.5V21" /></>),
};

const Icona: React.FC<{ nome: NomeIcona; lato: number; colore: string }> = ({ nome, lato, colore }) => (
  <svg width={lato} height={lato} viewBox="0 0 24 24" fill="none" stroke={colore} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {TRATTI[nome]}
  </svg>
);

// Omino pieno per i pittogrammi "1 su 100".
const Omino: React.FC<{ lato: number; colore: string }> = ({ lato, colore }) => (
  <svg width={lato} height={lato} viewBox="0 0 24 24" fill={colore}>
    <circle cx="12" cy="6" r="4.2" />
    <path d="M4 23v-2.5a6.5 6.5 0 0 1 6.5-6.5h3a6.5 6.5 0 0 1 6.5 6.5V23z" />
  </svg>
);

// Numero con chi e cosa (04/11/2026, Federico: «il dato manca di soggetto, non si capisce a chi ci stiamo riferendo,
// deve essere intuibile subito a colpo d'occhio»; scelta la variante B su 3 render affiancati). Prima chi sono le
// persone, poi gli omini (li passa chi chiama), poi la legenda: omino colorato, numero, che cosa è successo; la riga
// grigia ("altri") solo se aiuta il messaggio. Il numero si legge accanto al suo significato, senza cercarlo nella frase.
export const OMINO_GRIGIO = "#C5CEDA";
export const NumeroLegenda: React.FC<{
  chi: string; cosa: string; altri?: string; su: number; totale: number;
  colore: string; testo: string; debole: string; children: React.ReactNode;
}> = ({ chi, cosa, altri, su, totale, colore, testo, debole, children }) => (
  <>
    <div style={{ textWrap: "pretty", color: testo, fontSize: 60, fontWeight: 800, lineHeight: 1.14, marginBottom: 30, whiteSpace: "pre-line" }}>{lega(chi)}</div>
    {children}
    <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 6 }}>
      {/* una riga = una frase: omino (centrato in una colonna fissa), numero e testo di seguito (05/11/2026: «allinea meglio 1…») */}
      {([[colore, su, cosa, true], [OMINO_GRIGIO, totale - su, altri, false]] as const).filter((r) => r[2]).map(([col, num, txt, primo]) => (
        <div key={String(primo)} style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 60, display: "flex", justifyContent: "center", flex: "none" }}><Omino lato={primo ? 60 : 48} colore={col} /></div>
          <span style={{ color: primo ? colore : debole, fontSize: primo ? 96 : 64, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1, flex: "none" }}>{num}</span>
          <span style={{ textWrap: "pretty", color: primo ? testo : debole, fontSize: primo ? 46 : 40, fontWeight: primo ? 800 : 650, lineHeight: 1.15 }}>{lega(String(txt))}</span>
        </div>
      ))}
    </div>
  </>
);

export type Slide =
  | { tipo: "copertina"; occhiello: string; titolo: string; evidenza: string; sotto: string; foto?: string; fotoIA?: boolean }
  // segni, figura, ponte (05/11/2026, Federico, variante Y): la risposta in una riga, i segni in un riquadro con la
  // figura accanto (nuca accesa da un lato), e una riga che porta alla slide degli studi; senza la foto della copertina
  | { tipo: "testo"; titolo: string; corpo: string; referto?: { intestazione: string; riga: string; evidenza: string }; segni?: { titolo: string; voci: string[] }; figura?: "nuca" | "gomito" | "tallone"; ponte?: string; scena?: string; conFoto?: boolean }
  // chi, cosa, altri (04/11/2026, variante B scelta da Federico): con un pittogramma, il numero non sta più da solo in
  // alto ma nella legenda accanto all'omino colorato, sotto "chi" (le persone); la frase allora non serve.
  | { tipo: "dato"; etichetta: string; numero?: string; frase?: string; chi?: string; cosa?: string; altri?: string; nota?: string; fonte: string; illustrazione?: Illustrazione }
  | { tipo: "lista"; titolo: string; segno: "si" | "no" | "attenzione"; voci: string[]; nota?: string; icone?: NomeIcona[]; scuro?: boolean }
  // esercizio (11/11/2026, Federico: «dare un esercizio… qualcosa di concreto in mano»): nei «Cosa dicono gli studi» un solo
  // esercizio mostrato da Federico, solo se esiste un suo girato (clip dell'archivio). Video su Instagram (esercizio.mp4),
  // due fotogrammi affiancati altrove (esercizio-1.jpg, esercizio-2.jpg, con le `scritte` sotto), i passi numerati accanto.
  // I file li prepara scripts/social/prepara-esercizio.sh da clip, da, durata, ritaglio e secondi.
  // Senza girato (11/11/2026 sera, Federico: «ok il disegno… scrivi 10 ripetizioni per 3 serie»): l'esercizio dello studio del
  // carosello, con un disegno a mano in due tempi in alto e largo (`disegno` = nome nel catalogo video-guide-media/social/disegni/
  // disegni.json, sezione «esercizi»; `disegni.py metti` copia i due SVG 447x300 in `disegnoSvg`), i passi sotto, la `fonte`
  // dello studio in fondo; slide ferma ovunque (niente video).
  | { tipo: "esercizio"; titolo: string; passi: string[]; scritte?: [string, string]; clip?: string; da?: number; durata?: number; ritaglio?: string; secondi?: [number, number]; frecce?: [number, number, number, number][]; disegno?: string; disegnoSvg?: [string, string]; fonte?: string }
  // pratica (08/11/2026, Federico: «Cosa fare» e «Cosa evitare» in una slide sola, stile F3 scelto su 7 prove): due colonne
  // «✓ Sì» e «✕ No», 2 voci per parte, un disegno per voce. Le tessere del Sì sono blu piene (come la barra che vince nella
  // slide dei dati e il pulsante della chiusura), quelle del No bianche col bordo grigio. I disegni li sceglie la routine dal
  // catalogo (video-guide-media/social/disegni) e scripts/carosello-social/disegni.py ne copia i tratti in `tratti`.
  | { tipo: "pratica"; titolo: string; si: PartePratica; no: PartePratica; nota?: string; tratti?: Record<string, { viewBox?: string; tratti: string }> }
  // guida (28/10/2026): i caroselli che portano a una video guida mostrano un solo movimento della guida (video su
  // Instagram, fotogramma fermo altrove) con il nome della guida come titolo; lo studio scende nella firma.
  // evidenza (29/10/2026): le parole del problema nel titolo, su fondo ambra come in copertina. Dal 29/10 lo stile
  // foto non mostra più inBreve (Federico: la risposta è già nella slide 2), resta solo per gli stili di prova.
  | { tipo: "chiusura"; titolo: string; corpo: string; pulsante: string; studio?: string; invito: string; inBreve?: string; evidenza?: string;
      guida?: { nome: string; contenuto: string; video: string; fermo: string } };

// avanzamento: "numeri" (n/8 in basso) o "barra" (barra sottile in alto).
// controllo: scrive nella console di render misure, colori e posizione di ogni testo
// (le legge scripts/controlla-carosello.py).
// verticale: versione 9:16 per TikTok (1080x1920). La slide 4:5 è ridotta a 0,9 e messa nella zona
// che l'interfaccia di TikTok lascia libera (testi tra x 90–900 e y 250–1420, come nei Reel).
// firma: piccola firma (ritratto intero in tessera + nome e titolo) in basso nelle slide interne, al posto di
// @fisioconfede. Approvata da Federico il 23/10/2026: il titolo "Dr. … osteopata e fisioterapista" pesa più della foto.
// storia (29/10/2026): slide 1 per la storia di Instagram e Facebook (skill storie-social), senza barra e senza
// "Scorri →": nella storia la barra si confonde con quella dell'app e non c'è niente da scorrere.
// animato + indice (28/10/2026): una sola slide a 30 fps, gli elementi entrano col tempo (MP4 per Instagram);
// senza, ogni fotogramma è una slide già al suo stato finale (JPEG per tutti i social).
export type CaroselloProps = { stile: Stile; slide: Slide[]; avanzamento?: "numeri" | "barra" | "tacche"; controllo?: boolean; verticale?: boolean; firma?: boolean; animato?: boolean; indice?: number; storia?: boolean };

// A capo (03/11/2026, ripasso dei caroselli: in 5 slide su 8 le righe finivano con «il», «di», «con», «o»): una riga
// non finisce con un articolo, una preposizione, «e», «o», «non», «che» (si legano alla parola dopo con uno spazio
// non separabile) e "2 su 3" non si spezza. Titolo ed evidenza delle slide con l'evidenza restano come sono: hanno
// gli a capo scritti a mano e l'evidenza va ritrovata uguale nel titolo.
const PAROLE_CORTE = new RegExp(
  "(?<=^|[\\s(«\"])(il|lo|la|i|gli|le|un|uno|una|di|a|da|in|con|su|per|tra|fra|del|dello|della|dei|degli|delle|al|allo|alla|ai|agli|alle|dal|dallo|dalla|dai|dagli|dalle|nel|nello|nella|nei|negli|nelle|sul|sullo|sulla|sui|sugli|sulle|col|coi|e|ed|o|non|che|se|ma) (?=\\S)",
  "gi",
);
// e un numero resta con la sua unità ("6 mesi", "14 giorni", "2 su 3"; fascite 03/11/2026: «A 6 / mesi»)
const UNITA = /(\d) (?=(su|mesi|mese|giorni|giorno|settimane|settimana|anni|anno|ore|ora|minuti|secondi|volte|persone|persona|studi|serie|ripetizioni)([\s\u00a0.,;:!?)]|$))/g;
// e le ultime due parole di un testo di 3 o più parole restano insieme (17/11/2026, punti tecnici della proposta di
// riordino): una parola sola sull'ultima riga faceva fallire il render («…di ogni | giorno», 07ec5963) e text-wrap: pretty
// non la evita sempre. testo-unico.py fa la stessa cosa nella previsione.
const ULTIME_DUE = /(\S) (\S+)\s*$/;
const vedova = (t: string) => (t.trim().split(/\s+/).length >= 3 ? t.split("\n").map((r) => (r.trim().split(/\s+/).length >= 3 ? r.replace(ULTIME_DUE, "$1\u00a0$2") : r)).join("\n") : t);
export const lega = (t: string) => vedova(t.replace(PAROLE_CORTE, "$1\u00a0").replace(UNITA, "$1\u00a0"));
const legaSlide = (s: Slide): Slide => {
  const x = { ...s } as Record<string, unknown>;
  const campi = ["sotto", "frase", "corpo", "nota", "invito", "chi", "cosa", "altri", ...("evidenza" in x && x.evidenza ? [] : ["titolo"])];
  for (const c of campi) if (typeof x[c] === "string") x[c] = lega(x[c] as string);
  for (const parte of ["si", "no"]) {
    const p = x[parte] as PartePratica | undefined;
    if (s.tipo === "pratica" && p) x[parte] = { ...p, titolo: p.titolo, voci: p.voci.map((v) => lega(v)) };
  }
  if (Array.isArray(x.voci)) x.voci = x.voci.map((v) => (typeof v === "string" ? lega(v) : v && typeof v === "object" && "testo" in v ? { ...v, testo: lega(String((v as { testo: string }).testo)) } : v));
  // Dal 17/11/2026 (Federico, punti tecnici della proposta di riordino): legate anche le voci e la frase del riquadro
  // `effetto`, i passi della slide «esercizio» e le voci dei segni. Prima una voce dell'effetto poteva andare a capo dopo
  // «di» («le cose di | ogni giorno», 07ec5963): controlla-carosello.py la fermava e il render falliva.
  if (Array.isArray(x.passi)) x.passi = (x.passi as unknown[]).map((v) => (typeof v === "string" ? lega(v) : v));
  const sg = x.segni as { titolo?: string; voci?: unknown[] } | undefined;
  if (sg && Array.isArray(sg.voci)) x.segni = { ...sg, voci: sg.voci.map((v) => (typeof v === "string" ? lega(v) : v)) };
  const il = x.illustrazione as { tipo?: string; titolo?: string; voci?: unknown[] } | undefined;
  if (il && il.tipo === "effetto") x.illustrazione = { ...il, titolo: typeof il.titolo === "string" ? lega(il.titolo) : il.titolo, voci: Array.isArray(il.voci) ? il.voci.map((v) => (typeof v === "string" ? lega(v) : v)) : il.voci };
  return x as Slide;
};

// Slide che su Instagram escono animate: barre, pochi omini, chiusura con la guida. Durata in secondi.
export const durataAnimata = (s: Slide) =>
  s.tipo === "chiusura" && s.guida ? 9
  : s.tipo === "dato" && (s.illustrazione?.tipo === "barre" || (s.illustrazione?.tipo === "pittogramma" && s.illustrazione.totale <= 10)) ? 6
  : s.tipo === "esercizio" && s.clip ? Math.max(3, Math.min(12, s.durata ?? 6))
  : 0;

const Tempo = createContext(false);
// Tempo dell'animazione: nel render statico ogni elemento è già arrivato
const useTempo = () => {
  const animato = useContext(Tempo);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return { f: animato ? frame : 100000, fps, animato };
};
const entra = (f: number, fps: number, da: number) => spring({ frame: f - da * fps, fps, config: { damping: 200 }, durationInFrames: Math.round(0.7 * fps) });

const SCALA_VERTICALE = 0.9;

const Avanzamento = createContext<{ barra: boolean; scuro: boolean; firma: boolean; storia?: boolean; tacche?: boolean }>({ barra: false, scuro: false, firma: false });

// Ritratto intero (ritratto.png ha lo sfondo bianco): in una tessera bianca, si vede su bianco e su sabbia.
// Federico 23/10: il solo viso nel cerchio "è brutto", vuole la figura intera.
const MiniRitratto: React.FC = () => (
  <div data-ostacolo style={{ width: 118, height: 152, borderRadius: 14, overflow: "hidden", background: "white", border: "2px solid #E2E8F0", flex: "0 0 auto" }}>
    <Img src={staticFile("ritratto.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 100%" }} />
  </div>
);

const Firma: React.FC<{ coloreNome: string; colore: string }> = ({ coloreNome, colore }) => (
  <div style={{ position: "absolute", left: 90, right: 90, bottom: 52, display: "flex", alignItems: "center", gap: 24 }}>
    <MiniRitratto />
    <div>
      <div style={{ color: coloreNome, fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}>Dr. Federico Piazza</div>
      <div style={{ color: colore, fontSize: 28, fontWeight: 600, lineHeight: 1.3 }}>Osteopata e fisioterapista · @fisioconfede</div>
    </div>
  </div>
);

// Barra di avanzamento sottile in alto, senza numeri (scelta di Federico 17/10 sul confronto numeri/barra).
// suFoto: binario scuro trasparente, perché sul muro chiaro della foto quello bianco sparisce.
// tacche (19/11/2026, Federico: «quando arrivo alla slide dell'esercizio la barra in alto perde la continuità delle altre e
// diventa tutta lunga»): nei «Come funziona» le slide che disegna questo componente (esercizio, copertina con la foto,
// chiusura verso lo studio) usano le stesse tacche di ComeFunziona.tsx, una per slide.
const Barra: React.FC<{ n: number; tot: number; scuro: boolean; suFoto?: boolean }> = ({ n, tot, scuro, suFoto }) => {
  const av = useContext(Avanzamento);
  if (av.tacche)
    return (
      <div style={{ position: "absolute", left: 90, right: 90, top: 46, display: "flex", gap: 8 }}>
        {Array.from({ length: tot }, (_, i) => <div key={i} style={{ flex: 1, height: 10, borderRadius: 5, background: i < n ? (scuro ? AMBER_400 : BRAND_700) : scuro ? "rgba(255,255,255,0.3)" : suFoto ? "rgba(11,36,71,0.45)" : "#E2E8F0" }} />)}
      </div>
    );
  return (
    <div style={{ position: "absolute", left: 90, right: 90, top: 48, height: 8, borderRadius: 4, background: suFoto ? "rgba(11,36,71,0.45)" : scuro ? "rgba(255,255,255,0.3)" : "rgba(11,36,71,0.12)" }}>
      <div style={{ width: `${(n / tot) * 100}%`, height: "100%", borderRadius: 4, background: scuro ? AMBER_400 : BRAND_700 }} />
    </div>
  );
};

// Ritratti della firma: nessun testo deve finirci sopra (fascite 23/10: la fonte toccava la tessera).
const misuraOstacoli = () =>
  Array.from(document.querySelectorAll("[data-ostacolo]")).map((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });

// Raccoglie ogni testo visibile: dimensione, peso, colore e riquadro reale delle lettere.
// Righe vere di un testo, come le vede chi legge (07/11/2026, Federico: «un a capo brutto»): le parole raggruppate
// per altezza; controlla-carosello.py ferma le righe che finiscono con un articolo o una preposizione, l'ultima riga
// di una parola sola e la riga spezzata (molto più corta delle altre) in un testo di 3 righe o più.
const righeDi = (nodo: Node): string[] => {
  const t = nodo.textContent ?? "";
  const out: { top: number; testo: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const r = document.createRange();
    r.setStart(nodo, m.index);
    r.setEnd(nodo, m.index + m[0].length);
    const rects = r.getClientRects();
    if (!rects.length) continue;
    const top = Math.round(rects[0].top);
    const ultima = out[out.length - 1];
    if (ultima && Math.abs(ultima.top - top) < 4) ultima.testo += " " + m[0];
    else out.push({ top, testo: m[0] });
  }
  return out.map((o) => o.testo);
};

const misuraTesti = () => {
  const voci: { testo: string; px: number; peso: number; colore: string; x: number; y: number; w: number; h: number; blocco: number; righe: string[] }[] = [];
  // blocco: il primo antenato non in linea; testi dello stesso blocco (righe di un titolo, "Fonte:" + nome)
  // non contano come sovrapposti nel controllo.
  const blocchi = new Map<Element, number>();
  const giro = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let nodo = giro.nextNode();
  while (nodo) {
    const testo = (nodo.textContent ?? "").trim();
    const el = nodo.parentElement;
    if (testo && el) {
      const st = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(nodo);
      const r = range.getBoundingClientRect();
      if (r.width > 0) {
        let b: Element = el;
        while (b.parentElement && getComputedStyle(b).display === "inline") b = b.parentElement;
        if (!blocchi.has(b)) blocchi.set(b, blocchi.size);
        voci.push({ testo: testo.slice(0, 40), px: parseFloat(st.fontSize), peso: parseInt(st.fontWeight, 10), colore: st.color, x: r.left, y: r.top, w: r.width, h: r.height, blocco: blocchi.get(b)!, righe: righeDi(nodo) });
      }
    }
    nodo = giro.nextNode();
  }
  return voci;
};

const tema = (stile: Stile, alterna: boolean) => {
  if (stile === "navy") {
    return { sfondo: alterna ? NAVY_900 : NAVY_800, titolo: "white", corpo: "#CBD5E1", accento: AMBER_400, debole: "#94A3B8", card: "rgba(255,255,255,0.07)" };
  }
  return { sfondo: alterna ? SAND_50 : "white", titolo: NAVY_800, corpo: SLATE_600, accento: BRAND_700, debole: SLATE_500, card: alterna ? "white" : SAND_50 };
};

// Spezza il titolo e colora la parte "evidenza".
const ConEvidenza: React.FC<{ testo: string; evidenza: string; colore: string; sfondo?: string }> = ({ testo, evidenza, colore, sfondo }) => {
  const i = testo.indexOf(evidenza);
  if (i < 0) return <>{testo}</>;
  return (
    <>
      {testo.slice(0, i)}
      <span style={{ color: colore, background: sfondo, padding: sfondo ? "0 8px" : undefined, borderRadius: 6 }}>{evidenza}</span>
      {testo.slice(i + evidenza.length)}
    </>
  );
};

const Cornice: React.FC<{ n: number; tot: number; colore: string; scuro?: boolean; suFoto?: boolean; children: React.ReactNode }> = ({ n, tot, colore, scuro, suFoto, children }) => {
  const av = useContext(Avanzamento);
  return (
    <>
      {children}
      {av.barra && !av.storia ? <Barra n={n} tot={tot} scuro={scuro ?? av.scuro} suFoto={suFoto} /> : null}
      {av.firma && n > 1 ? (
        <Firma coloreNome={(scuro ?? av.scuro) ? "white" : NAVY_800} colore={colore} />
      ) : (
        <div style={{ position: "absolute", left: 90, bottom: 64, fontSize: 28, fontWeight: 600, color: colore }}>@fisioconfede</div>
      )}
      {n < tot && !av.barra && !av.storia ? (
        <div style={{ position: "absolute", right: 90, bottom: 64, fontSize: 28, fontWeight: 600, color: colore }}>
          {n}/{tot}
        </div>
      ) : null}
    </>
  );
};

const BarraSeServe: React.FC<{ n: number; tot: number }> = ({ n, tot }) => {
  const av = useContext(Avanzamento);
  return av.barra ? <Barra n={n} tot={tot} scuro={av.scuro} /> : null;
};

// Chiusura (29/10/2026): freccia disegnata nel pulsante, titolo con le parole del problema su fondo ambra
// e titolo più piccolo se una riga è lunga (le righe si spezzano con "\n" nei dati)
// Freccia blu del movimento sopra una foto (11/11/2026): blu del sito con un bordo bianco, perché si legga su ogni sfondo
const FrecciaFoto: React.FC<{ f: [number, number, number, number]; w: number; h: number }> = ({ f, w, h }) => {
  const [x1, y1, x2, y2] = [f[0] * w / 100, f[1] * h / 100, f[2] * w / 100, f[3] * h / 100];
  const a = Math.atan2(y2 - y1, x2 - x1), L = 26, A = 0.55;
  const punta = `${x2},${y2} ${x2 - L * Math.cos(a - A)},${y2 - L * Math.sin(a - A)} ${x2 - L * Math.cos(a + A)},${y2 - L * Math.sin(a + A)}`;
  const fine = [x2 - 16 * Math.cos(a), y2 - 16 * Math.sin(a)];
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
      <line x1={x1} y1={y1} x2={fine[0]} y2={fine[1]} stroke="white" strokeWidth={15} strokeLinecap="round" />
      <polygon points={punta} fill={BRAND_700} stroke="white" strokeWidth={6} strokeLinejoin="round" paintOrder="stroke" />
      <line x1={x1} y1={y1} x2={fine[0]} y2={fine[1]} stroke={BRAND_700} strokeWidth={8} strokeLinecap="round" />
    </svg>
  );
};
const Freccia: React.FC<{ lato: number }> = ({ lato }) => (
  <svg width={lato} height={lato} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
);
const TitoloEvidenziato: React.FC<{ testo: string; evidenza?: string }> = ({ testo, evidenza }) =>
  evidenza ? <ConEvidenza testo={testo} evidenza={evidenza} colore={NAVY_800} sfondo={AMBER_400} /> : <>{testo}</>;
const rigaPiuLunga = (testo: string) => Math.max(...testo.split("\n").map((r) => r.length));

// Copertina "pulita" (29/10/2026, Federico): le righe del problema su un blocco ambra, come l'evidenza della chiusura.
// Il blocco sporge di 14 px a sinistra, così il testo resta allineato al margine con le altre righe. Se l'evidenza
// non occupa righe intere del titolo, evidenziatore dentro la riga.
const TitoloCopertina: React.FC<{ testo: string; evidenza: string }> = ({ testo, evidenza }) => {
  if (!evidenza) return <>{testo}</>;
  const righe = testo.split("\n");
  const ev = evidenza.split("\n");
  if (!ev.every((r, i) => r === righe[i])) return <ConEvidenza testo={testo} evidenza={evidenza} colore={NAVY_800} sfondo={AMBER_400} />;
  return (
    <>
      {righe.map((riga, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <br /> : null}
          {i < ev.length ? <span style={{ color: NAVY_800, background: AMBER_400, padding: "0 14px", margin: "0 -14px", borderRadius: 8 }}>{riga}</span> : riga}
        </React.Fragment>
      ))}
    </>
  );
};

const SEGNI = { si: "✓", no: "✕", attenzione: "!" } as const;

export const Carosello: React.FC<CaroselloProps> = (props) => {
  const frame = useCurrentFrame();
  const [attesa] = useState(() => (props.controllo ? delayRender("misura testi") : null));
  useEffect(() => {
    if (attesa === null) return;
    document.fonts.ready.then(() => {
      console.log("CONTROLLO " + JSON.stringify({ slide: frame, scala: props.verticale ? SCALA_VERTICALE : 1, verticale: !!props.verticale, voci: misuraTesti(), ostacoli: misuraOstacoli() }));
      continueRender(attesa);
    });
  }, [attesa, frame, props.verticale]);
  const indice = props.indice ?? Math.min(frame, props.slide.length - 1);
  const slide = useMemo(() => props.slide.map(legaSlide), [props.slide]);
  const contenuto = <Slide1 {...props} slide={slide} indice={indice} />;
  return (
    <Tempo.Provider value={!!props.animato}>
    <Avanzamento.Provider value={{ barra: props.avanzamento === "barra" || props.avanzamento === "tacche", tacche: props.avanzamento === "tacche", scuro: props.stile === "navy", firma: !!props.firma, storia: !!props.storia }}>
      {props.verticale ? (
        <AbsoluteFill style={{ backgroundColor: sfondoSlide({ ...props, slide }, indice) }}>
          <div style={{ position: "absolute", left: 9, top: 210, width: 1080, height: 1350, transform: `scale(${SCALA_VERTICALE})`, transformOrigin: "0 0" }}>
            {contenuto}
          </div>
        </AbsoluteFill>
      ) : (
        contenuto
      )}
    </Avanzamento.Provider>
    </Tempo.Provider>
  );
};

// Colore che riempie lo schermo 9:16 attorno alla slide: lo stesso del suo sfondo.
const sfondoSlide = ({ stile, slide }: CaroselloProps, indice: number) => {
  const s = slide[indice];
  const n = indice + 1;
  if (s.tipo === "copertina" && stile === "foto" && s.foto) return NAVY_800;
  if (s.tipo === "lista" && s.scuro) return tema("navy", false).sfondo;
  if (s.tipo === "chiusura") return stile === "navy" ? tema(stile, n % 2 === 0).sfondo : "white";
  return tema(stile, n % 2 === 0).sfondo;
};

// Zona del contenuto delle slide nuove (28/10/2026): tra la barra in alto e la firma in basso, centrata in verticale
const Contenuto: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", left: 90, right: 90, top: 100, bottom: 230, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
);

const Slide1: React.FC<CaroselloProps & { indice: number }> = ({ stile, slide, indice, storia }) => {
  const { f, fps, animato } = useTempo();
  const s = slide[indice];
  const n = indice + 1;
  const tot = slide.length;
  let t = tema(stile, n % 2 === 0);
  const base: React.CSSProperties = { backgroundColor: t.sfondo, fontFamily: "Inter", letterSpacing: "-0.01em" };

  if (s.tipo === "copertina" && stile === "foto" && s.foto) {
    return (
      <AbsoluteFill style={base}>
        {/* Foto in alto (girati orizzontali: 1080x840), titolo sotto sul navy */}
        <AbsoluteFill style={{ backgroundColor: NAVY_800 }} />
        <Img src={staticFile(s.foto)} style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 840, objectFit: "cover" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, height: 210, background: `linear-gradient(180deg, rgba(11,36,71,0) 0%, ${NAVY_800} 100%)` }} />
        {/* AI Act art. 50(4), dal 2/8/2026: immagine realistica di una persona reale generata con l'IA
            → dichiarazione visibile al primo sguardo, non un'etichetta sbiadita */}
        {/* Discreta (scelta di Federico del 24/10/2026): corta e piccola, ma leggibile (28 px, minimo del controllo) */}
        {s.fotoIA ? (
          <div style={{ position: "absolute", left: 90, top: 82, color: "white", fontSize: 28, fontWeight: 500, background: "rgba(11,36,71,0.7)", padding: "4px 14px", borderRadius: 24 }}>
            Immagine IA
          </div>
        ) : null}
        <Cornice n={n} tot={tot} colore="#CED3DA" scuro suFoto>
          <div style={{ position: "absolute", left: 90, right: 90, bottom: 140 }}>
            <div style={{ display: "inline-block", color: "white", background: "rgba(11,36,71,0.8)", border: "2px solid rgba(255,255,255,0.35)", fontSize: 28, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 18px", borderRadius: 8, marginBottom: 26 }}>
              {s.occhiello}
            </div>
            <div style={{ textWrap: "pretty", color: "white", fontSize: 100, fontWeight: 800, lineHeight: 1.12, whiteSpace: "pre-line" }}>
              <TitoloCopertina testo={s.titolo} evidenza={s.evidenza} />
            </div>
            <div style={{ textWrap: "pretty", color: "#E2E8F0", fontSize: 36, fontWeight: 500, lineHeight: 1.35, marginTop: 30 }}>{s.sotto}</div>
          </div>
        </Cornice>
      </AbsoluteFill>
    );
  }

  if (s.tipo === "copertina") {
    const scuro = stile === "navy";
    return (
      <AbsoluteFill style={base}>
        <Cornice n={n} tot={tot} colore={t.debole}>
          <div style={{ position: "absolute", left: 90, right: 90, top: 0, bottom: 120, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: scuro ? AMBER_400 : BRAND_700, fontSize: 32, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 36 }}>
              {s.occhiello}
            </div>
            <div style={{ width: 120, height: 10, background: AMBER_400, borderRadius: 5, marginBottom: 48 }} />
            <div style={{ textWrap: "pretty", color: t.titolo, fontSize: 132, fontWeight: 800, lineHeight: 1.02, whiteSpace: "pre-line" }}>
              <ConEvidenza testo={s.titolo} evidenza={s.evidenza} colore={scuro ? AMBER_400 : BRAND_700} />
            </div>
            <div style={{ textWrap: "pretty", color: t.corpo, fontSize: 40, fontWeight: 500, lineHeight: 1.35, marginTop: 44, maxWidth: 820 }}>{s.sotto}</div>
          </div>
          {storia ? null : (
            <div style={{ position: "absolute", right: 90, bottom: 150, color: scuro ? NAVY_800 : "white", background: scuro ? AMBER_400 : BRAND_700, fontSize: 32, fontWeight: 700, padding: "16px 30px", borderRadius: 50 }}>
              Scorri →
            </div>
          )}
        </Cornice>
      </AbsoluteFill>
    );
  }

  // B · Riaggancio (28/10/2026): la scena della copertina torna in alto, sfumata nella sabbia (filo con la slide 1)
  // Dal 05/11/2026 (Federico, variante Y e poi B) la slide 2 non ripete la foto della copertina: resta solo se `conFoto`
  const cop = slide[0];
  if (s.tipo === "testo" && n === 2 && stile === "foto" && cop.tipo === "copertina" && cop.foto && !s.segni && s.conFoto) {
    return (
      <AbsoluteFill style={{ ...base, backgroundColor: t.sfondo }}>
        <Img src={staticFile(cop.foto)} style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 400, objectFit: "cover", objectPosition: "50% 22%" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 200, height: 202, background: `linear-gradient(180deg, rgba(247,243,236,0) 0%, ${t.sfondo} 100%)` }} />
        {/* fondo più pieno che in copertina: sulla scena schiarita il 70% dava 4,5:1 (mal di schiena f9d45c8e, 29/10/2026) */}
        {cop.fotoIA ? (
          <div style={{ position: "absolute", left: 90, top: 82, color: "white", fontSize: 28, fontWeight: 500, background: "rgba(11,36,71,0.85)", padding: "4px 14px", borderRadius: 24 }}>Immagine IA</div>
        ) : null}
        <Cornice n={n} tot={tot} colore={t.debole} suFoto>
          <div style={{ position: "absolute", left: 90, right: 90, top: 330 }}>
            <div style={{ textWrap: "pretty", color: t.titolo, fontSize: 74, fontWeight: 800, lineHeight: 1.1 }}>{s.titolo}</div>
            {s.referto ? (
              <div style={{ margin: "38px 0", background: "white", border: "2px solid #E2E8F0", borderRadius: 18, padding: "30px 36px", boxShadow: "0 16px 40px rgba(11,36,71,0.12)", transform: "rotate(-1.2deg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <Icona nome="referto" lato={44} colore={SLATE_500} />
                  <div style={{ color: SLATE_500, fontSize: 28, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.referto.intestazione}</div>
                </div>
                <div style={{ height: 12, width: "70%", background: "#E2E8F0", borderRadius: 6, marginTop: 20 }} />
                <div style={{ textWrap: "pretty", color: NAVY_800, fontSize: 41, fontWeight: 700, lineHeight: 1.3, marginTop: 18 }}>
                  <ConEvidenza testo={s.referto.riga} evidenza={s.referto.evidenza} colore={NAVY_800} sfondo={AMBER_100} />
                </div>
              </div>
            ) : (
              <div style={{ width: 120, height: 10, background: AMBER_400, borderRadius: 5, margin: "40px 0" }} />
            )}
            <div style={{ textWrap: "pretty", color: t.corpo, fontSize: 42, fontWeight: 500, lineHeight: 1.38 }}>{s.corpo}</div>
            {s.ponte ? <div style={{ textWrap: "pretty", color: BRAND_700, fontSize: 42, fontWeight: 800, marginTop: 28 }}>{s.ponte}</div> : null}
          </div>
        </Cornice>
      </AbsoluteFill>
    );
  }

  if (s.tipo === "testo") {
    return (
      <AbsoluteFill style={base}>
        <Cornice n={n} tot={tot} colore={t.debole}>
          <div style={{ position: "absolute", left: 90, right: 90, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ textWrap: "pretty", color: t.titolo, fontSize: 76, fontWeight: 800, lineHeight: 1.1 }}>{s.titolo}</div>
            {s.referto ? (
              // Il referto disegnato come un foglio: mostra la cosa di cui si parla, senza anatomia
              <div style={{ margin: "44px 0", background: "white", border: "2px solid #E2E8F0", borderRadius: 16, padding: "28px 34px", boxShadow: "0 10px 30px rgba(11,36,71,0.08)" }}>
                <div style={{ color: SLATE_500, fontSize: 28, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.referto.intestazione}</div>
                <div style={{ height: 12, width: "70%", background: "#E2E8F0", borderRadius: 6, marginTop: 22 }} />
                <div style={{ textWrap: "pretty", color: NAVY_800, fontSize: 40, fontWeight: 700, lineHeight: 1.3, marginTop: 20 }}>
                  <ConEvidenza testo={s.referto.riga} evidenza={s.referto.evidenza} colore={NAVY_800} sfondo={AMBER_100} />
                </div>
                <div style={{ height: 12, width: "55%", background: "#E2E8F0", borderRadius: 6, marginTop: 22 }} />
              </div>
            ) : (
              <div style={{ width: 120, height: 10, background: AMBER_400, borderRadius: 5, margin: "48px 0" }} />
            )}
            {s.scena && !s.segni ? (
              // scena accanto alla risposta (05/11/2026, Federico: variante B): disegno intero con le figure delle tavole
              // approvate, file in lavori/<id>/scene/ con width e height già proporzionati (max 420 × 260)
              <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
                <Img src={staticFile(s.scena)} style={{ maxWidth: 420, maxHeight: 260, flex: "none" }} />
                <div style={{ textWrap: "pretty", color: t.corpo, fontSize: 44, fontWeight: 500, lineHeight: 1.4 }}>{s.corpo}</div>
              </div>
            ) : (
              <div style={{ textWrap: "pretty", color: t.corpo, fontSize: s.segni ? 42 : 44, fontWeight: s.segni ? 600 : 500, lineHeight: s.segni ? 1.35 : 1.4 }}>{s.corpo}</div>
            )}
            {s.segni ? (
              <div style={{ background: "white", borderRadius: 18, padding: "22px 30px", marginTop: 22, display: "flex", gap: 30, alignItems: "center" }}>
                {/* scena nel riquadro dei segni (gomito, 05/11/2026): il gesto del segno, con le figure delle tavole */}
                {s.scena ? <Img src={staticFile(s.scena)} style={{ width: 200, height: 240, flex: "none" }} /> : null}
                {s.figura === "gomito" ? (
                    // braccio di profilo col gomito piegato, nello stile dei disegni degli esercizi, con le proporzioni vere (20/11/2026, Federico:
                    // «il gomito rendilo più realistico», poi «è sproporzionata»): l'esterno del gomito acceso (gomito del tennista)
                    <svg width={200} height={240} viewBox="8 2 210 176" style={{ flex: "none" }}>
                      <defs>
                      <linearGradient id="gp-pelle" gradientUnits="userSpaceOnUse" x1="20" y1="40" x2="206" y2="175"><stop offset="0" stopColor="#D9A57E"/><stop offset="0.35" stopColor="#EDC4A2"/><stop offset="1" stopColor="#E3B08A"/></linearGradient>
                      <linearGradient id="gp-mano" gradientUnits="userSpaceOnUse" x1="20" y1="40" x2="206" y2="175"><stop offset="0" stopColor="#D9A57E"/><stop offset="0.35" stopColor="#EDC4A2"/><stop offset="1" stopColor="#E3B08A"/></linearGradient>
                      <linearGradient id="gp-maglia" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2E3B57"/><stop offset="0.5" stopColor="#3A4865"/><stop offset="1" stopColor="#33405C"/></linearGradient>
                      <radialGradient id="gp-dolore"><stop offset="0" stopColor="#E23B1E" stopOpacity="0.95"/><stop offset="0.45" stopColor="#F26B1D" stopOpacity="0.75"/><stop offset="1" stopColor="#F59E0B" stopOpacity="0"/></radialGradient>
                      </defs>
                      {/* braccio intero di profilo (braccio destro visto dall'esterno, gomito a 90°): braccio e avambraccio lunghi quasi uguali e larghi uguali al gomito, polso stretto */}
                      <path d="M25,32 C21,56 20,82 22,104 C23,120 24,130 26,139 C27,151 33,160 44,161 C80,160 126,156 160,152 L160,131 C140,130 118,126 100,120 C90,117 80,115 72,117 C64,119 60,126 59,134 C62,116 67,96 66,78 C65,60 62,46 61,32 Z" fill="url(#gp-pelle)" stroke="#8A5A3C" strokeWidth="2.2" strokeLinejoin="round"/>
                      {/* piega del gomito, bicipite, riflessi, ombra sotto e punta ossea del gomito */}
                      <path d="M59,134 C61,139 64,142 69,143" fill="none" stroke="#B97E5A" strokeWidth="1.8" opacity="0.65" strokeLinecap="round"/>
                      <path d="M60,70 C63,86 63,102 60,116" fill="none" stroke="#B97E5A" strokeWidth="1.5" opacity="0.35" strokeLinecap="round"/>
                      <path d="M78,121 C100,123 130,129 154,134" fill="none" stroke="#FBE3CF" strokeWidth="3" opacity="0.75" strokeLinecap="round"/>
                      <path d="M46,56 C50,76 51,98 49,116" fill="none" stroke="#FBE3CF" strokeWidth="2.6" opacity="0.5" strokeLinecap="round"/>
                      <path d="M50,156 C84,155 124,152 154,149" fill="none" stroke="#B97E5A" strokeWidth="2" opacity="0.3" strokeLinecap="round"/>
                      <path d="M27,146 C29,153 34,157 41,158" fill="none" stroke="#B97E5A" strokeWidth="1.6" opacity="0.5" strokeLinecap="round"/>
                      {/* pugno chiuso visto dal dorso, pollice sopra con l'unghia, le quattro dita piegate una sopra l'altra e le nocche sul davanti (21/11/2026, Federico: «la mano non si capisce») */}
                      <path d="M156,131 C168,129 180,128 190,129 C198,130 204,135 206,142 C208,149 207,156 204,161 C200,166 194,168 186,168 C176,168 166,162 156,153 Z" fill="url(#gp-mano)"/>
                      <path d="M190,140 C196,140 202,141 207,143 M190,149 C196,149 202,150 207,151 M188,158 C194,158 200,159 205,160" fill="none" stroke="#9C6646" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M189,135 C188,145 188,157 186,167" fill="none" stroke="#9C6646" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M166,130 C176,129 184,128 190,129 C198,130 204,135 206,142 C208,149 207,156 204,161 C200,166 194,168 186,168 C177,168 169,163 162,157" fill="none" stroke="#8A5A3C" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round"/>
                      <path d="M172,142 C176,148 178,154 178,160" fill="none" stroke="#B97E5A" strokeWidth="1.4" opacity="0.45" strokeLinecap="round"/>
                      <path d="M162,135 C170,127 184,124 195,125 C202,126 206,130 204,135 C200,138 190,138 182,138 C174,138 168,138 163,137" fill="url(#gp-mano)" stroke="#8A5A3C" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
                      <path d="M195,126.5 C200,126.5 203.5,129.5 203.5,133 C200,134 196.5,133 194.5,130.5 Z" fill="#F4D6BE" stroke="#B97E5A" strokeWidth="1.1"/>
                      <path d="M172,130 C178,128 184,127 190,127.5" fill="none" stroke="#FBE3CF" strokeWidth="1.8" opacity="0.85" strokeLinecap="round"/>
                      {/* manica corta della maglia */}
                      <path d="M17,4 L68,4 L70,40 C56,45 32,45 17,40 Z" fill="url(#gp-maglia)" stroke="#1E2A40" strokeWidth="2.2" strokeLinejoin="round"/>
                      <path d="M19,35 C34,39 54,39 68,35" fill="none" stroke="#26324A" strokeWidth="2.2"/>
                      {/* dove fa male: l'esterno del gomito (epicondilo laterale), poco sopra e davanti alla punta del gomito */}
                      <ellipse cx="42" cy="142" rx="24" ry="20" fill="url(#gp-dolore)"/>
                      <ellipse cx="42" cy="143" rx="13" ry="11" fill="url(#gp-dolore)"/>
                    </svg>
                ) : null}
                {s.figura === "tallone" ? (
                    // gamba e piede nudo visti dall'interno, nello stile dei disegni degli esercizi (21/11/2026, Federico: «rendili più realistici», «colore più forte»): sotto il tallone acceso (fascite plantare)
                    <svg width={200} height={240} viewBox="0 0 200 240" style={{ flex: "none" }}>
                      <defs>
                      <linearGradient id="gt-pelle" gradientUnits="userSpaceOnUse" x1="40" y1="40" x2="190" y2="216"><stop offset="0" stopColor="#D9A57E"/><stop offset="0.4" stopColor="#EDC4A2"/><stop offset="1" stopColor="#E0AC86"/></linearGradient>
                      <linearGradient id="gt-pant" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3A4A72"/><stop offset="0.5" stopColor="#4E5F88"/><stop offset="1" stopColor="#40517A"/></linearGradient>
                      <radialGradient id="gt-terra" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#0B2447" stopOpacity="0.22"/><stop offset="1" stopColor="#0B2447" stopOpacity="0"/></radialGradient>
                      <linearGradient id="gt-sotto" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B97E5A" stopOpacity="0"/><stop offset="1" stopColor="#B97E5A" stopOpacity="0.45"/></linearGradient>
                      <radialGradient id="gt-dolore"><stop offset="0" stopColor="#E23B1E" stopOpacity="0.95"/><stop offset="0.45" stopColor="#F26B1D" stopOpacity="0.75"/><stop offset="1" stopColor="#F59E0B" stopOpacity="0"/></radialGradient>
                      </defs>
                      <ellipse cx="124" cy="218" rx="80" ry="6" fill="url(#gt-terra)"/>
                      {/* gamba e piede nudo visti dall'interno: polpaccio che si stringe, tendine d'Achille, tallone, arco, avampiede, alluce */}
                      <path d="M46,40 C40,70 42,100 52,128 C56,142 58,154 58,166 C58,178 52,186 51,196 C50,208 58,215 72,216 C84,217 94,214 102,211 C112,207 126,206 138,209 C148,212 158,215 170,215 C180,215 187,214 192,212 C198,210 199,204 194,201 C190,198 184,197 178,196 C170,195 160,192 150,188 C136,182 122,175 112,170 C106,167 101,165 99,162 C97,128 96,80 96,40 Z" fill="url(#gt-pelle)" stroke="#8A5A3C" strokeWidth="2.2" strokeLinejoin="round"/>
                      {/* ombra sotto la pianta e sotto l'arco */}
                      <path d="M60,208 C70,215 86,216 100,211 C112,206 126,205 140,209 C152,213 168,214 184,212 L186,215 C170,217 150,216 138,212 C124,208 110,209 100,213 C86,219 66,217 58,210 Z" fill="url(#gt-sotto)"/>
                      <path d="M98,210 C110,204 126,203 140,207" fill="none" stroke="#B97E5A" strokeWidth="2" opacity="0.5" strokeLinecap="round"/>
                      {/* tendine d'Achille, malleolo, piega della caviglia */}
                      <path d="M60,138 C63,152 62,166 58,182" fill="none" stroke="#B97E5A" strokeWidth="1.8" opacity="0.5" strokeLinecap="round"/>
                      <path d="M74,170 C78,163 87,163 90,170 C90,177 84,181 77,179" fill="url(#gt-pelle)" stroke="#B97E5A" strokeWidth="1.6" opacity="0.9" strokeLinecap="round"/>
                      <path d="M99,161 C103,165 107,167 111,169" fill="none" stroke="#B97E5A" strokeWidth="1.4" opacity="0.5" strokeLinecap="round"/>
                      {/* alluce con l'unghia e la piega, testa del primo metatarso */}
                      <path d="M182,198 C187,197 191,199 192,203 C189,204 185,203 182,201 Z" fill="#F4D6BE" stroke="#B97E5A" strokeWidth="1.2"/>
                      <path d="M170,197 C172,202 172,208 170,214" fill="none" stroke="#9C6646" strokeWidth="1.4" strokeLinecap="round"/>
                      <path d="M150,198 C155,192 163,192 166,198" fill="none" stroke="#B97E5A" strokeWidth="1.4" opacity="0.5" strokeLinecap="round"/>
                      {/* riflessi su collo del piede e stinco */}
                      <path d="M112,170 C126,177 142,184 158,189" fill="none" stroke="#FBE3CF" strokeWidth="3" opacity="0.7" strokeLinecap="round"/>
                      <path d="M86,62 C88,92 89,122 90,150" fill="none" stroke="#FBE3CF" strokeWidth="2.6" opacity="0.5" strokeLinecap="round"/>
                      {/* orlo dei pantaloni */}
                      <path d="M40,0 L104,0 L104,62 C84,70 60,70 40,62 Z" fill="url(#gt-pant)" stroke="#1E2A40" strokeWidth="2.2" strokeLinejoin="round"/>
                      <path d="M42,54 C62,61 84,61 102,54" fill="none" stroke="#2C3A5C" strokeWidth="2.4"/>
                      {/* dove fa male: sotto il tallone, sul davanti, dove parte la fascia plantare */}
                      <ellipse cx="82" cy="211" rx="25" ry="15" fill="url(#gt-dolore)"/>
                      <ellipse cx="82" cy="212" rx="13" ry="8" fill="url(#gt-dolore)"/>
                    </svg>
                ) : null}
                {s.figura === "nuca" ? (
                    // testa, collo e spalle visti da dietro, nello stile dei disegni degli esercizi (21/11/2026, Federico: «rendili più realistici», «il dolore è evidenziato giusto?»): il dolore parte dalla nuca da un lato e sale sulla stessa metà della testa, come dicono i segni
                    <svg width={200} height={240} viewBox="0 0 200 240" style={{ flex: "none" }}>
                      <defs>
                      <linearGradient id="gn-pelle" gradientUnits="userSpaceOnUse" x1="40" y1="30" x2="170" y2="210"><stop offset="0" stopColor="#D9A57E"/><stop offset="0.4" stopColor="#EDC4A2"/><stop offset="1" stopColor="#E0AC86"/></linearGradient>
                      <linearGradient id="gn-ombra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8A5A3C" stopOpacity="0.35"/><stop offset="1" stopColor="#8A5A3C" stopOpacity="0"/></linearGradient>
                      <linearGradient id="gn-capelli" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stopColor="#6A4B3A"/><stop offset="0.6" stopColor="#4A3428"/><stop offset="1" stopColor="#3A281E"/></linearGradient>
                      <linearGradient id="gn-maglia" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2A3652"/><stop offset="0.5" stopColor="#3A4865"/><stop offset="1" stopColor="#2F3C58"/></linearGradient>
                      <radialGradient id="gn-dolore"><stop offset="0" stopColor="#E23B1E" stopOpacity="0.95"/><stop offset="0.45" stopColor="#F26B1D" stopOpacity="0.75"/><stop offset="1" stopColor="#F59E0B" stopOpacity="0"/></radialGradient>
                      </defs>
                      {/* spalle e trapezi */}
                      <path d="M4,240 L4,176 C20,164 40,156 56,150 C64,146 68,138 69,128 L131,128 C132,138 136,146 144,150 C160,156 180,164 196,176 L196,240 Z" fill="url(#gn-pelle)" stroke="#8A5A3C" strokeWidth="2.2" strokeLinejoin="round"/>
                      {/* orecchie con il bordo e la piega interna */}
                      <path d="M58,76 C51,70 45,77 46,88 C47,96 51,101 58,100 L61,97 Z M142,76 C149,70 155,77 154,88 C153,96 149,101 142,100 L139,97 Z" fill="#E3B08A" stroke="#8A5A3C" strokeWidth="1.9" strokeLinejoin="round"/>
                      <path d="M54,81 C51,85 51,91 54,95 M146,81 C149,85 149,91 146,95" fill="none" stroke="#B97E5A" strokeWidth="1.5" opacity="0.7" strokeLinecap="round"/>
                      {/* testa (con gli angoli della mandibola sotto le orecchie) e collo in un pezzo solo */}
                      <path d="M57,82 C57,48 76,30 100,30 C124,30 143,48 143,82 C143,96 141,106 135,114 C129,120 119,124 100,124 C81,124 71,120 65,114 C59,106 57,96 57,82 Z" fill="url(#gn-pelle)"/>
                      <path d="M70,108 L130,108 C130,124 132,136 140,146 L150,160 L50,160 L60,146 C68,136 70,124 70,108 Z" fill="url(#gn-pelle)"/>
                      <path d="M66,115 C59,106 57,96 57,82 C57,48 76,30 100,30 C124,30 143,48 143,82 C143,96 141,106 134,115" fill="none" stroke="#8A5A3C" strokeWidth="2.2" strokeLinecap="round"/>
                      <path d="M66,115 C69,128 66,140 54,150 C40,156 22,164 6,175 M134,115 C131,128 134,140 146,150 C160,156 178,164 194,175" fill="none" stroke="#8A5A3C" strokeWidth="2.2" strokeLinecap="round"/>
                      {/* ombra sotto il cranio, solco al centro del collo e muscoli della nuca */}
                      <ellipse cx="100" cy="119" rx="32" ry="9" fill="url(#gn-ombra)"/>
                      <path d="M100,121 C100,132 100,142 100,154" fill="none" stroke="#B97E5A" strokeWidth="1.6" opacity="0.35" strokeLinecap="round"/>
                      <path d="M89,122 C88,132 86,140 82,148 M111,122 C112,132 114,140 118,148" fill="none" stroke="#B97E5A" strokeWidth="1.3" opacity="0.22" strokeLinecap="round"/>
                      <path d="M76,140 C68,150 52,156 32,164 M124,140 C132,150 148,156 168,164" fill="none" stroke="#B97E5A" strokeWidth="1.6" opacity="0.35" strokeLinecap="round"/>
                      <path d="M120,124 C122,132 124,138 128,144" fill="none" stroke="#FBE3CF" strokeWidth="2.4" opacity="0.5" strokeLinecap="round"/>
                      {/* capelli corti, attaccatura sulla nuca un po' più bassa al centro */}
                      <path d="M56,84 C53,48 74,28 100,28 C126,28 147,48 144,84 C144,94 142,102 138,108 C135,112 131,114 127,116 C119,112 110,112 100,115 C90,112 81,112 73,116 C69,114 65,112 62,108 C58,102 56,94 56,84 Z" fill="url(#gn-capelli)" stroke="#2E1F17" strokeWidth="2" strokeLinejoin="round"/>
                      <path d="M74,44 C82,37 92,34 102,35 M66,64 C71,56 78,52 86,51 M116,46 C124,48 132,54 136,62 M62,88 C64,80 68,74 74,70 M138,88 C136,80 132,74 126,70 M90,60 C96,56 104,56 110,58 M84,92 C90,88 98,88 104,90 M108,98 C114,96 120,97 126,100" fill="none" stroke="#866250" strokeWidth="1.8" opacity="0.55" strokeLinecap="round"/>
                      <path d="M80,108 l2,6 M90,107 l1,6 M110,107 l-1,6 M120,108 l-2,6" stroke="#3A281E" strokeWidth="1.6" strokeLinecap="round" opacity="0.7"/>
                      {/* maglia con lo scollo dietro e una piega */}
                      <path d="M0,184 C18,172 42,166 62,162 C78,171 122,171 138,162 C158,166 182,172 200,184 L200,240 L0,240 Z" fill="url(#gn-maglia)" stroke="#1E2A40" strokeWidth="2.2" strokeLinejoin="round"/>
                      <path d="M64,167 C80,176 120,176 136,167" fill="none" stroke="#24304A" strokeWidth="3.2"/>
                      <path d="M36,200 C50,208 64,212 80,214 M164,200 C150,208 136,212 120,214" fill="none" stroke="#24304A" strokeWidth="1.8" opacity="0.6" strokeLinecap="round"/>
                      {/* dove fa male: parte dalla nuca da un lato, all'attaccatura dei capelli, e sale sulla stessa metà della testa */}
                      <ellipse cx="117" cy="104" rx="19" ry="30" transform="rotate(-12 117 104)" fill="url(#gn-dolore)"/>
                      <ellipse cx="118" cy="112" rx="12" ry="14" fill="url(#gn-dolore)"/>
                    </svg>
                ) : null}
                <div style={{ flex: 1 }}>
                  <div style={{ textWrap: "pretty", color: NAVY_800, fontSize: 40, fontWeight: 800, marginBottom: 18 }}>{s.segni.titolo}</div>
                  {s.segni.voci.map((v, i) => (
                    <div key={i} style={{ display: "flex", gap: 20, alignItems: "center", marginTop: i ? 14 : 0 }}>
                      <svg width={44} height={44} viewBox="0 0 60 60" style={{ flex: "none", marginTop: 2 }}><circle cx="30" cy="30" r="30" fill={BRAND_700} /><path d="M17 31 L26 40 L44 21" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <div style={{ textWrap: "pretty", color: NAVY_800, fontSize: 44, fontWeight: 700, lineHeight: 1.2 }}>{lega(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {s.ponte ? <div style={{ textWrap: "pretty", color: BRAND_700, fontSize: 42, fontWeight: 800, marginTop: 30 }}>{s.ponte}</div> : null}
          </div>
        </Cornice>
      </AbsoluteFill>
    );
  }

  if (s.tipo === "dato") {
    const pitto = s.illustrazione?.tipo === "pittogramma" ? s.illustrazione : null;
    const conf = s.illustrazione?.tipo === "confronto" ? s.illustrazione : null;
    const tempi = s.illustrazione?.tipo === "tempi" ? s.illustrazione : null;
    const barre = s.illustrazione?.tipo === "barre" ? s.illustrazione : null;
    // C · Prova (28/10/2026): barre e pochi omini grandi, che su Instagram entrano col tempo
    const grande = !!barre || (!!pitto && pitto.totale <= 10);
    // Numero con chi e cosa (variante B, 04/11/2026): serve il pittogramma
    const legenda = pitto && s.chi && s.cosa ? pitto : null;
    const omini = (
      pitto ? (
              pitto.totale <= 10 ? (
                // "2 su 3": tre omini grandi, lo stesso denominatore del numero (icon array, Garcia-Retamero e Galesic)
                <div style={{ display: "flex", gap: 22, marginBottom: 44 }}>
                  {Array.from({ length: pitto.totale }, (_, i) => {
                    const lato = pitto.totale <= 3 ? 240 : pitto.totale <= 4 ? 200 : 900 / pitto.totale - 22;
                    const p = entra(f, fps, 0.6 + i * 0.6);
                    return (
                      <div key={i} style={{ position: "relative", width: lato, height: lato }}>
                        <div style={{ position: "absolute", inset: 0 }}><Omino lato={lato} colore="#C5CEDA" /></div>
                        {i < pitto.su ? <div style={{ position: "absolute", inset: 0, opacity: p, transform: `scale(${0.85 + 0.15 * p})` }}><Omino lato={lato} colore={t.accento} /></div> : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(20, 45px)", rowGap: 0, marginBottom: 30 }}>
                {Array.from({ length: pitto.totale }, (_, i) => (
                  <Omino key={i} lato={36} colore={i < pitto.su ? t.accento : "#C5CEDA"} />
                ))}
              </div>
              )
            ) : null
    );
    const Zona: React.FC<{ children: React.ReactNode }> = grande ? Contenuto
      : ({ children }) => <div style={{ position: "absolute", left: 90, right: 90, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>;
    return (
      <AbsoluteFill style={base}>
        <Cornice n={n} tot={tot} colore={t.debole}>
          <Zona>
            <div style={{ color: t.accento, fontSize: 30, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 28 }}>{s.etichetta}</div>
            {legenda ? (
              <NumeroLegenda chi={s.chi!} cosa={s.cosa!} altri={s.altri} su={legenda.su} totale={legenda.totale} colore={t.accento} testo={t.titolo} debole={SLATE_600}>
                {omini}
              </NumeroLegenda>
            ) : (<>
            {/* Numero lungo ("6 settimane"): a 200 px va su due righe e esce dal margine (mal di schiena 24/10) */}
            {s.numero ? (
              <div style={{ color: t.accento, fontSize: pitto || s.numero.length > 8 ? 136 : 200, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", marginBottom: 30 }}>{s.numero}</div>
            ) : null}
            {omini}
            {s.frase ? <div style={{ textWrap: "pretty", color: t.titolo, fontSize: s.numero ? 56 : barre ? 64 : 66, fontWeight: 750, lineHeight: barre ? 1.16 : 1.18 }}>{s.frase}</div> : null}
            </>)}
            {s.illustrazione?.tipo === "effetto" ? (() => { const e = s.illustrazione; /* Riquadro del risultato (Federico, 10/11/2026, stile 3 su 3 prove): stessa forma della nota, bordo a sinistra in blu invece che in ambra (blu = risultato dello studio, ambra = nota); frase dello studio in grigio, risultati in grassetto */ return (
              <div style={{ background: t.card, borderLeft: `8px solid ${BRAND_700}`, borderRadius: 12, padding: "26px 34px", marginTop: 40 }}>
                <div style={{ textWrap: "pretty", color: t.corpo, fontSize: 36, fontWeight: 600, lineHeight: 1.35, marginBottom: 22 }}>{lega(e.titolo)}</div>
                {e.voci.map((v, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, marginTop: i ? 18 : 0 }}>
                    <svg width={70} height={70} viewBox="0 0 84 84" style={{ flex: "none" }}><circle cx="42" cy="42" r="42" fill="#E3EEFB" /><path d={e.frecce?.[i] === "su" ? "M42 64 V24 M26 38 L42 22 L58 38" : "M42 20 V60 M26 46 L42 62 L58 46"} fill="none" stroke={BRAND_700} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <div style={{ textWrap: "pretty", color: NAVY_800, fontSize: 44, fontWeight: 800 }}>{v}</div>
                  </div>
                ))}
              </div>
            ); })() : null}
            {conf ? (
              <div style={{ display: "flex", alignItems: "stretch", gap: 24, marginTop: 44 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 20, background: t.card, borderRadius: 14, padding: "22px 26px" }}>
                  <Icona nome={conf.a.icona} lato={64} colore={SLATE_500} />
                  <div>
                    <div style={{ textWrap: "pretty", color: SLATE_600, fontSize: 34, fontWeight: 700 }}>{conf.a.testo}</div>
                    {conf.a.esito ? <div style={{ textWrap: "pretty", color: SLATE_600, fontSize: 28, fontWeight: 600, marginTop: 4 }}>{conf.a.esito}</div> : null}
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 20, background: "#E3EEFB", borderRadius: 14, padding: "22px 26px" }}>
                  <Icona nome={conf.b.icona} lato={64} colore={BRAND_700} />
                  <div>
                    <div style={{ textWrap: "pretty", color: NAVY_800, fontSize: 34, fontWeight: 800 }}>{conf.b.testo}</div>
                    <div style={{ textWrap: "pretty", color: "#0A57AD", fontSize: 28, fontWeight: 700, marginTop: 4 }}>{conf.b.esito}</div>
                  </div>
                </div>
              </div>
            ) : null}
            {barre ? (
              <div style={{ display: "flex", flexDirection: "column", gap: barre.righe.length > 3 ? 26 : barre.scala ? 30 : 44, marginTop: barre.scala ? 44 : 56 }}>
                {barre.scala?.titolo ? <div style={{ textWrap: "pretty", color: NAVY_800, fontSize: 40, fontWeight: 800, marginBottom: -6 }}>{barre.scala.titolo}</div> : null}
                {barre.righe.map((b, i) => {
                  const p = entra(f, fps, 0.5 + i * 0.9);
                  // la barra colorata è quella da far vedere (`evidenza`), che può stare per prima (gomito, Federico 05/11/2026); senza, l'ultima
                  const ultima = barre.righe.some((r) => r.evidenza) ? !!b.evidenza : i === barre.righe.length - 1;
                  const alta = barre.righe.length > 3 ? 52 : barre.scala ? 64 : 88;
                  return (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                        <div style={{ color: SLATE_600, fontSize: 36, fontWeight: 700 }}>{b.etichetta}</div>
                        <div style={{ color: ultima ? BRAND_700 : NAVY_800, fontSize: barre.righe.length > 3 ? 44 : 60, fontWeight: 900, letterSpacing: "-0.03em", opacity: p }}>{b.testo}</div>
                      </div>
                      <div style={{ height: alta, borderRadius: 16, background: "#E2E8F0", overflow: "hidden" }}>
                        <div style={{ width: `${b.valore * p}%`, height: "100%", borderRadius: 16, background: ultima ? BRAND_700 : SLATE_500 }} />
                      </div>
                    </div>
                  );
                })}
                {/* solo il titolo, senza righello, quando le barre contano persone (gomito, 05/11/2026) */}
                {barre.scala?.da && barre.scala?.a ? (
                  // il righello: gli estremi della scala sotto l'ultima barra, allineati ai suoi bordi
                  <div style={{ marginTop: -14 }}>
                    <div style={{ height: 14, borderLeft: `3px solid ${SLATE_500}`, borderRight: `3px solid ${SLATE_500}`, borderBottom: `3px solid ${SLATE_500}` }} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, color: SLATE_600, fontSize: 32, fontWeight: 700 }}>
                      <span>{barre.scala.da}</span><span>{barre.scala.a}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {tempi ? (
              <div style={{ display: "flex", alignItems: "stretch", gap: 24, marginTop: 44 }}>
                {tempi.tappe.map((tp, i) => (
                  <div key={i} style={{ flex: 1, background: t.card, borderRadius: 14, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ color: t.accento, fontSize: 28, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{tp.quando}</div>
                    {(["a", "b"] as const).map((g) => {
                      const avanti = tp.meglio === g;
                      return (
                        <div key={g} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 10, padding: "10px 16px", background: avanti ? "#E3EEFB" : "#FFFFFF", border: avanti ? `3px solid ${BRAND_700}` : "3px solid #E2E8F0" }}>
                          <div style={{ textWrap: "pretty", color: avanti ? NAVY_800 : SLATE_600, fontSize: 32, fontWeight: avanti ? 800 : 600 }}>{tempi[g]}</div>
                          {avanti ? (
                            <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={BRAND_700} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
                          ) : tp.meglio ? null : (
                            <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={SLATE_500} strokeWidth={3} strokeLinecap="round"><path d="M5 9h14" /><path d="M5 15h14" /></svg>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ textWrap: "pretty", color: NAVY_800, fontSize: 30, fontWeight: 800, marginTop: 4 }}>{tp.esito}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {s.nota ? (
              <div style={{ textWrap: "pretty", background: t.card, borderLeft: `8px solid ${AMBER_400}`, borderRadius: 12, padding: "28px 32px", marginTop: 48, color: t.titolo, fontSize: 38, fontWeight: 600, lineHeight: 1.35 }}>
                {s.nota}
              </div>
            ) : null}
            <div style={{ textWrap: "pretty", color: t.debole, fontSize: 28, fontWeight: 500, lineHeight: 1.4, marginTop: grande ? 36 : 40 }}>Fonte: {s.fonte}</div>
          </Zona>
        </Cornice>
      </AbsoluteFill>
    );
  }

  if (s.tipo === "pratica") return <Pratica s={s} t={t} n={n} tot={tot} base={base} />;

  // Esercizio mostrato da Federico (11/11/2026): riquadro di 420 px accanto ai passi (i vecchi Reel dell'archivio
  // sono compressi: più grande sgranerebbe); titolo con gli a capo scritti; passi numerati come li direbbe a un paziente
  if (s.tipo === "esercizio" && !s.clip) {
    // Esercizio dallo studio con il disegno (11/11/2026 sera): disegno in alto, largo e stretto sul gesto; passi sotto
    const W = 900, H = 300;
    return (
      <AbsoluteFill style={base}>
        <Cornice n={n} tot={tot} colore={t.debole}>
          <Contenuto>
            <div style={{ textWrap: "pretty", color: t.titolo, fontSize: 62, fontWeight: 800, lineHeight: 1.1, marginBottom: 36, whiteSpace: "pre-line" }}>{s.titolo}</div>
            <div style={{ display: "flex", gap: 6, width: W, height: H, borderRadius: 22, overflow: "hidden", background: "#E2E8F0" }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ width: (W - 6) / 2, height: H, background: "white" }}>
                  {s.disegnoSvg ? <div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: s.disegnoSvg[i].replace("<svg", '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice"') }} /> : null}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, marginBottom: 34 }}>
              {(s.scritte ?? []).map((x) => <div key={x} style={{ width: (W - 6) / 2, textAlign: "center", color: SLATE_600, fontSize: 30, fontWeight: 700 }}>{x}</div>)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {s.passi.map((v, i) => (
                <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                  <div style={{ flex: "none", width: 54, height: 54, borderRadius: 27, background: BRAND_700, color: "white", fontSize: 30, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                  <div style={{ textWrap: "pretty", color: t.titolo, fontSize: 38, fontWeight: 700, lineHeight: 1.25 }}>{lega(v)}</div>
                </div>
              ))}
            </div>
            {s.fonte ? <div style={{ marginTop: 24, color: t.debole, fontSize: 28, fontWeight: 500 }}>Fonte: {s.fonte}</div> : null}
          </Contenuto>
        </Cornice>
      </AbsoluteFill>
    );
  }

  if (s.tipo === "esercizio") {
    const W = 420, H = 560;
    return (
      <AbsoluteFill style={base}>
        <Cornice n={n} tot={tot} colore={t.debole}>
          <Contenuto>
            <div style={{ textWrap: "pretty", color: t.titolo, fontSize: 66, fontWeight: 800, lineHeight: 1.1, marginBottom: 44, whiteSpace: "pre-line" }}>{s.titolo}</div>
            <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
              <div style={{ flex: "none", width: W }}>
                <div style={{ position: "relative", width: W, height: H, borderRadius: 22, overflow: "hidden", background: NAVY_800 }}>
                  {animato ? (
                    <OffthreadVideo src={staticFile("esercizio.mp4")} muted style={{ width: W, height: H, objectFit: "cover" }} />
                  ) : (
                    <div style={{ display: "flex", gap: 4, width: W, height: H, background: "white" }}>
                      {["esercizio-1.jpg", "esercizio-2.jpg"].map((im, i) => (
                        // Frecce del movimento sui fotogrammi fermi (Federico, 11/11/2026: «puoi mettere delle frecce per capire
                        // meglio il movimento?»): una per fotogramma, [x1, y1, x2, y2] in % del fotogramma, calcolate dalla posa
                        // (scripts/social/frecce-esercizio.py), nello spazio libero vicino a ciò che si muove, mai sul viso
                        <div key={im} style={{ position: "relative", width: (W - 4) / 2, height: H }}>
                          <Img src={staticFile(im)} style={{ width: "100%", height: H, objectFit: "cover" }} />
                          {s.frecce?.[i] ? <FrecciaFoto f={s.frecce[i]} w={(W - 4) / 2} h={H} /> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {!animato && s.scritte ? (
                  <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
                    {s.scritte.map((x) => <div key={x} style={{ width: (W - 4) / 2, textAlign: "center", color: SLATE_600, fontSize: 28, fontWeight: 700 }}>{x}</div>)}
                  </div>
                ) : null}
              </div>
              <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: 30 }}>
                {s.passi.map((v, i) => (
                  <div key={i} style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
                    <div style={{ flex: "none", width: 52, height: 52, borderRadius: 26, background: BRAND_700, color: "white", fontSize: 30, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>{i + 1}</div>
                    <div style={{ textWrap: "pretty", color: t.titolo, fontSize: 38, fontWeight: 700, lineHeight: 1.25 }}>{lega(v)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Contenuto>
        </Cornice>
      </AbsoluteFill>
    );
  }

  if (s.tipo === "lista") {
    // Campanelli d'allarme su navy: cambio di registro visibile, l'ambra del "!" risalta
    if (s.scuro) t = tema("navy", false);
    base.backgroundColor = t.sfondo;
    const coloreSegno = s.segno === "attenzione" ? AMBER_400 : s.segno === "no" ? t.debole : t.accento;
    const lunga = s.voci.length > 4;
    return (
      <AbsoluteFill style={base}>
        <Cornice n={n} tot={tot} colore={s.scuro ? "#CBD5E1" : t.debole} scuro={s.scuro}>
          <Contenuto>
            <div style={{ textWrap: "pretty", color: t.titolo, fontSize: 70, fontWeight: 800, lineHeight: 1.1, marginBottom: lunga ? 40 : 44 }}>{s.titolo}</div>
            {s.voci.map((v, i) => s.icone && !lunga ? (
              // D · Pratica (28/10/2026): una scheda per voce, icona grande con il segno ✓/✕
              <div key={v} style={{ display: "flex", alignItems: "center", gap: 30, background: t.card, borderRadius: 20, padding: "22px 28px", marginBottom: 22 }}>
                <div style={{ position: "relative", flex: "0 0 auto", width: 112, height: 112, borderRadius: 24, background: s.segno === "no" ? "#E9ECF1" : "#E3EEFB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icona nome={s.icone[i]} lato={68} colore={s.segno === "no" ? SLATE_600 : BRAND_700} />
                  <div style={{ position: "absolute", right: -10, bottom: -10, width: 48, height: 48, borderRadius: 24, background: s.segno === "no" ? SLATE_500 : BRAND_700, border: `4px solid ${t.card}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                      {s.segno === "no" ? (<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>) : <path d="M4 12.5l5 5L20 6.5" />}
                    </svg>
                  </div>
                </div>
                <div style={{ textWrap: "pretty", color: t.titolo, fontSize: 40, fontWeight: 600, lineHeight: 1.28 }}>{v}</div>
              </div>
            ) : (
              <div key={v} style={{ display: "flex", gap: 28, alignItems: s.icone ? "center" : "flex-start", marginBottom: lunga ? 24 : 34 }}>
                {s.icone ? (
                  // Icona che illustra la voce + piccolo segno (✓/✕) perché resti chiaro se è da fare o da evitare
                  <div style={{ position: "relative", flex: "0 0 auto", width: 84, height: 84, borderRadius: 20, background: s.segno === "no" ? "#E9ECF1" : "#E3EEFB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icona nome={s.icone[i]} lato={48} colore={s.segno === "no" ? SLATE_500 : BRAND_700} />
                    <div style={{ position: "absolute", right: -9, bottom: -9, width: 40, height: 40, borderRadius: 20, background: coloreSegno, border: `3px solid ${t.sfondo}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {/* segno disegnato, non testo: è un simbolo piccolo, non una scritta da leggere */}
                      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                        {s.segno === "no" ? (<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>) : <path d="M4 12.5l5 5L20 6.5" />}
                      </svg>
                    </div>
                  </div>
                ) : (
                <div style={{ flex: "0 0 auto", width: 60, height: 60, borderRadius: 30, background: coloreSegno, color: s.segno === "attenzione" || stile === "navy" || s.scuro ? NAVY_800 : "white", fontSize: 36, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                  {SEGNI[s.segno]}
                </div>
                )}
                <div style={{ textWrap: "pretty", color: t.titolo, fontSize: lunga ? 38 : 42, fontWeight: 600, lineHeight: 1.3 }}>{v}</div>
              </div>
            ))}
            {s.nota ? (
              <div style={{ alignSelf: "flex-start", marginTop: 20, background: stile === "navy" ? "rgba(251,191,36,0.15)" : AMBER_100, color: stile === "navy" ? AMBER_400 : NAVY_800, fontSize: 32, fontWeight: 700, padding: "14px 24px", borderRadius: 10, display: "flex", alignItems: "center", gap: 14 }}>
                <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={NAVY_800} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                {s.nota.replace(/\s*🔖\s*$/u, "")}
              </div>
            ) : null}
          </Contenuto>
        </Cornice>
      </AbsoluteFill>
    );
  }

  // F · Chiusura verso una guida (28/10/2026, Federico): la guida è il prodotto, non la didascalia del video;
  // una sola azione (il pulsante), lo studio scende nella firma, niente ritratto (Federico è già nel video).
  // Dal 29/10/2026 senza "In breve": titolo più grande con il problema evidenziato e video più alto
  if (s.guida) {
    const g = s.guida;
    const scala = animato ? 1 + 0.04 * Math.min(1, f / (9 * fps)) : 1;
    return (
      <AbsoluteFill style={{ ...base, backgroundColor: "white" }}>
        <BarraSeServe n={n} tot={tot} />
        {/* colonna tra la barra e la firma: il video prende lo spazio che resta (titolo lungo → video più basso) */}
        <div style={{ position: "absolute", left: 90, right: 90, top: 96, bottom: 216, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ textWrap: "pretty", flex: "none", color: NAVY_800, fontSize: rigaPiuLunga(s.titolo) > 26 ? 60 : 72, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.01em", marginTop: 22, whiteSpace: "pre-line" }}>
            <TitoloEvidenziato testo={s.titolo} evidenza={s.evidenza} />
          </div>
          <div style={{ position: "relative", flex: "1 1 0", minHeight: 240, maxHeight: 620, marginTop: 30, width: 900, borderRadius: 22, overflow: "hidden", background: NAVY_800 }}>
            <div style={{ position: "absolute", inset: 0, transform: `scale(${scala})` }}>
              {animato ? (
                <OffthreadVideo src={staticFile(g.video)} muted style={{ width: 900, height: "100%", objectFit: "cover" }} />
              ) : (
                <Img src={staticFile(g.fermo)} style={{ width: 900, height: "100%", objectFit: "cover" }} />
              )}
            </div>
          </div>
          {/* nome lungo ("… Sblocco Schiena di Emergenza"): più piccolo per restare su una riga */}
          <div style={{ textWrap: "pretty", flex: "none", color: NAVY_800, fontSize: g.nome.length > 32 ? 37 : 44, fontWeight: 800, lineHeight: 1.1, marginTop: 24, letterSpacing: g.nome.length > 32 ? "-0.02em" : undefined }}>{g.nome}</div>
          <div style={{ textWrap: "pretty", flex: "none", color: SLATE_600, fontSize: 32, fontWeight: 500, lineHeight: 1.3, marginTop: 8 }}>{g.contenuto}</div>
          <div style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 14, marginTop: 30, background: BRAND_700, color: "white", fontSize: 40, fontWeight: 800, padding: "20px 30px 20px 36px", borderRadius: 14 }}>
            {s.pulsante}
            <Freccia lato={40} />
          </div>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, marginTop: 22, width: "fit-content", background: SAND_50, color: NAVY_800, fontSize: 32, fontWeight: 700, padding: "14px 24px", borderRadius: 14 }}>
            <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={BRAND_700} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
            {s.invito.replace(/^📩\s*/u, "")}
          </div>
        </div>
        <div style={{ position: "absolute", left: 90, right: 90, bottom: 90, borderTop: "2px solid #E2E8F0", paddingTop: 22 }}>
          <div style={{ color: NAVY_800, fontSize: 30, fontWeight: 800, lineHeight: 1.25 }}>Dr. Federico Piazza · Osteopata e fisioterapista</div>
          <div style={{ color: SLATE_500, fontSize: 28, fontWeight: 600, lineHeight: 1.3 }}>{s.studio ? `${s.studio} · ` : ""}@fisioconfede</div>
        </div>
      </AbsoluteFill>
    );
  }

  // F · Chiusura verso lo studio (29/10/2026, Federico): niente "In breve" (la risposta è già nella slide 2), titolo grande
  // col problema evidenziato come in copertina, ritratto scontornato grande su un cerchio sabbia, fondo chiaro
  if (stile === "foto") {
    return (
      <AbsoluteFill style={{ ...base, backgroundColor: "white" }}>
        {/* cerchio e ritratto chiusi nella slide: nel 9:16 il cerchio usciva dai bordi */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -70, bottom: -150, width: 580, height: 580, borderRadius: "50%", background: SAND_50 }} />
          <Img data-ostacolo src={staticFile("ritratto-scontornato.png")} style={{ position: "absolute", right: 14, bottom: 0, height: 556, width: 556 * (1064 / 1478) }} />
        </div>
        <BarraSeServe n={n} tot={tot} />
        <div style={{ position: "absolute", left: 90, right: 90, top: 150 }}>
          <div style={{ textWrap: "pretty", color: NAVY_800, fontSize: rigaPiuLunga(s.titolo) > 20 ? 84 : 100, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.01em", whiteSpace: "pre-line" }}>
            <TitoloEvidenziato testo={s.titolo} evidenza={s.evidenza} />
          </div>
          {s.corpo ? <div style={{ textWrap: "pretty", color: SLATE_600, fontSize: 44, fontWeight: 500, lineHeight: 1.35, marginTop: 26 }}>{s.corpo}</div> : null}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 16, marginTop: 46, background: BRAND_700, color: "white", fontSize: 42, fontWeight: 800, padding: "22px 34px 22px 40px", borderRadius: 16, whiteSpace: "nowrap" }}>
            {s.pulsante}
            <Freccia lato={44} />
          </div>
          {s.studio ? <div style={{ textWrap: "pretty", color: SLATE_600, fontSize: 32, fontWeight: 500, lineHeight: 1.4, marginTop: 22 }}>{s.studio}</div> : null}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginTop: 30, background: SAND_50, color: NAVY_800, fontSize: 32, fontWeight: 700, padding: "16px 24px", borderRadius: 14 }}>
            <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={BRAND_700} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
            {s.invito.replace(/^📩\s*/u, "")}
          </div>
        </div>
        <div style={{ position: "absolute", left: 90, bottom: 100 }}>
          <div style={{ color: NAVY_800, fontSize: 46, fontWeight: 800, lineHeight: 1.15 }}>Dr. Federico Piazza</div>
          <div style={{ color: BRAND_700, fontSize: 32, fontWeight: 700, marginTop: 8 }}>Osteopata e fisioterapista</div>
          <div style={{ color: SLATE_600, fontSize: 30, fontWeight: 600, marginTop: 10 }}>@fisioconfede</div>
        </div>
      </AbsoluteFill>
    );
  }

  // chiusura negli stili di prova "sito" e "navy" (17/10/2026): testo a tutta larghezza in alto, firma in basso
  const scuro = stile === "navy";
  return (
    <AbsoluteFill style={{ ...base, backgroundColor: scuro ? t.sfondo : "white" }}>
      <div style={{ position: "absolute", left: 90, right: 90, top: 110 }}>
        {s.inBreve ? (
          // La risposta alla domanda della copertina, in una riga: è la frase che resta (e che finisce negli screenshot)
          <div style={{ background: NAVY_800, borderRadius: 16, padding: "24px 30px", marginBottom: 36 }}>
            <div style={{ color: AMBER_400, fontSize: 28, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>In breve</div>
            <div style={{ textWrap: "pretty", color: "white", fontSize: 38, fontWeight: 700, lineHeight: 1.28, marginTop: 8 }}>{s.inBreve}</div>
          </div>
        ) : null}
        <div style={{ textWrap: "pretty", color: t.titolo, fontSize: s.inBreve ? 60 : 76, fontWeight: 800, lineHeight: 1.08 }}>{s.titolo}</div>
        <div style={{ textWrap: "pretty", color: t.corpo, fontSize: s.inBreve ? 38 : 42, fontWeight: 500, lineHeight: 1.4, marginTop: s.inBreve ? 22 : 32 }}>{s.corpo}</div>
        <div style={{ display: "inline-block", marginTop: s.inBreve ? 30 : 40, background: scuro ? AMBER_400 : BRAND_700, color: scuro ? NAVY_800 : "white", fontSize: 38, fontWeight: 700, padding: "20px 36px", borderRadius: 14, whiteSpace: "nowrap" }}>
          {s.pulsante}
        </div>
        {s.studio ? <div style={{ textWrap: "pretty", color: t.corpo, fontSize: 32, fontWeight: 500, lineHeight: 1.4, marginTop: 30 }}>{s.studio}</div> : null}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginTop: 30, background: scuro ? t.card : SAND_50, color: t.titolo, fontSize: 32, fontWeight: 700, padding: "16px 24px", borderRadius: 14 }}>
          <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={BRAND_700} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
          {s.invito.replace(/^📩\s*/u, "")}
        </div>
      </div>
      <Cornice n={n} tot={tot} colore={t.debole}>
        <div style={{ position: "absolute", left: 90, bottom: 130, color: t.debole, fontSize: 30, fontWeight: 500 }}>Dr. Federico Piazza · Osteopata e fisioterapista</div>
      </Cornice>
    </AbsoluteFill>
  );
};

// ---- Slide «Cosa fare e cosa evitare» (tipo pratica, 08/11/2026, stile F3) ----
const SegnoTratto: React.FC<{ si: boolean; lato: number; colore: string }> = ({ si, lato, colore }) => (
  <svg width={lato} height={lato} viewBox="0 0 24 24" fill="none" stroke={colore} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
    {si ? <path d="M4 12.5l5 5L20 6.5" /> : (<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>)}
  </svg>
);

// Il disegno di una voce: dai tratti copiati dal catalogo; le icone del componente restano come riserva
const DisegnoPratica: React.FC<{ nome: string; tratti?: Record<string, { viewBox?: string; tratti: string }>; lato: number; colore: string }> = ({ nome, tratti, lato, colore }) => {
  const d = tratti?.[nome];
  if (!d && !(nome in TRATTI)) throw new Error(`Disegno «${nome}» mancante: lancia scripts/carosello-social/disegni.py metti sul dati.json`);
  return (
    <svg width={lato} height={lato} viewBox={d?.viewBox ?? "0 0 24 24"} fill="none" stroke={colore} strokeWidth={d ? 1.8 : 2} strokeLinecap="round" strokeLinejoin="round">
      {d ? <g dangerouslySetInnerHTML={{ __html: d.tratti }} /> : TRATTI[nome as NomeIcona]}
    </svg>
  );
};

// Le due colonne e l'invito a salvare: le usa anche la rubrica «Come funziona» (ComeFunziona.tsx), con il suo fondo e le sue tacche
export const ColonnePratica: React.FC<{ s: Extract<Slide, { tipo: "pratica" }> }> = ({ s }) => {
  const colonna = (si: boolean, p: PartePratica) => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* intestazione: segno e parola, con una riga spessa sotto (blu sotto il Sì, grigia sotto il No) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, borderBottom: `8px solid ${si ? BRAND_700 : "#CBD2DC"}`, paddingBottom: 14 }}>
        <SegnoTratto si={si} lato={44} colore={si ? BRAND_700 : SLATE_500} />
        <div style={{ color: si ? NAVY_800 : SLATE_600, fontSize: 48, fontWeight: 800 }}>{p.titolo}</div>
      </div>
      {p.voci.map((v, i) => (
        <div key={v} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 18, background: si ? BRAND_700 : "white", border: si ? "none" : "4px solid #CBD2DC", borderRadius: 24, padding: si ? "34px 24px" : "30px 20px" }}>
          <div style={{ width: 148, height: 148, borderRadius: 74, background: si ? "rgba(255,255,255,0.16)" : "#EEF0F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DisegnoPratica nome={p.disegni[i]} tratti={s.tratti} lato={104} colore={si ? "white" : SLATE_500} />
          </div>
          <div style={{ textWrap: "balance", color: si ? "white" : SLATE_600, fontSize: 36, fontWeight: 650, lineHeight: 1.22 }}>{lega(v)}</div>
        </div>
      ))}
    </div>
  );
  return (
    <>
      <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
        {colonna(true, s.si)}
        {colonna(false, s.no)}
      </div>
      {s.nota ? (
        <div style={{ alignSelf: "flex-start", marginTop: 26, background: AMBER_100, color: NAVY_800, fontSize: 30, fontWeight: 700, padding: "12px 22px", borderRadius: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={NAVY_800} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
          {s.nota.replace(/\s*🔖\s*$/u, "")}
        </div>
      ) : null}
    </>
  );
};

const Pratica: React.FC<{ s: Extract<Slide, { tipo: "pratica" }>; t: ReturnType<typeof tema>; n: number; tot: number; base: React.CSSProperties }> = ({ s, t, n, tot, base }) => (
  <AbsoluteFill style={base}>
    <Cornice n={n} tot={tot} colore={t.debole}>
      <Contenuto>
        <div style={{ textWrap: "pretty", color: t.titolo, fontSize: 64, fontWeight: 800, lineHeight: 1.1, marginBottom: 36 }}>{s.titolo}</div>
        <ColonnePratica s={s} />
      </Contenuto>
    </Cornice>
  </AbsoluteFill>
);
