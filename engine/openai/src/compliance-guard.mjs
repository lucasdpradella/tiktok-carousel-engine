// compliance-guard.mjs — guard de compliance COMPARTILHADO (roteirista de vídeo + carrossel).
// Bloqueia a AÇÃO, não o TEMA: recomendação imperativa, promessa de retorno, timing/previsão,
// ticker específico E — novo, §4 do briefing DEMONSTRAR (2026-07-04) — ALOCAÇÃO PRESCRITIVA
// (% de carteira, "precisa estar em X", "percentual estratégico"). Fonte única = sem drift.
// Também barra VALOR EM R$ SEM LASTRO em fala de retorno (2026-08-14) — ver acharValorSemLastro.
//
// As funções RETORNAM o trecho casado (string) ou null; o caller monta a mensagem de erro.

export const ACAO_PROIBIDA = [
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
  // timing / previsão de direção
  /\b(vai|vão|tende a|tendem a|deve|devem) (subir|cair|disparar|despencar|explodir|desabar|valorizar|desvalorizar)\b/,
  /\b(hora|momento) de (comprar|vender|investir|entrar|sair|aproveitar)\b/,
  /\b(hora|momento) (de|pra|para) (a |o )?(renda fixa|bolsa|a[çc][õo]es|d[óo]lar|cripto|bitcoin|t[íi]tulos?)\b/,
  /\bagora é a hora\b/,
  /\b(d[óo]lar|bolsa|ibovespa|bitcoin|a[çc][õo]es)\b[^.]{0,15}\bvai (pra|para|a|chegar|bater|virar)\b/,
  // valuation call (comprar/vender disfarçado)
  /\b(est[áa]|t[áa])\s+(barat[oa]|car[oa])\b/,
  /\b(barat[oa]|car[oa])\s+(demais|pra (comprar|entrar))\b/,
  // ticker específico (ex: petr4, vale3)
  /\b[a-z]{4}\d{1,2}\b/,
  // ALOCAÇÃO PRESCRITIVA — imperativo + objeto de alocação (§4 DEMONSTRAR)
  // (sem \b entre o imperativo e o objeto: \b do JS é ASCII e falha após vogal acentuada, ex "o ideal é")
  /\b(precisa|precisam|deve|devem|dever[íi]a|tem que|t[êe]m que|ter que|o ideal [ée]|o certo [ée]|mantenha|defina|aloque|coloque|reserve)[^.]{0,30}\b(fora do risco|na carteira|no patrim[ôo]nio|alocad|posicionad|em (renda fixa|d[óo]lar|a[çc][õo]es|bolsa|cripto|ouro|moeda forte|dividendos|fundos?|t[íi]tulos?)|\d{1,3}\s*(%|por cento))/,
  /\bpercentual (estrat[ée]gico|ideal|certo|recomendad|de aloca|de carteira)/,
  /\b(uma )?(parcela|fatia|parte|posi[çc][ãa]o) (precisa|deve|tem que|ideal|estrat[ée]gic)/,
];

// % de alocação: número % co-ocorrendo com palavra de carteira/alocação, FORA de exemplo ilustrativo.
const RE_PCT = /\b\d{1,3}\s*(%|por cento)/;
const RE_ALOC = /\b(carteira|patrim[ôo]nio|aloca|posi[çc][ãa]o|exposi[çc][ãa]o|percentual|parcela|fatia)/;
const RE_ILUSTRATIVO = /\b(imagine|imagina|digamos|suponha|hipot[ée]tic|s[óo] pra ilustrar|por exemplo|figura[dr])/;

/** Retorna o trecho da AÇÃO proibida (string) ou null (limpo). */
export function acharAcaoProibida(txt) {
  const t = String(txt || '').toLowerCase();
  for (const re of ACAO_PROIBIDA) {
    const m = t.match(re);
    if (m) return m[0];
  }
  // % de alocação prescritivo (só passa dentro de exemplo ILUSTRATIVO rotulado)
  if (RE_PCT.test(t) && RE_ALOC.test(t) && !RE_ILUSTRATIVO.test(t)) {
    return `${(t.match(RE_PCT) || ['%'])[0]} de alocação (percentual prescritivo)`;
  }
  return null;
}

// CUSTO VAGO (briefing-gemini §2, 2026-07-06): afirmação de custo/impacto SEM número é conteúdo
// raso ("atendimentos emergenciais podem custar muito"). Onde há claim de custo, exige número
// concreto ilustrativo. Lista estreita pra não dar falso-positivo em linguagem legítima.
const CUSTO_VAGO = [
  /\b(custa|custam|custar|custou)\s+(muito|caro|bastante)\b/,
  /\b(custa|custam|custar)\s+mais caro\b/,
  /\bsai(r|em)?\s+(muito\s+)?caro\b/,
  /\bmuito dinheiro\b/,
  /\bbastante (dinheiro|caro)\b/,
  /\bum valor (alto|elevado|absurdo)\b/,
  /\bvalores (altos|elevados|absurdos)\b/,
  /\bpode(m)? ser muito maior(es)?\b/,
  /\bmuito car[oa]s?\b/,
];

