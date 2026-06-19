// run-completo.mjs
// Orquestrador do GitHub Actions, em DUAS FASES (a Content Posting API puxa as
// imagens por URL, então elas precisam estar públicas no GitHub Pages ANTES do
// content/init — o git que publica acontece ENTRE as fases, no workflow).
//
//   FASE 1 — generate  (node src/run-completo.mjs):
//     1. Lê data/temas.json + data/estado.json → topic = temas[indice_atual]
//     2. gerarCarrossel() → roteiro + 2 PNGs (templates Python)
//     3. Converte os PNGs → JPEG (TikTok não aceita PNG em foto)
//     4. (se !DRY_RUN) copia os JPEGs pra docs/post-YYYY-MM-DD/ (servido pelo Pages)
//        e grava outputs/last-post.json (manifesto pra Fase 2)
//     → workflow comita/pusha docs/ e espera o Pages publicar
//
//   FASE 2 — post  (node src/run-completo.mjs --post):
//     5. Lê o manifesto + faz HEAD nas URLs do Pages até 200 (timeout ~5min)
//     6. refreshAccessToken() → access_token fresco (avisa se o refresh rotacionou)
//     7. postarTikTokInbox() → publish_id (MEDIA_UPLOAD = cai no inbox do @pradella.lucas)
//     8. Avança data/estado.json (indice_atual += 1)
//     → workflow comita/pusha data/estado.json
//
// DRY_RUN=true: roda só a Fase 1 sem stagear em docs/ — gera o artifact (PNG+JPEG),
// não posta e não avança. (O workflow nem chama a Fase 2 quando dry-run.)
//
// Degradação graciosa: MEDIA_UPLOAD nunca publica sozinho. Qualquer falha de Pages
// ou de init deixa o artifact de pé e o Lucas posta manual — nada é destrutivo.
//
// Falhas: logam stack + exit code != 0 (GitHub Actions marca o run como failed).

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarCarrossel } from './gerar-carrossel.mjs';
import { pngToJpeg } from './converter-jpeg.mjs';
import { refreshAccessToken, postarTikTokInbox, getPostStatus, montarTextos } from './postar.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');
const TEMAS_PATH = resolve(DATA_DIR, 'temas.json');
const ESTADO_PATH = resolve(DATA_DIR, 'estado.json');
const OUTPUTS_DIR = resolve(__dirname, '../outputs');
const MANIFEST_PATH = resolve(OUTPUTS_DIR, 'last-post.json');
// docs/ (raiz do repo) é o que o GitHub Pages serve.
const DOCS_DIR = resolve(__dirname, '../../../docs');
const PAGES_BASE = (
  process.env.PAGES_BASE_URL || 'https://lucasdpradella.github.io/tiktok-carousel-engine'
).replace(/\/$/, '');

const DRY_RUN = process.env.DRY_RUN === 'true';
const POST_PHASE = process.argv.includes('--post');

// Pages não publica na hora — faz HEAD até 200, com timeout.
const PAGES_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const PAGES_POLL_INTERVAL_MS = 10 * 1000;

