// Modello dei Reel di esercizi di @fisioconfede, versione "momenti" (scelte di Federico del 23/10/2026, skill reel-social).
// Stesso file in video-studio/src/ e in video-guide-restyling/src/social/: se lo cambi, copialo nell'altro.
//
// Momenti: 1 gancio (apertura stretta sul gesto che si allarga, titolo maiuscolo con l'ultima riga gialla; oppure
// sottotitoli parola per parola nel formato parlato) · 2 perché (riquadro scuro, gesto quotidiano in giallo) ·
// 3 passi (uno alla volta, con i puntini) · errore facoltativo ("Così no" / "Così sì") · 4 dosaggio in tre battute ·
// 5 invito (pulsante bianco con 📩, fino alla fine). Ritmo: pochi stacchi, sempre sul battito del brano.
//
// Tutte le coordinate sono in pixel della SORGENTE (la clip), non dello schermo: cerchio, archi e assi seguono da soli
// l'inquadratura attiva. Un punto P della sorgente va sullo schermo in x = 540 + (P.x − cx)·k·z, y = ay + (P.y − cy)·k·z,
// con k = 1920 / altezza della sorgente e z lo zoom del piano in quell'istante.
import { loadFont } from "@remotion/fonts";
import { fitText } from "@remotion/layout-utils";
import { Audio, Video } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

loadFont({ family: "Inter", url: staticFile("Inter.woff2"), weight: "100 900" });

const GIALLO = "#FFD60A";
const AMBRA = "#FBBF24";
const NAVY = "#0B2447";
const VERDE = "#22C55E";
const ROSSO = "#EF4444";
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const MORBIDO = Easing.bezier(0.16, 1, 0.3, 1);
const SCATTO = Easing.bezier(0.34, 1.56, 0.64, 1);
const SPINTA = Easing.bezier(0.3, 0, 0.6, 1);
// Zona libera di tutti i social: testi centrati tra 180 e 900 px, da 250 a 1420 px in altezza (controlla-zone.py)
const MARGINE = 180;

// Un piano del montaggio: dal secondo `da` del Reel si vede la sorgente dal secondo `clip`, con zoom da z0 a z1
export type Piano = {
  readonly da: number; readonly clip: number;
  readonly z0: number; readonly z1: number;
  readonly cx: number; readonly cy: number; readonly ay: number;
};
export type Punto = { readonly x: number; readonly y: number };
// Arco del movimento (rotazione nel piano della telecamera): perno e lunghezza in pixel della sorgente,
// traccia = angolo misurato dell'attrezzo (gradi schermo: 0 destra, 90 giù, 180 sinistra, 270 su) nei secondi del Reel
export type Arco = {
  readonly da: number; readonly a: number; readonly perno: Punto; readonly lunghezza: number;
  readonly traccia: readonly { readonly t: number; readonly gradi: number }[];
};
// Asse del corpo (Federico, 24/10/2026: "una linea che faccia vedere il tronco in asse", plank laterale): linea dritta
// gialla che unisce 2 o più punti del corpo in pixel della sorgente (es. caviglia → anca → spalla), con un pallino su ogni
// punto. Se il corpo si sposta, `movimento` dà i punti misurati in altri secondi del Reel (stesso numero e ordine).
export type Asse = {
  readonly da: number; readonly a: number; readonly punti: readonly Punto[];
  readonly movimento?: readonly { readonly t: number; readonly punti: readonly Punto[] }[];
};
export type Parola = { readonly t: number; readonly testo: string };

