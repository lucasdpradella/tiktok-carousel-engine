// gerar-roteiro.mjs
// Recebe um tópico (string em pt-BR) → chama gpt-4o-mini com response_format JSON →
// devolve { caption, hashtags, slides: [tensao, resolucao] } com shapes DIFERENTES:
//   - slide 1 (tensao):    { ordem, tipo, headline, subtexto, texto_meta, sujeito_visual }   (vai pro gpt-image-1)
//   - slide 2 (resolucao): { ordem, tipo, titulo, bullets, tagline, texto_meta }              (vai pro template Pradex)

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat } from './openai-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Gera roteiro de carrossel de 2 slides (TENSÃO → RESOLUÇÃO) a partir de um tópico.
 *
 * @param {object} opts
 * @param {string} opts.topico — ex: "Reserva de emergência se mede pelo custo de viver, não pela renda"
 * @param {string} [opts.angulo] — opcional, ângulo editorial; se vazio, o modelo escolhe
 * @returns {Promise<{
 *   caption: string,
 *   hashtags: string[],
 *   slides: Array<{ ordem: number, tipo: 'tensao'|'resolucao', headline: string, subtexto: string, texto_meta: string, sujeito_visual: string }>
 * }>}
 */
export async function gerarRoteiro({ topico, angulo } = {}) {
  if (!topico || typeof topico !== 'string') {
    throw new Error('[gerar-roteiro] opts.topico (string) obrigatorio');
  }

  const systemPath = resolve(__dirname, '../prompts/system-roteirista.md');
  const bibliotecaPath = resolve(__dirname, '../prompts/financas-comportamentais.md');

  const [systemPrompt, biblioteca] = await Promise.all([
    readFile(systemPath, 'utf-8'),
    readFile(bibliotecaPath, 'utf-8'),
  ]);

  // monta system prompt = system-roteirista + 4000 chars da biblioteca de ângulos/temas
  const fullSystem = systemPrompt + '\n\n## CONTEXTO DA BIBLIOTECA\n\n' + biblioteca.slice(0, 4000);

  const userPrompt =
    `Tópico: ${topico}\n` +
    (angulo
      ? `Ângulo editorial: ${angulo}`
      : 'Ângulo: escolha 1 dos 10 da biblioteca (A reframe, B lista, C viés nomeado, D história/case, E pergunta provocativa, F mito vs verdade, G comparativo numérico, H checklist comportamental, I quote de impacto, J reflexão).') +
    '\n\nGere 2 slides (TENSÃO → RESOLUÇÃO) em JSON estrito (sem markdown, sem comentário fora do objeto).';

  let parsed;
  try {
    const { text } = await chat({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: fullSystem },
        { role: 'user', content: userPrompt },
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.85,
    });
    parsed = JSON.parse(text);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`[gerar-roteiro] JSON invalido retornado pelo modelo: ${e.message}`);
    }
    throw e;
  }

  // validacao de shape minimo
  if (!parsed.caption || typeof parsed.caption !== 'string') {
    throw new Error(
      'Roteiro inválido: caption ausente ou não-string. Recebido: ' +
        JSON.stringify(parsed).slice(0, 300)
    );
  }
  if (!Array.isArray(parsed.slides) || parsed.slides.length !== 2) {
    throw new Error(
      `Roteiro inválido: esperava slides.length === 2, recebeu ${parsed.slides?.length}. ` +
        JSON.stringify(parsed).slice(0, 300)
    );
  }
  for (const [i, s] of parsed.slides.entries()) {
    // tipo é opcional na resposta — se faltar, deduz pelo idx 0/1
    if (!s.tipo || (s.tipo !== 'tensao' && s.tipo !== 'resolucao')) {
      s.tipo = i === 0 ? 'tensao' : 'resolucao';
    }
    if (!s.texto_meta || typeof s.texto_meta !== 'string') {
      throw new Error(`Roteiro inválido: slide ${i + 1} sem 'texto_meta'. ` + JSON.stringify(s));
    }

    if (s.tipo === 'tensao') {
      // Schema clássico do gpt-image-1
      for (const k of ['headline', 'subtexto', 'sujeito_visual']) {
        if (!s[k] || typeof s[k] !== 'string') {
          throw new Error(
            `Roteiro inválido: slide TENSÃO sem '${k}'. ` + JSON.stringify(s)
          );
        }
      }
    } else {
      // Schema novo do template Pradex (slide RESOLUÇÃO)
      if (!Array.isArray(s.titulo) || s.titulo.length < 1 || s.titulo.length > 2) {
        throw new Error(
          `Roteiro inválido: slide RESOLUÇÃO 'titulo' precisa ser array de 1-2 [texto, estilo]. ` +
            JSON.stringify(s.titulo)
        );
      }
      for (const [j, t] of s.titulo.entries()) {
        if (!Array.isArray(t) || t.length !== 2 || typeof t[0] !== 'string') {
          throw new Error(
            `Roteiro inválido: titulo[${j}] mal formado, esperava [texto, estilo]. ` +
              JSON.stringify(t)
          );
        }
        if (!['r', 'i', 'i_underline'].includes(t[1])) {
          // normaliza pra 'r' se vier algo inesperado
          t[1] = 'r';
        }
      }
      if (!Array.isArray(s.bullets) || s.bullets.length < 1 || s.bullets.length > 4) {
        throw new Error(
          `Roteiro inválido: slide RESOLUÇÃO 'bullets' precisa ser array de 1-4 itens. ` +
            JSON.stringify(s.bullets)
        );
      }
      for (const [j, b] of s.bullets.entries()) {
        if (!Array.isArray(b) || b.length !== 3 || b.some((x) => typeof x !== 'string')) {
          throw new Error(
            `Roteiro inválido: bullet[${j}] mal formado, esperava [numero, titulo, descricao]. ` +
              JSON.stringify(b)
          );
        }
      }
      if (!Array.isArray(s.tagline) || s.tagline.length < 1 || s.tagline.length > 3) {
        throw new Error(
          `Roteiro inválido: slide RESOLUÇÃO 'tagline' precisa ser array de 1-3 strings. ` +
            JSON.stringify(s.tagline)
        );
      }
      for (const [j, line] of s.tagline.entries()) {
        if (typeof line !== 'string') {
          throw new Error(`Roteiro inválido: tagline[${j}] não é string.`);
        }
      }
    }
  }

  // hashtags default se vier vazio
  if (!Array.isArray(parsed.hashtags)) parsed.hashtags = [];

  return parsed;
}

// CLI: node src/gerar-roteiro.mjs "tópico aqui"
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const topico = process.argv[2];
  if (!topico) {
    console.error('Uso: node gerar-roteiro.mjs "Topico em pt-BR"');
    process.exit(1);
  }
  gerarRoteiro({ topico })
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(2);
    });
}
