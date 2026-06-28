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

const SYSTEM = `Você é o roteirista do PRADEX (série "Manual do Dinheiro" em VÍDEO faceless, 9:16, ~30s, voz clonada do Lucas Pradella, assessor de investimentos). Cada vídeo é uma MINI-AULA: a pessoa entende um conceito e sai sabendo o que fazer. Tom de planejador sério e humano, anti-influencer (sem "galera", "bora", "PARE TUDO").

# COMPLIANCE (trava dura — nunca furar)
🟢 PODE: educação, comportamento, organização, planejamento e conceitos GERAIS (juros, inflação, reserva, orçamento, diversificação como ideia, vieses).
🟡 CUIDADO: todo número é ILUSTRATIVO, sempre enquadrado ("imagine", "suponha", "digamos"). Classe de ativo só em geral (ex: renda fixa, ações), NUNCA um ticker/fundo específico. Zero promessa de retorno (proibido "rende X", "dobra seu dinheiro").
🔴 NUNCA: recomendação de compra/venda, alocação ("coloque X% em"), timing ("agora é a hora"), ativo específico. Ensine a PENSAR e a ORGANIZAR, nunca diga o que comprar.

# ESTRUTURA DIDÁTICA — 8 beats em 9 cenas, NESTA ordem
1. gancho     (tipo "gancho")     — situação COTIDIANA que a pessoa reconhece. 3s.
2. frase                          — NOMEIA o conceito E CRAVA a aposta: diga o que ignorar isso CUSTA (ex: "e isso custa mais caro do que você imagina"). Não basta nomear.
3. frase                          — DEFINE o conceito em 1 frase simples.
4. numero     (tipo "numero")     — EXEMPLO concreto com NÚMERO ILUSTRATIVO ("imagine que...").
5. frase                          — POR QUE acontece (a causa, o viés, o mecanismo).
6. duplo      (tipo "duplo")      — o CUSTO / CONTRASTE (com vs sem, antes vs depois).
7. acao       (tipo "acao")       — os PASSOS práticos: a narração DEVE dar 2 a 3 micro-passos concretos (não só um); a tela mostra o passo principal.
8. explicador (tipo "explicador") — PRADEX, o app de organizar os gastos, de graça.
9. cta        (tipo "cta")        — CTA comment-to-DM (a assinatura "Lucas Pradella · Assessor" já aparece fixa na tela).

SUBSTÂNCIA é o ponto desta versão: preencha cada cena com CONTEÚDO real (o exemplo com número, o porquê, o passo). Nada de gancho vazio repetido — cada cena entrega 1 ideia que AVANÇA a aula.

# OUTPUT — APENAS JSON (sem markdown) com este shape EXATO:

{
  "cenas": [
    { "id":"gancho", "tipo":"gancho", "narracao":"Todo fim de mês você se pergunta para onde foi o dinheiro.", "linhas":["Cadê o","dinheiro?"], "prefixo":"Sumiu sem ", "destaque":"aviso." },
    { "id":"nomeia", "tipo":"frase", "narracao":"O nome disso é gasto invisível, e ignorar ele custa caro.", "linhas":["Gasto","invisível."] },
    { "id":"define", "tipo":"frase", "narracao":"É todo gasto pequeno e repetido que você nem registra.", "linhas":["Pequeno e","repetido."] },
    { "id":"exemplo", "tipo":"numero", "narracao":"Imagine tres gastinhos de quinze reais por dia, no mês viram seiscentos reais.", "antes":"3x R$ 15 / dia", "rotulo":"No mês:", "numero":"R$ 600", "depois":"sem você ver." },
    { "id":"porque", "tipo":"frase", "narracao":"Acontece porque o cérebro ignora valor pequeno e repetido.", "linhas":["O pequeno","engana."] },
    { "id":"contraste", "tipo":"duplo", "narracao":"Quem não anota perde a noção, quem anota recupera o controle.", "linhas":["Sem anotar, some.","Anotando, sobra."] },
    { "id":"passo", "tipo":"acao", "narracao":"Comece simples, anote um gasto por dia durante uma semana.", "titulo":"Comece por:", "prefixo":"anota ", "destaque":"1 gasto", "sufixo":" por dia", "extra":"por uma semana." },
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

Devolva só o JSON do objeto com "cenas" (ideal 9; aceito 7 a 9). Nada além disso.`;

/**
 * Gera o script.json de um vídeo a partir do tema.
 * @returns {Promise<{fps,width,height,cenas:Array}>}
 */
async function _gerarUma({ tema, resumo, hint } = {}) {
  if (!tema) throw new Error('[roteirista-video] tema obrigatório');

  const user = `Tema: ${tema}\n${resumo ? `Ângulo/resumo: ${resumo}\n` : ''}\nGere o JSON com "cenas" (7 a 9), seguindo a estrutura e as regras. Saída: só JSON.${hint ? '\n\nA tentativa anterior foi REJEITADA por: ' + hint + '\nCorrija EXATAMENTE isso e devolva o JSON completo de novo.' : ''}`;

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
  if (!Array.isArray(cenas) || cenas.length < 7 || cenas.length > 9) {
    throw new Error(`[roteirista-video] esperava 7-9 cenas, recebi ${cenas?.length}`);
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
  });

  // âncoras de estrutura
  if (cenas[0].tipo !== 'gancho') throw new Error('[roteirista-video] primeira cena precisa ser "gancho"');
  if (cenas[cenas.length - 1].tipo !== 'cta') throw new Error('[roteirista-video] última cena precisa ser "cta"');
  if (!cenas.some((c) => c.tipo === 'explicador')) throw new Error('[roteirista-video] falta a cena "explicador" (PRADEX)');

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