export type ReelMomentiProps = {
  readonly modello: "momenti";
  readonly video: string;
  readonly larghezza: number; // sorgente: 1080×1920 per le clip dell'archivio, 3840×2160 per i girati 4K
  readonly altezza: number;
  readonly piani: readonly Piano[];
  readonly voce?: { readonly file: string; readonly da: number }; // formato parlato: audio della voce dal secondo `da`
  readonly gancio: {
    readonly a: number; readonly righe: readonly string[]; // gialla l'ultima riga, o `gialla` (quella con il problema)
    readonly gialla?: number | readonly number[];
    readonly parlato?: { readonly y: number; readonly parole: readonly Parola[] }; // sottotitoli al posto del titolo
  };
  readonly perche: { readonly da: number; readonly a: number; readonly testo: string; readonly chiave: string };
  readonly passi: { readonly da: number; readonly a: number; readonly voci: readonly { readonly da: number; readonly testo: string }[] };
  readonly segnale?: { readonly da: number; readonly a: number; readonly x: number; readonly y: number }; // cerchio, pixel sorgente
  readonly archi?: readonly Arco[];
  readonly assi?: readonly Asse[];
  readonly errore?: { readonly da: number; readonly meta: number; readonly a: number; readonly no: string; readonly si: string };
  // `parole` per le tenute (Federico, 24/10/2026: "3 ripetizioni × 1 serie da 30 s" non si capiva): es. "30 s" ["per lato", "volte"] e "3"
  readonly dosaggio: { readonly da: number; readonly a: number; readonly ripetizioni: string; readonly serie: string; readonly etichetta: string;
    readonly parole?: readonly [string, string] };
  readonly invito: { readonly da: number; readonly testo: string; readonly icona: string };
  readonly firma: string;
  readonly copertina?: Copertina; // copertina composta (scelta di Federico, 23/10 sera): fotogramma scelto, stretto, titolo sul petto
  readonly misura?: boolean; // solo testi su nero, per controlla-zone.py
};
// Copertina: il fotogramma `clip` della sorgente con l'inquadratura {z, cx, cy, ay} (stessa formula dei piani),
// titolo del gancio fermo con la riga alta a `titoloY` px (sul petto, dentro il ritaglio 3:4 della griglia: 240–1680)
// Titolo di copertina (Federico, 24/10/2026): `righe` = testo corto solo per la copertina (2-4 parole, il problema per
// primo) al posto delle righe del gancio; `gialla` = indice della riga gialla (quella con il problema, di norma la prima);
// `grande` = corpo fino a 150 px su 840 px di larghezza, perché nella griglia del profilo la copertina è larga 1/3 di schermo.
export type Copertina = {
  readonly clip: number; readonly z: number; readonly cx: number; readonly cy: number; readonly ay: number; readonly titoloY: number;
  readonly righe?: readonly string[]; readonly gialla?: number | readonly number[]; readonly grande?: boolean;
  // Sottotitolo (Federico, 24/10/2026): continua il titolo con il verbo del "perché" + lo sforzo ("Allena il piede, senza
  // attrezzi"), 64 px bianco sotto il titolo; mai promesse di risultato né numeri di esercizi dedotti dai fotogrammi
  readonly sotto?: string;
};

const contorno = (px: number): React.CSSProperties => ({ WebkitTextStroke: `${px}px black`, paintOrder: "stroke fill" });
const f = (fps: number, s: number) => Math.round(s * fps);

const Da: React.FC<{ readonly da: number; readonly a: number; readonly nome: string; readonly children: React.ReactNode }> = ({ da, a, nome, children }) => {
  const { fps } = useVideoConfig();
  if (a <= da) return null;
  return <Sequence name={nome} from={f(fps, da)} durationInFrames={f(fps, a - da)} premountFor={fps}>{children}</Sequence>;
};

const useEntrata = (durata: number, salita = 30) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return {
    opacity: interpolate(frame, [0, 0.15 * fps, durata - 0.15 * fps, durata], [0, 1, 1, 0], CLAMP),
    translate: interpolate(frame, [0, 0.4 * fps], [`0px ${salita}px`, "0px 0px"], { ...CLAMP, easing: MORBIDO }),
  };
};

// ─── Montaggio ───
const UnPiano: React.FC<{ readonly p: ReelMomentiProps; readonly q: Piano; readonly durata: number; readonly primo: boolean }> = ({ p, q, durata, primo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = 1920 / p.altezza;
  const z = interpolate(frame, [0, durata], [q.z0, q.z1], { ...CLAMP, easing: SPINTA });
  const colpo = primo ? 0 : 0.035 * Math.exp(-frame / 2.2); // piccolo colpo di zoom sul taglio
  const manoX = 3.2 * Math.sin(frame * 0.071) + 1.8 * Math.sin(frame * 0.033 + 1.3); // camera a mano
  const manoY = 2.6 * Math.sin(frame * 0.058 + 0.7) + 1.6 * Math.sin(frame * 0.027);
  return (
    <Video
      src={staticFile(p.video)}
      trimBefore={f(fps, q.clip)}
      muted
      style={{
        position: "absolute", left: 0, top: 0, width: p.larghezza * k, height: p.altezza * k, maxWidth: "none",
        transformOrigin: `${q.cx * k}px ${q.cy * k}px`,
        translate: `${540 - q.cx * k + manoX}px ${q.ay - q.cy * k + manoY}px`,
        scale: String(z + colpo),
      }}
    />
  );
};
const Montaggio: React.FC<{ readonly p: ReelMomentiProps }> = ({ p }) => {
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      {p.piani.map((q, i) => {
        const inizio = f(fps, q.da);
        const fine = i + 1 < p.piani.length ? f(fps, p.piani[i + 1].da) : durationInFrames;
        return (
          <Sequence key={i} name={`Piano ${i + 1}`} from={inizio} durationInFrames={fine - inizio} premountFor={fps}>
            <UnPiano p={p} q={q} durata={fine - inizio} primo={i === 0} />
          </Sequence>
        );
      })}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 75% at 50% 50%, transparent 62%, rgba(0, 0, 0, 0.32) 100%)" }} />
    </AbsoluteFill>
  );
};

