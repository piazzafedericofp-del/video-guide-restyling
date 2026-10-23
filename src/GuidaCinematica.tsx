import { loadFont } from "@remotion/fonts";
import { Audio, Video } from "@remotion/media";
import type React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { type ParolaVoce, paroleATempo } from "./tempiParole";
export type { ParolaVoce };

loadFont({ family: "Inter", url: staticFile("Inter.woff2"), weight: "100 900" });

// Video guide 16:9 per il sito: girato 4K reinquadrato in più piani, sottotitoli in basso,
// grafiche agganciate al corpo. Tutti i tempi sono in secondi del girato originale ("raw").

const NAVY = "#0B2447";
const SABBIA = "#F7F3EC";
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SRC_W = 3840;
const SRC_H = 2160;

// Tre stili da confrontare: stessi contenuti, cambiano sottotitoli, capitoli e grafiche
export type NomeStile = "riquadro" | "parola" | "chiaro";
type Tono = "accento" | "errore" | "giusto";
type Stile = {
  readonly linea: Record<Tono, string>;
  // Colore delle parole marcate dentro le pillole
  readonly marca: Record<Tono, string>;
  readonly pillolaSfondo: string;
  readonly pillolaTesto: string;
  readonly pillolaBordo: boolean;
};

const STILI: Record<NomeStile, Stile> = {
  riquadro: {
    linea: { accento: "#FBBF24", errore: "#F87171", giusto: "#4ADE80" },
    marca: { accento: "#FBBF24", errore: "#F87171", giusto: "#4ADE80" },
    pillolaSfondo: "rgba(7, 22, 44, 0.8)",
    pillolaTesto: "white",
    pillolaBordo: true,
  },
  parola: {
    linea: { accento: "#FBBF24", errore: "#F87171", giusto: "#4ADE80" },
    marca: { accento: "#B45309", errore: "#DC2626", giusto: "#15803D" },
    pillolaSfondo: "white",
    pillolaTesto: NAVY,
    pillolaBordo: false,
  },
  chiaro: {
    linea: { accento: "#3A84DC", errore: "#EF4444", giusto: "#22C55E" },
    marca: { accento: "#0B6BD3", errore: "#DC2626", giusto: "#15803D" },
    pillolaSfondo: SABBIA,
    pillolaTesto: NAVY,
    pillolaBordo: false,
  },
};

// Tratti del girato montati uno dopo l'altro (il salto toglie le pause morte)
export type Tratto = { readonly da: number; readonly a: number };
// Inquadratura: zoom rispetto al quadro intero e centro in pixel del girato 4K
export type Piano = {
  readonly da: number;
  readonly z0: number;
  readonly z1: number;
  readonly cx: number;
  readonly cy: number;
};
// Sottotitolo: *parole* tra asterischi evidenziate
export type Sottotitolo = { readonly da: number; readonly a: number; readonly testo: string };
export type Capitolo = { readonly da: number; readonly etichetta: string; readonly tono: Tono };
type Punto = readonly [number, number];
export type Grafica =
  | {
      // Angolo con vertice in "spalla" (qualsiasi articolazione). Direzioni in gradi sullo schermo:
      // 0 = destra, 90 = giù, 180 = sinistra, 270 = su. Default: riferimento giù, braccio a destra (90°).
      readonly tipo: "angolo";
      readonly da: number;
      readonly a: number;
      readonly spalla: Punto;
      readonly etichetta: string;
      readonly riferimento?: number;
      readonly braccio?: number;
      readonly lunghezza?: number;
    }
  | {
      // Richiamo scritto agganciato a un punto del corpo, per misure che la camera non può mostrare
      // (es. angoli in profondità con ripresa frontale): pallino sul punto + etichetta accanto
      readonly tipo: "nota";
      readonly da: number;
      readonly a: number;
      readonly punto: Punto;
      readonly etichetta: string;
      readonly tono?: "accento" | "errore" | "giusto";
      readonly lato?: "dx" | "sx";
    }
  | {
      // Linea di riferimento tra due punti del corpo (es. braccio perpendicolare, gomito vicino al fianco)
      readonly tipo: "linea";
      readonly da: number;
      readonly a: number;
      readonly p1: Punto;
      readonly p2: Punto;
      readonly tono?: "accento" | "errore" | "giusto";
      readonly tratteggiata?: boolean;
      readonly etichetta?: string;
    }
  | { readonly tipo: "tenuta"; readonly da: number; readonly a: number; readonly vicino: Punto; readonly etichetta: string }
  | {
      readonly tipo: "asse";
      readonly da: number;
      readonly a: number;
      readonly bacino: Punto;
      readonly collo: Punto;
      readonly giusto: boolean;
      readonly etichetta: string;
    }
  | { readonly tipo: "anatomia"; readonly da: number; readonly a: number; readonly immagine: string; readonly etichetta: string }
  // Concetto chiave dei video parlati (introduzioni e chiusure): riquadro navy a sinistra, sul muro
  | { readonly tipo: "punto"; readonly da: number; readonly a: number; readonly etichetta: string; readonly testo: string; readonly tono?: Tono; readonly y?: number; readonly larghezza?: number };

