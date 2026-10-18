import { loadFont } from "@remotion/fonts";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { fitText } from "@remotion/layout-utils";
import { Video } from "@remotion/media";
import type React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
// Inquadratura ricavata dalla clip: zoom che spinge da zoomInizio a zoomFine, punto della clip (centroX, centroY)
// portato all'altezza arrivoY dello schermo (stesso tipo del progetto video-studio)
export type Inquadratura = {
  readonly da: number;
  readonly zoomInizio: number;
  readonly zoomFine: number;
  readonly centroX: number;
  readonly centroY: number;
  readonly arrivoY: number;
};

loadFont({ family: "Inter", url: staticFile("Inter.woff2"), weight: "100 900" });
loadMontserrat("italic", { weights: ["800", "900"], subsets: ["latin"] });
loadAnton("normal", { weights: ["400"], subsets: ["latin"] });

// Ogni momento del video ha un ruolo e quindi un aspetto suo:
// gancio (titolo grande), perché (frase spiegata), passi (elenco numerato che si costruisce),
// segnale (cerchio sul punto del corpo), dosaggio (numero da screenshot), invito (pulsante in basso).
const GIALLO = "#FFD60A";
const AMBRA = "#FBBF24";
const NAVY = "#0B2447";
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// Zona libera di tutti i social (margini più severi tra le fonti, 17/10/2026): i testi centrati stanno
// tra 180 e 900 px (larghi 720), quelli allineati a sinistra partono da 100 e finiscono entro 900.
// Verifica obbligatoria con scripts/controlla-zone.py.
const MARGINE_LATI = 180;
const LARGHEZZA_TESTI = 1080 - 2 * MARGINE_LATI;
const MORBIDO = Easing.bezier(0.16, 1, 0.3, 1);
const SCATTO = Easing.bezier(0.34, 1.56, 0.64, 1);

export type Passo = { readonly da: number; readonly testo: string };

// Arco di movimento: ampiezza e verso di una rotazione che avviene nel piano della telecamera.
// Gradi sullo schermo: 0 destra, 90 giù, 180 sinistra, 270 su. Centro e raggio in pixel dello schermo 1080×1920.
// Mai un arco che a occhio non corrisponde al movimento (regola delle video guide).
export type Arco = {
  readonly da: number; readonly a: number;
  readonly cx: number; readonly cy: number; readonly raggio: number;
  readonly inizio: number; readonly fine: number;
  readonly doppio?: boolean; // frecce alle due estremità (movimento avanti e indietro)
  // Traccia misurata sul video: angolo (gradi schermo) della parte mobile in alcuni istanti (secondi del Reel).
  // Se c'è, l'arco si disegna seguendo il movimento reale e la freccia sta sulla punta che si muove.
  readonly traccia?: readonly { readonly t: number; readonly gradi: number }[];
};

export type EsercizioStrutturaProps = {
  readonly video: string;
  readonly altezzaVideo: number;
  readonly inquadrature: readonly Inquadratura[];
  readonly gancio: { readonly a: number; readonly righe: readonly string[]; readonly chiave: string };
  // chiave = parte del testo evidenziata in giallo (il beneficio), come la parola chiave del gancio
  readonly perche: { readonly da: number; readonly a: number; readonly testo: string; readonly chiave?: string };
  readonly passi: { readonly da: number; readonly a: number; readonly voci: readonly Passo[] };
  readonly segnale: {
    readonly da: number; readonly a: number; readonly x: number; readonly y: number; readonly testo: string;
    // Dove mettere l'etichetta rispetto al cerchio: lontano dal bordo destro, dove ci sono i pulsanti dei social
    readonly lato?: LatoEtichetta;
  };
  readonly dosaggio: { readonly da: number; readonly a: number; readonly numero: string; readonly etichetta: string };
  readonly invito: { readonly da: number; readonly testo: string; readonly icona: string };
  readonly archi?: readonly Arco[];
  readonly firma: string;
  readonly carattere: CarattereTitoli;
};

