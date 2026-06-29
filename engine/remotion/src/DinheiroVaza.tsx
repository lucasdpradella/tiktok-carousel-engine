import React from 'react';
import {
  AbsoluteFill,
  Series,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { useBrandFonts } from './fonts';
import { Background } from './Background';
import { C, SERIF, SANS, H, SAFE_BOTTOM } from './theme';
import script from './script.json';
import { sceneFrames } from './timing';

// ── helpers de animação ─────────────────────────────────────────────────────

const Reveal: React.FC<{
  delay?: number;
  dur?: number;
  y?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ delay = 0, dur = 18, y = 44, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, durationInFrames: dur, config: { damping: 200 } });
  return (
    <div style={{ ...style, opacity: p, transform: `translateY(${interpolate(p, [0, 1], [y, 0])}px)` }}>
      {children}
    </div>
  );
};

// palavra de ênfase: aparece com "pop" (escala) em terracota
const Pop: React.FC<{ delay?: number; children: React.ReactNode }> = ({ delay = 0, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    frame: frame - delay,
    fps,
    durationInFrames: 20,
    config: { damping: 11, mass: 0.7, stiffness: 140 },
  });
  return (
    <span
      style={{
        display: 'inline-block',
        color: C.accent,
        fontStyle: 'italic',
        transform: `scale(${interpolate(p, [0, 1], [0.4, 1])})`,
        opacity: interpolate(p, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' }),
      }}
    >
      {children}
    </span>
  );
};

// ── moldura + header de marca (persistem em todas as cenas) ──────────────────

const Frame: React.FC = () => (
  <div style={{ position: 'absolute', inset: 40, border: '2px solid rgba(194,162,78,0.22)', borderRadius: 2 }} />
);

const BrandHeader: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 100,
      left: 96,
      right: 96,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}
  >
    <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 30, letterSpacing: 4, color: C.accent }}>
      MANUAL DO DINHEIRO
    </div>
    <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 38, letterSpacing: 1, color: C.accent }}>LP</div>
  </div>
);

// assinatura fixa logo acima da zona segura (centralizada)
const Signature: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top: H - SAFE_BOTTOM - 70,
      textAlign: 'center',
      fontFamily: SANS,
      fontWeight: 500,
      fontSize: 30,
      color: C.inkSoft,
    }}
  >
    Lucas Pradella · Assessor de Investimentos
  </div>
);

// ── área de conteúdo (centro-superior, deixando os 20% de baixo livres) ──────

const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top: 240,
      height: H - SAFE_BOTTOM - 240,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '0 96px',
    }}
  >
    {children}
  </div>
);

// ── ícones minimalistas (line-art, terracota) ────────────────────────────────

const Icon: React.FC<{ name: string }> = ({ name }) => {
  const s = 58;
  const p = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: C.accent, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'delivery') {
    return (
      <svg {...p}>
        <path d="M5 8h14l-1.2 11H6.2L5 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    );
  }
  if (name === 'assinatura') {
    return (
      <svg {...p}>
        <path d="M20 11a8 8 0 0 0-14-4M4 6v4h4" />
        <path d="M4 13a8 8 0 0 0 14 4M20 18v-4h-4" />
      </svg>
    );
  }
  if (name === 'cafe') {
    return (
      <svg {...p}>
        <path d="M5 9h12v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z" />
        <path d="M17 10h2a2 2 0 0 1 0 4h-2" />
        <path d="M8 4v2M12 4v2" />
      </svg>
    );
  }
  return null;
};

// ── cenas ────────────────────────────────────────────────────────────────────

const titleStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontWeight: 400,
  fontSize: 96,
  lineHeight: 1.06,
  color: C.ink,
};

