// fonts.ts — carrega as TTFs da marca (Lora + Poppins) de public/fonts.
// As mesmas fontes do engine/python-pradex, copiadas pra public/ deste projeto.
//
// Remotion 4 exige delayRender() DENTRO de um componente (fase de render), não no
// topo do módulo. Por isso exportamos um hook chamado dentro da composição.
import { useState, useEffect } from 'react';
import { staticFile, delayRender, continueRender } from 'remotion';

type Spec = { family: string; file: string; descriptors: FontFaceDescriptors };

const FONTS: Spec[] = [
  { family: 'Lora', file: 'fonts/Lora-Regular.ttf', descriptors: { weight: '400', style: 'normal' } },
  { family: 'Lora', file: 'fonts/Lora-Italic.ttf', descriptors: { weight: '400', style: 'italic' } },
  { family: 'Poppins', file: 'fonts/Poppins-Regular.ttf', descriptors: { weight: '400', style: 'normal' } },
  { family: 'Poppins', file: 'fonts/Poppins-Medium.ttf', descriptors: { weight: '500', style: 'normal' } },
  { family: 'Poppins', file: 'fonts/Poppins-Bold.ttf', descriptors: { weight: '700', style: 'normal' } },
];

export const useBrandFonts = (): void => {
  // delayRender chamado durante o render (initializer do useState) — segura o frame
  // até as fontes carregarem (continueRender no useEffect).
  const [handle] = useState(() => delayRender('load-fonts'));

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      FONTS.map((f) => {
        const face = new FontFace(f.family, `url(${staticFile(f.file)})`, f.descriptors);
        return face.load().then((loaded) => {
          (document.fonts as FontFaceSet).add(loaded);
        });
      })
    )
      .then(() => {
        if (!cancelled) continueRender(handle);
      })
      .catch((err) => {
        // Não trava o render se uma fonte falhar — cai no fallback do browser.
        console.error('[fonts] falha ao carregar:', err);
        continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);
};
