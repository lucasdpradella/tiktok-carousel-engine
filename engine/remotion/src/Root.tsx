import React from 'react';
import { Composition } from 'remotion';
import { DinheiroVaza } from './DinheiroVaza';
import script from './script.json';
import { totalFrames } from './timing';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="DinheiroVaza"
      component={DinheiroVaza}
      durationInFrames={totalFrames}
      fps={script.fps}
      width={script.width}
      height={script.height}
    />
  );
};