// Dove sta adesso sullo schermo un punto della sorgente (stessa curva di zoom del montaggio)
const sulloSchermo = (p: ReelMomentiProps, t: number, fineReel: number, punto: Punto) => {
  const i = p.piani.reduce((acc, q, j) => (t >= q.da ? j : acc), 0);
  const q = p.piani[i];
  const fine = i + 1 < p.piani.length ? p.piani[i + 1].da : fineReel;
  const z = interpolate(t, [q.da, fine], [q.z0, q.z1], { ...CLAMP, easing: SPINTA }) * (1920 / p.altezza);
  return { x: 540 + (punto.x - q.cx) * z, y: q.ay + (punto.y - q.cy) * z, z };
};

// ─── Grafiche agganciate al corpo ───
const Cerchio: React.FC<{ readonly p: ReelMomentiProps; readonly da: number; readonly punto: Punto }> = ({ p, da, punto }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { x, y } = sulloSchermo(p, da + frame / fps, durationInFrames / fps, punto);
  const impulso = (frame % fps) / fps;
  const r = 70;
  const base: React.CSSProperties = { position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: r };
  return (
    <>
      <div style={{ ...base, border: `7px solid ${GIALLO}`, boxShadow: "0 0 0 3px rgba(0,0,0,0.35)",
        scale: interpolate(frame, [0, 0.35 * fps], [0.4, 1], { ...CLAMP, easing: SCATTO, output: "perceptual-scale" }),
        opacity: interpolate(frame, [0, 0.1 * fps], [0, 1], CLAMP) }} />
      <div style={{ ...base, border: `4px solid ${GIALLO}`, scale: String(1 + impulso * 0.5), opacity: 0.7 * (1 - impulso) }} />
    </>
  );
};
const ArcoMovimento: React.FC<{ readonly p: ReelMomentiProps; readonly arco: Arco }> = ({ p, arco }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const t = arco.da + frame / fps;
  const { x: cx, y: cy, z } = sulloSchermo(p, t, durationInFrames / fps, arco.perno);
  const raggio = arco.lunghezza * z;
  const tr = arco.traccia;
  const punto = (g: number) => [cx + raggio * Math.cos((g * Math.PI) / 180), cy + raggio * Math.sin((g * Math.PI) / 180)];
  const inizio = tr[0].gradi;
  const testa = interpolate(t, tr.map((v) => v.t), tr.map((v) => v.gradi), CLAMP);
  if (Math.abs(testa - inizio) < 2) return null;
  const orario = tr[tr.length - 1].gradi > inizio;
  const [x0, y0] = punto(inizio);
  const [x1, y1] = punto(testa);
  const dir = ((testa + (orario ? 90 : -90)) * Math.PI) / 180;
  const p1 = [x1 - 34 * Math.cos(dir - 0.55), y1 - 34 * Math.sin(dir - 0.55)];
  const p2 = [x1 - 34 * Math.cos(dir + 0.55), y1 - 34 * Math.sin(dir + 0.55)];
  const durata = f(fps, arco.a - arco.da);
  const tratto = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, stroke: GIALLO, strokeWidth: 9 };
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: interpolate(frame, [0, 0.12 * fps, durata - 0.2 * fps, durata], [0, 1, 1, 0], CLAMP) }}>
      <g style={{ filter: "drop-shadow(0 0 4px rgba(0,0,0,0.7))" }}>
        <path d={`M ${x0} ${y0} A ${raggio} ${raggio} 0 ${Math.abs(testa - inizio) > 180 ? 1 : 0} ${orario ? 1 : 0} ${x1} ${y1}`} {...tratto} />
        <path d={`M ${p1[0]} ${p1[1]} L ${x1} ${y1} L ${p2[0]} ${p2[1]}`} {...tratto} />
      </g>
    </svg>
  );
};

