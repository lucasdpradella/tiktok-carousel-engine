import React from 'react';

interface Item {
  badge: string;   // ex: "01" | "até 50%" | "min 20%"
  titulo: string;  // ex: "Mapear" | "Essenciais"
  descricao: string;
}

interface Props {
  serie: string;
  ordem: string;
  titulo: string;          // serif gigante com ~itálico~
  itens: Item[];           // 3 itens é o sweet spot
  rodapeNota?: string;     // ex: "Não pule a etapa 02. Investir sem reserva é construir em areia."
  proximoLabel?: string;
  proximoTitulo?: string;
  marca?: string;
  pillLabel?: string;      // ex: "DICA DO PRADELLA" — desenha a pílula laranja
}

const COLORS = {
  bg: '#F0EAE0',
  ink: '#1A1A1A',
  inkSoft: '#5F5C57',
  accent: '#C04A2B',
  frame: '#1A1A1A',
};

function comItalico(s: string): React.ReactNode[] {
  return s.split('~').map((p, i) =>
    i % 2 === 1 ? (
      <span key={i} style={{ fontStyle: 'italic' }}>
        {p}
      </span>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );
}

/**
 * Slide de LISTA (3 itens) — padrão "O mapa em 3 partes" / "Por onde começar".
 * Cada item: badge em laranja serif + título sans-serif bold + descrição.
 */
export const PradexLista: React.FC<Props> = ({
  serie,
  ordem,
  titulo,
  itens,
  rodapeNota,
  proximoLabel = 'Próximo:',
  proximoTitulo,
  pillLabel,
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

      {/* Titulo -- display:block pra Satori tratar como fluxo de texto */}
      <div
        style={{
          display: 'block',
          color: COLORS.ink,
          fontFamily: 'Playfair',
          fontWeight: 700,
          fontSize: 112,
          lineHeight: 1.0,
          letterSpacing: -2,
          marginTop: 56,
          marginBottom: 12,
        }}
      >
        {comItalico(titulo)}
      </div>
      <div
        style={{
          display: 'flex',
          width: 90,
          height: 5,
          backgroundColor: COLORS.accent,
          marginBottom: 56,
        }}
      />

      {/* Itens */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
        {itens.map((it, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div
              style={{
                display: 'flex',
                width: 230,
                color: COLORS.accent,
                fontFamily: 'Playfair',
                fontStyle: 'italic',
                fontWeight: 600,
                fontSize: 56,
                lineHeight: 1.0,
              }}
            >
              {it.badge}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
              }}
            >
              <div
                style={{
                  color: COLORS.ink,
                  fontFamily: 'Inter',
                  fontWeight: 800,
                  fontSize: 44,
                  lineHeight: 1.1,
                  marginBottom: 8,
                }}
              >
                {it.titulo}
              </div>
              <div
                style={{
                  color: COLORS.ink,
                  fontFamily: 'Inter',
                  fontWeight: 400,
                  fontSize: 30,
                  lineHeight: 1.3,
                }}
              >
                {it.descricao}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex' }} />

      {/* Pílula "DICA DO PRADELLA" + rodapé nota */}
      {pillLabel || rodapeNota ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 40,
            marginBottom: rodapeNota ? 32 : 0,
          }}
        >
          {pillLabel ? (
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-end',
                backgroundColor: COLORS.accent,
                color: '#FFFFFF',
                fontFamily: 'Inter',
                fontWeight: 800,
                fontSize: 26,
                letterSpacing: 2,
                padding: '14px 32px',
                borderRadius: 999,
                marginBottom: 16,
              }}
            >
              {pillLabel}
            </div>
          ) : null}
          {rodapeNota ? (
            <div
              style={{
                display: 'flex',
                color: COLORS.ink,
                fontFamily: 'Playfair',
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 42,
                lineHeight: 1.25,
                whiteSpace: 'pre-line',
              }}
            >
              {rodapeNota}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Próximo */}
      {proximoTitulo ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              color: COLORS.inkSoft,
              fontFamily: 'Inter',
              fontWeight: 500,
              fontSize: 28,
              marginBottom: 6,
            }}
          >
            {proximoLabel}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              color: COLORS.accent,
              fontFamily: 'Playfair',
              fontStyle: 'italic',
              fontWeight: 600,
              fontSize: 40,
            }}
          >
            {proximoTitulo} ›
          </div>
        </div>
      ) : null}
    </div>
  </div>
);