// Inquadrature come nello stile approvato: spinta lenta, colpo di zoom sul taglio, camera a mano
const Riprese: React.FC<{
  readonly video: string;
  readonly altezzaVideo: number;
  readonly inquadrature: readonly Inquadratura[];
}> = ({ video, altezzaVideo, inquadrature }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();
  const indice = inquadrature.reduce((acc, q, i) => (frame >= q.da * fps ? i : acc), 0);
  const q = inquadrature[indice];
  const inizio = q.da * fps;
  const termine = indice + 1 < inquadrature.length ? inquadrature[indice + 1].da * fps : durationInFrames;
  const spinta = interpolate(frame, [inizio, termine], [q.zoomInizio, q.zoomFine], {
    ...CLAMP,
    easing: Easing.bezier(0.3, 0, 0.6, 1),
  });
  const colpo = indice === 0 ? 0 : 0.035 * Math.exp(-(frame - inizio) / 2.2);
  const manoX = 3.2 * Math.sin(frame * 0.071) + 1.8 * Math.sin(frame * 0.033 + 1.3);
  const manoY = 2.6 * Math.sin(frame * 0.058 + 0.7) + 1.6 * Math.sin(frame * 0.027);

  return (
    <Video
      name="Clip"
      src={staticFile(video)}
      muted
      style={{
        position: "absolute",
        width: "100%",
        height: altezzaVideo,
        transformOrigin: `${q.centroX}px ${q.centroY}px`,
        translate: `${width / 2 - q.centroX + manoX}px ${q.arrivoY - q.centroY + manoY}px`,
        scale: String(spinta + colpo),
      }}
    />
  );
};

// Carattere dei titoli (gancio, numeri, etichetta del segnale): scelto per composizione
export type CarattereTitoli = "montserrat-corsivo" | "inter" | "anton";
const CARATTERI: Record<CarattereTitoli, React.CSSProperties> = {
  "montserrat-corsivo": { fontFamily: "Montserrat", fontStyle: "italic", fontWeight: 900 },
  inter: { fontFamily: "Inter", fontStyle: "normal", fontWeight: 900 },
  anton: { fontFamily: "Anton", fontStyle: "normal", fontWeight: 400, letterSpacing: "0.01em" },
};
let carattereAttivo: CarattereTitoli = "montserrat-corsivo";

const testoContornato: React.CSSProperties = {
  textTransform: "uppercase",
  WebkitTextStroke: "12px black",
  paintOrder: "stroke fill",
  letterSpacing: "-0.01em",
};
const titolo = (): React.CSSProperties => ({ ...testoContornato, ...CARATTERI[carattereAttivo] });

// 1 · Gancio: titolo grande, maiuscolo, la parola chiave in giallo
const Gancio: React.FC<{ readonly righe: readonly string[]; readonly chiave: string; readonly durata: number }> = ({
  righe,
  chiave,
  durata,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 96 px se ci sta, altrimenti quanto serve perché la riga più lunga resti nella zona libera
  const stile = CARATTERI[carattereAttivo];
  const corpo = Math.min(
    96,
    ...righe.map((r) => fitText({
      text: r.toUpperCase(), withinWidth: LARGHEZZA_TESTI - 24, fontFamily: String(stile.fontFamily),
      fontWeight: Number(stile.fontWeight ?? 800), letterSpacing: "-0.01em",
    }).fontSize),
  );

  return (
    <div
      style={{
        position: "absolute",
        left: MARGINE_LATI,
        right: MARGINE_LATI,
        top: 264,
        textAlign: "center",
        opacity: interpolate(frame, [durata - 0.15 * fps, durata], [1, 0], CLAMP),
      }}
    >
      {righe.map((riga, i) => (
        <div
          key={riga}
          style={{
            ...titolo(),
            fontSize: corpo,
            lineHeight: 1.08,
            color: riga.includes(chiave) ? GIALLO : "white",
            scale: interpolate(frame, [i * 0.1 * fps - 2, i * 0.1 * fps + 0.3 * fps], [1.25, 1], {
              ...CLAMP,
              easing: SCATTO,
              output: "perceptual-scale",
            }),
          }}
        >
          {riga}
        </div>
      ))}
    </div>
  );
};

// 2 · Perché: frase spiegata, minuscola, su riquadro scuro, più piccola del gancio
const Perche: React.FC<{ readonly testo: string; readonly chiave?: string; readonly durata: number }> = ({ testo, chiave, durata }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // "\n" nel testo = a capo deciso (sulla pausa della frase); ogni riga deve stare in una sola linea
  const righe = testo.split("\n");
  const corpo = righe.length > 1
    ? Math.min(58, ...righe.map((r) => fitText({ text: r, withinWidth: LARGHEZZA_TESTI - 68, fontFamily: "Inter", fontWeight: 600 }).fontSize))
    : 58;

  return (
    <div
      style={{
        position: "absolute",
        left: MARGINE_LATI,
        right: MARGINE_LATI,
        top: 310,
        display: "flex",
        justifyContent: "center",
        opacity: interpolate(frame, [0, 0.15 * fps, durata - 0.15 * fps, durata], [0, 1, 1, 0], CLAMP),
        translate: interpolate(frame, [0, 0.4 * fps], ["0px 30px", "0px 0px"], { ...CLAMP, easing: MORBIDO }),
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.72)",
          borderRadius: 22,
          textWrap: "balance", // righe di lunghezza simile: mai una parola sola sull'ultima
          whiteSpace: "pre-line", // "\n" = a capo deciso
          padding: "18px 34px 22px",
          color: "white",
          fontFamily: "Inter",
          fontSize: corpo,
          fontWeight: 600,
          lineHeight: 1.2,
          textAlign: "center",
        }}
      >
        {chiave && testo.includes(chiave) ? (
          <>
            {testo.slice(0, testo.indexOf(chiave))}
            <span style={{ color: GIALLO }}>{chiave}</span>
            {testo.slice(testo.indexOf(chiave) + chiave.length)}
          </>
        ) : testo}
      </div>
    </div>
  );
};