const AsseCorpo: React.FC<{ readonly p: ReelMomentiProps; readonly asse: Asse }> = ({ p, asse }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const t = asse.da + frame / fps;
  const chiavi = [{ t: asse.da, punti: asse.punti }, ...(asse.movimento ?? [])].sort((u, v) => u.t - v.t);
  const qui = asse.punti.map((_, i) => {
    const sorgente = chiavi.length < 2 ? asse.punti[i] : {
      x: interpolate(t, chiavi.map((c) => c.t), chiavi.map((c) => c.punti[i].x), CLAMP),
      y: interpolate(t, chiavi.map((c) => c.t), chiavi.map((c) => c.punti[i].y), CLAMP),
    };
    return sulloSchermo(p, t, durationInFrames / fps, sorgente);
  });
  const durata = f(fps, asse.a - asse.da);
  // La linea si disegna dal primo all'ultimo punto in 0,4 s, poi resta; i pallini compaiono quando la linea li raggiunge
  const lunghezze = qui.slice(1).map((q, i) => Math.hypot(q.x - qui[i].x, q.y - qui[i].y));
  const totale = lunghezze.reduce((a, b) => a + b, 0) || 1;
  const disegnata = interpolate(frame, [0, 0.4 * fps], [0, 1], { ...CLAMP, easing: MORBIDO });
  const tratto = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, stroke: GIALLO, strokeWidth: 9 };
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: interpolate(frame, [0, 0.12 * fps, durata - 0.2 * fps, durata], [0, 1, 1, 0], CLAMP) }}>
      <g style={{ filter: "drop-shadow(0 0 4px rgba(0,0,0,0.7))" }}>
        <polyline points={qui.map((q) => `${q.x},${q.y}`).join(" ")} {...tratto} strokeDasharray={totale} strokeDashoffset={totale * (1 - disegnata)} />
        {qui.map((q, i) => {
          const arrivo = lunghezze.slice(0, i).reduce((a, b) => a + b, 0) / totale;
          return <circle key={i} cx={q.x} cy={q.y} r={13} fill={GIALLO} stroke={NAVY} strokeWidth={4}
            opacity={disegnata >= arrivo - 0.001 ? 1 : 0} />;
        })}
      </g>
    </svg>
  );
};

// ─── 1 · Gancio ───
const Titolo: React.FC<{ readonly righe: readonly string[]; readonly durata: number; readonly top?: number; readonly fermo?: boolean;
  readonly gialla?: number | readonly number[]; readonly grande?: boolean }> = ({ righe, durata, top = 270, fermo = false, gialla, grande = false }) => {
  const adesso = useCurrentFrame();
  const frame = fermo ? 1000 : adesso; // ferma = titolo già entrato
  const larghezza = grande ? 840 : 696;
  const corpo = Math.min(grande ? 150 : 88, ...righe.map((r) => fitText({ text: r.toUpperCase(), withinWidth: larghezza, fontFamily: "Inter", fontWeight: 900, letterSpacing: "-0.01em" }).fontSize));
  const margine = (1080 - larghezza) / 2 - 12;
  return (
    <div style={{ position: "absolute", left: margine, right: margine, top, textAlign: "center", opacity: fermo ? 1 : interpolate(frame, [durata - 5, durata], [1, 0], CLAMP) }}>
      {righe.map((r, i) => (
        <div key={r} style={{ fontFamily: "Inter", fontWeight: 900, fontSize: corpo, lineHeight: 1.08, textTransform: "uppercase", letterSpacing: "-0.01em",
          color: [gialla ?? righe.length - 1].flat().includes(i) ? GIALLO : "white", ...contorno(grande ? 14 : 11),
          scale: interpolate(frame, [i * 3 - 2, i * 3 + 9], [1.2, 1], { ...CLAMP, easing: SCATTO, output: "perceptual-scale" }) }}>
          {r}
        </div>
      ))}
    </div>
  );
};
// Formato parlato: blocchi di 2-3 parole (si va a capo dopo la punteggiatura), parola appena detta in giallo
const Sottotitoli: React.FC<{ readonly y: number; readonly parole: readonly Parola[] }> = ({ y, parole }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const blocchi: number[][] = [];
  parole.forEach((w, i) => {
    const ultimo = blocchi[blocchi.length - 1];
    if (!ultimo || ultimo.length >= 3 || /[,.;:?!]$/.test(parole[i - 1]?.testo ?? "")) blocchi.push([i]);
    else ultimo.push(i);
  });
  const b = blocchi.reduce((acc, bl, i) => (t >= parole[bl[0]].t ? i : acc), 0);
  const dette = blocchi[b].filter((i) => t >= parole[i].t);
  return (
    <div style={{ position: "absolute", left: MARGINE, right: MARGINE, top: y, textAlign: "center", fontFamily: "Inter", fontWeight: 900, fontSize: 76, lineHeight: 1.1, textTransform: "uppercase", ...contorno(10) }}>
      {blocchi[b].map((i) => (
        <span key={i} style={{ color: i === dette[dette.length - 1] ? GIALLO : "white", opacity: t >= parole[i].t ? 1 : 0.35 }}>
          {parole[i].testo.replace(/[,.;:]$/, "")}{" "}
        </span>
      ))}
    </div>
  );
};

