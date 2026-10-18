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

export type Slide =
  | { tipo: "copertina"; occhiello: string; titolo: string; evidenza: string; sotto: string; foto?: string; fotoIA?: boolean }
  | { tipo: "testo"; titolo: string; corpo: string }
  | { tipo: "dato"; etichetta: string; numero?: string; frase: string; nota: string; fonte: string }
  | { tipo: "lista"; titolo: string; segno: "si" | "no" | "attenzione"; voci: string[]; nota?: string }
  | { tipo: "chiusura"; titolo: string; corpo: string; pulsante: string; studio: string; invito: string };

// avanzamento: "numeri" (n/8 in basso) o "barra" (barra sottile in alto).
// controllo: scrive nella console di render misure, colori e posizione di ogni testo
// (le legge scripts/controlla-carosello.py).
// verticale: versione 9:16 per TikTok (1080x1920). La slide 4:5 è ridotta a 0,9 e messa nella zona
// che l'interfaccia di TikTok lascia libera (testi tra x 90–900 e y 250–1420, come nei Reel).
export type CaroselloProps = { stile: Stile; slide: Slide[]; avanzamento?: "numeri" | "barra"; controllo?: boolean; verticale?: boolean };

const SCALA_VERTICALE = 0.9;

const Avanzamento = createContext<{ barra: boolean; scuro: boolean }>({ barra: false, scuro: false });

// Barra di avanzamento sottile in alto, senza numeri (scelta di Federico 17/10 sul confronto numeri/barra).
// suFoto: binario scuro trasparente, perché sul muro chiaro della foto quello bianco sparisce.
const Barra: React.FC<{ n: number; tot: number; scuro: boolean; suFoto?: boolean }> = ({ n, tot, scuro, suFoto }) => (
  <div style={{ position: "absolute", left: 90, right: 90, top: 48, height: 8, borderRadius: 4, background: suFoto ? "rgba(11,36,71,0.45)" : scuro ? "rgba(255,255,255,0.3)" : "rgba(11,36,71,0.12)" }}>
    <div style={{ width: `${(n / tot) * 100}%`, height: "100%", borderRadius: 4, background: scuro ? AMBER_400 : BRAND_700 }} />
  </div>
);

// Raccoglie ogni testo visibile: dimensione, peso, colore e riquadro reale delle lettere.
const misuraTesti = () => {
  const voci: { testo: string; px: number; peso: number; colore: string; x: number; y: number; w: number; h: number }[] = [];
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
        voci.push({ testo: testo.slice(0, 40), px: parseFloat(st.fontSize), peso: parseInt(st.fontWeight, 10), colore: st.color, x: r.left, y: r.top, w: r.width, h: r.height });
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
      <div style={{ position: "absolute", left: 90, bottom: 64, fontSize: 28, fontWeight: 600, color: colore }}>@fisioconfede</div>
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
      console.log("CONTROLLO " + JSON.stringify({ slide: frame, scala: props.verticale ? SCALA_VERTICALE : 1, verticale: !!props.verticale, voci: misuraTesti() }));
      continueRender(attesa);
    });
  }, [attesa, frame, props.verticale]);
  const contenuto = <Slide1 {...props} />;
  return (
    <Avanzamento.Provider value={{ barra: props.avanzamento === "barra", scuro: props.stile === "navy" }}>
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
        <Cornice n={n} tot={tot} colore="rgba(255,255,255,0.8)" scuro suFoto>
          <div style={{ position: "absolute", left: 90, right: 90, bottom: 140 }}>
            <div style={{ display: "inline-block", background: AMBER_400, color: NAVY_800, fontSize: 30, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "10px 20px", borderRadius: 8, marginBottom: 30 }}>
              {s.occhiello}
            </div>
            <div style={{ color: "white", fontSize: 100, fontWeight: 800, lineHeight: 1.04, whiteSpace: "pre-line" }}>
              <ConEvidenza testo={s.titolo} evidenza={s.evidenza} colore={AMBER_400} />
            </div>
            <div style={{ color: "#E2E8F0", fontSize: 36, fontWeight: 500, lineHeight: 1.35, marginTop: 30 }}>{s.sotto}</div>
          </div>
          <div style={{ position: "absolute", right: 90, top: 80, color: "white", fontSize: 30, fontWeight: 700, background: "rgba(11,36,71,0.6)", padding: "10px 22px", borderRadius: 40 }}>Scorri →</div>
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
    return (
      <AbsoluteFill style={base}>
        <Cornice n={n} tot={tot} colore={t.debole}>
          <div style={{ position: "absolute", left: 90, right: 90, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: t.accento, fontSize: 30, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 28 }}>{s.etichetta}</div>
            {s.numero ? (
              <div style={{ color: t.accento, fontSize: 200, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", marginBottom: 30 }}>{s.numero}</div>
            ) : null}
            <div style={{ color: t.titolo, fontSize: s.numero ? 56 : 66, fontWeight: 750, lineHeight: 1.18 }}>{s.frase}</div>
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
            {s.voci.map((v) => (
              <div key={v} style={{ display: "flex", gap: 28, alignItems: "flex-start", marginBottom: lunga ? 24 : 34 }}>
                <div style={{ flex: "0 0 auto", width: 60, height: 60, borderRadius: 30, background: coloreSegno, color: s.segno === "attenzione" || stile === "navy" ? NAVY_800 : "white", fontSize: 36, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                  {SEGNI[s.segno]}
                </div>
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
          <Img src={staticFile("ritratto.png")} style={{ position: "absolute", left: 70, bottom: 0, height: 420, width: 420 * (1064 / 1478) }} />
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
