// gerar-roteiro-carrossel.mjs — roteiro do carrossel DIDÁTICO multi-slide (7-9, 8 beats).
// Trava de caractere POR VALIDADOR (não por prompt): mede cada linha e, se estourar,
// re-pede ao modelo com o erro (retry com auto-reparo), igual o roteirista de vídeo.
// CTA travada de forma DETERMINÍSTICA (força os valores exatos no último slide).
//
// CLI: node gerar-roteiro-carrossel.mjs "Tópico"   → escreve ../../remotion/src/carrossel.json + imprime.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat } from './chat-provider.mjs'; // Gemini (Pro→Flash) com fallback OpenAI
import { acharAcaoProibida, contarNegacoes, acharReframeIrresponsavel, acharCustoVago } from './compliance-guard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYS_PATH = resolve(__dirname, '../prompts/system-roteirista.md');
const BIB_PATH = resolve(__dirname, '../prompts/financas-comportamentais.md');
const OUT = resolve(__dirname, '../../remotion/src/carrossel.json');

// Limites = PISO DE LEGIBILIDADE: o quanto cabe ACIMA da fonte mínima do render (Carrossel.tsx).
// Acima disso, nas tentativas normais o roteirista é OBRIGADO a ENCURTAR (retry); na ÚLTIMA
// tentativa degrada (warn + auto-fit no piso) pra o post NUNCA falhar. Robustez > rigidez.
const R_MAX = 34, I_MAX = 30, PASSO_MAX = 46, CORPO_MAX = 110;
const CTA_TITULO = [['Comenta', 'r'], ['PRADEX', 'i']];
const CTA_CORPO = 'que eu te mando o link no direto. E me segue pra não morrer sem dinheiro.';

// normaliza typo de TELA: 3+ letras idênticas seguidas -> 2 (não toca dígitos).
const colapsa = (x) => (typeof x === 'string' ? x.replace(/([A-Za-zÀ-ÿ])\1{2,}/g, '$1$1') : x);

// Compliance = AÇÃO, não TEMA — lista no módulo compartilhado (compliance-guard.mjs), igual ao
// vídeo (sem drift). Bloqueia recomendação/promessa/timing/ticker/ALOCAÇÃO PRESCRITIVA (% carteira).
function checarComplianceTexto(txt, onde) {
  const hit = acharAcaoProibida(txt);
  if (hit) {
    throw new Error(`${onde}: AÇÃO proibida ("${hit}") — recomendação/promessa/timing/alocação prescritiva. Reframe e ensine o conceito e a estrutura; para dosagem responda com PROCESSO ("depende do perfil e objetivo, é conversa de planejamento"), nunca com percentual.`);
  }
  const irr = acharReframeIrresponsavel(txt);
  if (irr) {
    throw new Error(`${onde}: REFRAME IRRESPONSÁVEL ("${irr}") — NÃO argumente contra proteção/necessidade (plano de saúde, seguro, previdência, reserva). Posicione o VALOR: transferência de risco, o custo de NÃO ter, como estruturar/escolher bem. Nunca "desperdício"/"paga e não usa"/"mau investimento".`);
  }
}

