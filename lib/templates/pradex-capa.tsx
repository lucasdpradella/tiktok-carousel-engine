import React from 'react';

interface Props {
  serie: string;          // ex: "MANUAL DO DINHEIRO" | "SÉRIE CFP" | "VIESES"
  ordem: string;          // ex: "01 DE 08" | "CAP. 03"
  numero: string;         // ex: "01" | "03" — exibido grande em laranja
  titulo: string;         // título serif gigante (use ~ pra marcar palavra em itálico, ex: "Antes de investir, ~organize-se~.")
  moduloLabel: string;    // ex: "MÓDULO 01" | "CAPÍTULO 03"
  moduloTitulo: string;   // ex: "Organização Financeira"
  moduloDescricao: string;// 2-3 linhas
  rodapeEsq?: string;     // default "deslize › ›"
  rodapeDir?: string;     // default "uma série em 8 partes"
  marca?: string;         // default "PRADEX"
}

const COLORS = {
  bg: '#F0EAE0',
  ink: '#1A1A1A',
  inkSoft: '#5F5C57',
  accent: '#C04A2B',
  frame: '#1A1A1A',
};

/**
 * Quebra o título em pedaços renderizando ~itálico~ como <i>.
 * Ex: "Antes de investir, ~organize-se~." vira ["Antes de investir, ", <i>organize-se</i>, "."]
 */
function renderTituloComItalico(titulo: string): React.ReactNode {
  // Separador explicito (&nbsp; em span proprio) entre as partes.
  const raw = titulo.split('~');
  const out: React.ReactNode[] = [];
  raw.forEach((p, i) => {
    const trimmed = p.replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '');
    if (!trimmed) return;
    if (out.length > 0) {
      out.push(<span key={`sep-${i}`}>&nbsp;</span>);
    }
    if (i % 2 === 1) {
      out.push(<span key={i} style={{ fontStyle: 'italic' }}>{trimmed}</span>);
    } else {
      out.push(<span key={i}>{trimmed}</span>);
    }
  });
  return out;
}

/**
 * Capa de série/módulo — padrão Pradex "Manual do Dinheiro".
 * 1080×1920. Tipografia editorial, sem foto de fundo.
 */
export const PradexCapa: React.FC<Props> = ({
  serie,
  ordem,
  numero,
  titulo,
  moduloLabel,
  moduloTitulo,
  moduloDescricao,
  rodapeEsq = 'deslize › ›',
  rodapeDir = 'uma série em 8 partes',
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
    {/* Frame interno */}
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        border: `2px solid ${COLORS.frame}33`,
        padding: '80px 90px 90px 90px',
        position: 'relative',
      }}
    >
      {/* Top: série · ordem · marca */}
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

      {/* Número grande no canto direito */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 70,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            color: COLORS.accent,
            fontFamily: 'Playfair',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: 180,
            lineHeight: 1,
          }}
        >
          {numero}
        </div>
      </div>

      {/* Título serif gigante */}
      <div
        style={{
          display: 'flex',
          color: COLORS.ink,
          fontFamily: 'Playfair',
          fontWeight: 700,
          fontSize: 120,
          lineHeight: 1.0,
          letterSpacing: -2,
          marginTop: 10,
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        {renderTituloComItalico(titulo)}
      </div>

      {/* Espaço flexível */}
      <div style={{ flex: 1, display: 'flex' }} />

      {/* Bloco módulo */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            width: 70,
            height: 4,
            backgroundColor: COLORS.accent,
            marginBottom: 24,
          }}
        />
        <div
          style={{
            color: COLORS.ink,
            fontFamily: 'Inter',
            fontWeight: 800,
            fontSize: 32,
            letterSpacing: 2,
            marginBottom: 12,
          }}
        >
          {moduloLabel}
        </div>
        <div
          style={{
            color: COLORS.ink,
            fontFamily: 'Playfair',
            fontWeight: 500,
            fontSize: 56,
            lineHeight: 1.1,
            marginBottom: 24,
          }}
        >
          {moduloTitulo}
        </div>
        <div
          style={{
            color: COLORS.inkSoft,
            fontFamily: 'Inter',
            fontWeight: 400,
            fontSize: 30,
            lineHeight: 1.35,
            marginBottom: 56,
            whiteSpace: 'pre-line',
          }}
        >
          {moduloDescricao}
        </div>
      </div>

      {/* Rodapé */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <div
          style={{
            color: COLORS.accent,
            fontFamily: 'Inter',
            fontWeig