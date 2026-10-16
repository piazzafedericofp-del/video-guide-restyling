import { Composition, staticFile } from "remotion";
import { GuidaCinematica, type GuidaCinematicaProps, durataGuida } from "../GuidaCinematica";

// Render in cloud: una lezione alla volta, i dati arrivano da public/dati.json
// (scaricato dall'archivio privato prima del render; nel codice pubblico non c'è nessun testo delle guide)
const vuota: GuidaCinematicaProps = {
  stile: "parola",
  video: "lezione-4k.mp4",
  colonna: "lezione-colonna.wav",
  audio: "",
  ultimoFotogramma: "lezione-ultimo.jpg",
  inizioFile: 0,
  tratti: [{ da: 0, a: 1 }],
  piani: [{ da: 0, z0: 1, z1: 1, cx: 1920, cy: 1080 }],
  sottotitoli: [],
  paroleVoce: [],
  capitoli: [],
  grafiche: [],
  fase: "",
  titolo: "",
  dosaggio: { grande: "", sotto: "", consigli: [] },
  durataFinale: 1,
};

export const RootLezione: React.FC = () => (
  <Composition
    id="GuidaLezione"
    component={GuidaCinematica}
    fps={30}
    width={1920}
    height={1080}
    durationInFrames={durataGuida(vuota, 30)}
    defaultProps={vuota}
    calculateMetadata={async ({ props }) => {
      try {
        const dati = (await fetch(staticFile("dati.json")).then((r) => r.json())) as GuidaCinematicaProps;
        return { props: dati, durationInFrames: durataGuida(dati, 30) };
      } catch {
        return { props, durationInFrames: durataGuida(props, 30) };
      }
    }}
  />
);
