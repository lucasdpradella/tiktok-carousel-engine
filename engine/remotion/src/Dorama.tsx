// Dorama PRADEX — monta um episódio a partir do JSON de cenas.
//
// Cada cena é um clipe (mp4 do gerador) ou uma imagem parada (os quadros de fundo
// chapado). Por cima entram: texto queimado, o polvo do pack, e o carimbo legal.
//
// PALETA PRÓPRIA, não a do theme.ts. Aquele arquivo é do canal PESSOAL (marinho,
// marfim, dourado, serifada). Este é o canal do PRODUTO: fundo #0C0E14, DM Sans.
// Importar o theme.ts aqui misturaria as duas marcas.

import React from 'react';
import {
  AbsoluteFill, Sequence, Video, Img, staticFile,
  useCurrentFrame, useVideoConfig, interpolate,
} from 'remotion';
import ep01 from './dorama-ep01.json';

const FUNDO = '#0C0E14';
const TINTA = '#F1F2F4';

type Cena = {
  id: string;
  tipo: 'clip' | 'imagem';
  arquivo: string;
  dur: number;
  texto: string[] | null;
  textoPos?: 'alto' | 'baixo';
  tamanho?: number;
  pausa?: boolean;
  carimbo?: boolean;
  polvo?: { arquivo: string; larg: number; css: string };
};

// O `css` do JSON vem como "right:56px;bottom:170px" — mesmo formato usado no
// montar-quadros.mjs, pra posição do polvo não divergir entre os dois caminhos.
function cssParaEstilo(css: string): React.CSSProperties {
  const e: Record<string, string> = {};
  css.split(';').filter(Boolean).forEach((par) => {
    const [k, v] = par.split(':');
    e[k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v.trim();
  });
  return e as React.CSSProperties;
}

const Texto: React.FC<{ cena: Cena }> = ({ cena }) => {
  const frame = useCurrentFrame();
  // Entrada em 8 frames. Texto de dorama não desliza nem pisca — só aparece.
  const op = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  if (!cena.texto) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: cena.textoPos === 'baixo' ? 'flex-end' : 'flex-start',
        alignItems: 'center',
        padding: cena.textoPos === 'baixo' ? '0 88px 320px' : '300px 88px 0',
        opacity: op,
      }}
    >
      <p
        style={{
          margin: 0, textAlign: 'center', color: TINTA,
          fontFamily: 'DM Sans, system-ui, sans-serif',
          fontSize: cena.tamanho ?? 68, fontWeight: 500,
          lineHeight: 1.26, letterSpacing: '-0.02em',
          // O fundo dos clipes é escuro mas não uniforme; a sombra garante leitura
          // sem precisar de caixa sólida por trás, que mataria o clima.
          textShadow: '0 4px 28px rgba(0,0,0,0.85)',
        }}
      >
        {cena.texto.map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}
      </p>
    </AbsoluteFill>
  );
};

// Obrigatório em toda cena com tela: o Lucas é assessor credenciado e a conta é ficção.
const Carimbo: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 56 }}>
    <p
      style={{
        margin: 0, color: 'rgba(241,242,244,0.5)',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        fontSize: 22, fontWeight: 400, letterSpacing: '0.08em',
      }}
    >
      HISTÓRIA FICTÍCIA · CONTA DE DEMONSTRAÇÃO
    </p>
  </AbsoluteFill>
);

const CenaUma: React.FC<{ cena: Cena }> = ({ cena }) => (
  <AbsoluteFill style={{ backgroundColor: FUNDO }}>
    {cena.tipo === 'clip' ? (
      // objectFit cover: os clipes vêm em 2:3 (o gerador não faz 9:16 nativo) e o
      // corte central é o mesmo que já foi validado quadro a quadro nas imagens.
      <Video src={staticFile(`dorama/${cena.arquivo}`)}
             style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
    ) : (
      <Img src={staticFile(`dorama/${cena.arquivo}`)}
           style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    )}

    {cena.polvo && (
      <Img
        src={staticFile(`dorama/${cena.polvo.arquivo}`)}
        style={{ position: 'absolute', width: cena.polvo.larg, height: 'auto',
                 ...cssParaEstilo(cena.polvo.css) }}
      />
    )}

    <Texto cena={cena} />
    {cena.carimbo && <Carimbo />}
  </AbsoluteFill>
);

export const Dorama: React.FC = () => {
  const { fps } = useVideoConfig();
  const cenas = ep01.cenas as Cena[];

  let acc = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: FUNDO }}>
      {cenas.map((c) => {
        const inicio = Math.round(acc * fps);
        const dur = Math.round(c.dur * fps);
        acc += c.dur;
        return (
          <Sequence key={c.id} from={inicio} durationInFrames={dur}>
            <CenaUma cena={c} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export const doramaFrames = (fps: number) =>
  Math.round((ep01.cenas as Cena[]).reduce((s, c) => s + c.dur, 0) * fps);
