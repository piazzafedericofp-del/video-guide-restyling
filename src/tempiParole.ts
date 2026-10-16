// Parola della trascrizione (whisper) con il suo inizio in secondi del girato
export type ParolaVoce = { readonly da: number; readonly testo: string };

const normalizza = (p: string) =>
  p
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9']/g, "");

const simili = (a: string, b: string) =>
  a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));

// Tempo di ogni parola del sottotitolo: preso dalla trascrizione quando la parola coincide,
// interpolato per le parole corrette a mano; se manca la trascrizione, stima proporzionale alle lettere
export const paroleATempo = (s: { readonly da: number; readonly a: number; readonly testo: string }, voce: readonly ParolaVoce[]) => {
  const parole = s.testo.split("*").join("").split(" ");
  const fine = Math.max(s.da + 0.4, s.a - 0.35);
  const candidati = voce.filter((w) => w.da >= s.da - 0.15 && w.da < s.a + 0.1);
  const tempi: (number | null)[] = parole.map(() => null);
  let j = 0;
  parole.forEach((p, i) => {
    const n = normalizza(p);
    for (let k = j; k < Math.min(j + 4, candidati.length); k++) {
      if (simili(n, normalizza(candidati[k].testo))) {
        tempi[i] = candidati[k].da;
        j = k + 1;
        return;
      }
    }
  });
  if (tempi.every((t) => t === null)) {
    const totale = parole.reduce((n, p) => n + p.length + 1, 0);
    let cumulo = 0;
    return parole.map((testo) => {
      const da = s.da + (cumulo / totale) * (fine - s.da);
      cumulo += testo.length + 1;
      return { testo, da };
    });
  }
  // Riempie i buchi tra due tempi noti (o i bordi della frase)
  const pieni = tempi.map((t, i) => {
    if (t !== null) return t;
    let a = i - 1;
    while (a >= 0 && tempi[a] === null) a--;
    let b = i + 1;
    while (b < tempi.length && tempi[b] === null) b++;
    const ta = a >= 0 ? (tempi[a] as number) : s.da;
    const tb = b < tempi.length ? (tempi[b] as number) : fine;
    return ta + ((tb - ta) * (i - a)) / (b - a);
  });
  // Whisper a volte dà lo stesso inizio a più parole di fila: le distanzia di poco, sempre in avanti
  for (let i = 1; i < pieni.length; i++) pieni[i] = Math.max(pieni[i], pieni[i - 1] + 0.12);
  return parole.map((testo, i) => ({ testo, da: pieni[i] }));
};

