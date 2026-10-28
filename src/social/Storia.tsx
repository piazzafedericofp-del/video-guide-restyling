import { loadFont } from "@remotion/fonts";
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

loadFont({ family: "Inter", url: staticFile("Inter.woff2"), weight: "100 900" });

// Storia che annuncia il post appena uscito su Instagram e Facebook (skill storie-social, 28/10/2026), 1080×1920.
// Zone coperte dall'app: in alto ~250 px (barre e nome), in basso ~330 px (barra dei messaggi): tutto tra y 262 e ~1610.
// Nessun testo nuovo: dentro il riquadro la copertina del Reel o la slide 1 pulita del carosello, già approvate.
// Tre varianti a rotazione (impaginazione + frasi fisse); la variante la sceglie la dashboard quando pubblica.
const NAVY_800 = "#0B2447";
const BRAND_700 = "#0B6BD3";
const SLATE_300 = "#CBD5E1";

export type Variante = 1 | 2 | 3;
export type StoriaProps = {
  formato: "reel" | "carosello";
  social: "instagram" | "facebook";
  immagine: string; // copertina del Reel (9:16) o slide 1 pulita del carosello (4:5)
  slide?: number; // carosello: numero di slide
  variante?: Variante;
  scuro?: number; // variante 2: quanto si scurisce lo sfondo sfocato (0,65; di più se il contrasto non basta)
  children?: React.ReactNode; // storia video: il contenuto del riquadro al posto dell'immagine
};

// [scritta in alto, frase grande]. {dove} = "sul mio profilo" su Instagram, "sulla mia pagina" su Facebook:
// nella storia della Pagina in alto c'è il nome della Pagina, non @fisioconfede. Testi approvati da Federico il 28/10/2026.
const FRASI: Record<"reel" | "carosello", Record<Variante, [string, string]>> = {
  reel: {
    1: ["NUOVO REEL", "Guardalo {dove}"],
    2: ["APPENA USCITO", "Il video intero è {dove}"],
    3: ["NUOVO VIDEO", "Lo trovi {dove}"],
  },
  carosello: {
    1: ["NUOVO CAROSELLO", "Leggilo {dove}"],
    2: ["APPENA USCITO", "Tutto il carosello è {dove}"],
    3: ["NUOVE SLIDE", "Le trovi {dove}"],
  },
};
// Stessa frase su tutti e due i social: il nome in alto a sinistra apre il profilo o la Pagina
const TOCCA = "Tocca il mio nome qui in alto ↖";

// Riquadro dalle proporzioni del post, entro 900 px di larghezza: Reel 9:16 → 619×1100, carosello 4:5 → 900×1125
// (il Reel resta più basso per lasciare spazio alle frasi sopra la barra dei messaggi)
export const riquadro = (formato: StoriaProps["formato"]) => {
  const [w, h] = formato === "reel" ? [1080, 1920] : [1080, 1350];
  const scala = Math.min(900 / w, (formato === "reel" ? 1100 : 1125) / h);
  return { largo: Math.round(w * scala), alto: Math.round(h * scala), scala, w, h };
};

export const Storia: React.FC<StoriaProps> = ({ formato, social, immagine, slide = 8, variante = 1, scuro = 0.65, children }) => {
  const dove = social === "facebook" ? "sulla mia pagina" : "sul mio profilo";
  const [occhiello, grande] = FRASI[formato][variante].map((t) => t.replace("{dove}", dove).replace("{n}", String(slide)));
  const { largo, alto, scala, w, h } = riquadro(formato);
  // 1 cornice navy · 2 sfondo = il post sfocato e scurito · 3 riquadro inclinato con scritta blu
  return (
    <AbsoluteFill style={{ background: NAVY_800, fontFamily: "Inter", color: "white" }}>
      {variante === 2 && (
        <>
          <Img src={staticFile(immagine)} style={{ position: "absolute", inset: -80, width: 1240, height: 2080, objectFit: "cover", filter: "blur(46px)" }} />
          <AbsoluteFill style={{ background: `rgba(8,26,51,${scuro})` }} />
        </>
      )}
      <div style={{ position: "absolute", top: 262, width: "100%", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            padding: "12px 26px", borderRadius: 10, fontSize: 34, fontWeight: 700, letterSpacing: 5,
            ...(variante === 3
              ? { background: BRAND_700 }
              : { border: "2px solid rgba(255,255,255,0.4)", background: variante === 2 ? "rgba(8,26,51,0.6)" : "transparent" }),
          }}
        >
          {occhiello}
        </div>
      </div>
      <div
        style={{
          position: "absolute", top: 352, left: (1080 - largo) / 2, width: largo, height: alto, borderRadius: 28, overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)", outline: "2px solid rgba(255,255,255,0.12)",
          transform: variante === 3 ? "rotate(-3deg)" : undefined,
        }}
      >
        <div style={{ width: w, height: h, transform: `scale(${scala})`, transformOrigin: "top left", position: "relative" }}>
          {children ?? <Img src={staticFile(immagine)} style={{ width: "100%", height: "100%" }} />}
        </div>
      </div>
      <div data-frase-piccola style={{ position: "absolute", top: 352 + alto + (variante === 3 ? 56 : 34), width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 44, fontWeight: 800 }}>{grande}</div>
        <div style={{ fontSize: 32, fontWeight: 500, color: SLATE_300, marginTop: 10 }}>{TOCCA}</div>
      </div>
    </AbsoluteFill>
  );
};
