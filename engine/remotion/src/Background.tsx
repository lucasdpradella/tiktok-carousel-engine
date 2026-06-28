import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { BG_MODE } from './theme';

// Camada de fundo: foto editorial (gpt-image-1) + SCRIM escuro obrigatório por cima,
// pra o texto marfim sempre ler. Fallback: BG_MODE='solido' ou bg ausente → não renderiza
// nada (fica o marinho sólido do AbsoluteFill por baixo). Texto/ouro/header ficam ACIMA disto.
//
// Variedade de 1 imagem só (custo): cada slide usa um crop/zoom diferente + scrim mais forte
// nos slides de conteúdo. `index`/`total` controlam o pan; `strong` reforça o scrim.
export const Background: React.FC<{
  bg?: string;
  index?: number;
  total?: number;
  strong?: boolean;
}> = ({ bg, index = 0, total = 1, strong = false }) => {
  if (BG_MODE === 'solido' || !bg) return null;

  // crop/zoom determinístico por slide (capa = cena cheia; conteúdo = zoom + pan)
  const zoom = index === 0 ? 1.0 : 1.22;
  const posX = index === 0 ? 60 : 30 + ((index * 23) % 50); // % objectPosition (objetos à direita)
  const posY = index === 0 ? 35 : 25 + ((index * 17) % 45);

  // scrim na cor da marca (#122033) — mais forte na zona de texto (topo-esquerda)
  const a1 = strong ? 0.74 : 0.58; // topo-esquerda (onde entra o texto)
  const a2 = 0.16; // canto dos objetos (deixa a cena respirar)

  return (
    <AbsoluteFill>
      <Img
        src={staticFile(bg)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: `${posX}% ${posY}%`,
          transform: `scale(${zoom})`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, rgba(18,32,51,${a1}) 0%, rgba(18,32,51,${a1 * 0.82}) 38%, rgba(18,32,51,${a2}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
