// hashtags.mjs — hashtags OBRIGATÓRIAS travadas por pós-processamento (Squad XP B2B, 2026-07-21).
// Regra do programa: sem #squadxpb2b (+ futura #tema do briefing mensal) o conteúdo NÃO conta.
// Determinístico como o CTA: nunca depende do modelo. Dedupe case-insensitive.
//
// PONTO DE EXTENSÃO (Fase 2): quando o briefing mensal chegar, a hashtag do tema entra nesta
// lista (via config) — zero lógica de tema aqui por enquanto (decisão do Lucas pendente).

export const HASHTAGS_OBRIGATORIAS = ['#squadxpb2b'];

/**
 * Garante que a caption contenha todas as hashtags obrigatórias.
 * Anexa as faltantes na ÚLTIMA linha que já tem hashtags (junto das demais); se a caption
 * não tem nenhuma hashtag, cria uma linha nova no fim. Não duplica (case-insensitive).
 * @param {string} caption
 * @param {string[]} [obrigatorias]
 * @returns {string}
 */
export function garantirHashtags(caption, obrigatorias = HASHTAGS_OBRIGATORIAS) {
  let out = String(caption || '').replace(/\s+$/, '');
  const lower = out.toLowerCase();
  const faltantes = obrigatorias.filter((h) => !lower.includes(h.toLowerCase()));
  if (faltantes.length) {
    const linhas = out.split('\n');
    let idxTags = -1;
    for (let i = linhas.length - 1; i >= 0; i--) {
      if (linhas[i].includes('#')) {
        idxTags = i;
        break;
      }
    }
    if (idxTags >= 0) linhas[idxTags] = linhas[idxTags].replace(/\s+$/, '') + ' ' + faltantes.join(' ');
    else linhas.push('', faltantes.join(' '));
    out = linhas.join('\n');
  }
  return out + '\n';
}
