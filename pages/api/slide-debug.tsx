import React from 'react';
import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';

export const config = { runtime: 'edge' };

/**
 * /api/slide-debug — compara 3 estratégias de renderização de título com itálico inline.
 *
 * Mesmo input ("A conta ~certa~.") renderizado de 3 jeitos:
 *   A) flex + spans (estado atual em prod, BUG: "A contacerta.")
 *   B) flex + Fragment text nodes (Plano B revisado)
 *   C) flex + separator-span com nbsp (5a tentativa, já provada falha)
 *
 * Espera-se que B renderize "A conta certa." com espaços corretos.
 *
 * NÃO ATIVAR EM PROD — endpoint só pra validação local.
 */

const FONT_URLS = {
  interBold: 'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf',
  playfairBold: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.ttf',
  playfairBoldItalic: 'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-italic.ttf',
};

async function loadFonts() {
  const fetchFont = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font fetch failed: ${url}`);
    return res.arrayBuffer();
  };
  const [inB, pfB, pfBI] = await Promise.all([
    fetchFont(FONT_URLS.interBold),
    fetchFont(FONT_URLS.playfairBold),
    fetchFont(FONT_URLS.playfairBoldItalic),
  ]);
  return [
    { name: 'Inter', data: inB, weight: 700 as const, style: 'normal' as const },
    { name: 'Playfair', data: pfB, weight: 700 as const, style: 'normal' as const },
    { name: 'Playfair', data: pfBI, weight: 700 as const, style: 'italic' as const },
  ];
}

const COLORS = { bg: '#F0EAE0', ink: '#1A1A1A', accent: '#C04A2B', muted: '#5F5C57' };

// ────────────────────────────────────────────────────────────────
// 3 estratégias renderizando "A conta ~certa~." e
// "Antes de investir, ~organize-se~."
// ────────────────────────────────────────────────────────────────

// A — flex + spans (estado original, BUG)
const renderA = (s: string) => {
  const raw = s.split('~');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', fontFamily: 'Playfair', fontSize: 80, color: COLORS.ink, lineHeight: 1 }}>
      {raw.map((p, i) =>
        i % 2 === 1
          ? <span key={i} style={{ fontStyle: 'italic', color: COLORS.accent }}>{p}</span>
          : <span key={i}>{p}</span>
      )}
    </div>
  );
};

// B — flex + Fragment text nodes (Plano B revisado)
const renderB = (s: string) => {
  const raw = s.split('~');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', fontFamily: 'Playfair', fontSize: 80, color: COLORS.ink, lineHeight: 1 }}>
      {raw.map((p, i) =>
        i % 2 === 1
          ? <span key={i} style={{ fontStyle: 'italic', color: COLORS.accent }}>{p}</span>
          : <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </div>
  );
};

// C — flex + separator-span (5a tentativa, FALHOU em prod)
const renderC = (s: string) => {
  const raw = s.split('~');
  const out: React.ReactNode[] = [];
  raw.forEach((p, i) => {
    const trimmed = p.replace(/^[\s ]+|[\s ]+$/g, '');
    if (!trimmed) return;
    if (out.length > 0) out.push(<span key={`sep-${i}`}>&nbsp;</span>);
    if (i % 2 === 1) {
      out.push(<span key={i} style={{ fontStyle: 'italic', color: COLORS.accent }}>{trimmed}</span>);
    } else {
      out.push(<span key={i}>{trimmed}</span>);
    }
  });
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', fontFamily: 'Playfair', fontSize: 80, color: COLORS.ink, lineHeight: 1 }}>
      {out}
    </div>
  );
};

const Caso: React.FC<{ label: string; node: React.ReactNode }> = ({ label, node }) => (
  <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 40 }}>
    <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 24, color: COLORS.muted, marginBottom: 12, letterSpacing: 2 }}>
      {label}
    </div>
    {node}
  </div>
);

export default async function handler(_req: NextRequest) {
  const fonts = await loadFonts();
  const TESTES = [
    'A conta ~certa~.',
    'Antes de investir, ~organize-se~.',
    'Seus ~gastos fixos~ × 6 meses.',
  ];

  const element = (
    <div
      style={{
        width: '100%', height: '100%', backgroundColor: COLORS.bg,
        padding: 60, display: 'flex', flexDirection: 'column',
        fontFamily: 'Inter',
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.accent, marginBottom: 30, letterSpacing: 2 }}>
        SLIDE-DEBUG · COMPARAÇÃO DE ESTRATÉGIAS
      </div>

      <Caso label="A · FLEX + SPANS (estado prod — BUG: palavras coladas)" node={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {TESTES.map((t, i) => <div key={i} style={{ display: 'flex', marginBottom: 8 }}>{renderA(t)}</div>)}
        </div>
      }/>

      <Caso label="B · BLOCK + TEXT NODES (Plano B proposto — deve renderizar com espaços)" node={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {TESTES.map((t, i) => <div key={i} style={{ display: 'flex', marginBottom: 8 }}>{renderB(t)}</div>)}
        </div>
      }/>

      <Caso label="C · FLEX + SEPARATOR-SPAN com nbsp (5a tentativa — FALHOU em prod)" node={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {TESTES.map((t, i) => <div key={i} style={{ display: 'flex', marginBottom: 8 }}>{renderC(t)}</div>)}
        </div>
      }/>
    </div>
  );

  return new ImageResponse(element, {
    width: 1200,
    height: 1600,
    fonts,
  });
}
