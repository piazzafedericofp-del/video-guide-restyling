import { loadFont } from "@remotion/fonts";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Img, staticFile, useCurrentFrame } from "remotion";

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
export type NomeIcona = "letto" | "cammina" | "posizione" | "casa" | "pillola" | "clessidra" | "pesi" | "telefono";
export type Illustrazione =
  | { tipo: "pittogramma"; su: number; totale: number }
  | { tipo: "confronto"; a: { icona: NomeIcona; testo: string; esito?: string }; b: { icona: NomeIcona; testo: string; esito: string } }
  // Risultato che cambia nel tempo (fascite 23/10: "meglio prima, non di più" non si capiva con il confronto):
  // una scheda per controllo, i due gruppi in ogni scheda, evidenziato quello che sta meglio (nessuno se pari).
  | { tipo: "tempi"; a: string; b: string; tappe: { quando: string; esito: string; meglio?: "a" | "b" }[] };

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

export type Slide =
  | { tipo: "copertina"; occhiello: string; titolo: string; evidenza: string; sotto: string; foto?: string; fotoIA?: boolean }
  | { tipo: "testo"; titolo: string; corpo: string }
  | { tipo: "dato"; etichetta: string; numero?: string; frase: string; nota: string; fonte: string; illustrazione?: Illustrazione }
  | { tipo: "lista"; titolo: string; segno: "si" | "no" | "attenzione"; voci: string[]; nota?: string; icone?: NomeIcona[] }
  | { tipo: "chiusura"; titolo: string; corpo: string; pulsante: string; studio: string; invito: string };

// avanzamento: "numeri" (n/8 in basso) o "barra" (barra sottile in alto).
// controllo: scrive nella console di render misure, colori e posizione di ogni testo
// (le legge scripts/controlla-carosello.py).
// verticale: versione 9:16 per TikTok (1080x1920). La slide 4:5 è ridotta a 0,9 e messa nella zona
// che l'interfaccia di TikTok lascia libera (testi tra x 90–900 e y 250–1420, come nei Reel).
// firma: piccola firma (ritratto intero in tessera + nome e titolo) in basso nelle slide interne, al posto di
// @fisioconfede. Approvata da Federico il 23/10/2026: il titolo "Dr. … osteopata e fisioterapista" pesa più della foto.
export type CaroselloProps = { stile: Stile; slide: Slide[]; avanzamento?: "numeri" | "barra"; controllo?: boolean; verticale?: boolean; firma?: boolean };

const SCALA_VERTICALE = 0.9;

const Avanzamento = createContext<{ barra: boolean; scuro: boolean; firma: boolean }>({ barra: false, scuro: false, firma: false });

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
const Barra: React.FC<{ n: number; tot: number; scuro: boolean; suFoto?: boolean }> = ({ n, tot, scuro, suFoto }) => (
  <div style={{ position: "absolute", left: 90, right: 90, top: 48, height: 8, borderRadius: 4, background: suFoto ? "rgba(11,36,71,0.45)" : scuro ? "rgba(255,255,255,0.3)" : "rgba(11,36,71,0.12)" }}>
    <div style={{ width: `${(n / tot) * 100}%`, height: "100%", borderRadius: 4, background: scuro ? AMBER_400 : BRAND_700 }} />
  </div>
);

// Ritratti della firma: nessun testo deve finirci sopra (fascite 23/10: la fonte toccava la tessera).
const misuraOstacoli = () =>
  Array.from(document.querySelectorAll("[data-ostacolo]")).map((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });

