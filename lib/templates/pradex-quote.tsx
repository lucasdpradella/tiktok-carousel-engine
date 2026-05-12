import React from 'react';

interface Props {
  serie: string;
  ordem: string;
  quote: string;          // frase grande, serif com ~itálico~ pra ênfase
  autoria?: string;       // ex: "Daniel Kahneman" ou "Lucas Pradella, CFP®"
  rodapeContexto?: string;// 1-2 linhas em sans-serif explicando por que aquela frase importa
  marca?: string;
}

const COLORS = {
  bg: '#F0EAE0',
  ink: '#1A1A1A',
  inkSoft: '#5F5C57',
  accent: '#C04A2B',
  frame: '#1A1A1A',
};

function comItalico(s: string): React.ReactNode {
  const raw = s.split('~');
  const out: React.ReactNode[] = [];
  raw.forEach((p, i) => {
    const trimmed = p.replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '');
    if (!trimmed) return;
    if (out.length > 0) {
      out.push(<span key={`sep-${i}`}>&nbsp;</span>);
    }
    if (i % 2 === 1) {
      out.push(<span key={i} style={{ fontStyle: 'italic', color: COLORS.accent }}>{trimmed}</span>);
    } else {
      out.push(<span key={i}>{trimmed}</span>);
    }
  });
  return out;
}

/**
 * Slide de QUOTE — pra frases de impacto comportamental (Kahneman, Munger, Thaler ou autoria do Lucas).
 * Layout vertical centrado, aspas decorativas.
 */
export const PradexQuote: React.FC<Props> = ({
  serie,
  ordem,
  quote,
  autoria,
  rodapeContexto,
  marca = 'PRADEX',
}) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      backgroundColor: COLORS.bg,
      padding: 50,
    }}
  >
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        border: `2px solid ${COLORS.frame}33`,
        padding: '80px 90px 90px 90px',
      }}
    >
      {/* Top */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          paddingBottom: 24,
          borderBottom: `2px solid ${COLORS.ink}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            color: COLORS.accent,
            fontFamily: 'Inter',
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 3,
          }}
        >
          {serie} · {ordem}
        </div>
        <div
          style={{
            display: 'flex',
            color: COLORS.ink,
            fontFamily: 'Inter',
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: 1.5,
          }}
        >
          {marca}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex' }} />

      {/* Aspa decorativa */}
      <div
        style={{
          display: 'flex',
          color: COLORS.accent,
          fontFamily: 'Playfair',
          fontWeight: 700,
          fontSize: 280,
          lineHeight: 0.7,
          marginBottom: 20,
        }}
      >
        “
      </div>

      {/* Quote */}
      <div
        style={{
          display: 'flex',
          color: COLORS.ink,
          fontFamily: 'Playfair',
          fontWeight: 500,
          fontStyle: 'italic',
          fontSize: 78,
          lineHeight: 1.15,
          letterSpacing: -1,
          marginBottom: 50,
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        {comItalico(quote)}
      </div>

      {/* Autoria */}
      {autoria ? (
        <div
          style={{
            display: 'flex',
            color: COLORS.ink,
            fontFamily: 'Inter',
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: 2,
            marginBottom: 24,
          }}
        >
          — {autoria}
        </div>
      ) : null}

      <div style={{ flex: 1, display: 'flex' }} />

      {/* Rodapé com contexto */}
      {rodapeContexto ? (
        <div
          style={{
            display: 'flex',
            color: COLORS.inkSoft,
            fontFamily: 'Inter',
            fontWeight: 400,
            fontSi