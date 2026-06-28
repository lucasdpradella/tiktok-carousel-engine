// gerar-roteiro-carrossel.mjs — roteiro do carrossel DIDÁTICO multi-slide (7-9, 8 beats).
// Trava de caractere POR VALIDADOR (não por prompt): mede cada linha e, se estourar,
// re-pede ao modelo com o erro (retry com auto-reparo), igual o roteirista de vídeo.
// CTA travada de forma DETERMINÍSTICA (força os valores exatos no último slide).
//
// CLI: node gerar-roteiro-carrossel.mjs "Tópico"   → escreve ../../remotion/src/carrossel.json + imprime.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat } from './openai-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYS_PATH = resolve(__dirname, '../prompts/system-roteirista.md');
const BIB_PATH = resolve(__dirname, '../prompts/financas-comportamentais.md');
const OUT = resolve(__dirname, '../../remotion/src/carrossel.json');

const R_MAX = 14, I_MAX = 13, PASSO_MAX = 40, CORPO_MAX = 90;
const CTA_TITULO = [['Comenta', 'r'], ['PRADEX', 'i']];
const CTA_CORPO = 'que eu te mando o link no direto. E me segue pra não morrer sem dinheiro.';

function validar(text) {
  let p;
  try {
    p = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON inválido: ${e.message}`);
  }
  if (typeof p.caption !== 'string' || !p.caption.trim()) throw new Error('caption ausente');
  if (!Array.isArray(p.hashtags)) p.hashtags = [];
  const s = p.slides;
  if (!Array.isArray(s) || s.length < 7 || s.length > 9) throw new Error(`esperava 7-9 slides, recebi ${s?.length}`);

  s.forEach((sl, i) => {
    const n = i + 1;
    if (!Array.isArray(sl.titulo) || !sl.titulo.length) throw new Error(`slide ${n}: titulo ausente`);
    for (const pair of sl.titulo) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string') {
        throw new Error(`slide ${n}: titulo mal formado (esperava [texto, estilo])`);
      }
      const [t, st] = pair;
      if (!['r', 'i'].includes(st)) pair[1] = 'r';
      const lim = st === 'i' ? I_MAX : R_MAX;
      if (t.length > lim) {
        throw new Error(`slide ${n}: linha "${t}" tem ${t.length} chars (limite ${lim} pro estilo "${st}"). Reescreva mais curta ou quebre em mais linhas.`);
      }
    }
    if (sl.corpo != null) {
      if (typeof sl.corpo !== 'string') throw new Error(`slide ${n}: corpo precisa ser string`);
      if (sl.corpo.length > CORPO_MAX) throw new Error(`slide ${n}: corpo tem ${sl.corpo.length} chars (limite ${CORPO_MAX}).`);
    }
    if (sl.passos != null) {
      if (!Array.isArray(sl.passos) || sl.passos.length < 2 || sl.passos.length > 3) {
        throw new Error(`slide ${n}: passos precisa ter 2 ou 3 itens`);
      }
      for (const ps of sl.passos) {
        if (typeof ps !== 'string') throw new Error(`slide ${n}: passo não-string`);
        if (ps.length > PASSO_MAX) throw new Error(`slide ${n}: passo "${ps}" tem ${ps.length} chars (limite ${PASSO_MAX}). Encurte.`);
      }
    }
    if (sl.numero != null && !/\d/.test(String(sl.numero))) {
      throw new Error(`slide ${n}: "numero" precisa ter algarismo (ex "R$ 600"), recebi "${sl.numero}"`);
    }
  });

  if (s[0].beat !== 'gancho') throw new Error('primeiro slide precisa ser beat "gancho"');
  if (s[s.length - 1].beat !== 'cta') throw new Error('último slide precisa ser beat "cta"');

  // CTA travada de forma determinística (garante a frase exata, sem depender do modelo)
  const cta = s[s.length - 1];
  cta.titulo = CTA_TITULO.map((x) => [...x]);
  cta.corpo = CTA_CORPO;
  delete cta.passos;
  delete cta.numero;

  return { caption: p.caption, hashtags: p.hashtags, slides: s };
}

export async function gerarRoteiroCarrossel({ topico, maxTentativas = 4 } = {}) {
  if (!topico) throw new Error('[carrossel] topico obrigatório');
  const [sys, bib] = await Promise.all([readFile(SYS_PATH, 'utf-8'), readFile(BIB_PATH, 'utf-8')]);
  const full = sys + '\n\n## CONTEXTO DA BIBLIOTECA\n\n' + bib.slice(0, 4000);

  let lastErr = null;
  for (let attempt = 1; attempt <= maxTentativas; attempt++) {
    const user =
      `Tópico: ${topico}\n\nGere o carrossel didático (7 a 9 slides) seguindo os 8 beats. Saída: só JSON.` +
      (lastErr ? `\n\nA tentativa anterior foi REJEITADA por: ${lastErr}\nCorrija EXATAMENTE isso (respeite o limite de caracteres por linha) e devolva o JSON completo.` : '');
    const { text } = await chat({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'system', content: full }, { role: 'user', content: user }],
      responseFormat: { type: 'json_object' },
      temperature: 0.85,
    });
    try {
      return validar(text);
    } catch (e) {
      lastErr = e.message;
      console.warn(`[carrossel] tentativa ${attempt}/${maxTentativas} rejeitada: ${e.message}`);
    }
  }
  throw new Error(`[carrossel] falhou após ${maxTentativas} tentativas. Último erro: ${lastErr}`);
}

// CLI
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const topico = process.argv[2] || 'O erro número 1 ao montar o orçamento';
  gerarRoteiroCarrossel({ topico })
    .then(async (r) => {
      await mkdir(dirname(OUT), { recursive: true });
      await writeFile(OUT, JSON.stringify(r, null, 2) + '\n');
      console.log(`[carrossel] ${r.slides.length} slides → ${OUT}`);
      for (const sl of r.slides) {
        const linha = sl.titulo.map((t) => t[0]).join(' ');
        console.log(`  [${sl.beat}] ${linha}${sl.corpo ? ' — ' + sl.corpo : ''}${sl.passos ? ' — passos: ' + sl.passos.join(' / ') : ''}${sl.numero ? ' — ' + sl.numero : ''}`);
      }
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
