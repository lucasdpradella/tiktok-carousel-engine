// compliance-guard.mjs — guard de compliance COMPARTILHADO (roteirista de vídeo + carrossel).
// Bloqueia a AÇÃO, não o TEMA: recomendação imperativa, promessa de retorno, timing/previsão,
// ticker específico E — novo, §4 do briefing DEMONSTRAR (2026-07-04) — ALOCAÇÃO PRESCRITIVA
// (% de carteira, "precisa estar em X", "percentual estratégico"). Fonte única = sem drift.
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

// Anti-negação empilhada (§C): conta frases "não é/são/era/foi" no texto INTEIRO do roteiro.
// O reframe assinatura ("X não é Y, é Z") usa 1; o alvo é o EMPILHAMENTO (o post do dólar tinha 7).
export function contarNegacoes(txt) {
  // sem \b final: em JS o \b é ASCII e não fecha depois de "é" (vogal acentuada)
  const m = String(txt || '').toLowerCase().match(/\bn[ãa]o (é|s[ãa]o|era|foi|se trata|significa)/g);
  return m ? m.length : 0;
}