export type GuidaCinematicaProps = {
  readonly stile: NomeStile;
  readonly video: string;
  // Colonna sonora già montata sul tempo del video (voce + musica); se vuota usa la voce del girato
  readonly colonna: string;
  readonly audio: string;
  readonly ultimoFotogramma: string;
  readonly inizioFile: number;
  readonly tratti: readonly Tratto[];
  readonly piani: readonly Piano[];
  readonly sottotitoli: readonly Sottotitolo[];
  // Trascrizione parola per parola: aggancia la parola accesa alla voce
  readonly paroleVoce: readonly ParolaVoce[];
  readonly capitoli: readonly Capitolo[];
  readonly grafiche: readonly Grafica[];
  readonly fase: string;
  readonly titolo: string;
  // etichetta: scritta sopra il numero grande (default "Dosaggio"; nei video parlati es. "Prossima fase")
  readonly dosaggio: { readonly grande: string; readonly sotto: string; readonly consigli: readonly string[]; readonly etichetta?: string };
  readonly durataFinale: number;
  // Video parlati: scheda navy iniziale (copre il titolo impresso nei vecchi montati) al posto del titolo in basso
  // prima: secondi di scheda con sola musica PRIMA del video (la voce parte quando la scheda sparisce); senza, la scheda copre i primi "fino" secondi
  readonly apertura?: {
    readonly fino: number;
    readonly prima?: number;
    readonly etichetta: string;
    readonly grande: string;
    readonly sotto: string;
  };
};

// Tempo del montaggio (s) → tempo del girato (s); null nel finale
const montaggioARaw = (t: number, tratti: readonly Tratto[]): number | null => {
  let base = 0;
  for (const tr of tratti) {
    const len = tr.a - tr.da;
    if (t < base + len) return tr.da + (t - base);
    base += len;
  }
  return null;
};

const durataMontaggio = (tratti: readonly Tratto[]) => tratti.reduce((s, tr) => s + tr.a - tr.da, 0);

type Camera = { readonly z: number; readonly cx: number; readonly cy: number };

const camera = (raw: number, frame: number, piani: readonly Piano[]): Camera => {
  const i = piani.reduce((acc, p, k) => (raw >= p.da ? k : acc), 0);
  const p = piani[i];
  const fine = i + 1 < piani.length ? piani[i + 1].da : p.da + 8;
  const z = interpolate(raw, [p.da, fine], [p.z0, p.z1], {
    ...CLAMP,
    easing: Easing.bezier(0.33, 0, 0.67, 1),
  });
  // Deriva lentissima da camera su cavalletto "viva": pochi pixel, mai periodica a vista
  const dx = 7 * Math.sin(frame * 0.021) + 4 * Math.sin(frame * 0.047 + 1.1);
  const dy = 5 * Math.sin(frame * 0.017 + 0.4) + 3 * Math.sin(frame * 0.039);
  const mezzoW = SRC_W / 2 / z;
  const mezzoH = SRC_H / 2 / z;
  return {
    z,
    cx: Math.min(Math.max(p.cx + dx, mezzoW), SRC_W - mezzoW),
    cy: Math.min(Math.max(p.cy + dy, mezzoH), SRC_H - mezzoH),
  };
};

// Pixel del girato → pixel dello schermo 1920×1080
const aSchermo = (c: Camera, [x, y]: Punto): Punto => [
  ((x - c.cx) / 2) * c.z + 960,
  ((y - c.cy) / 2) * c.z + 540,
];

const comparsa = (raw: number, da: number, a: number, entra = 0.25, esce = 0.25) =>
  interpolate(raw, [da, da + entra, a - esce, a], [0, 1, 1, 0], CLAMP);

const morbido = Easing.bezier(0.16, 1, 0.3, 1);

