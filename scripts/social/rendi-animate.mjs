// Rende in MP4 le slide del carosello che su Instagram escono animate (barre, pochi omini, chiusura con la guida).
// Uso: node scripts/social/rendi-animate.mjs <cartella di uscita>  → <cartella>/slide-NN.mp4 (stesso numero della JPEG)
// Le altre slide restano JPEG. Facebook e TikTok usano sempre le JPEG (non accettano video nei caroselli).
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const [uscita] = process.argv.slice(2);
if (!uscita) {
  console.error("Uso: node scripts/social/rendi-animate.mjs <cartella>");
  process.exit(1);
}
const browserExecutable = process.env.BROWSER_EXECUTABLE || null;
const slide = JSON.parse(fs.readFileSync("public/dati.json", "utf8")).props.slide;
const serveUrl = await bundle({ entryPoint: path.resolve("src/social/index.ts") });
for (let indice = 0; indice < slide.length; indice++) {
  const composition = await selectComposition({ serveUrl, id: "CaroselloAnimato", inputProps: { indice }, browserExecutable });
  if (composition.durationInFrames <= 1) continue;
  const file = path.join(uscita, `slide-${String(indice + 1).padStart(2, "0")}.mp4`);
  await renderMedia({ browserExecutable, composition, serveUrl, codec: "h264", crf: 20, muted: true, outputLocation: file, inputProps: { indice } });
  console.log(`animata ${path.basename(file)}`);
}
