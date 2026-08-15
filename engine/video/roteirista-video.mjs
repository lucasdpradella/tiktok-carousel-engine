// roteirista-video.mjs — gera o script.json de UM vídeo faceless (§2b do briefing-mestre).
// tema (fila) → gpt-4o-mini → { fps,width,height, cenas[] } no schema do piloto "dinheiro vaza".
// Reusa o client OpenAI do carrossel. Narração TTS-safe (sanitizada). Sem investimento (posicionamento travado).
//
// CLI:  node roteirista-video.mjs [indice]   (default: estado-video.json.indice_atual)
//       → escreve engine/video/out/script.json + imprime resumo.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat } from '../openai/src/chat-provider.mjs'; // Gemini (Pro→Flash) com fallback OpenAI
import { acharAcaoProibida, contarNegacoes, acharReframeIrresponsavel, acharCustoVago, acharValorSemLastro } from '../openai/src/compliance-guard.mjs';

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

// Backstop de compliance — a lista de padrões vive no módulo compartilhado (compliance-guard.mjs),
// usado igual pelo carrossel (sem drift). Bloqueia a AÇÃO (recomendação/promessa/timing/ticker/
// ALOCAÇÃO PRESCRITIVA), nunca o TEMA. Libera conceito/estrutura/reframe/raciocínio próprio.
function _textoCena(c) {
  const p = [c.narracao, c.titulo, c.corpo, c.antes, c.numero, c.depois, c.rotulo, c.prefixo, c.destaque, c.sufixo, c.extra, c.follow];
  if (Array.isArray(c.linhas)) p.push(c.linhas.join(' '));
  if (Array.isArray(c.resto)) p.push(c.resto.join(' '));
  if (Array.isArray(c.itens)) for (const it of c.itens) if (Array.isArray(it.linhas)) p.push(it.linhas.join(' '));
  return p.filter(Boolean).join(' ');
}
function checarCompliance(c, id, entrada = '') {
  const txt = _textoCena(c);
  const hit = acharAcaoProibida(txt);
  if (hit) {
    throw new Error(`cena ${id}: AÇÃO proibida ("${hit}") na narração/tela — recomendação direta, promessa de retorno, timing OU alocação prescritiva (% de carteira, "precisa estar em X"). Discuta o conceito/estrutura e reframe; para dosagem, responda com PROCESSO ("depende do seu perfil e objetivo, é conversa de planejamento"), nunca com número/percentual.`);
  }
  const irr = acharReframeIrresponsavel(txt);
  if (irr) {
    throw new Error(`cena ${id}: REFRAME IRRESPONSÁVEL ("${irr}") — NÃO argumente contra proteção/necessidade (plano de saúde, seguro, previdência, reserva). Posicione o VALOR (transferência de risco, custo de NÃO ter, como estruturar bem), nunca "desperdício"/"paga e não usa".`);
  }
  // ESPECIFICIDADE: claim de custo sem número = raso ("pode custar muito"). Na narração o número
  // vai por EXTENSO ("cinquenta mil reais"); na tela, em algarismo.
  const vago = acharCustoVago(txt);
  if (vago) {
    throw new Error(`cena ${id}: CUSTO VAGO ("${vago}") — troque por um número concreto ILUSTRATIVO (narração por extenso, ex "pode passar de cinquenta mil reais, só pra ilustrar"). Nada de "custa muito/caro" sem número.`);
  }
  // NUNCA INVENTE (CLAUDE.md §4): valor em R$ colado em retorno/rendimento/promessa, sem vir de
  // nenhum dado de entrada, é invenção pura — o percentual sozinho já comunica o risco.
  const semLastro = acharValorSemLastro(txt, entrada);
  if (semLastro) {
    throw new Error(`cena ${id}: VALOR SEM LASTRO ("${semLastro}") — valor em reais inventado numa fala de RETORNO/RENDIMENTO/PROMESSA; o tema não fornece essa âncora. TROQUE o valor por PERCENTUAL, múltiplo ou prazo, mantendo o campo de tela "numero" PREENCHIDO com algarismo (ex "200% ao ano", "2x", "10 anos") e a narração por extenso ("duzentos por cento em um ano") — NUNCA esvazie o "numero" nem corte a cena de exemplo. Valor em R$ segue liberado em ilustração de CUSTO/GASTO.`);
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

# REGRA DURA — DEMONSTRAR, NÃO AFIRMAR (o que separa "sofisticado mas inútil" de aula de verdade)
NÃO basta AFIRMAR a tese e esperar que o leitor acredite. FAÇA o leitor ENXERGAR o mecanismo: cena → número → contraste. Invioláveis:
(A) EXEMPLO COM NÚMERO (beat 4, cena "numero") é OBRIGATÓRIO — número ILUSTRATIVO ("imagine, só pra ilustrar...", "digamos que...") que mostra o mecanismo EM AÇÃO e o custo. Número usado só pra NEGAR algo ("não é sobre o dólar ir a seis reais") NÃO conta como beat 4.
(B) CONTRASTE CONCRETO (beat 6, cena "duplo") é OBRIGATÓRIO — antes vs depois, OU caminho A vs B, OU família/carteira 1 vs 2. Mostre as DUAS pontas, não só afirme que há diferença.
(C) ANTI-NEGAÇÃO EMPILHADA — no máximo 1 frase "não é X" no roteiro todo (fora do reframe do gancho). Proibido "não é A. não é B. não é C." como corpo: isso é falsa profundidade. A tese se sustenta pelo que É, com exemplo.
(D) AFIRMOU → PROVE NA FRASE SEGUINTE — toda afirmação de mecanismo ("o real se desvaloriza estruturalmente", "hedge protege") vem IMEDIATAMENTE seguida de exemplo/número/cena que a sustente. Afirmação solta = reprovado.
(E) GANCHO ANCORADO (beat 1) — abra numa CENA COTIDIANA já vivida (aeroporto, remédio importado, curso do filho fora, boleto que subiu), não no conceito abstrato. O reframe "X não é Y, é Z" vem logo DEPOIS, mas a cena vem PRIMEIRO.
(F) DOSAGEM = PROCESSO, NÃO NÚMERO — quando o tema pedir "quanto" (quanto em dólar, quanto na reserva), NUNCA responda com percentual/faixa (ex "vinte a quarenta por cento") — é alocação prescritiva, PROIBIDO. Responda com PROCESSO: "quanto exatamente depende do seu perfil e objetivo, é conversa de planejamento, não regra de bolso." Mantém compliant E puxa pro serviço.
(G2) NÚMERO É DE CUSTO, NÃO DE RETORNO — ao falar de rendimento, promessa ou retorno, use SÓ o percentual ("prometem duzentos por cento em um ano"). PROIBIDO inventar valor em reais pra "dar um exemplo" de retorno (FAIL: "você põe dois mil reais e some tudo"); o percentual sozinho já comunica o risco. Valor em reais só em ilustração de CUSTO/GASTO, ou quando o TEMA fornecer a âncora. Isso NÃO dispensa a cena "numero" (beat 4): em tema de retorno, preencha o campo de tela com PERCENTUAL, múltiplo ou prazo ("200% ao ano", "2x", "10 anos"), nunca vazio.
(G) ESPECIFICIDADE — PROIBIDO quantificador vago onde deveria ter número: "custa muito", "pode custar caro", "sai caro", "muito dinheiro", "um valor alto", "pode ser muito maior". Toda afirmação de CUSTO/IMPACTO traz número concreto ilustrativo (na narração POR EXTENSO: "pode passar de cinquenta mil reais, só pra ilustrar"). Cada cena entrega uma informação ou número que a pessoa NÃO tinha — nunca paráfrase genérica do óbvio.

## EXEMPLOS (siga o PASS, evite o FAIL) — narração em extenso, TTS-safe
FAIL (vazio, só afirma): "Ter dólar na carteira é reconhecer que a moeda perde valor estruturalmente, não é pessimismo, é realidade histórica."
PASS (demonstra — cena + número + contraste): "Imagine duas famílias, quinhentos mil reais cada, só pra ilustrar. Uma deixou tudo em real, a outra pôs uma parte em moeda forte. Vem um ano de estresse, o real cai trinta por cento. A primeira acha que não perdeu nada, até tentar pagar o intercâmbio do filho lá fora, sumiu trinta por cento do poder de compra. A segunda amorteceu. Isso é estrutura, não aposta."
FAIL (alocação prescritiva, PROIBIDO): "Defina um percentual estratégico, entre vinte e quarenta por cento, e mantenha."
PASS (processo, não número): "Quanto exatamente, não tem regra de bolso, depende do seu perfil e objetivo, isso é conversa de planejamento."

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

  // dados de ENTRADA reais (o que sustenta um valor em R$ na tela/narração — ver acharValorSemLastro)
  const entrada = [tema, resumo].filter(Boolean).join(' ');

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
    checarCompliance(c, id, entrada);
  });

  // âncoras de estrutura
  if (cenas[0].tipo !== 'gancho') throw new Error('[roteirista-video] primeira cena precisa ser "gancho"');
  if (cenas[cenas.length - 1].tipo !== 'cta') throw new Error('[roteirista-video] última cena precisa ser "cta"');
  if (!cenas.some((c) => c.tipo === 'explicador')) throw new Error('[roteirista-video] falta a cena "explicador" (PRADEX)');

  // §3/§4 DEMONSTRAR, não afirmar — força os beats que o roteirista costuma pular:
  if (!cenas.some((c) => c.tipo === 'numero')) {
    throw new Error('[roteirista-video] falta o BEAT 4: uma cena "numero" com EXEMPLO ilustrativo (número que MOSTRA o mecanismo em ação, rotulado "imagine..."). Número só pra negar algo não conta.');
  }
  if (!cenas.some((c) => c.tipo === 'duplo')) {
    throw new Error('[roteirista-video] falta o BEAT 6: uma cena "duplo" de CONTRASTE concreto (antes vs depois, ou carteira A vs B). Mostre as DUAS pontas, não só afirme que há diferença.');
  }
  const negs = contarNegacoes(cenas.map(_textoCena).join(' '));
  if (negs >= 4) {
    throw new Error(`[roteirista-video] NEGAÇÃO EMPILHADA (${negs} frases "não é X"): a tese se sustenta por CONSTRUÇÃO (o que É + exemplo), não por acúmulo de negação. Reescreva mostrando o que É, com no máximo 1 negação fora do reframe do gancho.`);
  }

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
