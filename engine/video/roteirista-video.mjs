// roteirista-video.mjs — gera o script.json de UM vídeo faceless (§2b do briefing-mestre).
// tema (fila) → gpt-4o-mini → { fps,width,height, cenas[] } no schema do piloto "dinheiro vaza".
// Reusa o client OpenAI do carrossel. Narração TTS-safe (sanitizada). Sem investimento (posicionamento travado).
//
// CLI:  node roteirista-video.mjs [indice]   (default: estado-video.json.indice_atual)
//       → escreve engine/video/out/script.json + imprime resumo.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat } from '../openai/src/openai-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMAS = resolve(__dirname, 'temas-video.json');
const ESTADO = resolve(__dirname, 'estado-video.json');
const OUT = resolve(__dirname, 'out/script.json');

const FPS = 30, WIDTH = 1080, HEIGHT = 1920;
const ICONES = ['delivery', 'assinatura', 'cafe']; // únicos que o template Remotion tem hoje
const TIPOS = ['gancho', 'frase', 'lista', 'numero', 'duplo', 'acao', 'explicador', 'cta'];
const DUR_FALLBACK = { gancho: 90, frase: 70, lista: 160, numero: 140, duplo: 85, acao: 80, explicador: 70, cta: 90 };

// sanitizador igual ao do TTS (nunca deixar travessão/símbolo virar ruído).
function sanitize(t) {
  if (!t) return '';
  for (const d of ['—', '–', '―']) t = t.split(d).join(', ');
  for (const q of ['"', "'", '“', '”', '‘', '’', '«', '»', '„']) t = t.split(q).join('');
  for (const s of ['*', '_', '#', '~', '^', '|', '/', '<', '>', '=', '+', '`', '@', '&', '[', ']', '{', '}']) t = t.split(s).join(' ');
  while (t.includes('  ')) t = t.split('  ').join(' ');
  for (const p of [',', '.', '!', '?', ';', ':']) t = t.split(' ' + p).join(p);
  t = t.split(',,').join(',');
  return t.trim();
}

// Backstop de compliance — bloqueia a AÇÃO, não o TEMA (recalibrado 2026-06-29, estilo Igor).
// Rejeita SÓ: recomendação imperativa, promessa de retorno, ou timing/previsão de preço.
// LIBERA conceito/estrutura (diversificação, descorrelação, dólar como proteção, renda fixa,
// offshore, vieses), reframe "X não é Y é Z" e raciocínio próprio ("hoje tenho mais em proteção").
const COMPLIANCE_PROIBIDO = [
  // recomendação direta / imperativa ao espectador
  /\binvist[ae]m? em\b/,
  /\baplique[m]? em\b/,
  /\bcoloque[m]?\b[^.]{0,20}\bdinheiro\b/,
  /\bcompre[m]?\b/,
  /\bvenda[m]? (a[çc][õo]es|d[óo]lar|cripto|bitcoin|fundos?|t[íi]tulos?|seus?|suas?)/,
  /\brecomendo\b/,
  // promessa de retorno garantido
  /\b(retorno|rentabilidade|lucro|ganho)s?\b[^.]{0,18}garantid/,
  /garantid\w*[^.]{0,18}(retorno|rentabilidade|lucro|por cento|%|\d)/,
  /\blucro certo\b/,
  /\brende\w*[^.]{0,12}garantid/,
  // timing / previsão de direção (reforçado p/ o bloco mercado/economia, 2026-06-30)
  /\b(vai|vão|tende a|tendem a|deve|devem) (subir|cair|disparar|despencar|explodir|desabar|valorizar|desvalorizar)\b/,
  /\b(hora|momento) de (comprar|vender|investir|entrar|sair|aproveitar)\b/,
  /\b(hora|momento) (de|pra|para) (a |o )?(renda fixa|bolsa|a[çc][õo]es|d[óo]lar|cripto|bitcoin|t[íi]tulos?)\b/,
  /\bagora é a hora\b/,
  /\b(d[óo]lar|bolsa|ibovespa|bitcoin|a[çc][õo]es)\b[^.]{0,15}\bvai (pra|para|a|chegar|bater|virar)\b/,
  // valuation call (comprar/vender disfarçado): "está barato/caro", "barato demais pra comprar"
  /\b(est[áa]|t[áa])\s+(barat[oa]|car[oa])\b/,
  /\b(barat[oa]|car[oa])\s+(demais|pra (comprar|entrar))\b/,
  // ticker específico (ex: petr4, vale3) — nunca citar papel individual
  /\b[a-z]{4}\d{1,2}\b/,
];
function _textoCena(c) {
  const p = [c.narracao, c.titulo, c.corpo, c.antes, c.numero, c.depois, c.rotulo, c.prefixo, c.destaque, c.sufixo, c.extra, c.follow];
  if (Array.isArray(c.linhas)) p.push(c.linhas.join(' '));
  if (Array.isArray(c.resto)) p.push(c.resto.join(' '));
  if (Array.isArray(c.itens)) for (const it of c.itens) if (Array.isArray(it.linhas)) p.push(it.linhas.join(' '));
  return p.filter(Boolean).join(' ');
}
function checarCompliance(c, id) {
  const txt = _textoCena(c).toLowerCase();
  for (const re of COMPLIANCE_PROIBIDO) {
    const m = txt.match(re);
    if (m) {
      throw new Error(`cena ${id}: AÇÃO proibida ("${m[0]}") na narração/tela — recomendação direta, promessa de retorno ou timing. Pode discutir o conceito, a estrutura e reframar, mas NÃO mande comprar/vender/aplicar, não prometa retorno e não preveja preço.`);
    }
  }
}