function validar(text, { strict = true } = {}) {
  let p;
  try {
    p = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON inválido: ${e.message}`);
  }
  if (typeof p.caption !== 'string' || !p.caption.trim()) throw new Error('caption ausente');
  if (!Array.isArray(p.hashtags)) p.hashtags = [];
  const s = p.slides;
  if (!Array.isArray(s)) throw new Error('slides ausente');
  if (strict && s.length !== 8) throw new Error(`esperava EXATAMENTE 8 slides (S1-S8), recebi ${s.length}`);
  if (s.length < 7 || s.length > 9) throw new Error(`slides fora do range aceitável (7-9): ${s.length}`);

  s.forEach((sl, i) => {
    const n = i + 1;
    if (!Array.isArray(sl.titulo) || !sl.titulo.length) throw new Error(`slide ${n}: titulo ausente`);
    // normaliza typo de TELA (3+ letras iguais -> 2) ANTES de medir caractere
    sl.titulo = sl.titulo.map((pr) => (Array.isArray(pr) && typeof pr[0] === 'string' ? [colapsa(pr[0]), pr[1]] : pr));
    if (typeof sl.corpo === 'string') sl.corpo = colapsa(sl.corpo);
    if (Array.isArray(sl.passos)) sl.passos = sl.passos.map((x) => (typeof x === 'string' ? colapsa(x) : x));
    if (typeof sl.numero === 'string') sl.numero = colapsa(sl.numero);
    for (const pair of sl.titulo) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string') {
        throw new Error(`slide ${n}: titulo mal formado (esperava [texto, estilo])`);
      }
      const [t, st] = pair;
      if (!['r', 'i'].includes(st)) pair[1] = 'r';
      const lim = st === 'i' ? I_MAX : R_MAX;
      // PISO: acima do limite, nas tentativas normais EXIGE encurtar (retry); na última degrada (warn).
      if (t.length > lim) {
        if (strict) throw new Error(`slide ${n}: linha "${t}" tem ${t.length} chars (>${lim} p/ "${st}") — ENCURTE (reescreva/quebre) pra caber LEGÍVEL; não deixe pro auto-fit.`);
        console.warn(`[carrossel] slide ${n}: linha "${t}" tem ${t.length} chars (>${lim}) — segue no piso do auto-fit.`);
      }
    }
    if (sl.corpo != null) {
      if (typeof sl.corpo !== 'string') throw new Error(`slide ${n}: corpo precisa ser string`);
      if (sl.corpo.length > CORPO_MAX) console.warn(`[carrossel] slide ${n}: corpo tem ${sl.corpo.length} chars (>${CORPO_MAX}) — segue.`);
    }
    if (sl.passos != null) {
      if (!Array.isArray(sl.passos) || sl.passos.length < 2 || sl.passos.length > 3) {
        throw new Error(`slide ${n}: passos precisa ter 2 ou 3 itens`);
      }
      for (const ps of sl.passos) {
        if (typeof ps !== 'string') throw new Error(`slide ${n}: passo não-string`);
        if (ps.length > PASSO_MAX) console.warn(`[carrossel] slide ${n}: passo "${ps}" tem ${ps.length} chars (>${PASSO_MAX}) — segue.`);
      }
    }
    if (sl.numero != null && !/\d/.test(String(sl.numero))) {
      throw new Error(`slide ${n}: "numero" precisa ter algarismo (ex "R$ 600"), recebi "${sl.numero}"`);
    }
    // compliance: bloqueia AÇÃO (recomendação/promessa/timing) na tela do slide
    const txtSlide = [sl.titulo.map((t) => t[0]).join(' '), sl.corpo, (sl.passos || []).join(' '), sl.numero].filter(Boolean).join(' ');
    checarComplianceTexto(txtSlide, `slide ${n}`);
    // ESPECIFICIDADE: claim de custo sem número = raso. Reprova e o retry pede o número concreto.
    const vago = acharCustoVago(txtSlide);
    if (vago) {
      throw new Error(`slide ${n}: CUSTO VAGO ("${vago}") — troque por um número concreto ILUSTRATIVO (ex: "uma emergência hospitalar pode passar de R$ 50 mil, ilustrativo"). Nada de "custa muito/caro" sem número.`);
    }
  });

  checarComplianceTexto(p.caption, 'caption');

  if (s[0].beat !== 'gancho') throw new Error('primeiro slide precisa ser beat "gancho"');
  if (s[s.length - 1].beat !== 'cta') throw new Error('último slide precisa ser beat "cta"');

  // §3/§4 DEMONSTRAR, não afirmar — força os beats que costumam ser pulados:
  if (!s.some((sl) => sl.beat === 'exemplo' && sl.numero != null && /\d/.test(String(sl.numero)))) {
    throw new Error('falta o BEAT 4: um slide "exemplo" com "numero" ILUSTRATIVO (número que MOSTRA o mecanismo). Número só pra negar algo não conta.');
  }
  if (!s.some((sl) => sl.beat === 'contraste')) {
    throw new Error('falta o BEAT 6: um slide "contraste" concreto (antes vs depois, ou caminho A vs B). Mostre as duas pontas.');
  }
  // ESPECIFICIDADE no contraste: as duas pontas com NÚMERO (dígito), não adjetivo ("muito maior").
  const slContraste = s.find((sl) => sl.beat === 'contraste');
  const txtContraste = [(slContraste.titulo || []).map((t) => t[0]).join(' '), slContraste.corpo].filter(Boolean).join(' ');
  if (!/\d/.test(txtContraste)) {
    throw new Error(`slide contraste: sem NÚMERO — o contraste precisa de número concreto nas pontas (ex: "Sem plano: R$ 50 mil numa emergência. / Com plano: R$ 1.200/mês previsíveis."). Adjetivo ("muito maior") não conta.`);
  }
  const txtTudo =
    s.map((sl) => [(sl.titulo || []).map((t) => t[0]).join(' '), sl.corpo, (sl.passos || []).join(' ')].filter(Boolean).join(' ')).join(' ') +
    ' ' + p.caption;
  const negs = contarNegacoes(txtTudo);
  if (negs >= 4) {
    throw new Error(`NEGAÇÃO EMPILHADA (${negs} frases "não é X"): construa pela AFIRMAÇÃO com exemplo, no máximo 1 negação fora do reframe do gancho.`);
  }

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
      `Tópico: ${topico}\n\nGere o carrossel VALIOSO de EXATAMENTE 8 slides (S1-S8) seguindo os beats, com substância, reframe responsável e CTA forte. Saída: só JSON.` +
      (lastErr ? `\n\nA tentativa anterior foi REJEITADA por: ${lastErr}\nCorrija EXATAMENTE isso (encurte as linhas que estouraram, mantenha 8 slides) e devolva o JSON completo.` : '');
    const { text } = await chat({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'system', content: full }, { role: 'user', content: user }],
      responseFormat: { type: 'json_object' },
      temperature: 0.85,
    });
    try {
      // última tentativa degrada o PISO (aceita linha longa com warn) pra o post nunca falhar
      return validar(text, { strict: attempt < maxTentativas });
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
