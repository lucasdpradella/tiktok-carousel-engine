// run-video.mjs — orquestrador da engine de vídeo (§2f do briefing-engine-video-auto).
//
// GENERATE (default):  tema → roteiro → voz (XTTS) → render Remotion → MP4
//   DRY_RUN=true: para no MP4 (artifact). DRY_RUN=false: também faz stage do MP4 em docs/.
// POST (--post):       espera o Pages → refresh → inbox/video/init → avança estado-video.json
//
// A API puxa o MP4 por URL, então (modo real) ele precisa estar público no Pages ANTES do
// init — por isso o git (commit do MP4) acontece ENTRE generate e --post, no workflow.
// NÃO toca no carrossel de fotos (§0). video.upload/inbox apenas.

import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarScriptVideo } from './roteirista-video.mjs';
import { refreshAccessToken, postarVideoInbox, getPostStatus } from '../openai/src/postar.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../..');
const TEMAS = resolve(__dirname, 'temas-video.json');
const ESTADO = resolve(__dirname, 'estado-video.json');
const REMOTION = resolve(REPO, 'engine/remotion');
const REMO_SCRIPT = resolve(REMOTION, 'src/script.json');
const REMO_NARR = resolve(REMOTION, 'public/narracao/processed');
const REMO_DUR = resolve(REMOTION, 'public/narracao/durations.json');
const MP4 = resolve(REMOTION, 'out/dinheiro-vaza.mp4');
const VIDEO_OUT = resolve(__dirname, 'out');
const MANIFEST = resolve(VIDEO_OUT, 'video-post.json');
const CAPTION = resolve(VIDEO_OUT, 'caption.txt');
const DOCS = resolve(REPO, 'docs');

const LATENTS = process.env.VOICE_LATENTS_PTH || '/tmp/speaker_latents.pth';
const PYTHON = process.env.OPENAI_PYTHON_BIN || 'python';
const PAGES_BASE = (
  process.env.PAGES_BASE_URL || 'https://lucasdpradella.github.io/tiktok-carousel-engine'
).replace(/\/$/, '');
const DRY_RUN = process.env.DRY_RUN === 'true';
const POST_PHASE = process.argv.includes('--post');
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 10 * 1000;

const lerJSON = async (p) => JSON.parse(await readFile(p, 'utf-8'));
const hoje = () => new Date().toISOString().slice(0, 10);

function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', rej);
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} ${args.join(' ')} → exit ${code}`))));
  });
}

function montarCaption(script) {
  const corpo = script.cenas
    .filter((c) => !['explicador', 'cta'].includes(c.tipo))
    .map((c) => c.narracao)
    .join(' ');
  const cta = 'Comenta PRADEX que eu te mando o link do app no direto, é grátis.\nE me segue pra não morrer sem dinheiro.';
  const tags = '#financaspessoais #organizacaofinanceira #educacaofinanceira #planejamentofinanceiro #dinheiro #pradex';
  return `${corpo}\n\n${cta}\n\n${tags}\n`;
}

// ── GENERATE ─────────────────────────────────────────────────────────────────
async function gerar() {
  const temas = await lerJSON(TEMAS);
  const estado = await lerJSON(ESTADO);
  const idx = process.env.INDICE ? parseInt(process.env.INDICE, 10) : estado.indice_atual;
  const t = temas[idx];
  if (!t) {
    console.log(`[video] fila acabou (idx ${idx} >= ${temas.length} temas). Saindo limpo.`);
    return;
  }
  console.log(`[video] tema #${idx}: "${t.tema}" (dryRun=${DRY_RUN})`);

  // 1. roteiro → script.json (onde o Remotion lê) + cópia pro artifact
  const script = await gerarScriptVideo({ tema: t.tema, resumo: t.resumo });
  await mkdir(dirname(REMO_SCRIPT), { recursive: true });
  await writeFile(REMO_SCRIPT, JSON.stringify(script, null, 2) + '\n');
  await mkdir(VIDEO_OUT, { recursive: true });
  await writeFile(resolve(VIDEO_OUT, 'script.json'), JSON.stringify(script, null, 2) + '\n');
  console.log(`[video] roteiro: ${script.cenas.length} cenas`);

  // 2. voz (XTTS) → wavs + durations.json em public/narracao/processed
  if (!existsSync(LATENTS)) throw new Error(`[video] latents não encontrados em ${LATENTS} (decifre antes)`);
  await mkdir(REMO_NARR, { recursive: true });
  await run(PYTHON, [resolve(__dirname, 'tts_ci.py'), REMO_SCRIPT, LATENTS, REMO_NARR]);
  // timing.ts lê durations.json em public/narracao/ (um nível acima de processed/)
  await rename(resolve(REMO_NARR, 'durations.json'), REMO_DUR);
  console.log('[video] narração + durations prontos');

  // 3. render Remotion → MP4 (npm install é feito pelo workflow antes)
  await run('npx', ['remotion', 'render', 'src/index.ts', 'DinheiroVaza', 'out/dinheiro-vaza.mp4'], { cwd: REMOTION });
  console.log(`[video] MP4 renderizado: ${MP4}`);

  // caption sugerida (sempre — o Lucas cola no app ao finalizar)
  await writeFile(CAPTION, montarCaption(script));

  if (DRY_RUN) {
    console.log('[video] DRY_RUN=true → MP4 no artifact. NÃO posta, NÃO avança, NÃO faz stage em docs/.');
    console.log('[video] GENERATE (dry-run) COMPLETO ✓');
    return;
  }

  // 4. stage do MP4 em docs/post-video-DATA (o workflow comita → Pages; depois roda --post)
  const postDir = `post-video-${hoje()}`;
  const destDir = resolve(DOCS, postDir);
  await mkdir(destDir, { recursive: true });
  await copyFile(MP4, resolve(destDir, 'dinheiro-vaza.mp4'));
  const videoUrl = `${PAGES_BASE}/${postDir}/dinheiro-vaza.mp4`;
  await writeFile(MANIFEST, JSON.stringify({ postDir, videoUrl, indice: idx }, null, 2) + '\n');
  console.log(`[video] MP4 staged em docs/${postDir}/ — workflow comita e roda --post`);
}