async function lerJSON(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

function hoje() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── FASE 1 — gerar + converter + stagear ────────────────────────────────────
async function gerar() {
  console.log(`[run] FASE 1 (generate) — dryRun=${DRY_RUN}`);

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
  const puxada = topic.puxada === true;
  // Deixa do PRADEX na caption ~1 a cada 3 capítulos. Nunca junto da puxada (o slide3
  // já carrega o pitch) — evita pitch dobrado.
  const incluirCta = !puxada && chapterNumber % 3 === 0;
  console.log(
    `[run] tema #${idx}: "${topic.tema}" (ângulo=${topic.angulo}) — CAP. ${chapterNumber}/${chapterTotal}` +
      (puxada ? ' [PUXADA → 3 slides]' : ' [2 slides]') +
      (incluirCta ? ' [+deixa PRADEX na caption]' : '')
  );

  // gerarCarrossel → PNGs (artifact). Puxada gera 3 slides (o 3º = solução PRADEX).
  const r = await gerarCarrossel({
    topico: topic.tema,
    angulo: topic.angulo,
    chapterNumber,
    chapterTotal,
    puxada,
    incluirCta,
  });
  console.log(`[run] carrossel pronto em ${r.outputDir} (${r.slidePaths.length} slides)`);

  // Converte cada PNG → JPEG (no próprio dir do artifact)
  const jpgPaths = [];
  for (const png of r.slidePaths) {
    const jpg = png.replace(/\.png$/i, '.jpg');
    const out = await pngToJpeg(png, jpg);
    console.log(`[run] JPEG: ${jpg} (${Math.round(out.sizeBytes / 1024)} KB)`);
    jpgPaths.push(jpg);
  }

  if (DRY_RUN) {
    console.log('[run] DRY_RUN=true → artifact (PNG+JPEG) gerado. NÃO staged em docs/, NÃO posta, NÃO avança.');
    console.log('[run] Pra avançar a fila depois de postar manualmente: npm run avancar');
    console.log('[run] FASE 1 (dry-run) COMPLETA ✓');
    return;
  }

  // Stage dos JPEGs em docs/post-YYYY-MM-DD/ (o workflow comita/pusha → Pages)
  const postDir = `post-${hoje()}`;
  const destDir = resolve(DOCS_DIR, postDir);
  await mkdir(destDir, { recursive: true });
  const photoUrls = [];
  for (let i = 0; i < jpgPaths.length; i++) {
    const name = `slide-${String(i + 1).padStart(2, '0')}.jpg`;
    await copyFile(jpgPaths[i], resolve(destDir, name));
    photoUrls.push(`${PAGES_BASE}/${postDir}/${name}`);
  }
  console.log(`[run] ${photoUrls.length} JPEGs staged em docs/${postDir}/`);

  const { title, description } = montarTextos({ caption: r.caption, hashtags: r.hashtags });

  await mkdir(OUTPUTS_DIR, { recursive: true });
  await writeFile(
    MANIFEST_PATH,
    JSON.stringify({ postDir, photoUrls, title, description, indice: idx, chapterNumber }, null, 2) + '\n'
  );
  console.log(`[run] manifesto gravado em ${MANIFEST_PATH}`);
  console.log('[run] FASE 1 COMPLETA ✓ — workflow comita docs/ e roda a Fase 2 (--post)');
}

// ── FASE 2 — esperar Pages + refresh + postar + avançar ─────────────────────
async function postar() {
  console.log('[run] FASE 2 (post)');

  const manifest = await lerJSON(MANIFEST_PATH);
  const { photoUrls, title, description, indice } = manifest;

  // 5. Espera o Pages publicar cada JPEG (HEAD até 200)
  for (const url of photoUrls) {
    await esperarPages(url);
  }

  // 6. Refresh do access_token
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN;
  const tok = await refreshAccessToken({ clientKey, clientSecret, refreshToken });
  console.log(`[run] access_token ok (scope=${tok.scope}, expira em ${tok.expiresIn}s)`);
  if (tok.rotated) {
    // Caminho B (MVP): avisa alto. Migrar pro caminho A (persist-back via GitHub API) depois.
    console.warn(
      '[run] ⚠️ refresh_token ROTACIONOU — atualize o GitHub Secret TIKTOK_REFRESH_TOKEN ' +
        'com o novo valor (o antigo pode parar de funcionar). Ver briefing §1c.'
    );
  }

  // 7. Posta no inbox (MEDIA_UPLOAD)
  const { publishId } = await postarTikTokInbox({
    photoUrls,
    title,
    description,
    accessToken: tok.accessToken,
  });
  console.log(`[run] content/init OK — publish_id=${publishId} (rascunho no inbox do @pradella.lucas)`);

  // status best-effort (não bloqueia)
  try {
    const status = await getPostStatus({ publishId, accessToken: tok.accessToken });
    console.log('[run] status:', JSON.stringify(status));
  } catch (e) {
    console.warn('[run] status fetch falhou (ignorado):', e.message);
  }

  // 8. Avança a fila (workflow comita data/estado.json)
  const estado = await lerJSON(ESTADO_PATH);
  estado.indice_atual = (typeof indice === 'number' ? indice : estado.indice_atual) + 1;
  await writeFile(ESTADO_PATH, JSON.stringify(estado, null, 2) + '\n');
  console.log(`[run] estado.json avançado → indice_atual=${estado.indice_atual}`);
  console.log('[run] FASE 2 COMPLETA ✓ — Lucas finaliza o post no app TikTok');
}

async function esperarPages(url) {
  const deadline = Date.now() + PAGES_POLL_TIMEOUT_MS;
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
      if (res.status === 200) {
        console.log(`[run] Pages OK (${attempt}x): ${url}`);
        return;
      }
      console.log(`[run] Pages ainda não publicou (HTTP ${res.status}, tentativa ${attempt}): ${url}`);
    } catch (e) {
      console.log(`[run] Pages HEAD falhou (tentativa ${attempt}): ${e.message}`);
    }
    if (Date.now() > deadline) {
      throw new Error(`[run] timeout esperando o Pages publicar ${url} (>${PAGES_POLL_TIMEOUT_MS / 1000}s)`);
    }
    await new Promise((r) => setTimeout(r, PAGES_POLL_INTERVAL_MS));
  }
}

const run = POST_PHASE ? postar : gerar;
run().catch((e) => {
  console.error('[run] FALHA:', e.message);
  console.error(e.stack);
  process.exit(1);
});
