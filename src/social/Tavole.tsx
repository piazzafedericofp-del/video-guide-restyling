import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// Tavole anatomiche del blog sulle slide della rubrica «Come funziona» (skill carosello-social e tavole-anatomiche;
// portate dal laboratorio di video-studio il 03/11/2026, stile «lente» approvato da Federico). Gli SVG sono le copie
// per i social delle tavole approvate (scritte più grandi, alone dietro le scritte), in public/tavole insieme a
// kit-disegni.css e kit-defs.svg; le loro animazioni SMIL si fermano sul tempo voluto (pauseAnimations +
// setCurrentTime), così ogni fotogramma del render è sempre lo stesso, anche se Remotion li disegna in parallelo.
// Copia identica in video-studio/src/ e in federicopiazza.com/scripts/carosello-social/.
export const CARTELLA_TAVOLE = "tavole/";
export const SCALA_VERTICALE = 0.9;

export type Vista = { tipo: "dall'alto" | "di lato" | "dietro" | "davanti"; zona?: "schiena" | "spalla"; testo?: string };
export type SlideTavola = {
  tipo: "tavola";
  etichetta: string; // il passo ("2 · L'ernia"): fa vedere che il disegno va avanti
  titolo: string;
  frase?: string; // sopra il disegno, vicino a ciò che spiega
  fonte?: string;
  svg: string; // file in public/tavole
  tempo: number; // secondo del fotogramma fermo (JPEG per tutti i social)
  // Instagram: si anima solo il passaggio che è un movimento (da → a), poi resta fermo "ferma" secondi
  anima?: { da: number; a: number; ferma: number };
  vista?: Vista;
};

export const durataTavola = (s: { tipo: string }) => (s.tipo === "tavola" && (s as SlideTavola).anima ? (s as SlideTavola).anima!.a - (s as SlideTavola).anima!.da + (s as SlideTavola).anima!.ferma : 0);

const leggi = (file: string) => fetch(staticFile(CARTELLA_TAVOLE + file)).then((r) => r.text());

// Kit del blog (stili dei disegni e sfumature), caricato una volta sola
let kit: Promise<{ css: string; defs: string }> | null = null;
const caricaKit = () => (kit ??= Promise.all([leggi("kit-disegni.css"), leggi("kit-defs.svg")]).then(([css, defs]) => ({ css, defs })));

// Omino di orientamento, come nel blog: il riquadro ambra dice dove stiamo guardando
export const Omino: React.FC<{ vista: Vista; colore: string }> = ({ vista, colore }) => {
  const box = { fill: "none", stroke: "#f59e0b", strokeWidth: 2.4 };
  let disegno: React.ReactNode;
  if (vista.tipo === "dall'alto") {
    disegno = (<><rect x="13" y="4" width="20" height="12" rx="3" fill="#d8ccb4" /><rect x="13" y="19" width="20" height="5" rx="2" fill="#8db8ea" />
      <rect x="13" y="27" width="20" height="12" rx="3" fill="#d8ccb4" /><rect x="13" y="42" width="20" height="5" rx="2" fill="#8db8ea" />
      <path d="M4,21.5 H42" stroke="#f59e0b" strokeWidth={2.4} strokeDasharray="4 2.5" /></>);
  } else if (vista.tipo === "di lato") {
    disegno = (<><circle cx="20" cy="9" r="6.5" fill="#d8ccb4" />
      <path d="M15,17 C22,15 28,18 28,23 C29,29 26,33 27,39 L26,50 L17,50 L17,39 C15,33 13,27 13,22 C13,19 14,17 15,17 Z" fill="#d8ccb4" />
      <rect x="21" y="27" width="12" height="12" rx="3" {...box} /></>);
  } else {
    disegno = (<><circle cx="22" cy="9" r="6.5" fill="#d8ccb4" />
      <path d="M10,22 C10,18 14,17 22,17 C30,17 34,18 34,22 L36,38 L32,38 L31,28 L30,50 L14,50 L13,28 L12,38 L8,38 Z" fill="#d8ccb4" />
      {vista.zona === "spalla" ? <rect x="25" y="13" width="13" height="13" rx="3" {...box} /> : <rect x="15" y="27" width="14" height="13" rx="3" {...box} />}</>);
  }
  const testo = vista.testo ?? (vista.tipo === "dall'alto" ? "vista dall'alto" : vista.tipo === "di lato" ? "vista di lato" : `vista da ${vista.tipo}`);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, color: colore, fontSize: 28, fontWeight: 600, flex: "none" }}>
      <svg width={44} height={52} viewBox="0 0 44 52" aria-hidden>{disegno}</svg>
      {testo}
    </div>
  );
};