// ✕ e ✓ disegnati in SVG: Inter non ha questi simboli e su Linux comparirebbero con un altro font
const Icona: React.FC<{ readonly simbolo: "✕" | "✓"; readonly colore: string }> = ({ simbolo, colore }) => (
  <svg
    width="0.8em"
    height="0.8em"
    viewBox="0 0 24 24"
    style={{ display: "inline-block", verticalAlign: "-0.05em", marginRight: "0.12em" }}
  >
    <path
      d={simbolo === "✕" ? "M5 5 L19 19 M19 5 L5 19" : "M4 12.5 L9.5 18 L20 6"}
      fill="none"
      stroke={colore}
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TestoMarcato: React.FC<{ readonly testo: string; readonly accento: string; readonly peso?: number }> = ({
  testo,
  accento,
  peso,
}) => (
  <>
    {testo.split("*").map((pezzo, i) =>
      i % 2 === 1 ? (
        pezzo === "✕" || pezzo === "✓" ? (
          <Icona key={i} simbolo={pezzo} colore={accento} />
        ) : (
          <span key={i} style={{ color: accento, fontWeight: peso }}>
            {pezzo}
          </span>
        )
      ) : (
        <span key={i}>{pezzo}</span>
      ),
    )}
  </>
);

const Sottotitoli: React.FC<{
  readonly raw: number;
  readonly lista: readonly Sottotitolo[];
  readonly voce: readonly ParolaVoce[];
  readonly stile: NomeStile;
}> = ({ raw, lista, voce, stile }) => {
  const s = lista.find((x) => raw >= x.da && raw < x.a);
  if (!s) return null;
  const k = interpolate(raw, [s.da, s.da + 0.16], [0, 1], CLAMP);
  const contenitore: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: stile === "parola" ? 64 : 58,
    display: "flex",
    justifyContent: "center",
  };

  if (stile === "parola") {
    const parole = paroleATempo(s, voce);
    const attiva = parole.reduce((acc, p, i) => (raw >= p.da ? i : acc), 0);
    return (
      <div style={contenitore}>
        <div
          style={{
            maxWidth: 1360,
            textAlign: "center",
            fontSize: 54,
            fontWeight: 800,
            lineHeight: 1.22,
            letterSpacing: -0.5,
            color: "white",
            WebkitTextStroke: "9px rgba(7, 22, 44, 0.88)",
            paintOrder: "stroke fill",
            textShadow: "0 4px 24px rgba(7,22,44,0.5)",
            opacity: k,
          }}
        >
          {parole.map((p, i) => (
            <span
              key={i}
              style={{
                color: i === attiva ? "#FBBF24" : "white",
                display: "inline-block",
                margin: "0 8px",
              }}
            >
              {p.testo}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const chiaro = stile === "chiaro";
  return (
    <div style={contenitore}>
      <div
        style={{
          maxWidth: 1240,
          textAlign: "center",
          backgroundColor: chiaro ? SABBIA : "rgba(7, 22, 44, 0.74)",
          boxShadow: chiaro ? "0 10px 30px rgba(0,0,0,0.25)" : undefined,
          borderRadius: chiaro ? 12 : 14,
          padding: "10px 28px 13px",
          color: chiaro ? NAVY : "white",
          fontSize: chiaro ? 42 : 44,
          fontWeight: chiaro ? 550 : 600,
          lineHeight: 1.3,
          letterSpacing: -0.2,
          opacity: k,
          translate: `0 ${(1 - k) * 8}px`,
        }}
      >
        <TestoMarcato testo={s.testo} accento={chiaro ? "#0B6BD3" : "#FBBF24"} peso={chiaro ? 700 : undefined} />
      </div>
    </div>
  );
};

const Titolo: React.FC<{ readonly fase: string; readonly titolo: string; readonly t: number; readonly stile: NomeStile }> = ({
  fase,
  titolo,
  t,
  stile,
}) => {
  const k = interpolate(t, [0.4, 1.1], [0, 1], { ...CLAMP, easing: morbido });
  const k2 = interpolate(t, [0.6, 1.4], [0, 1], { ...CLAMP, easing: morbido });
  const fuori = interpolate(t, [5.6, 6.2], [1, 0], CLAMP);

  if (stile === "chiaro") {
    return (
      <div
        style={{
          position: "absolute",
          left: 96,
          bottom: 190,
          opacity: fuori * k,
          translate: `${(1 - k) * -30}px 0`,
          backgroundColor: "white",
          borderRadius: 18,
          padding: "24px 40px 28px 34px",
          borderLeft: "8px solid #0B6BD3",
          boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ color: "#0B6BD3", fontSize: 26, fontWeight: 600 }}>{fase}</div>
        <div style={{ color: NAVY, fontSize: 60, fontWeight: 750, letterSpacing: -1.2, marginTop: 4, opacity: k2 }}>
          {titolo}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", left: 96, bottom: 210, opacity: fuori }}>
      <div
        style={{
          width: interpolate(k, [0, 1], [0, 72]),
          height: 5,
          borderRadius: 3,
          backgroundColor: "#FBBF24",
          marginBottom: 18,
        }}
      />
      <div
        style={{
          color: "rgba(255,255,255,0.86)",
          fontSize: 30,
          fontWeight: 500,
          opacity: k,
          translate: `0 ${(1 - k) * 14}px`,
          textShadow: "0 2px 18px rgba(0,0,0,0.45)",
        }}
      >
        {fase}
      </div>
      <div
        style={{
          color: "white",
          fontSize: stile === "parola" ? 84 : 76,
          fontWeight: stile === "parola" ? 850 : 750,
          letterSpacing: -1.5,
          lineHeight: 1.05,
          marginTop: 6,
          opacity: interpolate(t, [0.6, 1.2], [0, 1], CLAMP),
          translate: `0 ${(1 - k2) * 22}px`,
          textShadow: "0 3px 28px rgba(0,0,0,0.5)",
        }}
      >
        {titolo}
      </div>
    </div>
  );
};

// Tempo del girato → tempo del montaggio; un tempo che cade in un taglio va all'inizio del tratto successivo
const rawAMontaggio = (raw: number, tratti: readonly Tratto[]) => {
  let m = 0;
  for (const tr of tratti) {
    if (raw >= tr.a) {
      m += tr.a - tr.da;
    } else {
      if (raw > tr.da) m += raw - tr.da;
      break;
    }
  }
  return m;
};

const Capitoli: React.FC<{
  readonly t: number;
  readonly lista: readonly Capitolo[];
  readonly tratti: readonly Tratto[];
  readonly stile: NomeStile;
}> = ({ t, lista, tratti, stile }) => {
  const st = STILI[stile];
  // Video parlati brevi (chiusure): nessun capitolo, nessuna barra
  if (lista.length === 0) return null;
  // Tutto sul tempo del MONTAGGIO: i segmenti sono lunghi quanto quello che si vede e si riempiono in modo continuo
  const inizi = lista.map((c) => rawAMontaggio(c.da, tratti));
  const fineM = durataMontaggio(tratti);
  const i = inizi.reduce((acc, x, k) => (t >= x ? k : acc), -1);

  // Stile "parola": barra a segmenti in alto, sempre visibile dopo il titolo, con la parte in corso che si riempie
  if (stile === "parola") {
    const k = interpolate(t, [inizi[0] - 0.5, inizi[0]], [0, 1], CLAMP);
    const totale = fineM - inizi[0];
    return (
      <div style={{ position: "absolute", left: 72, right: 72, top: 54, display: "flex", gap: 10, opacity: k }}>
        {lista.map((c, n) => {
          const da = inizi[n];
          const fine = n + 1 < lista.length ? inizi[n + 1] : fineM;
          const riempito = interpolate(t, [da, fine], [0, 1], CLAMP);
          return (
            <div key={c.da} style={{ flexGrow: Math.max(fine - da, 0.01) / totale, flexBasis: 0 }}>
              <div style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
                <div style={{ width: `${riempito * 100}%`, height: "100%", backgroundColor: st.linea[c.tono] }} />
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 24,
                  fontWeight: n === i ? 750 : 550,
                  color: "white",
                  opacity: n === i ? 1 : 0.65,
                  textShadow: "0 1px 3px rgba(7,22,44,0.85), 0 2px 14px rgba(7,22,44,0.65)",
                  whiteSpace: "nowrap",
                }}
              >
                {c.etichetta}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (i < 0) return null;
  const c = lista[i];
  const k = interpolate(t, [inizi[i], inizi[i] + 0.35], [0, 1], { ...CLAMP, easing: morbido });
  const chiaro = stile === "chiaro";
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        top: 60,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 24px 12px 18px",
        borderRadius: 999,
        backgroundColor: chiaro ? "white" : "rgba(7, 22, 44, 0.72)",
        boxShadow: chiaro ? "0 8px 24px rgba(0,0,0,0.2)" : undefined,
        color: chiaro ? NAVY : "white",
        fontSize: 28,
        fontWeight: 600,
        opacity: k,
        translate: `0 ${(1 - k) * -10}px`,
      }}
    >
      <div style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: (chiaro ? st.marca : st.linea)[c.tono] }} />
      {c.etichetta}
    </div>
  );
};

const Pillola: React.FC<{
  readonly x: number;
  readonly y: number;
  readonly tono: Tono;
  readonly testo: string;
  readonly k: number;
  readonly stile: Stile;
  readonly ancora?: "sx" | "dx";
}> = ({ x, y, tono, testo, k, stile, ancora = "sx" }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      translate: ancora === "dx" ? "-100% -50%" : "0 -50%",
      scale: String(interpolate(k, [0, 1], [0.9, 1])),
      opacity: k,
      backgroundColor: stile.pillolaSfondo,
      border: stile.pillolaBordo ? `2px solid ${stile.linea[tono]}` : undefined,
      boxShadow: stile.pillolaBordo ? undefined : "0 8px 24px rgba(0,0,0,0.25)",
      color: stile.pillolaTesto,
      borderRadius: 999,
      padding: "8px 22px 10px",
      fontSize: 32,
      fontWeight: 650,
      whiteSpace: "nowrap",
    }}
  >
    <TestoMarcato testo={testo} accento={stile.marca[tono]} />
  </div>
);

const Grafiche: React.FC<{
  readonly raw: number;
  readonly cam: Camera;
  readonly lista: readonly Grafica[];
  readonly stile: Stile;
}> = ({ raw, cam, lista, stile }) => (
  <>
    {lista
      .filter((g) => raw >= g.da && raw < g.a)
      .map((g) => {
        const k = comparsa(raw, g.da, g.a);
        const traccia = interpolate(raw, [g.da, g.da + 0.6], [0, 1], { ...CLAMP, easing: Easing.bezier(0.65, 0, 0.35, 1) });
        const accento = stile.linea.accento;
        if (g.tipo === "anatomia") {
          const e = interpolate(raw, [g.da, g.da + 0.5], [0, 1], { ...CLAMP, easing: morbido });
          return (
            <div
              key={g.da}
              style={{ position: "absolute", left: 96, top: 150, width: 400, opacity: k, translate: `0 ${(1 - e) * 24}px` }}
            >
              <Img
                src={staticFile(g.immagine)}
                style={{ width: 400, borderRadius: 20, display: "block", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}
              />
              <div
                style={{
                  display: "inline-block",
                  marginTop: 14,
                  padding: "8px 22px 10px",
                  borderRadius: 999,
                  backgroundColor: stile.pillolaSfondo,
                  color: stile.marca.accento,
                  fontSize: 32,
                  fontWeight: 700,
                }}
              >
                {g.etichetta}
              </div>
            </div>
          );
        }
        if (g.tipo === "punto") {
          const e = interpolate(raw, [g.da, g.da + 0.5], [0, 1], { ...CLAMP, easing: morbido });
          return (
            <div
              key={g.da}
              style={{
                position: "absolute",
                left: 96,
                top: g.y ?? 540,
                width: g.larghezza ?? 640,
                opacity: k,
                translate: `0 calc(-50% + ${(1 - e) * 24}px)`,
                backgroundColor: "rgba(11,36,71,0.9)",
                borderRadius: 28,
                padding: "26px 36px 34px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  fontSize: 28,
                  fontWeight: 650,
                  color: "white",
                  backgroundColor: "#0B6BD3",
                  borderRadius: 999,
                  padding: "6px 22px 8px",
                }}
              >
                {g.etichetta}
              </div>
              <div style={{ marginTop: 18, fontSize: 56, fontWeight: 800, lineHeight: 1.1, color: "white", letterSpacing: -1 }}>
                <TestoMarcato testo={g.testo} accento={g.tono && g.tono !== "accento" ? stile.linea[g.tono] : "#FBBF24"} />
              </div>
            </div>
          );
        }
        if (g.tipo === "angolo") {
          const [sx, sy] = aSchermo(cam, g.spalla);
          const L = (g.lunghezza ?? 300) * cam.z;
          const r = 90 * cam.z;
          const R = ((g.riferimento ?? 90) * Math.PI) / 180;
          const delta = ((((g.braccio ?? 0) - (g.riferimento ?? 90) + 540) % 360) - 180) * (Math.PI / 180);
          const B = R + delta * traccia;
          const fineB = R + delta;
          const bis = R + delta / 2;
          const lx = sx + Math.cos(bis) * r * 1.55;
          const ly = sy + Math.sin(bis) * r * 1.55;
          return (
            <AbsoluteFill key={g.da} style={{ opacity: k }}>
              <svg width={1920} height={1080} style={{ position: "absolute" }}>
                <line x1={sx} y1={sy} x2={sx + Math.cos(R) * L} y2={sy + Math.sin(R) * L} stroke="white" strokeWidth={4} strokeDasharray="10 10" opacity={0.8} />
                <line x1={sx} y1={sy} x2={sx + Math.cos(fineB) * L * traccia} y2={sy + Math.sin(fineB) * L * traccia} stroke={accento} strokeWidth={5} strokeLinecap="round" />
                <path
                  d={`M ${sx + Math.cos(R) * r} ${sy + Math.sin(R) * r} A ${r} ${r} 0 0 ${delta > 0 ? 1 : 0} ${sx + Math.cos(B) * r} ${sy + Math.sin(B) * r}`}
                  fill="none"
                  stroke={accento}
                  strokeWidth={5}
                  strokeLinecap="round"
                />
                <circle cx={sx} cy={sy} r={8} fill={accento} />
              </svg>
              <Pillola x={lx} y={ly} tono="accento" testo={g.etichetta} k={k} stile={stile} ancora={Math.cos(bis) < -0.3 ? "dx" : "sx"} />
            </AbsoluteFill>
          );
        }
        if (g.tipo === "nota") {
          const [px, py] = aSchermo(cam, g.punto);
          const tono = g.tono ?? "accento";
          const sx = g.lato === "sx";
          return (
            <AbsoluteFill key={g.da} style={{ opacity: k }}>
              <svg width={1920} height={1080} style={{ position: "absolute" }}>
                <circle cx={px} cy={py} r={9} fill={stile.linea[tono]} />
                <circle cx={px} cy={py} r={18} fill="none" stroke={stile.linea[tono]} strokeWidth={3} opacity={0.6} />
              </svg>
              <Pillola x={sx ? px - 30 : px + 30} y={py} tono={tono} testo={g.etichetta} k={k} stile={stile} ancora={sx ? "dx" : "sx"} />
            </AbsoluteFill>
          );
        }
        if (g.tipo === "linea") {
          const [x1, y1] = aSchermo(cam, g.p1);
          const [x2, y2] = aSchermo(cam, g.p2);
          const tono = g.tono ?? "accento";
          const colore = stile.linea[tono];
          return (
            <AbsoluteFill key={g.da} style={{ opacity: k }}>
              <svg width={1920} height={1080} style={{ position: "absolute" }}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x1 + (x2 - x1) * traccia}
                  y2={y1 + (y2 - y1) * traccia}
                  stroke={colore}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray={g.tratteggiata ? "14 12" : undefined}
                />
                <circle cx={x1} cy={y1} r={7} fill={colore} />
                <circle cx={x2} cy={y2} r={7} fill={colore} opacity={traccia} />
              </svg>
              {g.etichetta && (
                <Pillola x={Math.max(x1, x2) + 24} y={(y1 + y2) / 2} tono={tono} testo={g.etichetta} k={k} stile={stile} />
              )}
            </AbsoluteFill>
          );
        }
        if (g.tipo === "tenuta") {
          const [x, y] = aSchermo(cam, g.vicino);
          const giro = interpolate(raw, [g.da + 0.2, g.a - 0.3], [0, 1], CLAMP);
          return (
            <div key={g.da} style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", opacity: k }}>
              <svg width={150} height={150}>
                <circle cx={75} cy={75} r={64} fill={stile.pillolaSfondo} />
                <circle cx={75} cy={75} r={64} fill="none" stroke="rgba(128,128,128,0.3)" strokeWidth={7} />
                <circle
                  cx={75}
                  cy={75}
                  r={64}
                  fill="none"
                  stroke={accento}
                  strokeWidth={7}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={1 - giro}
                  transform="rotate(-90 75 75)"
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: stile.pillolaTesto,
                  fontSize: 34,
                  fontWeight: 750,
                }}
              >
                {g.etichetta}
              </div>
            </div>
          );
        }
        // Asse del tronco: rosso se si inclina, verde se resta fermo
        const [bx, by] = aSchermo(cam, g.bacino);
        const [nx, ny] = aSchermo(cam, g.collo);
        const tono: Tono = g.giusto ? "giusto" : "errore";
        const colore = stile.linea[tono];
        return (
          <AbsoluteFill key={g.da} style={{ opacity: k }}>
            <svg width={1920} height={1080} style={{ position: "absolute" }}>
              {!g.giusto && (
                <line x1={bx} y1={by} x2={bx} y2={ny} stroke="white" strokeWidth={4} strokeDasharray="10 10" opacity={0.75} />
              )}
              <line
                x1={bx}
                y1={by}
                x2={bx + (nx - bx) * traccia}
                y2={by + (ny - by) * traccia}
                stroke={colore}
                strokeWidth={7}
                strokeLinecap="round"
              />
              <circle cx={bx} cy={by} r={9} fill={colore} />
            </svg>
            <Pillola x={Math.min(nx, bx) - 70} y={ny - 10} tono={tono} testo={g.etichetta} k={k} stile={stile} ancora="dx" />
          </AbsoluteFill>
        );
      })}
  </>
);

const Finale: React.FC<{
  readonly immagine: string;
  readonly dosaggio: GuidaCinematicaProps["dosaggio"];
  readonly stile: NomeStile;
}> = ({ immagine, dosaggio, stile }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const sfondo = interpolate(t, [0, 0.6], [0, 1], { ...CLAMP, easing: Easing.bezier(0.33, 0, 0.67, 1) });
  const entra = (r: number) => interpolate(t, [0.3 + r, 0.9 + r], [0, 1], { ...CLAMP, easing: morbido });
  const chiaro = stile === "chiaro";
  const testo = chiaro ? NAVY : "white";
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(immagine)}
        style={{ width: 1920, height: 1080, filter: `blur(${sfondo * 18}px)`, scale: String(1.04 + sfondo * 0.04) }}
      />
      <AbsoluteFill style={{ backgroundColor: chiaro ? SABBIA : NAVY, opacity: sfondo * (chiaro ? 0.93 : 0.82) }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: testo, textAlign: "center" }}>
        {stile === "parola" ? (
          <div
            style={{
              fontSize: 30,
              fontWeight: 650,
              color: "white",
              backgroundColor: "#0B6BD3",
              borderRadius: 999,
              padding: "8px 26px 10px",
              opacity: entra(0),
            }}
          >
            {dosaggio.etichetta ?? "Dosaggio"}
          </div>
        ) : (
          <div style={{ fontSize: 32, fontWeight: 600, color: chiaro ? "#0B6BD3" : "#FBBF24", opacity: entra(0) }}>
            {dosaggio.etichetta ?? "Dosaggio"}
          </div>
        )}
        <div
          style={{
            fontSize: 190,
            fontWeight: 800,
            letterSpacing: -6,
            lineHeight: 1,
            marginTop: 10,
            opacity: entra(0.1),
            translate: `0 ${(1 - entra(0.1)) * 30}px`,
          }}
        >
          {dosaggio.grande}
        </div>
        <div style={{ fontSize: 40, fontWeight: 500, marginTop: 14, opacity: entra(0.2) }}>{dosaggio.sotto}</div>
        <div style={{ display: "flex", gap: 22, marginTop: 56 }}>
          {dosaggio.consigli.map((c, i) => (
            <div
              key={c}
              style={{
                fontSize: 32,
                fontWeight: 600,
                padding: "14px 30px 16px",
                borderRadius: 999,
                border: `2px solid ${chiaro ? "rgba(11,36,71,0.25)" : "rgba(255,255,255,0.35)"}`,
                backgroundColor: chiaro ? "white" : undefined,
                opacity: entra(0.45 + i * 0.12),
                translate: `0 ${(1 - entra(0.45 + i * 0.12)) * 16}px`,
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Apertura: React.FC<{ readonly t: number; readonly immagine: string; readonly dati: NonNullable<GuidaCinematicaProps["apertura"]> }> = ({
  t,
  immagine,
  dati,
}) => {
  const entra = (r: number) => interpolate(t, [0.1 + r, 0.7 + r], [0, 1], { ...CLAMP, easing: morbido });
  const fuori = interpolate(t, [dati.fino - 0.35, dati.fino], [1, 0], CLAMP);
  return (
    <AbsoluteFill style={{ opacity: fuori }}>
      <Img src={staticFile(immagine)} style={{ width: 1920, height: 1080, filter: "blur(18px)", scale: "1.08" }} />
      <AbsoluteFill style={{ backgroundColor: NAVY, opacity: 0.82 }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", color: "white", textAlign: "center" }}>
        <div
          style={{
            fontSize: 30,
            fontWeight: 650,
            backgroundColor: "#0B6BD3",
            borderRadius: 999,
            padding: "8px 26px 10px",
            opacity: entra(0),
          }}
        >
          {dati.etichetta}
        </div>
        <div
          style={{
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: -5,
            lineHeight: 1,
            marginTop: 14,
            opacity: entra(0.1),
            translate: `0 ${(1 - entra(0.1)) * 30}px`,
          }}
        >
          {dati.grande}
        </div>
        <div style={{ fontSize: 40, fontWeight: 500, marginTop: 18, color: "#FBBF24", opacity: entra(0.2) }}>{dati.sotto}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const GuidaCinematica: React.FC<GuidaCinematicaProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Scheda d'apertura prima del video: tutto il montaggio slitta in avanti di "prima" secondi
  const prima = props.apertura?.prima ?? 0;
  const primaF = Math.round(prima * fps);
  const t = frame / fps - prima;
  const raw = t < 0 ? null : montaggioARaw(t, props.tratti);
  const cam = raw === null ? null : camera(raw, frame, props.piani);
  const stile = STILI[props.stile];

  // Ogni tratto: stesso file, tagliato al punto giusto
  let base = 0;
  const sequenze = props.tratti.map((tr) => {
    const da = Math.round(base * fps) + primaF;
    const durata = Math.round((tr.a - tr.da) * fps);
    base += tr.a - tr.da;
    return { da, durata, trim: Math.round((tr.da - props.inizioFile) * fps) };
  });
  const fineMontaggio = Math.round(durataMontaggio(props.tratti) * fps) + primaF;

  return (
    <AbsoluteFill style={{ backgroundColor: "black", fontFamily: "Inter" }}>
      {sequenze.map((s) => (
        <Sequence key={s.da} from={s.da} durationInFrames={s.durata} premountFor={fps}>
          <AbsoluteFill
            style={
              cam
                ? {
                    transformOrigin: "0 0",
                    translate: `${960 - (cam.cx / 2) * cam.z}px ${540 - (cam.cy / 2) * cam.z}px`,
                    scale: String(cam.z),
                  }
                : undefined
            }
          >
            <Video src={staticFile(props.video)} trimBefore={s.trim} muted style={{ width: 1920, height: 1080 }} />
          </AbsoluteFill>
          {!props.colonna && <Audio src={staticFile(props.audio)} trimBefore={s.trim} />}
        </Sequence>
      ))}
      {props.colonna && <Audio src={staticFile(props.colonna)} />}

      {raw !== null && cam && (
        <>
          {/* Vignettatura leggera e sfumatura in basso per leggere i sottotitoli */}
          <AbsoluteFill
            style={{
              background:
                "radial-gradient(ellipse 85% 80% at 50% 45%, transparent 60%, rgba(0,0,0,0.28) 100%), linear-gradient(to top, rgba(0,0,0,0.25), transparent 30%)",
            }}
          />
          {props.stile === "parola" && (
            <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(7,22,44,0.6), rgba(7,22,44,0.28) 11%, transparent 20%)" }} />
          )}
          <Grafiche raw={raw} cam={cam} lista={props.grafiche} stile={stile} />
          <Capitoli t={t} lista={props.capitoli} tratti={props.tratti} stile={props.stile} />
          {props.apertura ? (
            !prima && t < props.apertura.fino && <Apertura t={t} immagine={props.ultimoFotogramma} dati={props.apertura} />
          ) : (
            <Titolo fase={props.fase} titolo={props.titolo} t={t} stile={props.stile} />
          )}
          <Sottotitoli raw={raw} lista={props.sottotitoli} voce={props.paroleVoce} stile={props.stile} />
        </>
      )}

      {prima > 0 && props.apertura && frame / fps < prima + 0.4 && (
        // si dissolve sul video già partito
        <Apertura t={frame / fps} immagine={props.ultimoFotogramma} dati={{ ...props.apertura, fino: prima + 0.4 }} />
      )}

      <Sequence from={fineMontaggio - 2} name="Finale">
        <Finale immagine={props.ultimoFotogramma} dosaggio={props.dosaggio} stile={props.stile} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const durataGuida = (props: GuidaCinematicaProps, fps: number) =>
  Math.round((durataMontaggio(props.tratti) + props.durataFinale + (props.apertura?.prima ?? 0)) * fps);
