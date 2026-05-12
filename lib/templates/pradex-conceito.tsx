import React from 'react';

interface Bullet {
  label: string;        // ex: "Onde guardar?" (negrito)
  texto: string;        // explicação
}

interface Props {
  serie: string;        // ex: "MANUAL DO DINHEIRO"
  ordem: string;        // ex: "CAP. 03"
  tituloRiscado?: string; // texto riscado em cinza (a "ideia errada"), ex: "Sua renda × 6"
  titulo: string;       // título principal serif, com ~itálico~
  corpoDestaque: string;// texto serif médio com ~itálico~ (a "ideia certa"), ex: "Seus ~gastos fixos~ × 6 meses."
  explicacao: string;   // parágrafo curto sans-serif
  bullets?: Bullet[];   // opcional, 1-2 bullets tipo "Onde guardar? — Liquidez diária..."
  proximoLabel?: string;// ex: "Próximo:"
  proximoTitulo?: string;// ex: "3 erros que travam tudo"
  marca?: string;
}

const COLORS = {
  bg: '#F0EAE0',
  ink: '#1A1A1A',
  inkSoft: '#5F5C57',
  inkRiscado: '#A6A09A',
  accent: '#C04A2B',
  frame: '#1A1A1A',
};

function comItalico(s: string): React.ReactNode {
  // Estrategia: separador EXPLICITO entre partes. Trim do texto + span " " entre os itens.
  // (Satori junta flex items sem espaco mesmo com gap.)
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
 * Slide de CONCEITO — padrão "A conta certa".
 * Tem opcional o texto riscado (ideia errada) e o texto destacado (ideia certa).
 * Usado pra reframes comportamentais: "você pensa X, na verdade é Y".
 */
export const PradexConceito: React.FC<Props> = ({
  serie,
  ordem,
  tituloRiscado,
  titulo,
  corpoDestaque,
  explicacao,
  bullets = [],
  proximoLabel = 'Próximo:',
  proximoTitulo,
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

      {/* Título principal */}
      <div
        style={{
          display: 'flex',
          color: COLORS.ink,
          fontFamily: 'Playfair',
          fontWeight: 700,
          fontSize: 124,
          lineHeight: 1.0,
          letterSpacing: -2,
          marginTop: 56,
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        {comItalico(titulo)}
      </div>
      {/* Sublinha decorativa laranja */}
      <div
        style={{
          display: 'flex',
          width: 90,
          height: 5,
          backgroundColor: COLORS.accent,
          marginBottom: 56,
        }}
      />

      {/* Riscado (ideia errada) */}
      {tituloRiscado ? (
        <div
          style={{
            display: 'flex',
            color: COLORS.inkRiscado,
            fontFamily: 'Playfair',
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 62,
            textDecoration: 'line-through',
            textDecorationColor: COLORS.accent,
            marginBottom: 32,
          }}
        >
          {tituloRiscado}
        </div>
      ) : null}

      {/* Destaque (ideia certa) */}
      <div
        style={{
          display: 'flex',
          color: COLORS.ink,
          fontFamily: 'Playfair',
          fontWeight: 700,
          fontSize: 72,
          lineHeight: 1.05,
          marginBottom: 36,
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        {comItalico(corpoDestaque)}
      </div>

      {/* Explicação */}
      <div
        style={{
          display: 'flex',
          color: COLORS.ink,
          fontFamily: 'Inter',
          fontWeight: 400,
          fontSize: 30,
          lineHeight: 1.35,
          marginBottom: 32,
          whiteSpace: 'pre-line',
        }}
      >
        {explicacao}
      </div>

      {/* Bullets */}
      {bullets.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {bullets.map((b, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  color: COLORS.ink,
                  fontFamily: 'Inter',
                  fontWeight: 700,
                  fontSize: 30,
                  marginBottom: 4,
                }}
              >
                {b.label}
              </div>
              <div
                style={{
                  color: COLORS.ink,
                  fontFamily: 'Inter',
                  fontWeight: 400,
                  fontSize: 28,
                  lineHeight: 1.35,
                }}
              >
                {b.texto}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ flex: 1, display: 'flex' }} />

      {/* Próximo */}
      {proximoTitulo ? (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40 }}>
          <div
            style={{
              color: COLORS.inkSoft,
              fontFamily: 'Inter',
              fontWeight: 500,
              fontSize: 28,
             