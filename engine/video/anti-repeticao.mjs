// anti-repeticao.mjs — a TRAVA. Roda ANTES de gerar (carrossel e vídeo) e decide se um
// candidato pode virar post, olhando o histórico REAL de tudo que já foi publicado
// (data/historico.json — carrossel, vídeo, expert e PIL, os dois tipos no mesmo balde).
//
// Causa raiz que ela mata (auditada 2026-07-31): dólar saiu no vídeo de 29/07 e no carrossel
// de 31/07 porque (a) o mesmo tema existia nas DUAS filas, (b) o wrap circular rebobinou a fila
// do carrossel pro idx 0, e (c) nenhum runner olhava o que já tinha sido postado.
//
// REGRAS (bloqueiam o candidato):
//   R1 slug      — tema já postado ALGUMA VEZ, em qualquer tipo. Bloqueio duro, SEM PRAZO.
//   R2 categoria — mesma categoria nos últimos JANELA_CATEGORIA posts (contando os dois tipos).
//                  SÓ vale pro roteirista automático (ver REGRAS_CURADO abaixo).
//   R3 jaccard   — similaridade de título ≥ LIMIAR_JACCARD entre os slugs tokenizados.
//   R4 assunto   — mesmo ASSUNTO-CHAVE dentro da JANELA DE RECÊNCIA. Tem prazo de propósito:
//                  bloqueio eterno de assunto trava a fila inteira com o tempo (só a R1 é eterna).
//
// Sobre a R4: o briefing pediu que a R3 pegasse "Dólar não é aposta" vs "O que move o dólar".
// Jaccard não pega — os títulos só dividem 1 token de ~7 (≈0,14, longe de 0,6). A R4 existe pra
// entregar essa intenção: um dicionário pequeno de assuntos (dólar/câmbio, CDI, FII, Selic...)
// que reconhece "é o mesmo assunto com outro título". Extensível em TERMOS_ASSUNTO abaixo.
//
// Bloqueou → o runner pula pro PRÓXIMO elegível. Nenhum elegível → sai limpo SEM POSTAR.
// Nunca postar repetido "porque era a vez dele".

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(__dirname, '../..');
export const HISTORICO = resolve(REPO, 'data/historico.json');

export const JANELA_CATEGORIA = 4; // posts recentes olhados pela R2
export const LIMIAR_JACCARD = 0.6; // R3

// JANELA DE RECÊNCIA DA R4 — o assunto sai do bloqueio pelo QUE VIER PRIMEIRO: 8 posts novos
// empurrando o antigo pra fora, OU 60 dias de idade. Na grade normal (3 posts/semana) quem
// solta é a contagem (~19 dias); se a publicação travar, quem solta é o tempo — que é
// exatamente o caso que o bloqueio eterno estragava. Só a R1 (tema já postado) não tem prazo.
export const JANELA_ASSUNTO = 8;       // bloqueia só dentro dos últimos N posts...
export const JANELA_ASSUNTO_DIAS = 60; // ...E só se o post tiver menos de N dias

// Conjuntos de regras por CAMINHO.
//   automático — o roteirista escolhendo sozinho: tudo ligado.
//   curado     — pauta aprovada na mão pelo Lucas e TOPICO= manual: só a R1. Recência de
//                categoria/assunto não veta decisão humana; repetir tema já publicado, sim.
export const REGRAS_AUTOMATICO = ['slug', 'categoria', 'jaccard', 'assunto'];
export const REGRAS_CURADO = ['slug'];

// stopwords PT — saem do slug pra o slug ser o ASSUNTO, não a frase.
const STOPWORDS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas',
  'por', 'para', 'pra', 'pro', 'com', 'sem', 'sob', 'sobre', 'que', 'se', 'ao', 'aos', 'as', 'os',
  'ou', 'mas', 'nao', 'sim', 'ser', 'eh', 'seu', 'sua', 'seus', 'suas', 'meu', 'minha',
  'voce', 'vc', 'ele', 'ela', 'eles', 'elas', 'isso', 'esse', 'essa', 'este', 'esta', 'isto',
  'aquilo', 'aquele', 'aquela', 'como', 'qual', 'quais', 'quando', 'onde', 'quem', 'porque',
  'pelo', 'pela', 'pelos', 'pelas', 'num', 'numa', 'todo', 'toda', 'todos', 'todas', 'tudo',
  'mais', 'menos', 'muito', 'muita', 'pouco', 'ja', 'ainda', 'so', 'tambem', 'entre', 'ate',
  'tem', 'ter', 'tera', 'foi', 'era', 'vai', 'faz', 'fazer', 'esta', 'estao', 'sao', 'ficar',
  'dele', 'dela', 'nem', 'lhe', 'me', 'te', 'nos', 'meu', 'la', 'ai', 'aqui', 'depois', 'antes',
]);

