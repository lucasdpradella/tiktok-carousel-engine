// gerar-roteiro.mjs
// STUB — Milestone 2: implementar quando billing Gemini estiver ativo.
//
// Lê um tópico do Supabase (claim_next_topic) → chama generateText com o
// system-roteirista.md → valida JSON → salva em topics.roteiro_json.

/**
 * Gera roteiro de carrossel a partir de um tópico Supabase.
 *
 * @param {object} opts
 * @param {string} opts.topico   ex: "Reserva de emergência menor do que deveria"
 * @param {string} opts.angulo   ex: "subestimação do gasto fixo"
 * @returns {Promise<{
 *   caption: string,
 *   slides: Array<{
 *     ordem: number,
 *     texto_overlay: string,
 *     texto_meta: string,
 *     sujeito_visual: string
 *   }>
 * }>}
 */
export async function gerarRoteiro({ topico, angulo } = {}) {
  // TODO Milestone 2 — implementar quando billing ativo
  // 1) ler prompts/system-roteirista.md
  // 2) montar prompt = systemPrompt + '\n\nINPUT: ' + JSON.stringify({ topico, angulo })
  // 3) generateText({ model: 'gemini-2.5-flash', prompt, schema: ROTEIRO_SCHEMA, temperature: 0.7 })
  // 4) JSON.parse + validar shape
  // 5) retornar
  throw new Error('not implemented — Milestone 2');
}

// Permite uso como CLI: node src/gerar-roteiro.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('gerar-roteiro.mjs: stub Milestone 2 — ainda não implementado.');
  process.exit(2);
}
