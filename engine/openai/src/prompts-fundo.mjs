// prompts-fundo.mjs — biblioteca de prompts de FUNDO por categoria (portada de fundos-prompts.md,
// 2026-07-19). O fundo é gerado POR POST em runtime (Nano Banana); isto aqui dá variedade com
// coesão: 3 variações por categoria + rodízio persistente (estado-fundos.json) + coringa
// paisagem/genérico ocasional (a cada 4 fundos). Rodapé de regras duras SEMPRE anexado.
//
// Camadas finais: foto (Nano Banana) → overlay marinho fixo (Background.tsx) → texto marfim.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ESTADO_FUNDOS = resolve(__dirname, '../../video/estado-fundos.json');

// Rodapé de regras duras (marca) — anexado a TODO prompt.
const RODAPE =
  ' Deep navy #122033 tones, cinematic low-key private-banking aesthetic, generous darker ' +
  'negative space for text overlay, absolutely no text no words no letters no logos no watermark, ' +
  'no people, photorealistic, vertical.';

const BIBLIOTECA = {
  investimento: [
    'Elegant dark navy home-office desk at night, closed leather notebook, fountain pen, a cup of espresso, soft warm rim light from the side, empty darker space on the left for text, premium wealth-management aesthetic.',
    'Overhead flat-lay on a dark navy surface: leather notebook, pen, minimalist analog watch, single warm light source, moody, negative space lower-left, luxury finance mood.',
    'Close-up of a brass balance scale on a dark walnut desk, single warm spotlight, deep shadows all around, refined and calm, large dark area on the left.',
  ],
  planejamento: [
    'Minimalist dark navy desk with an open blank-paged planner seen from a low angle, warm desk lamp glow on the right edge, everything else falling into deep shadow, calm and organized mood.',
    'A neat stack of three hardcover books and a small hourglass on a dark navy table, soft warm side light, deep shadows, premium editorial still life, dark negative space above.',
    'Architectural blueprint tube and a brass compass resting on dark leather, low-key warm light, elegant planning mood, large dark space on the left.',
  ],
  mercado: [
    'Modern financial district skyline at blue hour seen through a window, deep navy sky, distant warm city lights bokeh, reflective glass, dark and sophisticated, large darker area on the left for text.',
    'Abstract dark navy surface with subtle golden light streaks suggesting movement and markets, minimal, elegant, lots of clean dark space, no charts.',
    'Rain-speckled window at night overlooking blurred warm city lights far below, deep marine blue dominating, contemplative and premium, dark left side.',
  ],
  saude: [
    'Calm minimalist scene: a glass of water and a small plant on a dark navy table, soft morning side light, serene, clean darker space for text on the left, premium wellbeing mood.',
    'Softly lit modern clinic corridor at dusk, deep navy shadows, clean and calm, warm distant light, cinematic depth, dark negative space.',
    'A folded white towel, smooth stones and a sprig of eucalyptus on a dark slate surface, gentle warm light from one side, spa-like serenity, deep navy shadows around.',
  ],
  aposentadoria: [
    'Serene coastal landscape at dusk, deep navy sea and sky, a lone calm horizon, subtle golden light on the water, peaceful, lots of dark sky for text overlay, premium aspirational mood.',
    'Quiet mountain lake at blue hour, deep marine tones, still water reflection, moody and elegant, dark upper sky as negative space.',
    'Empty wooden pier extending into calm dark water at dusk, faint warm glow at the horizon, tranquil and contemplative, large dark sky.',
  ],
  comportamento: [
    'Symbolic minimalist still life on dark navy: a chess piece under a single warm spotlight, deep shadows, thoughtful and calm mood, clean dark space around it, premium editorial.',
    'A single winding road or path seen from above at dusk through deep navy tones, sense of decision and direction, minimal, dark negative space.',
    'Two doors side by side in a dark navy wall, one slightly ajar with faint warm light escaping, symbolic of choice, moody and minimal, dark surroundings.',
  ],
  paisagem: [
    'Breathtaking aerial landscape at blue hour, rolling hills or coastline fading into deep navy mist, calm, elegant, large dark sky area for text, premium.',
    'Vast starless night sky over a dark silhouetted ridge line, deep marine gradient, one faint warm glow near the horizon, minimal and contemplative.',
    'Slow river bend seen from above at dusk, deep navy water and dark banks, subtle golden reflection, serene and cinematic.',
  ],
  generico: [
    'Abstract elegant marine-blue textured background, subtle gradient with a faint warm glow in one corner, lots of clean space, luxury minimal.',
    'Dark navy silk or heavy fabric draped with soft folds, one warm highlight grazing the texture, sophisticated and quiet, plenty of dark area.',
    'Deep navy wall with a single soft pool of warm light from above, empty room atmosphere, minimal, premium gallery mood.',
  ],
};

const CORINGAS = ['paisagem', 'generico'];
const CADA_QUANTOS_CORINGA = 4; // a cada 4 fundos, 1 vira paisagem/genérico (a "paisagem ocasional")

function lerEstado() {
  try {
    if (existsSync(ESTADO_FUNDOS)) return JSON.parse(readFileSync(ESTADO_FUNDOS, 'utf-8'));
  } catch {
    /* estado corrompido → recomeça */
  }
  return { ultimo: {}, total: 0 };
}

/**
 * Escolhe o prompt do fundo pro tema: categoria do tema (ou coringa ocasional), rotacionando
 * as variações (nunca repete a última da categoria). Com persistir=false (dry-run) o rodízio
 * NÃO avança — teste não gasta a sequência.
 * @returns {{ prompt: string, id: string, categoria: string }}
 */
export function escolherPromptFundo({ categoria = 'generico', persistir = true } = {}) {
  const estado = lerEstado();
  let cat = BIBLIOTECA[categoria] ? categoria : 'generico';
  // coringa ocasional: a cada N fundos, troca a categoria do tema por paisagem/genérico
  if ((estado.total + 1) % CADA_QUANTOS_CORINGA === 0 && !CORINGAS.includes(cat)) {
    cat = CORINGAS[Math.floor((estado.total / CADA_QUANTOS_CORINGA) % CORINGAS.length)];
  }
  const variacoes = BIBLIOTECA[cat];
  const ultima = typeof estado.ultimo?.[cat] === 'number' ? estado.ultimo[cat] : -1;
  const n = (ultima + 1) % variacoes.length;
  if (persistir) {
    estado.ultimo = { ...(estado.ultimo || {}), [cat]: n };
    estado.total = (estado.total || 0) + 1;
    writeFileSync(ESTADO_FUNDOS, JSON.stringify(estado, null, 2) + '\n');
  }
  return { prompt: variacoes[n] + RODAPE, id: `${cat}-${n + 1}`, categoria: cat };
}