// Raccoglie ogni testo visibile: dimensione, peso, colore e riquadro reale delle lettere.
const misuraTesti = () => {
  const voci: { testo: string; px: number; peso: number; colore: string; x: number; y: number; w: number; h: number; blocco: number }[] = [];
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
        voci.push({ testo: testo.slice(0, 40), px: parseFloat(st.fontSize), peso: parseInt(st.fontWeight, 10), colore: st.color, x: r.left, y: r.top, w: r.width, h: r.height, blocco: blocchi.get(b)! });
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
const ConEvidenza: React.FC<{ testo: string; evidenza: string; colore: string }> = ({ testo, evidenza, colore }) => {
  const i = testo.indexOf(evidenza);
  if (i < 0) return <>{testo}</>;
  return (
    <>
      {testo.slice(0, i)}
      <span style={{ color: colore }}>{evidenza}</span>
      {testo.slice(i + evidenza.length)}
    </>
  );
};

const Cornice: React.FC<{ n: number; tot: number; colore: string; scuro?: boolean; suFoto?: boolean; children: React.ReactNode }> = ({ n, tot, colore, scuro, suFoto, children }) => {
  const av = useContext(Avanzamento);
  return (
    <>
      {children}
      {av.barra ? <Barra n={n} tot={tot} scuro={scuro ?? av.scuro} suFoto={suFoto} /> : null}
      {av.firma && n > 1 ? (
        <Firma coloreNome={av.scuro ? "white" : NAVY_800} colore={colore} />
      ) : (
        <div style={{ position: "absolute", left: 90, bottom: 64, fontSize: 28, fontWeight: 600, color: colore }}>@fisioconfede</div>
      )}
      {n < tot && !av.barra ? (
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
  const contenuto = <Slide1 {...props} />;
  return (
    <Avanzamento.Provider value={{ barra: props.avanzamento === "barra", scuro: props.stile === "navy", firma: !!props.firma }}>
      {props.verticale ? (
        <AbsoluteFill style={{ backgroundColor: sfondoSlide(props, frame) }}>
          <div style={{ position: "absolute", left: 9, top: 210, width: 1080, height: 1350, transform: `scale(${SCALA_VERTICALE})`, transformOrigin: "0 0" }}>
            {contenuto}
          </div>
        </AbsoluteFill>
      ) : (
        contenuto
      )}
    </Avanzamento.Provider>
  );
};

// Colore che riempie lo schermo 9:16 attorno alla slide: lo stesso del suo sfondo.
const sfondoSlide = ({ stile, slide }: CaroselloProps, frame: number) => {
  const s = slide[Math.min(frame, slide.length - 1)];
  const n = frame + 1;
  if (s.tipo === "copertina" && stile === "foto" && s.foto) return NAVY_800;
  if (s.tipo === "chiusura") return stile === "navy" ? tema(stile, n % 2 === 0).sfondo : "white";
  return tema(stile, n % 2 === 0).sfondo;
};

const Slide1: React.FC<CaroselloProps> = ({ stile, slide }) => {
  const frame = useCurrentFrame();
  const s = slide[Math.min(frame, slide.length - 1)];
  const n = frame + 1;
  const tot = slide.length;
  const t = tema(stile, n % 2 === 0);
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
        {s.fotoIA ? (
          <div style={{ position: "absolute", left: 90, top: 80, color: "white", fontSize: 28, fontWeight: 600, background: "rgba(11,36,71,0.75)", padding: "8px 18px", borderRadius: 30 }}>
            Immagine generata con IA
          </div>
        ) : null}
        <Cornice n={n} tot={tot} colore="#CED3DA" scuro suFoto>
          <div style={{ position: "absolute", left: 90, right: 90, bottom: 140 }}>
            <div style={{ display: "inline-block", background: AMBER_400, color: NAVY_800, fontSize: 30, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "10px 20px", borderRadius: 8, marginBottom: 30 }}>
              {s.occhiello}
            </div>
            <div style={{ color: "white", fontSize: 100, fontWeight: 800, lineHeight: 1.04, whiteSpace: "pre-line" }}>
              <ConEvidenza testo={s.titolo} evidenza={s.evidenza} colore={AMBER_400} />
            </div>
            <div style={{ color: "#E2E8F0", fontSize: 36, fontWeight: 500, lineHeight: 1.35, marginTop: 30 }}>{s.sotto}</div>
          </div>
          <div style={{ position: "absolute", right: 90, top: 80, color: "white", fontSize: 30, fontWeight: 700, background: "rgba(11,36,71,0.75)", padding: "10px 22px", borderRadius: 40 }}>Scorri →</div>
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
            <div style={{ color: t.titolo, fontSize: 132, fontWeight: 800, lineHeight: 1.02, whiteSpace: "pre-line" }}>
              <ConEvidenza testo={s.titolo} evidenza={s.evidenza} colore={scuro ? AMBER_400 : BRAND_700} />
            </div>
            <div style={{ color: t.corpo, fontSize: 40, fontWeight: 500, lineHeight: 1.35, marginTop: 44, maxWidth: 820 }}>{s.sotto}</div>
          </div>
          <div style={{ position: "absolute", right: 90, bottom: 150, color: scuro ? NAVY_800 : "white", background: scuro ? AMBER_400 : BRAND_700, fontSize: 32, fontWeight: 700, padding: "16px 30px", borderRadius: 50 }}>
            Scorri →
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
            <div style={{ color: t.titolo, fontSize: 76, fontWeight: 800, lineHeight: 1.1 }}>{s.titolo}</div>
            <div style={{ width: 120, height: 10, background: AMBER_400, borderRadius: 5, margin: "48px 0" }} />
            <div style={{ color: t.corpo, fontSize: 44, fontWeight: 500, lineHeight: 1.4 }}>{s.corpo}</div>
          </div>
        </Cornice>
      </AbsoluteFill>
    );
  }

  if (s.tipo === "dato") {
    const pitto = s.illustrazione?.tipo === "pittogramma" ? s.illustrazione : null;
    const conf = s.illustrazione?.tipo === "confronto" ? s.illustrazione : null;
    const tempi = s.illustrazione?.tipo === "tempi" ? s.illustrazione : null;
    return (
      <AbsoluteFill style={base}>
        <Cornice n={n} tot={tot} colore={t.debole}>
          <div style={{ position: "absolute", left: 90, right: 90, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: t.accento, fontSize: 30, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 28 }}>{s.etichetta}</div>
            {s.numero ? (
              <div style={{ color: t.accento, fontSize: pitto ? 136 : 200, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", marginBottom: 30 }}>{s.numero}</div>
            ) : null}
            {pitto ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(20, 45px)", rowGap: 0, marginBottom: 30 }}>
                {Array.from({ length: pitto.totale }, (_, i) => (
                  <Omino key={i} lato={36} colore={i < pitto.su ? AMBER_400 : "#C5CEDA"} />
                ))}
              </div>
            ) : null}
            <div style={{ color: t.titolo, fontSize: s.numero ? 56 : 66, fontWeight: 750, lineHeight: 1.18 }}>{s.frase}</div>
            {conf ? (
              <div style={{ display: "flex", alignItems: "stretch", gap: 24, marginTop: 44 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 20, background: t.card, borderRadius: 14, padding: "22px 26px" }}>
                  <Icona nome={conf.a.icona} lato={64} colore={SLATE_500} />
                  <div>
                    <div style={{ color: SLATE_600, fontSize: 34, fontWeight: 700 }}>{conf.a.testo}</div>
                    {conf.a.esito ? <div style={{ color: SLATE_600, fontSize: 28, fontWeight: 600, marginTop: 4 }}>{conf.a.esito}</div> : null}
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 20, background: "#E3EEFB", borderRadius: 14, padding: "22px 26px" }}>
                  <Icona nome={conf.b.icona} lato={64} colore={BRAND_700} />
                  <div>
                    <div style={{ color: NAVY_800, fontSize: 34, fontWeight: 800 }}>{conf.b.testo}</div>
                    <div style={{ color: "#0A57AD", fontSize: 28, fontWeight: 700, marginTop: 4 }}>{conf.b.esito}</div>
                  </div>
                </div>
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
                          <div style={{ color: avanti ? NAVY_800 : SLATE_600, fontSize: 32, fontWeight: avanti ? 800 : 600 }}>{tempi[g]}</div>
                          {avanti ? (
                            <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={BRAND_700} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
                          ) : tp.meglio ? null : (
                            <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={SLATE_500} strokeWidth={3} strokeLinecap="round"><path d="M5 9h14" /><path d="M5 15h14" /></svg>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ color: NAVY_800, fontSize: 30, fontWeight: 800, marginTop: 4 }}>{tp.esito}</div>
                  </div>
                ))}
              </div>
            ) : null}
            <div style={{ background: t.card, borderLeft: `8px solid ${AMBER_400}`, borderRadius: 12, padding: "28px 32px", marginTop: 48, color: t.titolo, fontSize: 38, fontWeight: 600, lineHeight: 1.35 }}>
              {s.nota}
            </div>
            <div style={{ color: t.debole, fontSize: 28, fontWeight: 500, lineHeight: 1.4, marginTop: 40 }}>Fonte: {s.fonte}</div>
          </div>
        </Cornice>
      </AbsoluteFill>
    );
  }

  if (s.tipo === "lista") {
    const coloreSegno = s.segno === "attenzione" ? AMBER_400 : s.segno === "no" ? t.debole : t.accento;
    const lunga = s.voci.length > 4;
    return (
      <AbsoluteFill style={base}>
        <Cornice n={n} tot={tot} colore={t.debole}>
          <div style={{ position: "absolute", left: 90, right: 90, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: t.titolo, fontSize: 70, fontWeight: 800, lineHeight: 1.1, marginBottom: lunga ? 40 : 56 }}>{s.titolo}</div>
            {s.voci.map((v, i) => (
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
                <div style={{ flex: "0 0 auto", width: 60, height: 60, borderRadius: 30, background: coloreSegno, color: s.segno === "attenzione" || stile === "navy" ? NAVY_800 : "white", fontSize: 36, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                  {SEGNI[s.segno]}
                </div>
                )}
                <div style={{ color: t.titolo, fontSize: lunga ? 38 : 42, fontWeight: 600, lineHeight: 1.3 }}>{v}</div>
              </div>
            ))}
            {s.nota ? (
              <div style={{ alignSelf: "flex-start", marginTop: 20, background: stile === "navy" ? "rgba(251,191,36,0.15)" : AMBER_100, color: stile === "navy" ? AMBER_400 : NAVY_800, fontSize: 32, fontWeight: 700, padding: "14px 24px", borderRadius: 10 }}>
                {s.nota}
              </div>
            ) : null}
          </div>
        </Cornice>
      </AbsoluteFill>
    );
  }

  // chiusura: testo a tutta larghezza in alto, firma con ritratto in basso (stile foto)
  const conRitratto = stile === "foto";
  const scuro = stile === "navy";
  return (
    <AbsoluteFill style={{ ...base, backgroundColor: scuro ? t.sfondo : "white" }}>
      <div style={{ position: "absolute", left: 90, right: 90, top: 120 }}>
        <div style={{ color: t.titolo, fontSize: 76, fontWeight: 800, lineHeight: 1.08 }}>{s.titolo}</div>
        <div style={{ color: t.corpo, fontSize: 42, fontWeight: 500, lineHeight: 1.4, marginTop: 32 }}>{s.corpo}</div>
        <div style={{ display: "inline-block", marginTop: 40, background: scuro ? AMBER_400 : BRAND_700, color: scuro ? NAVY_800 : "white", fontSize: 38, fontWeight: 700, padding: "20px 36px", borderRadius: 14, whiteSpace: "nowrap" }}>
          {s.pulsante}
        </div>
        <div style={{ color: t.titolo, fontSize: 36, fontWeight: 600, lineHeight: 1.4, marginTop: 44 }}>{s.studio}</div>
        <div style={{ display: "inline-block", marginTop: 36, background: scuro ? t.card : SAND_50, color: t.titolo, fontSize: 34, fontWeight: 700, padding: "18px 26px", borderRadius: 14 }}>
          {s.invito}
        </div>
      </div>
      {conRitratto ? (
        <>
          <BarraSeServe n={n} tot={tot} />
          <div style={{ position: "absolute", left: 90, right: 90, top: 905, height: 3, background: SAND_50 }} />
          <Img data-ostacolo src={staticFile("ritratto.png")} style={{ position: "absolute", left: 70, bottom: 0, height: 420, width: 420 * (1064 / 1478) }} />
          <div style={{ position: "absolute", left: 420, right: 90, bottom: 110 }}>
            <div style={{ color: NAVY_800, fontSize: 44, fontWeight: 800 }}>Dr. Federico Piazza</div>
            <div style={{ color: BRAND_700, fontSize: 32, fontWeight: 700, marginTop: 8 }}>Osteopata e fisioterapista</div>
            <div style={{ color: SLATE_500, fontSize: 30, fontWeight: 500, marginTop: 14 }}>Firenze · Figline Valdarno</div>
            <div style={{ color: SLATE_500, fontSize: 30, fontWeight: 600, marginTop: 6 }}>@fisioconfede</div>
          </div>
        </>
      ) : (
        <Cornice n={n} tot={tot} colore={t.debole}>
          <div style={{ position: "absolute", left: 90, bottom: 130, color: t.debole, fontSize: 30, fontWeight: 500 }}>Dr. Federico Piazza · Osteopata e fisioterapista</div>
        </Cornice>
      )}
    </AbsoluteFill>
  );
};
