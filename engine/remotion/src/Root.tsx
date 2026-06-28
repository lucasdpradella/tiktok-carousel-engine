import React from 'react';
import { Composition } from 'remotion';
import { DinheiroVaza } from './DinheiroVaza';
import { Carrossel } from './Carrossel';
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
    </>
  );
};
