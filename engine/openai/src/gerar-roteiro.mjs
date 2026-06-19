// gerar-roteiro.mjs
// Recebe um tópico (string em pt-BR) → chama gpt-4o-mini com response_format JSON →
// devolve { caption, hashtags, slides: [tensao, resolucao] }.
// Ambos os slides agora rodam em template Python (sem gpt-image-1). Shapes:
//   - slide 1 (tensao):    { ordem, tipo, titulo, cap_nome, cap_desc, texto_meta }
//   - slide 2 (resolucao): { ordem, tipo, titulo, bullets, tagline, texto_meta }
// O texto_meta vem com placeholder "{{CAP}}" — o orquestrador substitui pelo nº do capítulo.

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
export async function gerarRoteiro({ topico, angulo, puxada = false } = {}) {
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

  const puxadaInstr = puxada
    ? '\n\nESTE É UM POST-PUXADA: além dos 2 slides, emita TAMBÉM um objeto "slide3" ' +
      '(tipo "solucao") com o pitch do PRADEX, adaptado AO TEMA do capítulo. Shape EXATO do slide3:\n' +
      '{\n' +
      '  "tipo": "solucao",\n' +
      '  "hook": [["linha 1", "r"], ["linha 2", "i"]],   // 2 linhas serif, ≤18 chars cada; última pode ser "i" (italic). Pergunta prática "e na vida real, como você faz X?"\n' +
      '  "contraste": "string",                            // 1 linha curta (≤40 chars): a dor de fazer manual (ex "Planilha trava. A cabeça esquece.")\n' +
      '  "mock_enviado": "string",                         // mensagem informal que o usuário mandaria no WhatsApp, sobre ORGANIZAÇÃO (ex "gastei 25 no almoço")\n' +
      '  "mock_resposta": "string",                        // resposta do PRADEX começando com "✓ " (ex "✓ Lançado em Alimentação — R$25")\n' +
      '  "fecho": ["linha 1", "linha 2", "linha 3"],       // 2-4 linhas serif curtas (≤22 chars): "No PRADEX você ... pelo WhatsApp."\n' +
      '  "texto_meta": "MANUAL DO DINHEIRO  ·  CAP. {{CAP}}"\n' +
      '}\n' +
      'REGRAS do slide3: sempre sobre ORGANIZAÇÃO/PLANEJAMENTO (lançar gasto, ver resumo, dividir orçamento) — NUNCA investimento/ativo. ' +
      'O CTA é fixo ("Grátis · link na bio"), NÃO inclua no JSON. ' +
      'Como o slide3 já carrega o pitch, deixe a CAPTION mais editorial e leve — no MÁXIMO 1 menção discreta ao PRADEX, sem repetir a deixa forte.'
    : '';

  const userPrompt =
    `Tópico: ${topico}\n` +
    (angulo
      ? `Ângulo editorial: ${angulo}`
      : 'Ângulo: escolha 1 dos 10 da biblioteca (A reframe, B lista, C viés nomeado, D história/case, E pergunta provocativa, F mito vs verdade, G comparativo numérico, H checklist comportamental, I quote de impacto, J reflexão).') +
    '\n\nGere 2 slides (TENSÃO → RESOLUÇÃO)' +
    (puxada ? ' + o objeto slide3 (SOLUÇÃO)' : '') +
    ' em JSON estrito (sem markdown, sem comentário fora do objeto).' +
    puxadaInstr;

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
      // Schema NOVO (2026-05-13 refactor 2): template Python capa de capítulo
      if (!Array.isArray(s.titulo) || s.titulo.length < 2 || s.titulo.length > 4) {
        throw new Error(
          `Roteiro inválido: slide TENSÃO 'titulo' precisa ser array de 2-4 [texto, estilo]. ` +
            JSON.stringify(s.titulo)
        );
      }
      for (const [j, t] of s.titulo.entries()) {
        if (!Array.isArray(t) || t.length !== 2 || typeof t[0] !== 'string') {
          throw new Error(
            `Roteiro inválido: slide TENSÃO titulo[${j}] mal formado, esperava [texto, estilo]. ` +
              JSON.stringify(t)
          );
        }
        // slide 1 só aceita 'r' ou 'i' (sem i_underline)
        if (!['r', 'i'].includes(t[1])) {
          t[1] = 'r';
        }
      }
      if (!s.cap_nome || typeof s.cap_nome !== 'string') {
        throw new Error(
          `Roteiro inválido: slide TENSÃO 'cap_nome' (string) obrigatório. ` + JSON.stringify(s)
        );
      }
      if (!Array.isArray(s.cap_desc) || s.cap_desc.length < 1 || s.cap_desc.length > 3) {
        throw new Error(
          `Roteiro inválido: slide TENSÃO 'cap_desc' precisa ser array de 1-3 strings. ` +
            JSON.stringify(s.cap_desc)
        );
      }
      for (const [j, line] of s.cap_desc.entries()) {
        if (typeof line !== 'string') {
          throw new Error(`Roteiro inválido: cap_desc[${j}] não é string.`);
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

  // slide3 (SOLUÇÃO) — só em post-puxada. Valida shape; se não-puxada, garante ausência.
  if (puxada) {
    const s3 = parsed.slide3;
    if (!s3 || typeof s3 !== 'object') {
      throw new Error('Roteiro inválido: post-puxada exige objeto "slide3". ' + JSON.stringify(parsed).slice(0, 300));
    }
    s3.tipo = 'solucao';
    if (!s3.texto_meta || typeof s3.texto_meta !== 'string') {
      s3.texto_meta = 'MANUAL DO DINHEIRO  ·  CAP. {{CAP}}';
    }
    if (!Array.isArray(s3.hook) || s3.hook.length < 1 || s3.hook.length > 2) {
      throw new Error(`Roteiro inválido: slide3 'hook' precisa ser array de 1-2 [texto, estilo]. ` + JSON.stringify(s3.hook));
    }
    for (const [j, t] of s3.hook.entries()) {
      if (!Array.isArray(t) || t.length !== 2 || typeof t[0] !== 'string') {
        throw new Error(`Roteiro inválido: slide3 hook[${j}] mal formado, esperava [texto, estilo]. ` + JSON.stringify(t));
      }
      if (!['r', 'i'].includes(t[1])) t[1] = 'r'; // slide3 só aceita 'r'/'i' (sem underline)
    }
    if (typeof s3.contraste !== 'string' || !s3.contraste.trim()) {
      throw new Error(`Roteiro inválido: slide3 'contraste' (string) obrigatório. ` + JSON.stringify(s3));
    }
    if (typeof s3.mock_enviado !== 'string' || !s3.mock_enviado.trim()) {
      throw new Error(`Roteiro inválido: slide3 'mock_enviado' (string) obrigatório. ` + JSON.stringify(s3));
    }
    if (typeof s3.mock_resposta !== 'string' || !s3.mock_resposta.trim()) {
      throw new Error(`Roteiro inválido: slide3 'mock_resposta' (string) obrigatório. ` + JSON.stringify(s3));
    }
    if (!Array.isArray(s3.fecho) || s3.fecho.length < 2 || s3.fecho.length > 4) {
      throw new Error(`Roteiro inválido: slide3 'fecho' precisa ser array de 2-4 strings. ` + JSON.stringify(s3.fecho));
    }
    for (const [j, line] of s3.fecho.entries()) {
      if (typeof line !== 'string') throw new Error(`Roteiro inválido: slide3 fecho[${j}] não é string.`);
    }
    // CTA é fixo no template; ignora se o modelo mandar algo esquisito.
    if (s3.cta != null && typeof s3.cta !== 'string') delete s3.cta;
  } else if (parsed.slide3) {
    // não-puxada não deve carregar slide3 — descarta pra não vazar pra render.
    delete parsed.slide3;
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