/** Retorna o trecho de CUSTO VAGO (claim de custo sem número) ou null. */
export function acharCustoVago(txt) {
  const t = String(txt || '').toLowerCase();
  for (const re of CUSTO_VAGO) {
    const m = t.match(re);
    if (m) return m[0];
  }
  return null;
}

// REFRAME IRRESPONSÁVEL (§4 do briefing carrossel-valioso): nunca argumentar CONTRA uma proteção/
// necessidade básica (plano de saúde, seguro, previdência, reserva) — a casa até VENDE isso.
// Alvo = o take de má-fé ("desperdício", "paga e não usa", "mau investimento", "não vale a pena ter").
// NÃO pega o reframe CORRETO ("plano não é investimento, é transferência de risco/proteção").
const REFRAME_IRRESPONSAVEL = [
  /\b(plano de sa[úu]de|seguro de vida|seguro|previd[êe]ncia|reserva de emerg[êe]ncia)\b[^.]{0,30}\b(desperd[íi]cio|jogar dinheiro fora|dinheiro jogado fora)\b/,
  /\bn[ãa]o vale a pena\b[^.]{0,18}\b(ter|contratar|pagar|manter|fazer)\b[^.]{0,18}\b(plano|seguro|previd)/,
  /\b(plano de sa[úu]de|seguro|previd[êe]ncia)\b[^.]{0,20}\b(mau|p[ée]ssimo|ruim|terr[íi]vel|furada) investimento\b/,
  /\bpaga\b[^.]{0,25}\b(nunca|quase nunca|s[óo] uma vez|raramente)\b[^.]{0,10}\busa\b/,
];

/** Retorna o trecho de um REFRAME IRRESPONSÁVEL (proteção pintada como desperdício) ou null. */
export function acharReframeIrresponsavel(txt) {
  const t = String(txt || '').toLowerCase();
  for (const re of REFRAME_IRRESPONSAVEL) {
    const m = t.match(re);
    if (m) return m[0];
  }
  return null;
}

// VALOR SEM LASTRO (achado do Lucas, 2026-08-14 — post de vídeo de 12/08, tema risco x retorno):
// espelho do acharCustoVago. Aquele COBRA número onde o roteiro falou de custo sem quantificar;
// este BARRA o número em R$ que o modelo inventou onde o percentual sozinho já comunicava.
// O caso real: "R$ 2.000" pendurado numa promessa de "200% em um ano" — sem âncora, sem base de
// cálculo, invenção pura ("nunca invente", CLAUDE.md §4).
//
// ⚠️ POR QUE NÃO É UM BLOQUEIO GERAL DE "R$ que não aparece nos dados de entrada":
// (1) NENHUM tema de entrada traz valor em R$ — temas-video.json, temas-carrossel.json e
//     data/pauta.json têm zero ocorrências de "R$". O lastro literal quase nunca existe.
// (2) Três validadores EXIGEM número ilustrativo inventado: o beat 4 (cena/slide "numero"), o
//     slide de CONTRASTE (número nas duas pontas) e o próprio acharCustoVago.
// Um bloqueio geral reprovaria 100% dos roteiros e entraria em deadlock com esses três — os 3-4
// retries queimariam e a run morreria sem postar. Então o guard mira o caso do achado: valor em R$
// colado em RETORNO/RENDIMENTO/PROMESSA, onde o percentual já basta e o número é invenção pura.
// Valor em contexto de CUSTO/GASTO/PATRIMÔNIO (justamente o que os outros guards pedem) passa.
//
// Escopo: roda por CENA (vídeo) e por SLIDE + caption (carrossel), igual aos outros guards — a
// janela de contexto é local, então promessa numa cena e valor em OUTRA cena não casam.
const JANELA_CTX = 120; // chars pra cada lado do valor = "mesma cena/slide", na prática

// escala SEMPRE com as formas longas primeiro: alternação em JS é ordenada, e "mil" antes de
// "milhão" faria "R$ 1 milhão" casar como "R$ 1 mil" (valor mil vezes menor).
const ESCALA = 'milh[õo]es|milh[ãa]o|bilh[õo]es|bilh[ãa]o|mil';
// valor monetário: "R$ 2.000", "R$ 50 mil", "R$ 1.200,50", "R$ 1,5 milhão"
const RE_MOEDA_G = new RegExp(`r\\$\\s*\\d[\\d.,]*(?:\\s*(?:${ESCALA}))?`, 'gi');
// qualquer número da ENTRADA vira lastro (com ou sem R$): "1.200/ano", "50 mil", "R$ 2.000"
const RE_NUM_G = new RegExp(`\\d[\\d.,]*(?:\\s*(?:${ESCALA}))?`, 'gi');