// ─── 2 · Perché ───
const Perche: React.FC<{ readonly testo: string; readonly chiave: string; readonly durata: number }> = ({ testo, chiave, durata }) => {
  const e = useEntrata(durata);
  const corpo = Math.min(58, ...testo.split("\n").map((r) => fitText({ text: r, withinWidth: 652, fontFamily: "Inter", fontWeight: 600 }).fontSize));
  const i = testo.indexOf(chiave);
  return (
    <div style={{ position: "absolute", left: MARGINE, right: MARGINE, top: 286, display: "flex", justifyContent: "center", ...e }}>
      <div style={{ backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 22, padding: "16px 34px 20px", color: "white", fontFamily: "Inter", fontSize: corpo, fontWeight: 600, lineHeight: 1.2, textAlign: "center", whiteSpace: "pre-line", textWrap: "balance" }}>
        {chiave && i >= 0 ? <>{testo.slice(0, i)}<span style={{ color: GIALLO }}>{chiave}</span>{testo.slice(i + chiave.length)}</> : testo}
      </div>
    </div>
  );
};

// ─── 3 · Passi: uno alla volta, con i puntini ───
const Passo: React.FC<{ readonly n: number; readonly di: number; readonly testo: string; readonly durata: number }> = ({ n, di, testo, durata }) => {
  const e = useEntrata(durata, 24);
  return (
    <div style={{ position: "absolute", left: MARGINE, right: MARGINE, top: 272, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, ...e }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, backgroundColor: "rgba(0,0,0,0.78)", borderRadius: 26, padding: "12px 28px 14px 14px" }}>
        <div style={{ flex: "none", width: 64, height: 64, borderRadius: 32, backgroundColor: GIALLO, color: "black", fontFamily: "Inter", fontWeight: 900, fontSize: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
        <div style={{ color: "white", fontFamily: "Inter", fontWeight: 800, fontSize: 48, lineHeight: 1.12, textWrap: "balance" }}>{testo}</div>
      </div>
      {di > 1 ? (
        <div style={{ display: "flex", gap: 12 }}>
          {Array.from({ length: di }, (_, i) => <div key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i < n ? GIALLO : "rgba(255,255,255,0.45)", boxShadow: "0 0 0 2px rgba(0,0,0,0.4)" }} />)}
        </div>
      ) : null}
    </div>
  );
};

