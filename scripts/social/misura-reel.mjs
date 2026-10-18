// Fotogrammi dei soli testi del Reel (composizione ReelMisura: clip nera, niente archi) nei momenti in cui ogni testo
// è fermo (a metà della sua durata, dopo l'animazione d'ingresso), per controlla-zone.py (come nella skill reel-social).
// Uso: node scripts/social/misura-reel.mjs <cartella>
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const uscita = process.argv[2];
fs.mkdirSync(uscita, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/social/index.ts") });
const composition = await selectComposition({ serveUrl, id: "ReelMisura" });
const p = composition.props;
const fine = composition.durationInFrames / 30;
const momenti = [
  p.gancio.a / 2,
  (p.perche.da + p.perche.a) / 2,
  ...p.passi.voci.map((v, i) => Math.min(v.da + 0.8, (p.passi.voci[i + 1]?.da ?? p.passi.a) - 0.05)),
  p.segnale.a > p.segnale.da ? (p.segnale.da + p.segnale.a) / 2 : null,
  (p.dosaggio.da + p.dosaggio.a) / 2,
  Math.min(p.invito.da + 1, fine - 0.1),
].filter((t) => t !== null && t >= 0 && t < fine);
for (const t of momenti) {
  const frame = Math.round(t * 30);
  await renderStill({ composition, serveUrl, frame, output: path.join(uscita, `f${String(frame).padStart(4, "0")}.png`), imageFormat: "png" });
}
console.log(`${momenti.length} fotogrammi`);
