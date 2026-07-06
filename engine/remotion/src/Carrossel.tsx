import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { useBrandFonts } from './fonts';
import { Background } from './Background';
import { C, SERIF, SANS } from './theme';
import carrossel from './carrossel.json';

// Carrossel didático multi-slide (Fase B). 4:5 (1080x1350). 1 frame = 1 slide → render por still.
// Paleta escura compartilhada com o vídeo (theme.ts). Layout parametrizável por beat.
const CW = 1080;
const CH = 1350;
const M = 96;

// AUTO-FIT: encolhe a fonte da linha de título pra caber na largura útil — o post NUNCA quebra
// por comprimento de linha (o validador do roteiro é folgado; o render garante o encaixe).
// Estimativa determinística (sem medir DOM): largura média por char relativa ao fontSize (itálico
// é mais largo). Conservador de propósito (encolhe um tico a mais) pra nunca estourar a margem.
const AVAIL = CW - 2 * M; // 888px úteis
const FONT_FLOOR = 50; // piso de legibilidade — nunca encolhe abaixo disso (o roteirista encurta antes)
function fitSize(text: string, base: number, italic: boolean): number {
  const charW = italic ? 0.56 : 0.52;
  const max = AVAIL / (Math.max(1, text.length) * charW);
  return Math.min(base, Math.max(FONT_FLOOR, Math.floor(max)));
}

const titleStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontWeight: 400,
  fontSize: 92,
  lineHeight: 1.08,
  color: C.ink,
};

// linha de título: estilo "i" vira dourado itálico (destaque); "r" é marfim
const Titulo: React.FC<{ linhas: [string, string][]; size?: number }> = ({ linhas, size = 92 }) => (
  <>
    {linhas.map(([t, st], i) => {
      const italic = st === 'i';
      return (
        <div
          key={i}
          style={{
            ...titleStyle,
            fontSize: fitSize(t, size, italic),
            color: italic ? C.accent : C.ink,
            fontStyle: italic ? 'italic' : 'normal',
          }}
        >
          {t}
        </div>
      );
    })}
  </>
);

const Corpo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 40, lineHeight: 1.32, color: C.inkSoft, marginTop: 36 }}>
    {children}
  </div>
);

const Frame: React.FC = () => (
  <div style={{ position: 'absolute', inset: 40, border: '2px solid rgba(194,162,78,0.22)', borderRadius: 2 }} />
);

const Header: React.FC<{ index: number; total: number }> = ({ index, total }) => (
  <>
    <div
      style={{
        position: 'absolute',
        top: 80,
        left: M,
        right: M,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 28, letterSpacing: 4, color: C.accent }}>
        MANUAL DO DINHEIRO
      </div>
      <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 36, color: C.accent }}>LP</div>
    </div>
    <div
      style={{
        position: 'absolute',
        bottom: 70,
        right: M,
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: 26,
        letterSpacing: 2,
        color: C.inkSoft,
      }}
    >
      {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
    </div>
  </>
);

const Body: React.FC<{ children: React.ReactNode; center?: boolean }> = ({ children, center }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top: 210,
      height: CH - 210 - 150,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: center ? 'center' : 'flex-start',
      alignItems: 'flex-start',
      padding: `0 ${M}px`,
    }}
  >
    {children}
  </div>
);

const Slide: React.FC<{ s: any }> = ({ s }) => {
  switch (s.beat) {
    case 'exemplo':
      return (
        <Body>
          <Titulo linhas={s.titulo} size={72} />
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 200, lineHeight: 1.05, color: C.accent, margin: '12px 0 8px' }}>
            {s.numero}
          </div>
          {s.corpo && <Corpo>{s.corpo}</Corpo>}
        </Body>
      );
    case 'passos':
      return (
        <Body>
          <Titulo linhas={s.titulo} size={78} />
          <div style={{ marginTop: 44 }}>
            {(s.passos || []).map((p: string, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginBottom: 30 }}>
                <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 56, color: C.accent, minWidth: 46 }}>{i + 1}</div>
                <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 42, lineHeight: 1.25, color: C.ink }}>{p}</div>
              </div>
            ))}
          </div>
        </Body>
      );
    case 'cta':
      return (
        <Body center>
          <Titulo linhas={s.titulo} size={104} />
          {s.corpo && <Corpo>{s.corpo}</Corpo>}
          <div style={{ marginTop: 80, fontFamily: SANS, fontWeight: 600, fontSize: 32, color: C.accent }}>
            Lucas Pradella · Assessor de Investimentos
          </div>
        </Body>
      );
    case 'gancho':
      return (
        <Body center>
          <Titulo linhas={s.titulo} size={104} />
          {s.corpo && <Corpo>{s.corpo}</Corpo>}
        </Body>
      );
    default:
      // conceito, definicao, porque, contraste
      return (
        <Body>
          <Titulo linhas={s.titulo} size={88} />
          {s.corpo && <Corpo>{s.corpo}</Corpo>}
        </Body>
      );
  }
};

export const Carrossel: React.FC = () => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const slides = carrossel.slides as any[];
  const i = Math.min(slides.length - 1, Math.max(0, Math.floor(frame)));
  const s = slides[i];
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Background bg={(carrossel as any).bg} mode={(carrossel as any).bgMode} index={i} total={slides.length} strong={!['gancho', 'cta'].includes(s.beat)} />
      <Frame />
      <Header index={i} total={slides.length} />
      <Slide s={s} />
    </AbsoluteFill>
  );
};
