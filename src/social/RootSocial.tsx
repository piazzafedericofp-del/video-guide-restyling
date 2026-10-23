import { Composition, staticFile } from "remotion";
import { Carosello, type CaroselloProps } from "./Carosello";
import { EsercizioStruttura, type EsercizioStrutturaProps } from "./EsercizioStruttura";
import { ReelMomenti, type ReelMomentiProps } from "./ReelMomenti";

// Render in cloud dei contenuti social di @fisioconfede: un contenuto alla volta, i dati arrivano da
// public/dati.json (scritto dalla routine nel progetto privato). Nel codice pubblico non c'è nessun testo.
// Reel: clip verticale 1080×1920 (skill reel-social). Carosello: una slide per fotogramma, 4:5 e 9:16 (skill carosello-social).

// Due modelli: "momenti" (dal 23/10/2026, skill reel-social) e quello del 17/10 (EsercizioStruttura) per i lavori già fatti
type PropsReel = EsercizioStrutturaProps | ReelMomentiProps;
type DatiReel = { formato: "reel"; durata: number; props: PropsReel };
const Reel: React.FC<PropsReel> = (props) =>
  "modello" in props && props.modello === "momenti" ? <ReelMomenti {...props} /> : <EsercizioStruttura {...(props as EsercizioStrutturaProps)} />;
type DatiCarosello = { formato: "carosello"; props: Pick<CaroselloProps, "slide"> };

const reelVuoto: PropsReel = {
  video: "clip.mp4", altezzaVideo: 1920,
  inquadrature: [{ da: 0, zoomInizio: 1, zoomFine: 1, centroX: 540, centroY: 960, arrivoY: 960 }],
  gancio: { a: 1, righe: [""], chiave: "" },
  perche: { da: 1, a: 2, testo: "" },
  passi: { da: 2, a: 3, voci: [] },
  segnale: { da: 0, a: 0, x: 0, y: 0, testo: "" },
  dosaggio: { da: 3, a: 4, numero: "", etichetta: "" },
  invito: { da: 4, testo: "", icona: "📩" },
  archi: [], firma: "@fisioconfede", carattere: "inter",
};
const caroselloVuoto: CaroselloProps = { stile: "foto", slide: [{ tipo: "testo", titolo: "", corpo: "" }], avanzamento: "barra", firma: true };

const leggi = async <T,>() => (await fetch(staticFile("dati.json")).then((r) => r.json())) as T;

export const RootSocial: React.FC = () => (
  <>
    {(["Reel", "ReelMisura"] as const).map((id) => (
      <Composition
        key={id}
        id={id}
        component={Reel}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={150}
        defaultProps={reelVuoto}
        calculateMetadata={async ({ props }) => {
          try {
            const d = await leggi<DatiReel>();
            // Misura: solo i testi su nero, senza grafiche (controlla-zone.py)
            const p: PropsReel = id !== "ReelMisura" ? d.props
              : "modello" in d.props ? { ...d.props, misura: true } : { ...d.props, video: "_nero.mp4", archi: [] };
            return { props: p, durationInFrames: Math.round(d.durata * 30) };
          } catch {
            return { props };
          }
        }}
      />
    ))}
    {([["Carosello", 1350, false], ["Carosello916", 1920, true]] as const).map(([id, altezza, verticale]) => (
      <Composition
        key={id}
        id={id}
        component={Carosello}
        fps={1}
        width={1080}
        height={altezza}
        durationInFrames={1}
        defaultProps={{ ...caroselloVuoto, verticale }}
        calculateMetadata={async ({ props }) => {
          try {
            const d = await leggi<DatiCarosello>();
            return {
              props: { stile: "foto" as const, avanzamento: "barra" as const, firma: true, slide: d.props.slide, verticale, controllo: props.controllo },
              durationInFrames: d.props.slide.length,
            };
          } catch {
            return { props };
          }
        }}
      />
    ))}
  </>
);