// ASSUNTOS-CHAVE (R4). chave canônica → apelidos procurados no título normalizado.
// Apelido com espaço vira busca de expressão (ex.: 'renda fixa'). Extensível à vontade:
// acrescentar um apelido aqui é o jeito de ensinar a trava que dois títulos falam do mesmo tema.
export const TERMOS_ASSUNTO = {
  dolar: ['dolar', 'dolares', 'cambio', 'cambial', 'moeda estrangeira'],
  cdi: ['cdi'],
  selic: ['selic'],
  juros: ['juros', 'juro', 'taxa basica'],
  'juros-compostos': ['juros compostos'],
  inflacao: ['inflacao', 'ipca'],
  fii: ['fii', 'fiis', 'fundo imobiliario', 'fundos imobiliarios', 'tijolo', 'laje', 'galpao'],
  offshore: ['offshore', 'jurisdicao'],
  'renda-fixa': ['renda fixa', 'marcacao a mercado', 'tesouro direto', 'titulo publico'],
  reserva: ['reserva', 'emergencia'],
  aposentadoria: ['aposentadoria', 'previdencia', 'fundo de pensao', 'fundos de pensao', 'independencia financeira'],
  diversificacao: ['diversificacao', 'diversificar', 'descorrelacao', 'descorrelacionado'],
  'plano-saude': ['plano de saude', 'saude'],
  orcamento: ['orcamento', '50 30 20'],
  divida: ['divida', 'dividas', 'emprestimo'],
  liquidez: ['liquidez'],
  risco: ['premio de risco', 'risco e retorno', 'risco escondido'],
  bolsa: ['bolsa', 'acao', 'acoes', 'valuation', 'precifica'],
  vies: ['vies', 'aversao a perda', 'efeito manada', 'ancoragem', 'confirmacao', 'cerebro'],
  vazamento: ['vaza', 'vazamento', 'gasto invisivel', 'termina o mes no zero'],
  ciclos: ['ciclo', 'ciclos', 'pib'],
  'custo-oportunidade': ['custo de oportunidade', 'dinheiro parado'],
};

