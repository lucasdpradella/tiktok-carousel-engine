// gerar-carrossel.mjs
// STUB — Milestone 2: implementar quando billing Gemini estiver ativo.
//
// Orquestra o post inteiro: pega tópico do Supabase → gera roteiro →
// gera 5 imagens em sequência (com referência do slide anterior) →
// faz upload no Supabase Storage → retorna URLs pro n8n publicar.

/**
 * Gera 1 carrossel completo (5 slides) a partir de UM tópico.
 *
 * @param {object} opts
 * @param {string} opts.topicoId   PK em supabase.topics
 * @returns {Promise<{
 *   postId: string,
 *   caption: string,
 *   slides: Array<{ ordem: number, url: string }>,
 *   custoEstimado: number
 * }>}
 */
export async function gerarCarrossel({ topicoId } = {}) {
  // TODO Milestone 2 — implementar quando billing ativo
  // 1) supabase: select * from topics where id = topicoId
  // 2) gerarRoteiro({ topico, angulo }) → { caption, slides[5] }
  // 3) for slide of slides:
  //      png = await gerarImagem({ slide, anguloEditorial, referenciaSlideAnterior })
  //      url = await uploadSupabaseStorage(png, `posts/${postId}/slide-${slide.ordem}.png`)
  // 4) insert into posts (...) returning postId
  // 5) retornar { postId, caption, slides:[{ordem,url}...], custoEstimado: 5 * 0.04 }
  throw new Error('not implemented — Milestone 2');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('gerar-carrossel.mjs: stub Milestone 2 — ainda não implementado.');
  process.exit(2);
}