const SYSTEM = `Você é o roteirista do PRADEX (série "Manual do Dinheiro" em VÍDEO faceless, 9:16, ~30s, voz clonada do Lucas Pradella, assessor de investimentos). Cada vídeo é uma MINI-AULA: a pessoa entende um conceito e sai sabendo o que fazer. Tom de planejador sério e humano, anti-influencer (sem "galera", "bora", "PARE TUDO").

# COMPLIANCE — bloqueia a AÇÃO, não o TEMA (estilo Igor: educar e estruturar, nunca recomendar)
🟢 PODE discutir QUALQUER conceito de forma educativa/estrutural: comportamento, planejamento E investimento como CONCEITO — diversificação, descorrelação, dólar como proteção, renda fixa, offshore como diversificação, vieses, juros compostos, inflação, fundos de pensão. Pode REFRAMAR ("X não é Y, é Z"), ensinar o PORQUÊ e a ESTRUTURA, mostrar o trade-off, e usar o SEU PRÓPRIO raciocínio como ILUSTRAÇÃO educativa ("hoje eu tenho mais em proteção porque o cenário pede..."). Números sempre ILUSTRATIVOS ("imagine que...").
🔴 NUNCA a AÇÃO (é só isso que é proibido):
  - Recomendação direta/imperativa ao espectador: "invista em X", "compre/venda [ativo]", "aplique em", "coloque seu dinheiro em", "recomendo [ativo]".
  - Promessa de retorno: "rentabilidade/retorno garantido", "rende X% garantido", "lucro certo".
  - Timing/previsão de preço: "vai subir/cair", "agora é a hora de comprar/vender", "o dólar vai pra R$ X".
Em vez de dizer O QUE FAZER, ENSINE a pensar: o conceito, o porquê, a estrutura, o trade-off. Compartilhar o próprio raciocínio é OK como exemplo; mandar o espectador comprar/vender/aplicar NÃO. No contraste e no fecho, reframe e ensine — pode contrastar conceitos (aposta vs estrutura, enxergar vs não enxergar), mas nunca vire recomendação, promessa ou timing.
⚠️ Ao falar de PROTEÇÃO/ESTRUTURA (dólar, diversificação, offshore), conecte a RISCOS específicos (câmbio, risco Brasil/fiscal, inflação, concentração) e ensine o PORQUÊ. NUNCA prometa que algo "mantém o valor", que "o patrimônio se mantém", nem qualquer ganho — é garantia implícita e PROIBIDO. Use hedge ("pode", "tende a", "historicamente") e foque no mecanismo e no trade-off, não no resultado.

# ESTRUTURA DIDÁTICA — mini-aula RICA em 10 a 12 cenas (1 ideia por cena), nesta ordem:
- gancho (tipo "gancho"): situação COTIDIANA reconhecível OU um REFRAME no formato "X não é Y, é Z" (ex: "Dólar não é aposta, é estrutura"). 3s.
- nomeia + aposta (frase): nomeia o conceito E crava o que ignorar isso CUSTA.
- define (frase): o conceito em 1 frase simples e clara.
- exemplo (tipo "numero"): número ILUSTRATIVO ("imagine que..."), falado por extenso na narração.
- por que (frase): a causa real, o viés ou o mecanismo por trás.
- aprofunda (frase ou "duplo"): 2ª camada — a consequência de não resolver, ou outro ângulo do porquê.
- contraste (tipo "duplo"): mostre o MECANISMO/estrutura por trás (ex: "oscilações cambiais pesam mais sem proteção") e o trade-off — NÃO "sem X você perde". Eduque o porquê, não a necessidade de um ativo.
- passos práticos: 2 a 3 cenas (use "acao" e "frase") com a narração DIZENDO cada micro-passo, concreto e específico (nada de "se organize" genérico — diga O QUE fazer).
- fecho memorável (frase ou "duplo"): a sacada que a pessoa leva — frase de efeito, conclusão.
- explicador (tipo "explicador"): PRADEX, o app de organizar os gastos, de graça.
- cta (tipo "cta"): comment-to-DM (a assinatura "Lucas Pradella · Assessor" já aparece fixa na tela).

PROFUNDIDADE estilo aula-que-ensina-de-verdade: substância REAL em CADA cena (o número, o porquê, a 2ª camada, os passos ditos, o fecho). Cada cena AVANÇA o ensino — nada de gancho vazio repetido nem encher linguiça. Total 10 a 12 cenas.

# OUTPUT — APENAS JSON (sem markdown) com este shape EXATO:

{
  "cenas": [
    { "id":"gancho", "tipo":"gancho", "narracao":"Todo fim de mês você se pergunta para onde foi o dinheiro.", "linhas":["Cadê o","dinheiro?"], "prefixo":"Sumiu sem ", "destaque":"aviso." },
    { "id":"nomeia", "tipo":"frase", "narracao":"O nome disso é gasto invisível, e ignorar ele custa caro.", "linhas":["Gasto","invisível."] },
    { "id":"define", "tipo":"frase", "narracao":"É todo gasto pequeno e repetido que você nem registra.", "linhas":["Pequeno e","repetido."] },
    { "id":"exemplo", "tipo":"numero", "narracao":"Imagine tres gastinhos de quinze reais por dia, no mês viram seiscentos reais.", "antes":"3x R$ 15 / dia", "rotulo":"No mês:", "numero":"R$ 600", "depois":"sem você ver." },
    { "id":"porque", "tipo":"frase", "narracao":"Acontece porque o cérebro ignora valor pequeno e repetido.", "linhas":["O pequeno","engana."] },
    { "id":"aprofunda", "tipo":"frase", "narracao":"Sem perceber, esse vazamento vira um rombo fixo todo mês.", "linhas":["Vira rombo","todo mês."] },
    { "id":"contraste", "tipo":"duplo", "narracao":"Quem não anota perde a noção, quem anota recupera o controle.", "linhas":["Sem anotar, some.","Anotando, sobra."] },
    { "id":"passo", "tipo":"acao", "narracao":"O primeiro passo é anotar um gasto por dia durante uma semana.", "titulo":"Passo 1:", "prefixo":"anota ", "destaque":"1 gasto", "sufixo":" por dia", "extra":"por uma semana." },
    { "id":"passo2", "tipo":"frase", "narracao":"No fim da semana, some os gastos por categoria e veja onde escapa.", "linhas":["Some por","categoria."] },
    { "id":"fecho", "tipo":"duplo", "narracao":"Você não precisa ganhar mais, precisa enxergar melhor.", "linhas":["Não é ganhar mais.","É enxergar melhor."] },
    { "id":"pradex", "tipo":"explicador", "narracao":"No PRADEX você registra pelo WhatsApp e vê tudo organizado, de graça.", "destaque":"PRADEX", "resto":["organiza seus gastos","pelo WhatsApp,","de graça."] },
    { "id":"cta", "tipo":"cta", "narracao":"Comenta PRADEX que eu te mando o link no direto.", "prefixo":"Comenta ", "destaque":"PRADEX", "linhas":["que eu te mando","o link no direto"], "follow":"e me segue pra não morrer sem dinheiro." }
  ]
}

(As narrações/linhas acima são EXEMPLO de estilo e dos beats — escreva NOVAS pro tema recebido. NUNCA copie o exemplo nem deixe reticências/placeholder.)

# REGRAS DE NARRAÇÃO (campo "narracao" = o que a voz fala)
- Didática e fluida, frases curtas. SEM travessão, SEM símbolos, SEM aspas. Vírgula no lugar de ponto seco.
- Mínimo 3-4 palavras por frase (nada de uma palavra + ponto).
- Valores e números POR EXTENSO e na ordem falada ("quinze reais", "cinco minutos") — NUNCA "R$" nem algarismos na narração.
- Na cena "numero", enquadre o valor como ILUSTRATIVO ("imagine que...", "suponha...").

# REGRAS DE TELA
- Linhas curtas (<= 16 caracteres) pra caber em 9:16. "destaque" = 1 palavra/expressão (vai em dourado).
- "numero": os campos de TELA (antes, numero, depois) em algarismo/R$. Ex CERTO "numero":"R$ 600". PROIBIDO valor por extenso no campo "numero" (extenso é só na narracao).
- "lista" (opcional): 3 itens, "icone" SÓ ∈ {delivery, assinatura, cafe}. Use lista APENAS se o tema for sobre gastos do dia a dia que combinem com esses ícones; senão use frase/numero/duplo.
- "explicador": SEMPRE destaque "PRADEX" + resto curto (app de organizar gastos, de graça).
- "cta": SEMPRE prefixo "Comenta ", destaque "PRADEX", follow EXATAMENTE "e me segue pra não morrer sem dinheiro."

Devolva só o JSON do objeto com "cenas" (ideal 10 a 12; mínimo 7). Nada além disso.`;