// ── normalização ─────────────────────────────────────────────────────────────
/** minúsculas, sem acento, só letra/dígito/espaço. */
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining marks (acentos) — escapes, nunca o char cru
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** tokens significativos (sem stopword, sem token de 1 letra). */
export function tokenizar(texto) {
  return normalizar(texto)
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** slug = tema normalizado, sem acento e sem stopword. É o que a R1 compara. */
export function slugificar(texto) {
  return tokenizar(texto).join('-');
}

/** Jaccard entre os tokens de dois textos (0..1). */
export function jaccard(a, b) {
  const A = new Set(tokenizar(a));
  const B = new Set(tokenizar(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** assuntos-chave reconhecidos no título (R4). */
export function assuntosDe(texto) {
  const n = ` ${normalizar(texto)} `;
  const achados = [];
  for (const [chave, apelidos] of Object.entries(TERMOS_ASSUNTO)) {
    if (apelidos.some((a) => n.includes(` ${a} `))) achados.push(chave);
  }
  return achados;
}

// ── histórico ────────────────────────────────────────────────────────────────
/** lê data/historico.json (array). Não existe ainda → []. */
export async function lerHistorico() {
  if (!existsSync(HISTORICO)) return [];
  const raw = JSON.parse(await readFile(HISTORICO, 'utf-8'));
  return Array.isArray(raw) ? raw : [];
}

/** posts em ordem cronológica (o arquivo já é append-only, mas não confiamos nisso). */
export function ordenarPorData(historico) {
  return [...historico].sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

/**
 * Append de um post REAL no histórico. Chamado no MESMO passo que hoje avança
 * estado-*.json / marca a pauta — post publicado sem registro é trava cega no próximo run.
 */
export async function registrarPost({ data, tipo, tema, categoria, origem, run_id }) {
  const historico = await lerHistorico();
  const entrada = {
    data,
    tipo,
    tema,
    categoria: categoria || 'generico',
    slug: slugificar(tema),
    origem: origem || 'desconhecida',
    run_id: run_id || '',
  };
  historico.push(entrada);
  await mkdir(dirname(HISTORICO), { recursive: true });
  await writeFile(HISTORICO, JSON.stringify(historico, null, 2) + '\n');
  console.log(`[trava] histórico +1: ${data} · ${tipo} · "${tema}" (slug=${entrada.slug}, origem=${entrada.origem})`);
  return entrada;
}

/**
 * Posts que ainda bloqueiam pela R4: estão entre os últimos JANELA_ASSUNTO E têm menos de
 * JANELA_ASSUNTO_DIAS dias. Sair de QUALQUER uma das duas condições já libera o assunto — é o
 * que impede a fila de travar inteira com o tempo (inclusive quando a publicação para).
 */
export function recentesR4(ordenado, hojeISO) {
  const hoje = hojeISO || new Date().toISOString().slice(0, 10);
  const corte = new Date(`${hoje}T00:00:00Z`);
  corte.setUTCDate(corte.getUTCDate() - JANELA_ASSUNTO_DIAS);
  const limite = corte.toISOString().slice(0, 10);
  return ordenado.slice(-JANELA_ASSUNTO).filter((p) => String(p.data) >= limite);
}

/** já saiu post desse tipo nessa data? (anti-duplo que funciona também pro pré-pronto) */
export function jaPostouEm(historico, { data, tipo }) {
  return historico.some((p) => p.data === data && p.tipo === tipo);
}

// ── a trava ──────────────────────────────────────────────────────────────────
/**
 * Decide se o candidato pode virar post.
 *
 * @param {{tema:string, categoria?:string}} candidato
 * @param {Array} historico
 * @param {{regras?: string[], hoje?: string}} opts — quais regras aplicar (default:
 *        REGRAS_AUTOMATICO) e a data de referência da janela da R4 (default: hoje).
 * @returns {{ok: boolean, motivo: string|null, slug: string}}
 */
export function checarCandidato(candidato, historico, opts = {}) {
  const regras = new Set(opts.regras || REGRAS_AUTOMATICO);
  const tema = candidato?.tema || '';
  const slug = slugificar(tema);
  const categoria = candidato?.categoria || 'generico';
  const ordenado = ordenarPorData(historico);

  if (!tema.trim()) return { ok: false, motivo: 'candidato sem tema', slug };

  // R1 — slug já postado alguma vez, em qualquer tipo. Sem prazo.
  if (regras.has('slug')) {
    const antes = ordenado.find((p) => p.slug === slug);
    if (antes) {
      return { ok: false, slug, motivo: `R1 slug já postado em ${antes.data} (${antes.tipo}): "${antes.tema}"` };
    }
  }

  // R2 — mesma categoria nos últimos JANELA_CATEGORIA posts (os dois tipos juntos).
  if (regras.has('categoria')) {
    const recentes = ordenado.slice(-JANELA_CATEGORIA);
    const colide = recentes.find((p) => p.categoria === categoria);
    if (colide) {
      return {
        ok: false,
        slug,
        motivo: `R2 categoria "${categoria}" repetida nos últimos ${JANELA_CATEGORIA} posts (${colide.data}, ${colide.tipo})`,
      };
    }
  }

  // R3 — similaridade alta de título contra TODO o histórico.
  if (regras.has('jaccard')) {
    for (const p of ordenado) {
      const s = jaccard(tema, p.tema);
      if (s >= LIMIAR_JACCARD) {
        return {
          ok: false,
          slug,
          motivo: `R3 título ${s.toFixed(2)} similar a "${p.tema}" (${p.data}, ${p.tipo})`,
        };
      }
    }
  }

  // R4 — mesmo assunto-chave dentro da janela de recência (últimos N posts OU últimos N dias).
  if (regras.has('assunto')) {
    const meus = assuntosDe(tema);
    if (meus.length) {
      const recentes = recentesR4(ordenado, opts.hoje);
      for (const p of recentes) {
        const compartilhado = assuntosDe(p.tema).find((a) => meus.includes(a));
        if (compartilhado) {
          return {
            ok: false,
            slug,
            motivo: `R4 assunto "${compartilhado}" saiu dentro da janela (${JANELA_ASSUNTO} posts ou ${JANELA_ASSUNTO_DIAS} dias): "${p.tema}" (${p.data}, ${p.tipo})`,
          };
        }
      }
    }
  }

  return { ok: true, motivo: null, slug };
}

/**
 * Primeiro candidato ELEGÍVEL da lista (a partir de `desde`), logando ::warning:: em cada
 * bloqueio. Nenhum passou → { item: null } e o runner sai limpo SEM POSTAR.
 *
 * @returns {{item: any|null, indice: number, slug: string|null, bloqueados: Array}}
 */
export function primeiroElegivel(candidatos, historico, opts = {}) {
  const { desde = 0, rotulo = 'fila', regras } = opts;
  const bloqueados = [];
  for (let i = desde; i < candidatos.length; i++) {
    const c = candidatos[i];
    if (!c) continue;
    const { ok, motivo, slug } = checarCandidato({ tema: c.tema, categoria: c.categoria }, historico, { regras });
    if (ok) return { item: c, indice: i, slug, bloqueados };
    bloqueados.push({ indice: i, tema: c.tema, motivo });
    console.log(`::warning::[trava] ${rotulo} #${i} "${c.tema}" BLOQUEADO — ${motivo}`);
  }
  return { item: null, indice: -1, slug: null, bloqueados };
}