// Misure per controlla-carosello.py, come in Carosello.tsx, con due differenze per i disegni:
// le scritte dell'SVG valgono per la loro dimensione sullo schermo (font-size × scala del disegno, divisa per la
// riduzione del 9:16 che getScreenCTM contiene già) e quelle spente dall'animazione (opacità 0) non contano.
const opacita = (el: Element | null): number => {
  let o = 1;
  for (let e = el; e && e !== document.body; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity || "1");
  return o;
};
const misuraTesti = (riduzione: number) => {
  const voci: { testo: string; px: number; peso: number; colore: string; x: number; y: number; w: number; h: number; blocco: number }[] = [];
  const blocchi = new Map<Element, number>();
  const inSvg = new Set<number>();
  const giro = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let nodo = giro.nextNode();
  while (nodo) {
    const testo = (nodo.textContent ?? "").trim();
    const el = nodo.parentElement;
    if (testo && el && el.tagName.toLowerCase() !== "style" && opacita(el) > 0.05) {
      const st = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(nodo);
      const r = range.getBoundingClientRect();
      if (r.width > 0) {
        let px = parseFloat(st.fontSize);
        const svg = el instanceof SVGElement ? el.ownerSVGElement : null;
        if (svg) px *= (svg.getScreenCTM()?.a ?? 1) / riduzione;
        let b: Element = el;
        while (b.parentElement && getComputedStyle(b).display === "inline" && !(b instanceof SVGElement)) b = b.parentElement;
        if (!blocchi.has(b)) blocchi.set(b, blocchi.size);
        voci.push({ testo: testo.slice(0, 40), px, peso: parseInt(st.fontWeight, 10), colore: st.color === "rgb(0, 0, 0)" && svg ? st.fill : st.color, x: r.left, y: r.top, w: r.width, h: r.height, blocco: blocchi.get(b)! });
        if (svg) inSvg.add(voci.length - 1);
      }
    }
    nodo = giro.nextNode();
  }
  // Nell'SVG ogni riga di un'etichetta su due righe ("Anello" / "fibroso") è un <text> a sé:
  // le righe impilate e allineate sono la stessa etichetta, non due testi che si toccano.
  const ids = [...inSvg];
  for (const i of ids) for (const j of ids) {
    const a = voci[i], c = voci[j];
    if (i === j || c.y <= a.y) continue;
    const impilate = c.y - (a.y + a.h) < a.h * 0.5 && Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x) > 0;
    if (impilate) { const vecchio = c.blocco; voci.forEach((v) => { if (v.blocco === vecchio) v.blocco = a.blocco; }); }
  }
  return voci;
};
const misuraOstacoli = () =>
  Array.from(document.querySelectorAll("[data-ostacolo]")).map((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });

// Carica kit e disegni, li adatta ai loro riquadri, ferma ogni SVG al suo tempo e poi (se serve) misura
export const useDisegni = (files: string[], tempi: number[], opz: { controllo?: boolean; indice: number; verticale?: boolean }) => {
  const [dati, setDati] = useState<{ css: string; defs: string; svg: string[] } | null>(null);
  const [attesa] = useState(() => delayRender("disegni " + files.join(",")));
  const radice = useRef<HTMLDivElement>(null);
  const chiave = files.join("|");
  useEffect(() => {
    Promise.all([caricaKit(), ...files.map((f) => leggi(f))]).then(([k, ...svg]) => setDati({ ...(k as { css: string; defs: string }), svg: svg as string[] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave]);
  const tempiChiave = tempi.join("|");
  // Dimensione e tempo si riapplicano a ogni fotogramma, prima dello scatto: nel render del video, quando il tempo
  // smetteva di cambiare (fine del passaggio animato), dal fotogramma dopo l'SVG ripartiva da capo con il suo orologio.
  const applica = () => {
    if (!dati || !radice.current) return;
    radice.current.querySelectorAll<HTMLDivElement>("[data-disegno]").forEach((box, i) => {
      const svg = box.querySelector("svg") as SVGSVGElement | null;
      if (!svg) return;
      if (box.dataset.inquadratura) svg.setAttribute("viewBox", box.dataset.inquadratura);
      // "lente": cerchio ambra sulla zona del problema, in coordinate del disegno
      if (box.dataset.lente && !svg.querySelector(".lente")) {
        const [cx, cy, r] = box.dataset.lente.split(/\s+/);
        const ns = "http://www.w3.org/2000/svg";
        for (const [w, colore] of [[9, "#0B2447"], [5, "#FBBF24"]] as const) {
          const c = document.createElementNS(ns, "circle");
          c.setAttribute("class", "lente"); c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", r);
          c.setAttribute("fill", "none"); c.setAttribute("stroke", colore); c.setAttribute("stroke-width", String(w));
          svg.appendChild(c);
        }
      }
      // tutta la larghezza del riquadro, senza superarne l'altezza
      const [, , vw, vh] = (svg.getAttribute("viewBox") ?? "0 0 400 400").split(/\s+/).map(Number);
      const scala = Math.min(box.clientWidth / vw, box.clientHeight / vh);
      svg.setAttribute("width", String(vw * scala));
      svg.setAttribute("height", String(vh * scala));
      svg.pauseAnimations();
      svg.setCurrentTime(tempi[i]);
    });
  };
  // A ogni fotogramma Remotion aspetta che tempo e dimensione siano applicati (03/11/2026: nel video, con il computer
  // carico, qualche fotogramma del tratto fermo usciva con il disegno ripartito da capo)
  useLayoutEffect(() => {
    if (!dati) return;
    const h = delayRender("tempo del disegno");
    applica();
    requestAnimationFrame(() => continueRender(h));
  });
  useEffect(() => {
    if (!dati) return;
    applica();
    // un fotogramma di respiro perché il browser applichi i tempi, poi la misura
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.fonts.ready.then(() => {
        if (opz.controllo) console.log("CONTROLLO " + JSON.stringify({ slide: opz.indice, scala: opz.verticale ? SCALA_VERTICALE : 1, verticale: !!opz.verticale, voci: misuraTesti(opz.verticale ? SCALA_VERTICALE : 1), ostacoli: misuraOstacoli() }));
        continueRender(attesa);
      });
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dati, tempiChiave, attesa]);
  return { dati, radice };
};
