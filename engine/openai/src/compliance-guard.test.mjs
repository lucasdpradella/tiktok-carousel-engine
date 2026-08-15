// compliance-guard.test.mjs — fixtures do guard COMPARTILHADO (vídeo + carrossel).
// Roda offline, sem API e sem rede:  node --test src/    (ou: npm test, na pasta engine/openai)
//
// Foco: o guard novo acharValorSemLastro (achado do Lucas 2026-08-14, post de vídeo de 12/08) —
// reprovar o valor em R$ INVENTADO em fala de retorno, com ZERO falso-positivo nos roteiros já
// aprovados. Os APROVA_* abaixo são texto real de roteiro que já foi ao ar ou que os validadores
// existentes EXIGEM (beat 4, slide de contraste, acharCustoVago) — se algum deles reprovar, o
// guard quebra produção.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acharAcaoProibida,
  acharCustoVago,
  acharReframeIrresponsavel,
  acharValorSemLastro,
  contarNegacoes,
} from './compliance-guard.mjs';

// entradas reais da fila (temas-video.json / temas-carrossel.json) — nenhuma traz valor em R$
const TEMA_RISCO = 'Risco e retorno: por que não existe rendimento alto sem risco escondido. A relação básica entre risco e retorno. Onde o retorno alto se paga, sem citar ativo ou ticker.';
const TEMA_PLANO = 'Plano de saúde não é gasto, é patrimônio negativo em formação. Reframe: o custo de saúde cresce com a idade e vira passivo futuro.';
const TEMA_DOLAR = 'Dólar não é aposta, é estrutura. Reframe: dólar como proteção e descorrelação do patrimônio.';
const TEMA_VAZA = 'Seu dinheiro não some, ele vaza. Gastos pequenos invisíveis que somam no mês.';

test('acharValorSemLastro REPROVA o caso real do post de 12/08 (R$ 2.000 numa promessa de retorno)', () => {
  // shape do achado: valor em reais pendurado numa promessa de "200% em um ano", sem âncora
  const cena = 'Alguém promete 200% em um ano. Você coloca R$ 2.000 e some com tudo.';
  assert.equal(acharValorSemLastro(cena, TEMA_RISCO), 'r$ 2.000');
});

test('acharValorSemLastro REPROVA o post de 12/08 reconstruído (narração publicada + tela)', () => {
  // narração literal de docs/post-video-2026-08-12/caption.txt — o "R$ 2.000" ficava nos campos de
  // TELA da cena "numero" (por isso não aparece na caption). _textoCena junta os dois.
  const narracao = 'Imagine um investimento que promete duzentos por cento em um ano, só pra ilustrar';
  const tela = 'R$ 2.000 Em 1 ano: R$ 6.000 se a promessa fosse real.';
  assert.equal(acharValorSemLastro(`${narracao} ${tela}`, TEMA_RISCO), 'r$ 2.000');
  // a mesma narração SEM o valor na tela é a forma correta — o percentual sozinho basta
  assert.equal(acharValorSemLastro(narracao, TEMA_RISCO), null);
});

test('acharValorSemLastro REPROVA valor inventado com a palavra de rendimento', () => {
  const cena = 'Prometeram que R$ 5.000 rendem o dobro em seis meses.';
  assert.equal(acharValorSemLastro(cena, TEMA_RISCO), 'r$ 5.000');
});

test('acharValorSemLastro REPROVA percentual + período mesmo sem a palavra "promessa"', () => {
  const slide = 'R$ 10.000 viram 30% ao ano, dizem por aí.';
  assert.ok(acharValorSemLastro(slide, TEMA_RISCO));
});

test('acharValorSemLastro APROVA valor COM lastro na entrada (âncora fornecida no prompt)', () => {
  // o caso do briefing: âncora real "R$ 1.200/ano" vinda do dado de entrada
  const entrada = TEMA_PLANO + ' Âncora do cliente: plano de R$ 1.200/ano.';
  const slide = 'Esse plano de R$ 1.200 por ano rende tranquilidade quando a conta chega.';
  assert.equal(acharValorSemLastro(slide, entrada), null);
});

test('acharValorSemLastro APROVA o slide de CONTRASTE do post "Plano de saúde" (custo, não retorno)', () => {
  // exigido por gerar-roteiro-carrossel.mjs: número nas DUAS pontas do contraste
  const slide = 'Sem plano: R$ 50 mil de uma vez. Com plano: R$ 1.200/mês previsíveis.';
  assert.equal(acharValorSemLastro(slide, TEMA_PLANO), null);
});

test('acharValorSemLastro APROVA a cena "numero" real do roteirista (ilustração de GASTO)', () => {
  // texto real de engine/video/out/script.json — beat 4 obrigatório
  const cena = 'Suponha que você gaste dez reais por dia em café, no mês são trezentos reais. R$ 10 / dia No mês: R$ 300 sem perceber.';
  assert.equal(acharValorSemLastro(cena, TEMA_VAZA), null);
});