const Scene: React.FC<{ cena: any; dur: number }> = ({ cena, dur }) => {
  const frame = useCurrentFrame();
  // fade-in/out global da cena (entrada suave + corte macio no fim), usando a
  // duração real (sincronizada com a narração).
  const fade = interpolate(frame, [0, 6, dur - 8, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  let content: React.ReactNode = null;

  switch (cena.tipo) {
    case 'gancho':
      content = (
        <Stage>
          {cena.linhas.map((l: string, i: number) => (
            <Reveal key={i} delay={i * 8}>
              <div style={titleStyle}>{l}</div>
            </Reveal>
          ))}
          <div style={{ height: 48 }} />
          <Reveal delay={42}>
            <div style={titleStyle}>
              {cena.prefixo}
              <Pop delay={50}>{cena.destaque}</Pop>
            </div>
          </Reveal>
        </Stage>
      );
      break;

    case 'frase':
      content = (
        <Stage>
          {cena.linhas.map((l: string, i: number) => (
            <Reveal key={i} delay={i * 10}>
              <div style={titleStyle}>{l}</div>
            </Reveal>
          ))}
        </Stage>
      );
      break;

    case 'lista':
      content = (
        <Stage>
          <Reveal>
            <div style={{ ...titleStyle, fontSize: 80, marginBottom: 52 }}>{cena.titulo}</div>
          </Reveal>
          {cena.itens.map((it: any, i: number) => (
            <Reveal key={i} delay={26 + i * 28} y={34}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 34, marginBottom: 36 }}>
                <div style={{ paddingTop: 4 }}>
                  <Icon name={it.icone} />
                </div>
                <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 48, lineHeight: 1.14, color: C.inkSoft }}>
                  {it.linhas.map((l: string, j: number) => (
                    <div key={j}>{l}</div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </Stage>
      );
      break;

    case 'numero':
      content = (
        <Stage>
          <Reveal>
            <div style={{ ...titleStyle, fontSize: 72, color: C.inkSoft }}>{cena.antes}</div>
          </Reveal>
          <div style={{ height: 72 }} />
          <Reveal delay={40}>
            <div style={{ ...titleStyle, fontSize: 64 }}>{cena.rotulo}</div>
          </Reveal>
          <Reveal delay={52}>
            <div style={{ fontFamily: SERIF, fontSize: 172, lineHeight: 1.04, margin: '20px 0 14px' }}>
              <Pop delay={56}>{cena.numero}</Pop>
            </div>
          </Reveal>
          <Reveal delay={72}>
            <div style={{ ...titleStyle, fontSize: 64, color: C.inkSoft }}>{cena.depois}</div>
          </Reveal>
        </Stage>
      );
      break;

    case 'duplo':
      content = (
        <Stage>
          <Reveal>
            <div style={titleStyle}>{cena.linhas[0]}</div>
          </Reveal>
          <div style={{ height: 30 }} />
          <Reveal delay={30}>
            <div style={{ ...titleStyle, color: C.accent }}>{cena.linhas[1]}</div>
          </Reveal>
        </Stage>
      );
      break;

    case 'acao':
      content = (
        <Stage>
          <Reveal>
            <div style={{ ...titleStyle, fontSize: 72, color: C.inkSoft }}>{cena.titulo}</div>
          </Reveal>
          <Reveal delay={18}>
            <div style={titleStyle}>
              {cena.prefixo}
              <Pop delay={26}>{cena.destaque}</Pop>
              {cena.sufixo}
            </div>
          </Reveal>
          <Reveal delay={40}>
            <div style={titleStyle}>{cena.extra}</div>
          </Reveal>
        </Stage>
      );
      break;

    case 'explicador':
      content = (
        <Stage>
          <div style={{ borderLeft: `6px solid ${C.accent}`, paddingLeft: 44 }}>
            <Reveal>
              <div style={titleStyle}>
                <Pop delay={6}>{cena.destaque}</Pop>
              </div>
            </Reveal>
            {cena.resto.map((l: string, i: number) => (
              <Reveal key={i} delay={14 + i * 8}>
                <div style={{ ...titleStyle, fontSize: 70, color: C.inkSoft }}>{l}</div>
              </Reveal>
            ))}
          </div>
        </Stage>
      );
      break;

    case 'cta':
      content = (
        <Stage>
          <Reveal>
            <div style={titleStyle}>
              {cena.prefixo}
              <Pop delay={8}>{cena.destaque}</Pop>
            </div>
          </Reveal>
          {cena.linhas.map((l: string, i: number) => (
            <Reveal key={i} delay={18 + i * 10}>
              <div style={titleStyle}>{l}</div>
            </Reveal>
          ))}
          <div style={{ height: 52 }} />
          <Reveal delay={34}>
            <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 48, color: C.inkSoft }}>{cena.follow}</div>
          </Reveal>
        </Stage>
      );
      break;

    default:
      content = null;
  }

  return <AbsoluteFill style={{ opacity: fade }}>{content}</AbsoluteFill>;
};

// ── composição ───────────────────────────────────────────────────────────────

export const DinheiroVaza: React.FC = () => {
  useBrandFonts();
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Background bg={(script as any).bg} mode={(script as any).bgMode} />
      <Series>
        {script.cenas.map((c: any) => {
          const frames = sceneFrames(c.id);
          return (
            <Series.Sequence key={c.id} durationInFrames={frames}>
              <Scene cena={c} dur={frames} />
              <Audio src={staticFile(`narracao/processed/${c.id}.wav`)} />
            </Series.Sequence>
          );
        })}
      </Series>
      <Frame />
      <BrandHeader />
      <Signature />
    </AbsoluteFill>
  );
};