// ─── Errore comune: "Così no" poi "Così sì" (il video dell'errore lo danno i piani) ───
const Segno: React.FC<{ readonly ok: boolean }> = ({ ok }) => (
  <div style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: ok ? VERDE : ROSSO, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(0,0,0,0.4)", flex: "none" }}>
    <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
      {ok ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
    </svg>
  </div>
);
const Esito: React.FC<{ readonly ok: boolean; readonly testo: string; readonly durata: number }> = ({ ok, testo, durata }) => {
  const e = useEntrata(durata, 20);
  return (
    <div style={{ position: "absolute", left: MARGINE - 60, right: MARGINE, top: 280, display: "flex", alignItems: "center", gap: 20, ...e }}>
      <Segno ok={ok} />
      <div style={{ fontFamily: "Inter", fontWeight: 900, fontSize: 50, lineHeight: 1.08, textTransform: "uppercase", color: "white", whiteSpace: "pre-line", ...contorno(9) }}>{testo}</div>
    </div>
  );
};

// ─── 4 · Dosaggio in tre battute: ripetizioni, × serie, condizione ───
const Numero: React.FC<{ readonly n: string; readonly parola: string; readonly da: number }> = ({ n, parola, da }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: interpolate(frame, [da, da + 3], [0, 1], CLAMP),
      scale: interpolate(frame, [da, da + 10], [0.6, 1], { ...CLAMP, easing: SCATTO, output: "perceptual-scale" }) }}>
      <div style={{ fontFamily: "Inter", fontWeight: 900, fontSize: 112, lineHeight: 0.95, color: "white", ...contorno(12) }}>{n}</div>
      <div style={{ fontFamily: "Inter", fontWeight: 800, fontSize: 36, color: "white", textTransform: "uppercase", letterSpacing: "0.03em", ...contorno(7) }}>{parola}</div>
    </div>
  );
};
const Dosaggio: React.FC<{ readonly d: ReelMomentiProps["dosaggio"]; readonly durata: number }> = ({ d, durata }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const corpo = Math.min(32, fitText({ text: d.etichetta.toUpperCase(), withinWidth: 680, fontFamily: "Inter", fontWeight: 800, letterSpacing: "0.04em" }).fontSize);
  return (
    <div style={{ position: "absolute", left: MARGINE, right: MARGINE, top: 262, display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      opacity: interpolate(frame, [durata - 5, durata], [1, 0], CLAMP) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        <Numero n={d.ripetizioni} parola={d.parole?.[0] ?? "ripetizioni"} da={0} />
        <div style={{ fontFamily: "Inter", fontWeight: 900, fontSize: 70, color: GIALLO, ...contorno(9), marginBottom: 40, opacity: interpolate(frame, [0.57 * fps, 0.63 * fps], [0, 1], CLAMP) }}>×</div>
        <Numero n={d.serie} parola={d.parole?.[1] ?? "serie"} da={0.6 * fps} />
      </div>
      <div style={{ backgroundColor: AMBRA, color: NAVY, borderRadius: 14, padding: "6px 20px 8px", fontFamily: "Inter", fontWeight: 800, fontSize: corpo, letterSpacing: "0.04em", textTransform: "uppercase",
        opacity: interpolate(frame, [1.2 * fps, 1.3 * fps], [0, 1], CLAMP) }}>
        {d.etichetta}
      </div>
    </div>
  );
};

// ─── 5 · Invito: pulsante bianco con l'icona, fino alla fine ───
const Invito: React.FC<{ readonly testo: string; readonly icona: string }> = ({ testo, icona }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: MARGINE + 15, right: MARGINE + 15, top: 1175, display: "flex", justifyContent: "center",
      translate: interpolate(frame, [0, 0.45 * fps], ["0px 60px", "0px 0px"], { ...CLAMP, easing: MORBIDO }),
      opacity: interpolate(frame, [0, 0.15 * fps], [0, 1], CLAMP) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, backgroundColor: "white", color: "black", borderRadius: 999, padding: "22px 44px", fontFamily: "Inter", fontSize: 50, fontWeight: 800,
        whiteSpace: "pre-line", textAlign: "center", textWrap: "balance", boxShadow: "0 12px 40px rgba(0,0,0,0.35)", scale: String(1 + 0.025 * Math.sin((frame / fps) * Math.PI * 2)) }}>
        <span style={{ fontFamily: "Apple Color Emoji", fontSize: 50 }}>{icona}</span>
        {testo}
      </div>
    </div>
  );
};

