import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Carosello, durataAnimata, lega, NumeroLegenda, OMINO_GRIGIO, type CaroselloProps, type Slide } from "./Carosello";
import { durataTavola, Omino, SCALA_VERTICALE, useDisegni, type SlideTavola } from "./Tavole";

// Rubrica «Come funziona» (skill carosello-social, variante «Come funziona»): l'articolo del blog in carosello, con le
// sue tavole. Stile «lente» scelto da Federico il 03/11/2026 tra tre prove del laboratorio di video-studio
// (src/laboratorio/caroselloTavole/ComeFunziona.tsx): fondo bianco, avanzamento a tacche, numero del passo nel cerchio blu,
// in copertina il corpo con il cerchio ambra sulla zona e la struttura ingrandita nella lente (il segno che nella griglia
// del profilo la distingue da «Cosa dicono gli studi»). Testi ≥ 28 px, contrasto, margini e firma con data-ostacolo come
// in Carosello.tsx. Copertina senza disegni (foto IA) e slide che lo stile non prevede: le disegna Carosello.tsx.
// Copia identica in video-studio/src/ e in federicopiazza.com/scripts/carosello-social/.
export const COME_FUNZIONA = "come-funziona";

const NAVY_800 = "#0B2447";
const BRAND_700 = "#0B6BD3";
const SAND_50 = "#F7F3EC";
const SLATE_600 = "#475569";
const SLATE_500 = "#5B6472";
const AMBER_400 = "#FBBF24";

export type MiniDisegno = { svg: string; tempo: number; inquadratura?: string; lente?: string };
// Copertina con i disegni: il corpo con la lente (disegni[0], con "lente" = "cx cy r") e la struttura ingrandita
// (disegni[1]); filo = il disegno piccolo che torna nella slide 2. Senza disegni è la copertina con la foto IA.
export type CopertinaCome = Extract<Slide, { tipo: "copertina" }> & { disegni?: MiniDisegno[]; filo?: MiniDisegno };
// "salva" (03/11/2026): l'invito a salvare sulla slide del dato, senza una slide di riepilogo
export type DatoCome = Extract<Slide, { tipo: "dato" }> & { salva?: string };
// "segni" (04/11/2026, sciatica): nel riaggancio i segni concreti per riconoscere il problema, con la fonte
export type TestoCome = Extract<Slide, { tipo: "testo" }> & { segni?: { titolo: string; voci: string[]; fonte?: string } };
export type SlideCome = Exclude<Slide, { tipo: "copertina" | "dato" | "testo" }> | CopertinaCome | DatoCome | TestoCome | SlideTavola;
export type PropsCome = { slide: SlideCome[]; controllo?: boolean; verticale?: boolean; animato?: boolean; indice?: number; storia?: boolean };

// Carosello di una rubrica: «Come funziona» nel suo stile, tutto il resto («Cosa dicono gli studi») in Carosello.tsx
export type PropsRubrica = Omit<CaroselloProps, "slide"> & { rubrica?: string; slide: SlideCome[] };
export const CaroselloRubrica: React.FC<PropsRubrica> = ({ rubrica, ...props }) =>
  rubrica === COME_FUNZIONA ? <ComeFunziona {...props} /> : <Carosello {...props} slide={props.slide as Slide[]} />;

// Slide che su Instagram escono in video: il passaggio della tavola che è un movimento e la chiusura con la guida
export const durataRubrica = (rubrica: string | undefined, s: SlideCome) =>
  rubrica !== COME_FUNZIONA ? durataAnimata(s as Slide)
  : s.tipo === "tavola" ? durataTavola(s)
  : s.tipo === "chiusura" && s.guida ? durataAnimata(s)
  : 0;

type Tema = { sfondo: string; titolo: string; corpo: string; debole: string; etichetta: string; numero: string; carta: string; bordo: string; scuro: boolean };
const LENTE: Tema = { sfondo: "white", titolo: NAVY_800, corpo: SLATE_600, debole: SLATE_500, etichetta: BRAND_700, numero: BRAND_700, carta: SAND_50, bordo: "#E2E8F0", scuro: false };
// sicurezza: cambia registro rispetto alle altre slide (navy)
const SICUREZZA: Tema = { sfondo: NAVY_800, titolo: "white", corpo: "#CBD5E1", debole: "#A7B4C6", etichetta: "#8DB8EA", numero: "#8DB8EA", carta: "rgba(255,255,255,0.07)", bordo: "rgba(255,255,255,0.16)", scuro: true };