// 3 · Passi: elenco numerato che si costruisce in sincronia con il movimento
const Passi: React.FC<{ readonly voci: readonly Passo[]; readonly inizio: number; readonly durata: number }> = ({
  voci,
  inizio,
  durata,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const attivo = voci.reduce((acc, v, i) => (frame >= (v.da - inizio) * fps ? i : acc), 0);

  return (
    <div
      style={{
        position: "absolute",
        left: 100, // margine sinistro più severo tra i social: 90 px (TikTok)
        right: MARGINE_LATI,
        top: 290,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        opacity: interpolate(frame, [durata - 0.15 * fps, durata], [1, 0], CLAMP),
      }}
    >
      {voci.map((v, i) => {
        const da = (v.da - inizio) * fps;
        const acceso = i === attivo;
        return (
          <div
            key={v.testo}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              alignSelf: "flex-start",
              backgroundColor: acceso ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.5)",
              borderRadius: 999,
              padding: "12px 34px 12px 12px",
              opacity: interpolate(frame, [da, da + 0.15 * fps], [0, acceso ? 1 : 0.72], CLAMP),
              translate: interpolate(frame, [da, da + 0.4 * fps], ["0px 24px", "0px 0px"], { ...CLAMP, easing: MORBIDO }),
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: acceso ? GIALLO : "rgba(255,255,255,0.25)",
                color: acceso ? "black" : "white",
                fontFamily: "Inter",
                fontSize: 36,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i + 1}
            </div>
            <div style={{ color: "white", fontFamily: "Inter", fontSize: 50, fontWeight: 700, textWrap: "balance" }}>{v.testo}</div>
          </div>
        );
      })}
    </div>
  );
};

export type LatoEtichetta = "destra" | "sinistra" | "sopra";

// Segnale: cerchio pulsante sul punto del corpo da guardare, con etichetta
const Segnale: React.FC<{ readonly x: number; readonly y: number; readonly testo: string; readonly lato: LatoEtichetta }> = ({ x, y, testo, lato }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const posizione: React.CSSProperties =
    lato === "sinistra" ? { right: width - (x - 70), top: y - 130, textAlign: "right" }
    : lato === "sopra" ? { left: x, top: y - 160, translate: "-50% 0", textAlign: "center", whiteSpace: "nowrap" }
    : { left: x + 70, top: y - 130 };
  const impulso = (frame % fps) / fps;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - 70,
          top: y - 70,
          width: 140,
          height: 140,
          borderRadius: 70,
          border: `7px solid ${GIALLO}`,
          boxShadow: "0 0 0 3px rgba(0,0,0,0.35)",
          scale: interpolate(frame, [0, 0.35 * fps], [0.4, 1], { ...CLAMP, easing: SCATTO, output: "perceptual-scale" }),
          opacity: interpolate(frame, [0, 0.1 * fps], [0, 1], CLAMP),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - 70,
          top: y - 70,
          width: 140,
          height: 140,
          borderRadius: 70,
          border: `4px solid ${GIALLO}`,
          scale: String(1 + impulso * 0.5),
          opacity: 0.7 * (1 - impulso),
        }}
      />
      <div
        style={{
          position: "absolute",
          ...posizione,
          ...titolo(),
          WebkitTextStroke: "9px black",
          fontSize: 54,
          color: GIALLO,
          opacity: interpolate(frame, [0.2 * fps, 0.35 * fps], [0, 1], CLAMP),
        }}
      >
        {testo}
      </div>
    </>
  );
};

