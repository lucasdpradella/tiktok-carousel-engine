// theme.ts — marca PRADEX "Manual do Dinheiro" (mesma paleta dos slides de carrossel).
export const C = {
  bg: '#F0EAE0', // creme quente
  ink: '#15171C', // grafite quente escuro
  inkSoft: '#3C4048', // grafite suave
  accent: '#C04A2B', // terracota / tijolo
  white: '#FFFFFF',
  sent: '#D4E0C7', // verde suave (não usado aqui, reservado p/ consistência)
};

export const SERIF = 'Lora'; // títulos (serifada elegante)
export const SANS = 'Poppins'; // corpo / labels

export const W = 1080;
export const H = 1920;
export const FPS = 30;

// Zona segura: bottom ~20% coberto pela UI do TikTok → texto nunca entra aí.
export const SAFE_BOTTOM = Math.round(H * 0.2); // 384px livres embaixo
