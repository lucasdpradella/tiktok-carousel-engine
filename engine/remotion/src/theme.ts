// theme.ts — rebrand "Lucas Pradella · Assessor" (fundo escuro + marfim + dourado).
export const C = {
  bg: '#122033', // azul-petróleo escuro
  ink: '#F7F1E3', // marfim (texto primário sobre o fundo escuro)
  inkSoft: '#D8CDB0', // marfim suave (texto secundário)
  accent: '#C2A24E', // dourado
  white: '#FFFFFF',
  sent: '#D4E0C7', // verde suave (não usado aqui, reservado p/ consistência)
};

export const SERIF = 'Lora'; // títulos (serifada elegante)
export const SANS = 'Poppins'; // corpo / labels

// Fundo fotográfico (Nano Banana, por post) sob o texto. 'foto' = usa a imagem (se houver) + scrim;
// 'solido' = marinho liso. Kill-switch reversível (voltar pra 'solido' mata a foto sem quebrar).
// LIGADO por default em 2026-07-19 (briefing fundo automático). Sem imagem → cai no sólido sozinho.
export const BG_MODE: 'foto' | 'solido' = 'foto';

export const W = 1080;
export const H = 1920;
export const FPS = 30;

// Zona segura: bottom ~20% coberto pela UI do TikTok → texto nunca entra aí.
export const SAFE_BOTTOM = Math.round(H * 0.2); // 384px livres embaixo
