import React from 'react';
import { Composition } from 'remotion';
import { DinheiroVaza } from './DinheiroVaza';
import { Carrossel } from './Carrossel';
import { Dorama, doramaFrames } from './Dorama';
import script from './script.json';
import carrossel from './carrossel.json';
import { totalFrames } from './timing';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DinheiroVaza"
        component={DinheiroVaza}
        durationInFrames={totalFrames}
        fps={script.fps}
        width={script.width}
        height={script.height}
      />
      <Composition
        id="Carrossel"
        component={Carrossel}
        durationInFrames={carrossel.slides.length}
        fps={1}
        width={1080}
        height={1350}
      />
      {/* Canal do PRODUTO (@pradexapp) — paleta e tipografia próprias, ver Dorama.tsx */}
      <Composition
        id="DoramaEp01"
        component={Dorama}
        durationInFrames={doramaFrames(30)}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
