// Fotogrammi del Reel per il revisore in contesto pulito (ciclo di revisione dei Reel, 03/11/2026, skill reel-social):
// il Reel vero (composizione Reel, con grafiche) nei momenti che il revisore deve giudicare, più la copertina composta.
// Per ogni testo il fotogramma a testo fermo; per ogni grafica inizio, metà e fine (la freccia e l'asse si vedono
// muoversi); il gancio anche nel primo mezzo secondo stretto sul gesto. Nomi dei file = secondo del Reel e momento,
// così il revisore cita il secondo. Dall'11/11/2026 (audit dei Reel): anche il primo fotogramma, quello che ferma il pollice
// (prima si partiva da 0,3 s), e per ogni passo una striscia di 6 fotogrammi in `strisce/`, perché da due fotogrammi
// fermi non si vede se il testo compare quando il gesto parte. Poi `revisione-reel.py prepara` compone telefono.jpg, griglia.jpg e testi.md.
// Uso (con public/dati.json e public/clip.mp4 già pronti, come per i fotogrammi di controllo): node scripts/social/fotogrammi-revisione.mjs <cartella del giro>
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const uscita = process.argv[2];
// Nel cloud delle routine: Chromium preinstallato che passa dal proxy (scripts/cloud/prepara-ambiente.sh)
const browserExecutable = process.env.BROWSER_EXECUTABLE || null;
fs.mkdirSync(uscita, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/social/index.ts") });
const composition = await selectComposition({ serveUrl, id: "Reel", browserExecutable });
const p = composition.props;
const fine = composition.durationInFrames / 30;
const tratto = (nome, da, a) => [[`${nome}-inizio`, da + 0.3], [`${nome}-meta`, (da + a) / 2], [`${nome}-fine`, a - 0.2]];
const momenti = [
  ["primo-fotogramma", 0],
  ...(p.gancio.parlato ? [] : [["gancio-stretto", 0.3], ["gancio", Math.max(0.6, p.gancio.a - 0.4)]]),
  ["perche", (p.perche.da + p.perche.a) / 2],
  ...p.passi.voci.flatMap((v, i) => {
    const a = p.passi.voci[i + 1]?.da ?? p.passi.a;
    return [[`passo${i + 1}`, Math.min(v.da + 0.8, a - 0.05)], [`passo${i + 1}-fine`, a - 0.15]];
  }),
  ...(p.segnale && p.segnale.a > p.segnale.da ? [["cerchio", (p.segnale.da + p.segnale.a) / 2]] : []),
  ...(p.archi ?? []).flatMap((g, i) => tratto(`arco${i + 1}`, g.da, g.a)),
  ...(p.assi ?? []).flatMap((g, i) => tratto(`asse${i + 1}`, g.da, g.a)),
  ...(p.frecce ?? []).flatMap((g, i) => tratto(`freccia${i + 1}`, g.da, g.a)),
  ...(p.errore ? [["cosi-no", (p.errore.da + p.errore.meta) / 2], ["cosi-si", (p.errore.meta + p.errore.a) / 2]] : []),
  ["dosaggio", Math.max(p.dosaggio.da + 1.2, (p.dosaggio.da + p.dosaggio.a) / 2)],
  ["invito", Math.min(p.invito.da + 1, fine - 0.1)],
  ["finale", fine - 0.1],
].filter(([, t]) => t >= 0 && t < fine).sort((x, y) => x[1] - y[1]);
for (const [nome, t] of momenti) {
  const frame = Math.round(t * 30);
  await renderStill({ composition, serveUrl, frame, scale: 0.5, imageFormat: "jpeg", jpegQuality: 85, browserExecutable,
    output: path.join(uscita, `t${(frame / 30).toFixed(2).padStart(5, "0")}-${nome}.jpg`) });
}
// Strisce del movimento: 6 fotogrammi per passo, dall'entrata del testo alla fine (larghi 270 px: serve il gesto, non il testo)
fs.mkdirSync(path.join(uscita, "strisce"), { recursive: true });
for (const [i, v] of p.passi.voci.entries()) {
  const a = Math.min(p.passi.voci[i + 1]?.da ?? p.passi.a, fine - 0.05);
  for (let k = 0; k < 6; k++) {
    const frame = Math.round((v.da + 0.05 + (k * (a - v.da - 0.1)) / 5) * 30);
    await renderStill({ composition, serveUrl, frame, scale: 0.25, imageFormat: "jpeg", jpegQuality: 80, browserExecutable,
      output: path.join(uscita, "strisce", `passo${i + 1}-t${(frame / 30).toFixed(2).padStart(5, "0")}.jpg`) });
  }
}
if (p.copertina) {
  const copertina = await selectComposition({ serveUrl, id: "Copertina", browserExecutable });
  await renderStill({ composition: copertina, serveUrl, frame: 0, imageFormat: "jpeg", jpegQuality: 90, browserExecutable,
    output: path.join(uscita, "copertina.jpg") });
}
console.log(`${momenti.length} fotogrammi, ${p.passi.voci.length} strisce${p.copertina ? " e la copertina" : ""} in ${uscita}`);