// Grafica di movimento: arco che segue il movimento reale (traccia misurata) o si disegna da solo, poi le punte
const ArcoMovimento: React.FC<{ readonly arco: Arco }> = ({ arco }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { cx, cy, raggio, inizio, doppio, traccia } = arco;
  const punto = (g: number) => [cx + raggio * Math.cos((g * Math.PI) / 180), cy + raggio * Math.sin((g * Math.PI) / 180)];
  const adesso = arco.da + frame / fps;
  // Dove arriva l'arco adesso: dalla traccia del video, oppure animazione di 0,6 s fino a "fine"
  const testa = traccia && traccia.length > 1
    ? interpolate(adesso, traccia.map((p) => p.t), traccia.map((p) => p.gradi), CLAMP)
    : inizio + (arco.fine - inizio) * interpolate(frame, [0, 0.6 * fps], [0, 1], { ...CLAMP, easing: MORBIDO });
  const orario = (traccia ? traccia[traccia.length - 1].gradi : arco.fine) > inizio;
  const [x0, y0] = punto(inizio);
  const [x1, y1] = punto(testa);
  const ampio = Math.abs(testa - inizio) > 180 ? 1 : 0;
  const visibile = Math.abs(testa - inizio) > 2;
  const durata = (arco.a - arco.da) * fps;
  const uscita = interpolate(frame, [durata - 0.2 * fps, durata], [1, 0], CLAMP);
  const comparsa = interpolate(frame, [0, 0.12 * fps], [0, 1], CLAMP);
  // Punta di freccia nel punto g, tangente all'arco e rivolta nel verso del movimento
  const punta = (g: number, avanti: boolean) => {
    const [px, py] = punto(g);
    const t = ((g + (orario === avanti ? 90 : -90)) * Math.PI) / 180;
    const a = 34;
    const p1 = [px - a * Math.cos(t - 0.55), py - a * Math.sin(t - 0.55)];
    const p2 = [px - a * Math.cos(t + 0.55), py - a * Math.sin(t + 0.55)];
    return `M ${p1[0]} ${p1[1]} L ${px} ${py} L ${p2[0]} ${p2[1]}`;
  };
  const tratto = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, stroke: GIALLO, strokeWidth: 9 };
  return (
    <svg width={width} height={height} style={{ position: "absolute", inset: 0, opacity: uscita * comparsa }}>
      {visibile ? (
        <g style={{ filter: "drop-shadow(0 0 4px rgba(0,0,0,0.7))" }}>
          <path d={`M ${x0} ${y0} A ${raggio} ${raggio} 0 ${ampio} ${orario ? 1 : 0} ${x1} ${y1}`} {...tratto} />
          <path d={punta(testa, true)} {...tratto} />
          {doppio && !traccia ? <path d={punta(inizio, false)} {...tratto} /> : null}
        </g>
      ) : null}
    </svg>
  );
};

// 4 · Dosaggio: numero grande da screenshot
const Dosaggio: React.FC<{ readonly numero: string; readonly etichetta: string; readonly durata: number }> = ({
  numero,
  etichetta,
  durata,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // L'etichetta (es. "al giorno · solo senza dolore") si riduce se non sta nella zona libera
  const corpoEtichetta = Math.min(40, fitText({
    text: etichetta.toUpperCase(), withinWidth: LARGHEZZA_TESTI - 48 - 8, fontFamily: "Inter", fontWeight: 800, letterSpacing: "0.04em",
  }).fontSize);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 280,
        textAlign: "center",
        opacity: interpolate(frame, [durata - 0.15 * fps, durata], [1, 0], CLAMP),
      }}
    >
      <div
        style={{
          ...titolo(),
          fontSize: 190,
          lineHeight: 1,
          color: "white",
          scale: interpolate(frame, [0, 0.35 * fps], [0.6, 1], { ...CLAMP, easing: SCATTO, output: "perceptual-scale" }),
        }}
      >
        {numero}
      </div>
      <div
        style={{
          display: "inline-block",
          marginTop: 14,
          backgroundColor: AMBRA,
          color: NAVY,
          borderRadius: 14,
          padding: "8px 24px 10px",
          fontFamily: "Inter",
          fontSize: corpoEtichetta,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          opacity: interpolate(frame, [0.2 * fps, 0.35 * fps], [0, 1], CLAMP),
        }}
      >
        {etichetta}
      </div>
    </div>
  );
};