/**
 * Gera o script.json de um vídeo a partir do tema.
 * @returns {Promise<{fps,width,height,cenas:Array}>}
 */
async function _gerarUma({ tema, resumo, hint } = {}) {
  if (!tema) throw new Error('[roteirista-video] tema obrigatório');

  const user = `Tema: ${tema}\n${resumo ? `Ângulo/resumo: ${resumo}\n` : ''}\nGere o JSON com "cenas" (10 a 12, mini-aula rica), seguindo a estrutura e as regras. Saída: só JSON.${hint ? '\n\nA tentativa anterior foi REJEITADA por: ' + hint + '\nCorrija EXATAMENTE isso e devolva o JSON completo de novo.' : ''}`;

  const { text } = await chat({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
    responseFormat: { type: 'json_object' },
    temperature: 0.85,
  });

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`[roteirista-video] JSON inválido do modelo: ${e.message}`);
  }
  const cenas = parsed.cenas;
  if (!Array.isArray(cenas) || cenas.length < 7 || cenas.length > 12) {
    throw new Error(`[roteirista-video] esperava 10-12 cenas (mín 7), recebi ${cenas?.length}`);
  }

  const ids = new Set();
  cenas.forEach((c, i) => {
    if (!TIPOS.includes(c.tipo)) throw new Error(`[roteirista-video] cena ${i}: tipo inválido "${c.tipo}"`);
    // id único, filename-safe (vira nome do .wav por cena no TTS)
    let id = String(c.id || c.tipo).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!id) id = `c${i}`;
    while (ids.has(id)) id = id + 'x';
    ids.add(id);
    c.id = id;
    // narração obrigatória + TTS-safe (sanitiza por garantia)
    if (typeof c.narracao !== 'string' || !c.narracao.trim()) {
      throw new Error(`[roteirista-video] cena ${id}: narracao ausente`);
    }
    c.narracao = sanitize(c.narracao);
    // rejeita placeholder/reticências/narração degenerada
    if (c.narracao.replace(/[.\s]/g, '').length < 8 || !/[a-zA-ZÀ-ÿ]{3,}/.test(c.narracao)) {
      throw new Error(`[roteirista-video] cena ${id}: narracao inválida/placeholder ("${c.narracao}")`);
    }
    // dur fallback (timing.ts usa as durações reais do TTS quando existem)
    c.dur = DUR_FALLBACK[c.tipo] || 90;
    // valida campos por tipo
    if (c.tipo === 'numero' && !/\d/.test(String(c.numero || ''))) {
      throw new Error(`[roteirista-video] ${id}: campo de tela "numero" precisa ter algarismo (ex "R$ 600"), recebi "${c.numero}"`);
    }
    if (c.tipo === 'lista') {
      if (!Array.isArray(c.itens) || c.itens.length < 1) throw new Error(`[roteirista-video] ${id}: lista sem itens`);
      for (const it of c.itens) {
        if (!ICONES.includes(it.icone)) throw new Error(`[roteirista-video] ${id}: icone inválido "${it.icone}" (use ${ICONES.join('/')})`);
        if (!Array.isArray(it.linhas) || !it.linhas.length) throw new Error(`[roteirista-video] ${id}: item sem linhas`);
      }
    }
    // backstop de compliance: bloqueia recomendação de investimento → retry re-pede
    checarCompliance(c, id);
  });

  // âncoras de estrutura
  if (cenas[0].tipo !== 'gancho') throw new Error('[roteirista-video] primeira cena precisa ser "gancho"');
  if (cenas[cenas.length - 1].tipo !== 'cta') throw new Error('[roteirista-video] última cena precisa ser "cta"');
  if (!cenas.some((c) => c.tipo === 'explicador')) throw new Error('[roteirista-video] falta a cena "explicador" (PRADEX)');

  // CTA TRAVADA de forma DETERMINÍSTICA (tela + narração) — não deixa o modelo variar nem cortar.
  // As DUAS partes da frase de marca sempre presentes: o convite + o "me segue...".
  const cta = cenas[cenas.length - 1];
  cta.tipo = 'cta';
  cta.prefixo = 'Comenta ';
  cta.destaque = 'PRADEX';
  cta.linhas = ['que eu te mando', 'o link no direto'];
  cta.follow = 'e me segue pra não morrer sem dinheiro.';
  cta.narracao = 'Comenta PRADEX que eu te mando o link no direto, e me segue pra não morrer sem dinheiro.';
  cta.dur = DUR_FALLBACK.cta;

  return { fps: FPS, width: WIDTH, height: HEIGHT, cenas };
}

