// Rende tutte le slide di un carosello in JPEG e salva le misure di ogni testo.
// Uso: node scripts/misura-carosello.mjs <IdComposizione> <cartella di uscita>
// Esce: <cartella>/slide-01.jpg … e <cartella>/misure.json (letto da controlla-carosello.py).
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const [id, uscita] = process.argv.slice(2);
if (!id || !uscita) {
  console.error("Uso: node scripts/misura-carosello.mjs <IdComposizione> <cartella>");
  process.exit(1);
}
fs.mkdirSync(uscita, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/social/index.ts") });
const inputProps = { controllo: true };
const composition = await selectComposition({ serveUrl, id, inputProps });
const props = { ...composition.props, controllo: true };

const misure = [];
for (let frame = 0; frame < composition.durationInFrames; frame++) {
  const file = path.join(uscita, `slide-${String(frame + 1).padStart(2, "0")}.jpg`);
  await renderStill({
    composition,
    serveUrl,
    output: file,
    frame,
    inputProps: props,
    imageFormat: "jpeg",
    jpegQuality: 95,
    onBrowserLog: ({ text }) => {
      if (text.startsWith("CONTROLLO ")) misure.push({ file, ...JSON.parse(text.slice(10)) });
    },
  });
  console.log(`slide ${frame + 1}/${composition.durationInFrames}`);
}
fs.writeFileSync(path.join(uscita, "misure.json"), JSON.stringify(misure, null, 1));
console.log(`Misure di ${misure.length} slide in ${path.join(uscita, "misure.json")}`);