const CSS_MINI = ".mini text, .mini .lead, .mini .banda, .mini .banda-l { display: none } .mini svg { overflow: hidden }"; // i piccoli restano dentro la loro inquadratura

// Una frase per riga (Inclusion Europe e Anffas; ricerca del 03/11/2026): ogni frase comincia a capo, così si va a capo
// dove si fa la pausa leggendo; "pretty" evita che una riga finisca con una parola sola
const perRighe = (t: string) => t.replace(/([.?!])\s+(?=\S)/g, "$1\n");
const RIGHE: React.CSSProperties = { whiteSpace: "pre-line", textWrap: "pretty" as React.CSSProperties["textWrap"] };

const passoDi = (etichetta: string) => {
  const m = etichetta.match(/^(\d+)\s*·\s*(.*)$/);
  return m ? { n: m[1], nome: m[2] } : { n: "", nome: etichetta };
};

// Titolo con le righe del problema su un blocco ambra (come la copertina "pulita" del 29/10/2026)
const TitoloEvidenza: React.FC<{ testo: string; evidenza?: string }> = ({ testo, evidenza }) => {
  if (!evidenza) return <>{testo}</>;
  const righe = testo.split("\n");
  const ev = evidenza.split("\n");
  if (ev.every((r, i) => r === righe[i])) {
    return (<>{righe.map((r, i) => (
      <React.Fragment key={i}>{i > 0 ? <br /> : null}{i < ev.length ? <span style={{ color: NAVY_800, background: AMBER_400, padding: "0 14px", margin: "0 -14px", borderRadius: 8 }}>{r}</span> : r}</React.Fragment>
    ))}</>);
  }
  const i = testo.indexOf(evidenza);
  if (i < 0) return <>{testo}</>;
  return <>{testo.slice(0, i)}<span style={{ color: NAVY_800, background: AMBER_400, padding: "0 10px", borderRadius: 8 }}>{evidenza}</span>{testo.slice(i + evidenza.length)}</>;
};

// a tacche: una per slide, si vede quanto manca (non nella storia: si confonderebbe con la barra dell'app)
const Avanzamento: React.FC<{ n: number; tot: number }> = ({ n, tot }) => (
  <div style={{ position: "absolute", left: 90, right: 90, top: 46, display: "flex", gap: 8 }}>
    {Array.from({ length: tot }, (_, i) => <div key={i} style={{ flex: 1, height: 10, borderRadius: 5, background: i < n ? BRAND_700 : "#E2E8F0" }} />)}
  </div>
);

const Firma: React.FC<{ t: Tema }> = ({ t }) => (
  <div style={{ position: "absolute", left: 90, right: 90, bottom: 52, display: "flex", alignItems: "center", gap: 24 }}>
    <div data-ostacolo style={{ width: 118, height: 152, borderRadius: 14, overflow: "hidden", background: "white", border: `2px solid ${t.scuro ? "rgba(255,255,255,0.3)" : "#E2E8F0"}`, flex: "0 0 auto" }}>
      <Img src={staticFile("ritratto.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 100%" }} />
    </div>
    <div>
      <div style={{ color: t.titolo, fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}>Dr. Federico Piazza</div>
      <div style={{ color: t.debole, fontSize: 28, fontWeight: 600, lineHeight: 1.3 }}>Osteopata e fisioterapista · @fisioconfede</div>
    </div>
  </div>
);

// Pagina comune: fondo, stili del kit, avanzamento, firma (slide 2-7), 9:16 per TikTok
const Pagina: React.FC<{ t: Tema; n: number; tot: number; firma: boolean; storia?: boolean; verticale?: boolean; kit: { css: string; defs: string } | null; radice: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }> = ({ t, n, tot, firma, storia, verticale, kit, radice, children }) => {
  const slide = (
    <AbsoluteFill ref={radice} style={{ backgroundColor: t.sfondo, fontFamily: "Inter", letterSpacing: "-0.01em", ["--sfondo" as string]: t.sfondo }}>
      {kit ? <style>{kit.css + CSS_MINI}</style> : null}
      {kit ? <div dangerouslySetInnerHTML={{ __html: kit.defs }} /> : null}
      {storia ? null : <Avanzamento n={n} tot={tot} />}
      {children}
      {firma ? <Firma t={t} /> : null}
    </AbsoluteFill>
  );
  return verticale ? (
    <AbsoluteFill style={{ backgroundColor: t.sfondo }}>
      <div style={{ position: "absolute", left: 9, top: 210, width: 1080, height: 1350, transform: `scale(${SCALA_VERTICALE})`, transformOrigin: "0 0" }}>{slide}</div>
    </AbsoluteFill>
  ) : slide;
};

const Colonna: React.FC<{ alto?: number; basso?: number; children: React.ReactNode }> = ({ alto = 96, basso = 220, children }) => (
  <div style={{ position: "absolute", left: 90, right: 90, top: alto, bottom: basso, display: "flex", flexDirection: "column" }}>{children}</div>
);

// Riquadro di un disegno: l'SVG lo inserisce e lo adatta useDisegni (data-disegno), "mini" toglie le scritte
const Disegno: React.FC<{ html?: string; mini?: boolean; inquadratura?: string; lente?: string; scritte?: number; style?: React.CSSProperties }> = ({ html, mini, inquadratura, lente, scritte, style }) => (
  <div data-disegno data-inquadratura={inquadratura} data-lente={lente} data-scritte-min={scritte} className={mini ? "mini" : undefined}
    style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, ...style }}
    dangerouslySetInnerHTML={html ? { __html: html } : undefined} />
);