// contexto de RETORNO/RENDIMENTO/PROMESSA — onde o R$ inventado não tem serventia nenhuma.
// Fora daqui (custo, gasto, patrimônio, salário) o número segue liberado e é até obrigatório.
// "ganho/ganha" NÃO entra: "quem ganha R$ 5.000 por mês" é ilustração de renda, não de retorno.
const RE_CTX_RETORNO = /(rende|rendeu|render|rendimento|rentabilidade|retorno|lucr[oa]|valoriza|dobr[ao]|dobrar|tripl|multiplic|promete|prometem|prometid|promessa)/;
// percentual + período também é fala de retorno ("200% em um ano"), mesmo sem a palavra
const RE_CTX_PCT_PERIODO = /\d{1,4}\s*(%|por cento)[^.]{0,40}(ao ano|por ano|em um ano|num ano|no ano|ao m[êe]s|por m[êe]s|em \d+ (meses|anos))/;
// ...mas percentual+período também descreve CUSTO ("taxa de 1% ao ano sobre R$ 1 milhão"), que é
// ilustração legítima e apareceu em post aprovado (carrossel legacy vs worldlegend). Palavra de
// custo na janela desarma SÓ o gatilho fuzzy; verbo explícito de retorno acima continua valendo.
// ("come [ao]" = "a taxa come o rendimento"; solto pegaria "comenta"/"começa" e desarmaria o guard)
const RE_CTX_CUSTO = /(taxa|tarifa|anuidade|mensalidade|custo|custa|custar|paga|pagar|gasta|gasto|despesa|parcela|fatura|imposto|come [ao]|corr[óo]i)/;

/** "r$ 1.200" -> 1200 · "r$ 50 mil" -> 50000 · "r$ 1,5 milhão" -> 1500000 · null se não parsear. */
function _valorNumerico(s) {
  const m = String(s).match(new RegExp(`(\\d[\\d.,]*)\\s*(${ESCALA})?`, 'i'));
  if (!m) return null;
  // pt-BR: ponto é separador de milhar, vírgula é decimal
  const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const esc = (m[2] || '').toLowerCase();
  if (esc.startsWith('mil') && !esc.startsWith('milh')) return n * 1e3;
  if (esc.startsWith('milh')) return n * 1e6;
  if (esc.startsWith('bilh')) return n * 1e9;
  return n;
}

/** Conjunto de valores que a ENTRADA (tema, resumo, âncoras) sustenta. */
function _lastroDaEntrada(entrada) {
  const set = new Set();
  const t = String(entrada || '').toLowerCase();
  for (const m of t.matchAll(RE_NUM_G)) {
    const v = _valorNumerico(m[0]);
    if (v != null) set.add(v);
  }
  return set;
}

/**
 * Retorna o trecho do VALOR EM R$ SEM LASTRO (inventado, em contexto de retorno) ou null.
 * @param {string} txt     texto gerado (cena, slide ou caption)
 * @param {string} entrada dados de entrada reais do prompt (tema + resumo/tópico + âncoras)
 */
export function acharValorSemLastro(txt, entrada = '') {
  const t = String(txt || '').toLowerCase();
  const lastro = _lastroDaEntrada(entrada);
  for (const m of t.matchAll(RE_MOEDA_G)) {
    const valor = _valorNumerico(m[0]);
    // veio de dado de entrada real (âncora de patrimônio, exemplo fornecido) → liberado
    if (valor != null && lastro.has(valor)) continue;
    const ini = Math.max(0, m.index - JANELA_CTX);
    const ctx = t.slice(ini, m.index + m[0].length + JANELA_CTX);
    // trecho do erro sem pontuação final grudada ("r$ 38." -> "r$ 38"), pro hint do retry sair limpo
    const trecho = m[0].trim().replace(/[.,]+$/, '');
    if (RE_CTX_RETORNO.test(ctx)) return trecho;
    if (RE_CTX_PCT_PERIODO.test(ctx) && !RE_CTX_CUSTO.test(ctx)) return trecho;
  }
  return null;
}

// Anti-negação empilhada (§C): conta frases "não é/são/era/foi" no texto INTEIRO do roteiro.
// O reframe assinatura ("X não é Y, é Z") usa 1; o alvo é o EMPILHAMENTO (o post do dólar tinha 7).
export function contarNegacoes(txt) {
  // sem \b final: em JS o \b é ASCII e não fecha depois de "é" (vogal acentuada)
  const m = String(txt || '').toLowerCase().match(/\bn[ãa]o (é|s[ãa]o|era|foi|se trata|significa)/g);
  return m ? m.length : 0;
}