export const ReelMomenti: React.FC<ReelMomentiProps> = (p) => {
  const { fps, durationInFrames } = useVideoConfig();
  const fine = durationInFrames / fps;
  const { gancio, perche, passi, errore, dosaggio, invito, segnale, misura = false } = p;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {misura ? null : <Montaggio p={p} />}
      {!misura && p.voce ? <Sequence from={f(fps, p.voce.da)}><Audio src={staticFile(p.voce.file)} /></Sequence> : null}
      {!misura && segnale ? <Da nome="Cerchio" da={segnale.da} a={segnale.a}><Cerchio p={p} da={segnale.da} punto={segnale} /></Da> : null}
      {!misura ? (p.archi ?? []).map((arco, i) => <Da key={i} nome={`Arco ${i + 1}`} da={arco.da} a={arco.a}><ArcoMovimento p={p} arco={arco} /></Da>) : null}
      {!misura ? (p.assi ?? []).map((asse, i) => <Da key={`asse${i}`} nome={`Asse ${i + 1}`} da={asse.da} a={asse.a}><AsseCorpo p={p} asse={asse} /></Da>) : null}

      <Da nome="1 Gancio" da={0} a={gancio.a}>
        {gancio.parlato ? <Sottotitoli y={gancio.parlato.y} parole={gancio.parlato.parole} /> : <Titolo righe={gancio.righe} gialla={gancio.gialla} durata={f(fps, gancio.a)} />}
      </Da>
      <Da nome="2 Perché" da={perche.da} a={perche.a}><Perche testo={perche.testo} chiave={perche.chiave} durata={f(fps, perche.a - perche.da)} /></Da>
      {passi.voci.map((v, i) => {
        const a = passi.voci[i + 1]?.da ?? passi.a;
        return <Da key={i} nome={`3 Passo ${i + 1}`} da={v.da} a={a}><Passo n={i + 1} di={passi.voci.length} testo={v.testo} durata={f(fps, a - v.da)} /></Da>;
      })}
      {errore ? (
        <>
          <Da nome="Errore: così no" da={errore.da} a={errore.meta}><Esito ok={false} testo={errore.no} durata={f(fps, errore.meta - errore.da)} /></Da>
          <Da nome="Errore: così sì" da={errore.meta} a={errore.a}><Esito ok testo={errore.si} durata={f(fps, errore.a - errore.meta)} /></Da>
        </>
      ) : null}
      <Da nome="4 Dosaggio" da={dosaggio.da} a={dosaggio.a}><Dosaggio d={dosaggio} durata={f(fps, dosaggio.a - dosaggio.da)} /></Da>
      <Da nome="5 Invito" da={invito.da} a={fine}><Invito testo={invito.testo} icona={invito.icona} /></Da>

      <div style={{ position: "absolute", left: 0, right: 0, top: 1362, textAlign: "center", color: "white", fontFamily: "Inter", fontSize: 30, fontWeight: 600, WebkitTextStroke: "5px rgba(0, 0, 0, 0.75)", paintOrder: "stroke fill" }}>
        {p.firma}
      </div>
    </AbsoluteFill>
  );
};

// ─── Copertina (un fotogramma): V2 del laboratorio, scelta da Federico il 23/10 sera ───
export const CopertinaMomenti: React.FC<ReelMomentiProps> = (p) => {
  const c = p.copertina ?? { clip: 1, z: 1.4, cx: p.larghezza / 2, cy: 0, ay: 0, titoloY: 1130 };
  // Stessa misura del Titolo: il sottotitolo parte subito sotto l'ultima riga, a qualunque corpo sia sceso il titolo
  const righe = c.righe ?? p.gancio.righe;
  const corpo = Math.min(c.grande ? 150 : 88, ...righe.map((r) => fitText({ text: r.toUpperCase(), withinWidth: c.grande ? 840 : 696, fontFamily: "Inter", fontWeight: 900, letterSpacing: "-0.01em" }).fontSize));
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <UnPiano p={p} q={{ da: 0, clip: c.clip, z0: c.z, z1: c.z, cx: c.cx, cy: c.cy, ay: c.ay }} durata={1} primo />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 75% at 50% 50%, transparent 62%, rgba(0, 0, 0, 0.32) 100%)" }} />
      <Titolo righe={c.righe ?? p.gancio.righe} gialla={c.righe ? c.gialla : p.gancio.gialla} grande={c.grande} durata={1} top={c.titoloY} fermo />
      {c.sotto ? (
        <div style={{ position: "absolute", left: 120, right: 120, top: c.titoloY + righe.length * corpo * 1.08 + 26,
          textAlign: "center", fontFamily: "Inter", fontWeight: 800, fontSize: 64, lineHeight: 1.12, color: "white", textWrap: "balance", ...contorno(9) } as React.CSSProperties}>{c.sotto}</div>
      ) : null}
    </AbsoluteFill>
  );
};
