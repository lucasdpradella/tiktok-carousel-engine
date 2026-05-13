// gerar-imagem.mjs
// STUB — Milestone 2: implementar quando billing Gemini estiver ativo.
//
// Recebe UM slide (vindo do gerar-roteiro) e devolve o PNG Buffer.
// Para slides 2-5 do mesmo post, recebe também o PNG do slide anterior
// pra forçar consistência de estilo via image-to-image.

/**
 * Gera PNG editorial pra um slide.
 *
 * @param {object} opts
 * @param {{
 *   ordem: number,
 *   texto_overlay: string,
 *   texto_meta: string,
 *   sujeito_visual: string
 * }} opts.slide
 * @param {string} [opts.anguloEditorial]   tom/ângulo herdado de topics.angulo
 * @param {Buffer} [opts.referenciaSlideAnterior]   PNG buffer do slide N-1 (opcional)
 * @param {string} [opts.model='gemini-2.5-flash-image']
 * @returns {Promise<{ buffer: Buffer, mimeType: string }>}
 */
export async function gerarImagem({
  slide,
  anguloEditorial = 'planejador CFP, sério mas humano',
  referenciaSlideAnterior = null,
  model = 'gemini-2.5-flash-image',
} = {}) {
  // TODO Milestone 2 — implementar quando billing ativo
  // 1) ler prompts/system-visual.md (template)
  // 2) preencher slots {texto_overlay}, {texto_meta}, {sujeito_visual}, {angulo_editorial}
  // 3) se referenciaSlideAnterior != null, incluir como inlineData no contents[0].parts
  // 4) generateImage({ model, prompt }) — wrapper já lida com inlineData se body custom
  //    (provavelmente vai precisar usar callGemini direto pra incluir referência)
  // 5) retornar { buffer, mimeType }
  throw new Error('not implemented — Milestone 2');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('gerar-imagem.mjs: stub Milestone 2 — ainda não implementado.');
  process.exit(2);
}