const IconaSalva: React.FC = () => (
  <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={NAVY_800} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
);

// Le slide che lo stile non disegna (copertina con la foto IA, chiusura verso lo studio, confronti…) le fa Carosello.tsx
const daCarosello = (s: SlideCome) =>
  (s.tipo === "copertina" && !s.disegni?.length) || (s.tipo === "chiusura" && !s.guida) || !["copertina", "testo", "tavola", "dato", "lista", "chiusura"].includes(s.tipo);

export const ComeFunziona: React.FC<PropsCome> = (props) => {
  const frame = useCurrentFrame();
  const indice = props.indice ?? Math.min(frame, props.slide.length - 1);
  const s = props.slide[indice];
  if (daCarosello(s)) return <Carosello stile="foto" avanzamento="barra" firma {...props} slide={props.slide as Slide[]} indice={indice} />;
  return <SlideLente {...props} indice={indice} />;
};

const SlideLente: React.FC<PropsCome & { indice: number }> = ({ slide, verticale, controllo, animato, storia, indice }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = slide[indice];
  const n = indice + 1;
  const tot = slide.length;
  const t = s.tipo === "lista" && s.segno === "attenzione" ? SICUREZZA : LENTE;
  const cop = slide[0] as CopertinaCome;

  // tutti i disegni della slide, con il loro tempo
  const mini: MiniDisegno[] =
    s.tipo === "copertina" ? s.disegni ?? []
    : s.tipo === "tavola" ? [{ svg: s.svg, tempo: animato && s.anima ? s.anima.da + Math.min(frame / fps, s.anima.a - s.anima.da) : s.tempo }]
    : s.tipo === "testo" && cop.filo ? [cop.filo]
    : [];
  const { dati, radice } = useDisegni(mini.map((m) => m.svg), mini.map((m) => m.tempo), { controllo, indice, verticale });
  const svg = (i: number) => dati?.svg[i];
  const pagina = (firma: boolean, children: React.ReactNode, tema: Tema = t) => (
    <Pagina t={tema} n={n} tot={tot} firma={firma} storia={storia} verticale={verticale} kit={dati} radice={radice}>{children}</Pagina>
  );

  // ── A · Copertina: il corpo con il cerchio ambra sulla zona e la lente con la struttura ingrandita
  if (s.tipo === "copertina" && s.disegni) {
    const [corpo, lente] = s.disegni;
    return pagina(false, (
      <>
        <Colonna alto={100} basso={110}>
          <div style={{ alignSelf: "flex-start", color: NAVY_800, border: "2px solid rgba(11,36,71,0.35)", fontSize: 28, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 16px", borderRadius: 8 }}>{s.occhiello}</div>
          <div style={{ color: t.titolo, fontSize: 92, fontWeight: 800, lineHeight: 1.12, whiteSpace: "pre-line", marginTop: 30 }}><TitoloEvidenza testo={s.titolo} evidenza={s.evidenza} /></div>
          <div style={{ color: t.corpo, fontSize: 36, fontWeight: 500, lineHeight: 1.35, marginTop: 26, ...RIGHE }}>{s.sotto}</div>
          {/* Misure fisse (riquadro 900×560) perché la linea che unisce cerchio e lente cada giusta */}
          <div style={{ position: "absolute", left: 0, top: 560, width: 900, height: 560 }}>
            <Disegno html={svg(0)} mini inquadratura={corpo.inquadratura} lente={corpo.lente} style={{ position: "absolute", left: 0, top: 0, width: 330, height: 560, maskImage: "linear-gradient(to bottom, black 70%, transparent 92%)", WebkitMaskImage: "linear-gradient(to bottom, black 70%, transparent 92%)" }} />
            <svg width={900} height={560} style={{ position: "absolute", left: 0, top: 0 }} aria-hidden>
              <line x1={218} y1={186} x2={386} y2={224} stroke={NAVY_800} strokeWidth={6} strokeLinecap="round" />
            </svg>
            {lente ? (
              <div style={{ position: "absolute", left: 380, top: 20, width: 520, height: 520, borderRadius: "50%", background: "white", border: `8px solid ${NAVY_800}`, overflow: "hidden", display: "flex" }}>
                <Disegno html={svg(1)} mini inquadratura={lente.inquadratura} style={{ flex: "1 1 0", margin: 56 }} />
              </div>
            ) : null}
          </div>
        </Colonna>
        <div style={{ position: "absolute", left: 90, bottom: 64, color: t.debole, fontSize: 28, fontWeight: 600 }}>@fisioconfede</div>
      </>
    ));
  }

  // ── B · La risposta subito, con il disegno della copertina in piccolo (filo con la slide 1) e i segni per riconoscerlo
  if (s.tipo === "testo") {
    return pagina(true, (
      <Colonna>
        {cop.filo ? <Disegno html={svg(0)} mini inquadratura={cop.filo.inquadratura} style={{ height: 300, flex: "none", marginTop: 10 }} /> : null}
        <div style={{ color: t.titolo, fontSize: 70, fontWeight: 800, lineHeight: 1.1, marginTop: 30 }}>{s.titolo}</div>
        <div style={{ width: 120, height: 10, background: AMBER_400, borderRadius: 5, margin: "34px 0" }} />
        <div style={{ color: t.corpo, fontSize: 44, fontWeight: 500, lineHeight: 1.38, ...RIGHE }}>{perRighe(s.corpo)}</div>
        {s.segni ? (
          <div style={{ marginTop: 44, background: t.carta, borderRadius: 24, padding: "34px 40px" }}>
            <div style={{ color: t.titolo, fontSize: 40, fontWeight: 800, marginBottom: 24 }}>{s.segni.titolo}</div>
            {s.segni.voci.map((v) => (
              <div key={v} style={{ display: "flex", gap: 24, alignItems: "flex-start", marginBottom: 20 }}>
                <div style={{ flex: "none", width: 52, height: 52, borderRadius: 26, background: AMBER_400, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                  <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={NAVY_800} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <div style={{ color: t.titolo, fontSize: 40, fontWeight: 600, lineHeight: 1.3, ...RIGHE }}>{v}</div>
              </div>
            ))}
            {s.segni.fonte ? <div style={{ color: t.debole, fontSize: 28, fontWeight: 500, marginTop: 6 }}>Fonte: {s.segni.fonte}</div> : null}
          </div>
        ) : null}
      </Colonna>
    ));
  }

  // ── C · Le tavole, un passo per slide (lo scorrere fa da animazione)
  if (s.tipo === "tavola") {
    const p = passoDi(s.etichetta);
    return pagina(true, (
      <Colonna>
        <div style={{ display: "flex", alignItems: "center", gap: 24, flex: "none" }}>
          <div style={{ flex: "none", width: 104, height: 104, borderRadius: 52, background: BRAND_700, color: "white", fontSize: 60, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.n}</div>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div style={{ color: t.etichetta, fontSize: 28, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{p.nome}</div>
              {s.vista ? <Omino vista={s.vista} colore={t.debole} /> : null}
            </div>
            <div style={{ color: t.titolo, fontSize: 52, fontWeight: 800, lineHeight: 1.1, marginTop: 6 }}>{s.titolo}</div>
          </div>
        </div>
        {s.frase ? <div style={{ flex: "none", color: t.corpo, fontSize: 36, fontWeight: 500, lineHeight: 1.32, marginTop: 14, ...RIGHE }}>{perRighe(s.frase)}</div> : null}
        {s.fonte ? <div style={{ flex: "none", color: t.debole, fontSize: 28, fontWeight: 500, marginTop: 8 }}>Fonte: {s.fonte}</div> : null}
        <Disegno html={svg(0)} scritte={s.scritte} style={{ flex: "1 1 0", marginTop: 10 }} />
      </Colonna>
    ));
  }

  // ── Cosa aspettarti: il numero, i 100 omini e l'invito a salvare
  if (s.tipo === "dato") {
    const pitto = s.illustrazione?.tipo === "pittogramma" ? s.illustrazione : null;
    const omini = pitto ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(20, 45px)", marginBottom: 28 }}>
        {Array.from({ length: pitto.totale }, (_, i) => (
          <svg key={i} width={36} height={36} viewBox="0 0 24 24" fill={i < pitto.su ? t.numero : OMINO_GRIGIO}>
            <circle cx="12" cy="6" r="4.2" /><path d="M4 23v-2.5a6.5 6.5 0 0 1 6.5-6.5h3a6.5 6.5 0 0 1 6.5 6.5V23z" />
          </svg>
        ))}
      </div>
    ) : null;
    return pagina(true, (
      <Colonna>
        <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ color: t.etichetta, fontSize: 30, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.etichetta}</div>
          {pitto && s.chi && s.cosa ? (
            // Numero con chi e cosa (variante B, Federico 04/11/2026): il numero sta nella legenda, accanto al suo significato
            <div style={{ marginTop: 20 }}>
              <NumeroLegenda chi={s.chi} cosa={s.cosa} altri={s.altri} su={pitto.su} totale={pitto.totale} colore={t.numero} testo={t.titolo} debole={t.debole}>
                {omini}
              </NumeroLegenda>
            </div>
          ) : (<>
            {s.numero ? <div style={{ color: t.numero, fontSize: 136, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", margin: "20px 0 26px" }}>{s.numero}</div> : null}
            {omini}
            {s.frase ? <div style={{ color: t.titolo, fontSize: 56, fontWeight: 750, lineHeight: 1.18, ...RIGHE }}>{perRighe(s.frase)}</div> : null}
          </>)}
          {/* barre con la scala del dolore (anca, Federico 05/11/2026): il numero si vede a colpo d'occhio, ferme come gli omini */}
          {s.illustrazione?.tipo === "barre" ? (() => { const barre = s.illustrazione; return (
            <div style={{ display: "flex", flexDirection: "column", gap: 30, marginTop: 44 }}>
              {barre.scala?.titolo ? <div style={{ color: NAVY_800, fontSize: 40, fontWeight: 800, marginBottom: -6 }}>{barre.scala.titolo}</div> : null}
              {barre.righe.map((b, i) => { const ultima = i === barre.righe.length - 1; return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                    <div style={{ color: "#475569", fontSize: 36, fontWeight: 700 }}>{b.etichetta}</div>
                    <div style={{ color: ultima ? BRAND_700 : NAVY_800, fontSize: 60, fontWeight: 900, letterSpacing: "-0.03em" }}>{b.testo}</div>
                  </div>
                  <div style={{ height: 64, borderRadius: 16, background: "#E2E8F0", overflow: "hidden" }}>
                    <div style={{ width: `${b.valore}%`, height: "100%", borderRadius: 16, background: ultima ? BRAND_700 : "#5B6472" }} />
                  </div>
                </div>); })}
              {barre.scala ? (
                <div style={{ marginTop: -14 }}>
                  <div style={{ height: 14, borderLeft: "3px solid #5B6472", borderRight: "3px solid #5B6472", borderBottom: "3px solid #5B6472" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, color: "#475569", fontSize: 32, fontWeight: 700 }}><span>{barre.scala.da}</span><span>{barre.scala.a}</span></div>
                </div>) : null}
            </div>); })() : null}
          {s.nota ? <div style={{ background: t.carta, borderLeft: `8px solid ${AMBER_400}`, borderRadius: 12, padding: "24px 30px", marginTop: 36, color: t.titolo, fontSize: 38, fontWeight: 600, lineHeight: 1.35, ...RIGHE }}>{s.nota}</div> : null}
          <div style={{ color: t.debole, fontSize: 28, fontWeight: 500, lineHeight: 1.4, marginTop: 30 }}>Fonte: {s.fonte}</div>
          {s.salva ? (
            <div style={{ alignSelf: "flex-start", marginTop: 26, background: AMBER_400, color: NAVY_800, fontSize: 32, fontWeight: 700, padding: "14px 24px", borderRadius: 10, display: "flex", alignItems: "center", gap: 14 }}>
              <IconaSalva />
              {s.salva.replace(/\s*🔖\s*$/u, "")}
            </div>
          ) : null}
        </div>
      </Colonna>
    ));
  }

  // ── E · Sicurezza: cambia registro (navy)
  if (s.tipo === "lista") {
    return pagina(true, (
      <Colonna>
        <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ color: t.titolo, fontSize: 70, fontWeight: 800, lineHeight: 1.1, marginBottom: 44 }}>{s.titolo}</div>
          {s.voci.map((v) => (
            <div key={v} style={{ display: "flex", gap: 28, alignItems: "flex-start", marginBottom: 34 }}>
              {s.segno === "attenzione" ? (
                <div style={{ flex: "none", width: 60, height: 60, borderRadius: 30, background: AMBER_400, color: NAVY_800, fontSize: 36, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>!</div>
              ) : (
                // sintesi «cosa fare» dopo il dato (05/11/2026, Federico: le indicazioni utili alla fine della storia)
                <svg width={60} height={60} viewBox="0 0 60 60" style={{ flex: "none", marginTop: 2 }}><circle cx="30" cy="30" r="30" fill={BRAND_700} /><path d="M17 31 L26 40 L44 21" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
              <div style={{ color: t.titolo, fontSize: 42, fontWeight: 600, lineHeight: 1.3, ...RIGHE }}>{lega(v)}</div>
            </div>
          ))}
          {s.segno !== "attenzione" && s.nota ? (
            <div style={{ alignSelf: "flex-start", marginTop: 10, background: AMBER_400, color: NAVY_800, fontSize: 32, fontWeight: 700, padding: "14px 24px", borderRadius: 10, display: "flex", alignItems: "center", gap: 14 }}>
              <IconaSalva />
              {s.nota.replace(/\s*🔖\s*$/u, "")}
            </div>
          ) : null}
        </div>
      </Colonna>
    ));
  }

  // ── F · Chiusura verso la guida: un solo movimento della guida, una sola azione
  if (s.tipo === "chiusura" && s.guida) {
    const g = s.guida;
    return pagina(false, (
      <>
        <div style={{ position: "absolute", left: 90, right: 90, top: 96, bottom: 216, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ flex: "none", color: t.titolo, fontSize: 64, fontWeight: 800, lineHeight: 1.12, marginTop: 22, whiteSpace: "pre-line" }}><TitoloEvidenza testo={s.titolo} evidenza={s.evidenza} /></div>
          <div style={{ position: "relative", flex: "1 1 0", minHeight: 240, maxHeight: 600, marginTop: 30, width: 900, borderRadius: 22, overflow: "hidden", background: NAVY_800 }}>
            {animato ? <OffthreadVideo src={staticFile(g.video)} muted style={{ width: 900, height: "100%", objectFit: "cover" }} />
              : <Img src={staticFile(g.fermo)} style={{ width: 900, height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ flex: "none", color: t.titolo, fontSize: g.nome.length > 32 ? 37 : 44, fontWeight: 800, lineHeight: 1.1, marginTop: 24, letterSpacing: g.nome.length > 32 ? "-0.02em" : undefined }}>{g.nome}</div>
          <div style={{ flex: "none", color: t.corpo, fontSize: 32, fontWeight: 500, lineHeight: 1.3, marginTop: 8 }}>{g.contenuto}</div>
          <div style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 14, marginTop: 28, background: BRAND_700, color: "white", fontSize: 40, fontWeight: 800, padding: "20px 30px 20px 36px", borderRadius: 14 }}>
            {s.pulsante}
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </div>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, marginTop: 20, background: t.carta, color: t.titolo, fontSize: 32, fontWeight: 700, padding: "14px 24px", borderRadius: 14 }}>
            <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={BRAND_700} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
            {s.invito.replace(/^📩\s*/u, "")}
          </div>
        </div>
        <div style={{ position: "absolute", left: 90, right: 90, bottom: 90, borderTop: `2px solid ${t.bordo}`, paddingTop: 22 }}>
          <div style={{ color: t.titolo, fontSize: 30, fontWeight: 800, lineHeight: 1.25 }}>Dr. Federico Piazza · Osteopata e fisioterapista</div>
          <div style={{ color: t.debole, fontSize: 28, fontWeight: 600, lineHeight: 1.3 }}>{s.studio ? `${s.studio} · ` : ""}@fisioconfede</div>
        </div>
      </>
    ));
  }
  return pagina(false, <div style={{ color: "red", fontSize: 40, padding: 90 }}>Slide non prevista: {s.tipo}</div>);
};