/**
 * Gera o script.json com retry + auto-reparo: se o validador rejeitar, re-pede ao
 * modelo dizendo EXATAMENTE o que corrigir (não derruba a run por um campo torto).
 * @returns {Promise<{fps,width,height,cenas:Array}>}
 */
export async function gerarScriptVideo({ tema, resumo, maxTentativas = 3 } = {}) {
  if (!tema) throw new Error('[roteirista-video] tema obrigatório');
  let lastErr = null;
  for (let attempt = 1; attempt <= maxTentativas; attempt++) {
    try {
      return await _gerarUma({ tema, resumo, hint: lastErr });
    } catch (e) {
      lastErr = e.message;
      console.warn(`[roteirista-video] tentativa ${attempt}/${maxTentativas} rejeitada: ${e.message}`);
    }
  }
  throw new Error(`[roteirista-video] falhou após ${maxTentativas} tentativas. Último erro: ${lastErr}`);
}

// CLI
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  (async () => {
    const temas = JSON.parse(await readFile(TEMAS, 'utf-8'));
    let idx = process.argv[2] != null ? parseInt(process.argv[2], 10) : null;
    if (idx == null) idx = JSON.parse(await readFile(ESTADO, 'utf-8')).indice_atual;
    const t = temas[idx];
    if (!t) throw new Error(`[roteirista-video] índice ${idx} fora da fila (${temas.length} temas)`);
    console.log(`[roteirista-video] tema #${idx}: "${t.tema}"`);
    const script = await gerarScriptVideo({ tema: t.tema, resumo: t.resumo });
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify(script, null, 2) + '\n');
    console.log(`[roteirista-video] ${script.cenas.length} cenas → ${OUT}`);
    console.log('--- narração por cena ---');
    for (const c of script.cenas) console.log(`  [${c.tipo}] ${c.narracao}`);
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