// ── POST ─────────────────────────────────────────────────────────────────────
async function esperarPages(url) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let n = 0;
  for (;;) {
    n++;
    try {
      const r = await fetch(url, { method: 'HEAD', redirect: 'manual' });
      if (r.status === 200) {
        console.log(`[video] Pages OK (${n}x): ${url}`);
        return;
      }
      console.log(`[video] Pages ainda não publicou (HTTP ${r.status}, tentativa ${n})`);
    } catch (e) {
      console.log(`[video] HEAD falhou (tentativa ${n}): ${e.message}`);
    }
    if (Date.now() > deadline) throw new Error(`[video] timeout esperando o Pages: ${url}`);
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
}

async function postar() {
  const m = await lerJSON(MANIFEST);
  const { videoUrl, indice } = m;
  if (!videoUrl) throw new Error('[video] manifest sem videoUrl — rode o generate (modo real) antes');

  await esperarPages(videoUrl);

  const tok = await refreshAccessToken({
    clientKey: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    refreshToken: process.env.TIKTOK_REFRESH_TOKEN,
  });
  console.log(`[video] access_token ok (scope=${tok.scope})`);
  if (tok.rotated) {
    console.warn('[video] ⚠️ refresh_token ROTACIONOU — atualize o GitHub Secret TIKTOK_REFRESH_TOKEN.');
  }

  const { publishId } = await postarVideoInbox({ videoUrl, accessToken: tok.accessToken });
  console.log(`[video] inbox/video/init OK — publish_id=${publishId}`);
  try {
    console.log('[video] status:', JSON.stringify(await getPostStatus({ publishId, accessToken: tok.accessToken })));
  } catch (e) {
    console.warn('[video] status fetch falhou (ignorado):', e.message);
  }

  // avança a fila (workflow comita estado-video.json)
  const estado = await lerJSON(ESTADO);
  estado.indice_atual = (typeof indice === 'number' ? indice : estado.indice_atual) + 1;
  await writeFile(ESTADO, JSON.stringify(estado, null, 2) + '\n');
  console.log(`[video] estado-video.json avançado → indice_atual=${estado.indice_atual}`);
  console.log('[video] POST COMPLETO ✓ — Lucas finaliza no app (cola caption + trending sound)');
}

const main = POST_PHASE ? postar : gerar;
main().catch((e) => {
  console.error('[video] FALHA:', e.message);
  console.error(e.stack);
  process.exit(1);
});
