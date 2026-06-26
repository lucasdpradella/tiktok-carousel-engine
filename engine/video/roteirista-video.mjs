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

const SYSTEM = `Você é o roteirista do PRADEX (série "Manual do Dinheiro" em VÍDEO faceless, 9:16, ~30s, voz clonada).
Posicionamento TRAVADO: planejamento, organização e comportamento financeiro. NUNCA recomendar investimento, ativo, "onde aplicar", "o que rende mais", nem timing de mercado. Tom de planejador sério e humano, anti-influencer (sem "galera", "bora", "PARE TUDO").

Recebe UM tema e devolve APENAS JSON (sem markdown) com este shape EXATO:

{
  "cenas": [
    { "id": "gancho", "tipo": "gancho", "narracao": "Seu dinheiro não some, ele vaza aos poucos.", "linhas": ["Seu dinheiro","não some."], "prefixo": "Ele ", "destaque": "VAZA." },
    { "id": "ponto", "tipo": "frase", "narracao": "E você quase nem percebe por onde ele vai.", "linhas": ["E você nem vê","por onde."] },
    { "id": "lista1", "tipo": "lista", "narracao": "São os gastos pequenos, os que parecem inofensivos.", "titulo": "São os pequenos:", "itens": [ {"icone":"delivery","linhas":["o delivery de terça"]}, {"icone":"assinatura","linhas":["a assinatura esquecida"]}, {"icone":"cafe","linhas":["o cafezinho diário"]} ] },
    { "id": "numero", "tipo": "numero", "narracao": "Sozinhos somam quinze reais, juntos viram seiscentos no mês.", "antes": "Sozinhos: R$ 15.", "rotulo": "Juntos:", "numero": "R$ 600", "depois": "no fim do mês." },
    { "id": "vira", "tipo": "duplo", "narracao": "Quem anota enxerga, e quem enxerga controla.", "linhas": ["Quem anota, controla.","Quem controla, sobra."] },
    { "id": "acao", "tipo": "acao", "narracao": "Começa hoje, anota um gasto, só um.", "titulo": "Começa hoje:", "prefixo": "anota ", "destaque": "UM", "sufixo": " gasto.", "extra": "Só um." },
    { "id": "pradex", "tipo": "explicador", "narracao": "No PRADEX você organiza tudo isso de graça.", "destaque": "PRADEX", "resto": ["é o meu app pra","organizar os gastos,","de graça."] },
    { "id": "cta", "tipo": "cta", "narracao": "Comenta PRADEX que eu te mando o link no direto.", "prefixo": "Comenta ", "destaque": "PRADEX", "linhas": ["que eu te mando","o link no direto"], "follow": "e me segue pra não morrer sem dinheiro." }
  ]
}

(As narrações acima são EXEMPLOS de estilo — escreva narrações NOVAS pro tema recebido, nunca copie o exemplo nem deixe reticências/placeholder.)

ESTRUTURA OBRIGATÓRIA (7 a 9 cenas, nesta ordem):
1. gancho (tipo "gancho") — choque calmo em 3s. linhas: 2 curtas; prefixo+destaque = a palavra-chave em terracota.
2..N-2. desenvolvimento: use "frase", "lista", "numero" e/ou "duplo" (2 a 4 cenas) pra desenvolver o tema.
N-2. acao (tipo "acao") — 1 micro-ação concreta ("anota UM gasto", etc.).
N-1. explicador (tipo "explicador") — SEMPRE destaque "PRADEX" + resto explicando que é o app de organizar gastos, de graça.
N.   cta (tipo "cta") — SEMPRE prefixo "Comenta ", destaque "PRADEX", e follow EXATAMENTE "e me segue pra não morrer sem dinheiro."

REGRAS DE NARRAÇÃO (campo "narracao" — é o que a voz fala):
- Fluida e natural, frases curtas. SEM travessão, SEM símbolos, SEM aspas. Use vírgula no lugar de pausa.
- NÃO use frase de uma palavra terminada em ponto (ruim pro TTS). Mínimo 3-4 palavras por frase.
- Valores e números POR EXTENSO e na ordem falada (ex: "dez reais", "seiscentos reais", "cinco minutos") — NUNCA "R$" nem algarismos na narração. (No texto de tela — antes/numero/depois — pode usar R$ e algarismos normalmente.)
- A narração conta a ideia da cena; o texto de tela é o resumo curto.

REGRAS DE TEXTO DE TELA:
- Linhas curtas (<= 16 caracteres) pra caber na tela 9:16. "destaque" = 1 palavra/expressão curta em terracota.
- "lista": 3 itens, e "icone" SÓ pode ser um de: delivery, assinatura, cafe. Se o tema não combinar com esses ícones, NÃO use "lista" (use frase/numero/duplo).
- "numero": use quando houver um número de impacto. Os campos de TELA desta cena (antes, numero, depois) DEVEM usar algarismos e R$. Ex CERTO: "numero": "R$ 600", "antes": "Sozinhos: R$ 15.". Ex ERRADO (PROIBIDO): "numero": "seiscentos reais". O valor por extenso vai SÓ na "narracao", nunca no campo de tela "numero".

Devolva só o JSON do objeto com "cenas". Nada além disso.`;

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