test('acharValorSemLastro APROVA o carrossel real de orçamento (R$ 400 / R$ 200 / R$ 600 em gasto)', () => {
  // texto real de engine/remotion/src/carrossel.json
  const slide = 'Você acha que gasta R$ 200, mas gasta R$ 600 em média. Sobra R$ 400 no papel.';
  assert.equal(acharValorSemLastro(slide, TEMA_VAZA), null);
});

test('acharValorSemLastro APROVA "Dólar não é aposta" (número por extenso, sem R$)', () => {
  const cena = 'Imagine duas famílias, quinhentos mil reais cada, só pra ilustrar. Vem um ano de estresse, o real cai trinta por cento.';
  assert.equal(acharValorSemLastro(cena, TEMA_DOLAR), null);
});

test('acharValorSemLastro APROVA ilustração de CUSTO exigida por acharCustoVago', () => {
  const cena = 'Uma internação pode passar de R$ 50 mil, só pra ilustrar.';
  assert.equal(acharValorSemLastro(cena, TEMA_PLANO), null);
});

test('acharValorSemLastro APROVA renda/salário ("ganha R$ X por mês" não é retorno)', () => {
  const cena = 'Quem ganha R$ 5.000 por mês e não anota, termina o mês no zero.';
  assert.equal(acharValorSemLastro(cena, TEMA_VAZA), null);
});

test('acharValorSemLastro APROVA taxa em % ao ano sobre patrimônio (post legacy vs worldlegend)', () => {
  // caso real que a varredura pegou: percentual + período descrevendo CUSTO, não retorno
  const slide = 'Cliente private costuma pagar perto de 1% ao ano sobre o que tem investido. Em R$ 1 milhão, isso já passa de R$ 10 mil.';
  assert.equal(acharValorSemLastro(slide, 'Legacy vs World Legend: a conta que não aparece.'), null);
});

test('acharValorSemLastro distingue "R$ 1 milhão" de "R$ 1 mil" no lastro', () => {
  // alternação ordenada: "mil" antes de "milhão" fazia 1 milhão virar 1 mil
  const entrada = 'Âncora do caso: patrimônio de R$ 1 milhão.';
  assert.equal(acharValorSemLastro('Esse R$ 1 milhão rende conforme a estrutura.', entrada), null);
  assert.equal(acharValorSemLastro('Esse R$ 1 mil rende conforme a estrutura.', entrada), 'r$ 1 mil');
});

test('acharValorSemLastro não casa contexto distante (janela local, não roteiro inteiro)', () => {
  const longe = 'Anote o café de R$ 10 por dia e a assinatura que você esqueceu de cancelar no ano passado, aquela que renovou sozinha em janeiro sem avisar ninguém, e some tudo no fim do mês pra enxergar o vazamento de verdade. Só depois disso a conversa vira rendimento.';
  assert.equal(acharValorSemLastro(longe, TEMA_VAZA), null);
});

test('acharValorSemLastro tolera entrada ausente e texto vazio', () => {
  assert.equal(acharValorSemLastro('', ''), null);
  assert.equal(acharValorSemLastro(null), null);
  assert.equal(acharValorSemLastro('Custo de R$ 300 no mês.'), null);
  assert.ok(acharValorSemLastro('R$ 2.000 de lucro garantido.'));
});

// --- regressão dos guards que já existiam (nenhum tinha fixture até aqui) ---

test('acharAcaoProibida pega recomendação, promessa, timing e alocação prescritiva', () => {
  assert.ok(acharAcaoProibida('Invista em dólar agora.'));
  assert.ok(acharAcaoProibida('Rentabilidade garantida de 12%.'));
  assert.ok(acharAcaoProibida('O dólar vai subir esse ano.'));
  assert.ok(acharAcaoProibida('Mantenha 20% da carteira em renda fixa.'));
  assert.equal(acharAcaoProibida('Dólar não é aposta, é estrutura de proteção.'), null);
});

test('acharCustoVago cobra número onde há claim de custo', () => {
  assert.ok(acharCustoVago('Uma emergência hospitalar pode custar muito.'));
  assert.equal(acharCustoVago('Uma emergência hospitalar pode passar de R$ 50 mil.'), null);
});

test('acharReframeIrresponsavel bloqueia o take de má-fé, não o reframe correto', () => {
  assert.ok(acharReframeIrresponsavel('Plano de saúde é desperdício.'));
  assert.equal(acharReframeIrresponsavel('Plano de saúde não é investimento, é transferência de risco.'), null);
});

test('contarNegacoes conta o empilhamento', () => {
  assert.equal(contarNegacoes('Não é aposta. Não é sorte. Não é palpite.'), 3);
  assert.equal(contarNegacoes('Dólar não é aposta, é estrutura.'), 1);
});
