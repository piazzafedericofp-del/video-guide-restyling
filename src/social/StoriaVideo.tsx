import React from "react";
import { AbsoluteFill, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { Storia, type StoriaProps } from "./Storia";

// Storia video di un Reel, 8 s (skill storie-social): nel riquadro passano gancio e perché del Reel con la sua musica,
// poi la copertina, che è l'immagine che chi tocca il nome ritrova nella griglia del profilo.
export const FPS = 30;
export const DURATA = 8 * FPS;

export type StoriaVideoProps = StoriaProps & { video: string; fineVideo: number }; // fineVideo = fine del perché, in s

export const StoriaVideo: React.FC<StoriaVideoProps> = ({ video, fineVideo, ...p }) => {
  const f = useCurrentFrame();
  const stacco = fineVideo * FPS;
  const copertina = interpolate(f, [stacco - 8, stacco + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(f, [stacco, DURATA], [1, 1.04], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Storia {...p}>
      <AbsoluteFill>
        {/* musica del Reel per tutta la storia, sfumata nell'ultimo mezzo secondo */}
        <OffthreadVideo
          src={staticFile(video)}
          endAt={DURATA}
          volume={(t) => interpolate(t, [DURATA - 15, DURATA], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          style={{ width: "100%", height: "100%" }}
        />
        <Img src={staticFile(p.immagine)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: copertina, transform: `scale(${zoom})` }} />
      </AbsoluteFill>
    </Storia>
  );
};
