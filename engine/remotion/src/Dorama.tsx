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
  AbsoluteFill, Sequence, Video, Img, Audio, staticFile,
  useCurrentFrame, useVideoConfig, interpolate,
} from 'remotion';
import ep01 from './dorama-ep01.json';

const FUNDO = '#0C0E14';
const TINTA = '#F1F2F4';

// Duração dos clipes que o gerador devolve. Todos saem iguais.
const CLIPE_S = 4;

type Canto = [number, number];

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
  // Captura real do app encaixada na tela do celular. Os 4 cantos são medidos no
  // frame renderizado, em pixels de 1080×1920, na ordem TL, TR, BR, BL.
  tela?: { arquivo: string; cantos: [Canto, Canto, Canto, Canto] };
  // Falas da cena, com o instante de entrada em segundos DENTRO da cena. A duração da
  // cena é derivada delas — ver o passo que reconstrói o tempo a partir de duracoes.json.
  audio?: { id: string; arquivo: string; em: number }[];
};

// Homografia do quadrado unitário pros 4 cantos medidos, devolvida como matrix3d.
//
// Por que não basta `rotate`: o celular está em perspectiva, não só girado. No 01.4 a
// borda de cima inclina 3,6° e a da esquerda 5,8° — ângulos diferentes, que é
// exatamente o que distingue perspectiva de rotação. Colar um retângulo girado deixa a
// tela "flutuando" por cima do aparelho em vez de dentro dele.
function matriz3d(c: [Canto, Canto, Canto, Canto]): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = c;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;

  let a13 = 0, a23 = 0;
  const den = dx1 * dy2 - dx2 * dy1;
  if (den !== 0 && (dx3 !== 0 || dy3 !== 0)) {
    a13 = (dx3 * dy2 - dx2 * dy3) / den;
    a23 = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a11 = x1 - x0 + a13 * x1, a21 = x3 - x0 + a23 * x3, a31 = x0;
  const a12 = y1 - y0 + a13 * y1, a22 = y3 - y0 + a23 * y3, a32 = y0;

  // matrix3d é column-major.
  return `matrix3d(${a11},${a12},0,${a13},${a21},${a22},0,${a23},0,0,1,0,${a31},${a32},0,1)`;
}

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
      // Os clipes do gerador têm 4s e as cenas passaram a durar até 13, porque o tempo
      // agora vem da narração. Sem desacelerar, o vídeo acaba no meio da cena e o
      // elemento <video> ERRA — derruba o render inteiro, não é só um frame preto.
      // Só freia, nunca acelera: cena mais curta que o clipe simplesmente corta.
      <Video src={staticFile(`dorama/${cena.arquivo}`)}
             playbackRate={Math.min(1, CLIPE_S / cena.dur)}
             style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
    ) : (
      <Img src={staticFile(`dorama/${cena.arquivo}`)}
           style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    )}

    {cena.tela && (
      // Sobre o retângulo preto que o gerador deixou. `scale(1/w,1/h)` primeiro leva a
      // imagem ao quadrado unitário; a matriz então a joga nos 4 cantos medidos.
      <Img
        src={staticFile(`dorama/${cena.tela.arquivo}`)}
        style={{
          position: 'absolute', top: 0, left: 0, width: 1170, height: 2532,
          transformOrigin: '0 0',
          transform: `${matriz3d(cena.tela.cantos)} scale(${1 / 1170}, ${1 / 2532})`,
        }}
      />
    )}

    {cena.polvo && (
      <Img
        src={staticFile(`dorama/${cena.polvo.arquivo}`)}
        style={{ position: 'absolute', width: cena.polvo.larg, height: 'auto',
                 ...cssParaEstilo(cena.polvo.css) }}
      />
    )}

    {cena.audio?.map((a) => (
      <Sequence key={a.id} from={Math.round(a.em * 30)}>
        <Audio src={staticFile(`dorama/${a.arquivo}`)} />
      </Sequence>
    ))}

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