// 5 · Invito: pulsante chiaro in basso, dentro la zona sicura, con un'icona
const Invito: React.FC<{ readonly testo: string; readonly icona: string }> = ({ testo, icona }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const respiro = 1 + 0.025 * Math.sin((frame / fps) * Math.PI * 2);

  return (
    <div
      style={{
        position: "absolute",
        left: MARGINE_LATI + 15, // margine extra per il "respiro" del pulsante (+2,5%)
        right: MARGINE_LATI + 15,
        top: 1175, // anche su due righe finisce sopra la firma
        textAlign: "center",
        display: "flex",
        justifyContent: "center",
        translate: interpolate(frame, [0, 0.45 * fps], ["0px 60px", "0px 0px"], { ...CLAMP, easing: MORBIDO }),
        opacity: interpolate(frame, [0, 0.15 * fps], [0, 1], CLAMP),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          backgroundColor: "white",
          color: "black",
          borderRadius: 999,
          textWrap: "balance",
          whiteSpace: "pre-line", // "\n" = a capo deciso
          textAlign: "center",
          padding: "22px 44px",
          fontFamily: "Inter",
          fontSize: 50,
          fontWeight: 800,
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          scale: String(respiro),
        }}
      >
        <span style={{ fontFamily: "Apple Color Emoji", fontSize: 50 }}>{icona}</span>
        {testo}
      </div>
    </div>
  );
};

export const EsercizioStruttura: React.FC<EsercizioStrutturaProps> = ({
  video,
  altezzaVideo,
  inquadrature,
  gancio,
  perche,
  passi,
  segnale,
  dosaggio,
  invito,
  archi = [],
  firma,
  carattere,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  carattereAttivo = carattere;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Riprese video={video} altezzaVideo={altezzaVideo} inquadrature={inquadrature} />
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 90% 75% at 50% 50%, transparent 62%, rgba(0, 0, 0, 0.32) 100%)" }}
      />

      <Sequence name="1 Gancio" durationInFrames={gancio.a * fps} premountFor={fps}>
        <Gancio righe={gancio.righe} chiave={gancio.chiave} durata={gancio.a * fps} />
      </Sequence>
      <Sequence name="2 Perché" from={perche.da * fps} durationInFrames={(perche.a - perche.da) * fps} premountFor={fps}>
        <Perche testo={perche.testo} chiave={perche.chiave} durata={(perche.a - perche.da) * fps} />
      </Sequence>
      <Sequence name="3 Passi" from={passi.da * fps} durationInFrames={(passi.a - passi.da) * fps} premountFor={fps}>
        <Passi voci={passi.voci} inizio={passi.da} durata={(passi.a - passi.da) * fps} />
      </Sequence>
      <Sequence name="Segnale" from={segnale.da * fps} durationInFrames={(segnale.a - segnale.da) * fps} premountFor={fps}>
        <Segnale x={segnale.x} y={segnale.y} testo={segnale.testo} lato={segnale.lato ?? "destra"} />
      </Sequence>
      {archi.map((arco, i) => (
        <Sequence key={i} name={`Arco ${i + 1}`} from={arco.da * fps} durationInFrames={(arco.a - arco.da) * fps} premountFor={fps}>
          <ArcoMovimento arco={arco} />
        </Sequence>
      ))}
      <Sequence name="4 Dosaggio" from={dosaggio.da * fps} durationInFrames={(dosaggio.a - dosaggio.da) * fps} premountFor={fps}>
        <Dosaggio numero={dosaggio.numero} etichetta={dosaggio.etichetta} durata={(dosaggio.a - dosaggio.da) * fps} />
      </Sequence>
      <Sequence name="5 Invito" from={invito.da * fps} durationInFrames={durationInFrames - invito.da * fps} premountFor={fps}>
        <Invito testo={invito.testo} icona={invito.icona} />
      </Sequence>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1362, // sopra i 500 px bassi coperti da Instagram (stima più prudente)
          textAlign: "center",
          color: "white",
          fontFamily: "Inter",
          fontSize: 30,
          fontWeight: 600,
          WebkitTextStroke: "5px rgba(0, 0, 0, 0.75)",
          paintOrder: "stroke fill",
        }}
      >
        {firma}
      </div>
    </AbsoluteFill>
  );
};
