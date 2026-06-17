// run-completo.mjs
// Orquestrador end-to-end pro GitHub Actions cron.
//
// Fila + numeração de capítulo vivem em dois arquivos versionados no repo
// (sem Supabase desde 2026-06-17 — ver engine/openai/data/):
//   - data/temas.json  → array ordenado dos temas que faltam publicar
//   - data/estado.json → ponteiro (indice_atual) + numeração (capitulo_offset, total_capitulos)
//
// Pipeline:
//   1. Lê data/temas.json + data/estado.json → topic = temas[indice_atual]
//   2. OpenAI: gerarRoteiro() → caption + hashtags + 2 slides estruturados
//   3. Em paralelo:
//      - slide 1 (TENSÃO) → template Python (slide_tensao.py)
//      - slide 2 (RESOLUÇÃO) → template Python (slide_resolucao.py)
//   4. DRY_RUN=true (modo manual, sempre ligado hoje): gera + deixa artifact, NÃO posta,
//      NÃO avança o índice. O Lucas avança explícito depois de postar: `npm run avancar`.
//   5. Post real (Fase 4, dormente hoje): postar.mjs → incrementa indice_atual + regrava estado.json.
//
// Falhas: logam stack + exit code != 0 (GitHub Actions marca o run como failed).

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarCarrossel } from './gerar-carrossel.mjs';
import { postarTikTok } from './postar.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');
const TEMAS_PATH = resolve(DATA_DIR, 'temas.json');
const ESTADO_PATH = resolve(DATA_DIR, 'estado.json');

const SCHEDULED_DATE = process.env.SCHEDULED_DATE; // opcional ISO-8601
const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function lerJSON(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function main() {
  console.log(`[run] iniciando — dryRun=${DRY_RUN}`);

  // 1. Lê fila + estado dos arquivos versionados
  const temas = await lerJSON(TEMAS_PATH);
  const estado = await lerJSON(ESTADO_PATH);
  const idx = estado.indice_atual;

  if (idx >= temas.length) {
    console.log(
      `[run] fila acabou — indice_atual=${idx} >= temas (${temas.length}). Nada a gerar. Saindo limpo.`
    );
    return;
  }

  const topic = temas[idx];
  const chapterNumber = estado.capitulo_offset + idx;
  const chapterTotal = estado.total_capitulos;
  console.log(
    `[run] tema #${idx}: "${topic.tema}" (ângulo=${topic.angulo}) — CAP. ${chapterNumber}/${chapterTotal}`
  );

  // 2. Gera roteiro + 3. gera 2 slides em paralelo
  const r = await gerarCarrossel({
    topico: topic.tema,
    angulo: topic.angulo,
    chapterNumber,
    chapterTotal,
  });
  console.log(`[run] carrossel pronto em ${r.outputDir}`);

  if (DRY_RUN) {
    console.log(
      '[run] DRY_RUN=true → carrossel gerado como artifact. NÃO posta e NÃO avança o índice.'
    );
    console.log('[run] Pra avançar a fila depois de postar manualmente: npm run avancar');
    console.log('[run] PIPELINE (dry-run) COMPLETO ✓');
    return;
  }

  // 4. Post real (Fase 4 — dormente: postar.mjs ainda aponta pro caminho antigo e o
  // workflow força dry-run). Mantido correto pra quando a audit liberar o Direct Post.
  console.log(`[run] postando via TikTok (scheduled=${SCHEDULED_DATE || 'imediato'})`);
  const postResult = await postarTikTok({
    slidePaths: r.slidePaths,
    caption: r.caption,
    hashtags: r.hashtags,
    scheduledDate: SCHEDULED_DATE,
    timezone: SCHEDULED_DATE ? TIMEZONE : undefined,
  });
  console.log(`[run] post OK. request_id=${postResult.request_id}, job_id=${postResult.job_id}`);

  // 5. Avança a fila: incrementa indice_atual e regrava estado.json
  estado.indice_atual = idx + 1;
  await writeFile(ESTADO_PATH, JSON.stringify(estado, null, 2) + '\n');
  console.log(`[run] estado.json avançado → indice_atual=${estado.indice_atual}`);
  // TODO Fase 4: commit-back no workflow (permissions: contents: write + step de git commit/push)
  // pra persistir o estado.json incrementado de volta no repo após o post automático.

  console.log('[run] PIPELINE COMPLETO ✓');
}

main().catch((e) => {
  console.error('[run] FALHA:', e.message);
  console.error(e.stack);
  process.exit(1);
});
