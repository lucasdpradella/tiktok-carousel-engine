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
import { sanitizeNarracao } from './sanitize-narracao.mjs';
import { gerarFundo } from '../openai/src/gerar-fundo.mjs';
import { escolherPromptFundo } from '../openai/src/prompts-fundo.mjs';
import { garantirHashtags } from '../openai/src/hashtags.mjs';
import { refreshAccessToken, postarVideoInbox, getPostStatus } from '../openai/src/postar.mjs';

// colapsa 3+ letras idênticas seguidas -> 2 (typo de TELA, ex "descorrrelacionado"). Não toca dígitos.
const colapsa = (s) => (typeof s === 'string' ? s.replace(/([A-Za-zÀ-ÿ])\1{2,}/g, '$1$1') : s);
function normalizarTela(c) {
  for (const k of ['titulo', 'prefixo', 'destaque', 'sufixo', 'extra', 'antes', 'numero', 'depois', 'rotulo', 'follow']) {
    if (typeof c[k] === 'string') c[k] = colapsa(c[k]);
  }
  if (Array.isArray(c.linhas)) c.linhas = c.linhas.map(colapsa);
  if (Array.isArray(c.resto)) c.resto = c.resto.map(colapsa);
  if (Array.isArray(c.itens)) for (const it of c.itens) if (Array.isArray(it.linhas)) it.linhas = it.linhas.map(colapsa);
}

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
// MODO_SEMANAL — hook da cadência semanal (decidido 2026-06-30): por ora 'so-video' (a quarta
// produz só vídeo; o carrossel é manual). 'alterna' (FUTURO) revezaria vídeo↔carrossel por um
// CONTADOR PERSISTENTE de runs postados (ex.: campo `runs_postados` em estado-video.json) —
// não por paridade de dia, que quebra com 1 run/semana. A decisão alterna mora num dispatcher
// acima dos 2 workflows; aqui é só o hook. 'so-video' ignora o contador e sempre gera vídeo.
const MODO_SEMANAL = process.env.MODO_SEMANAL || 'so-video';
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
  // IDEMPOTÊNCIA POR DIA (2026-07-08, anti post-duplo): se um run REAL já publicou hoje
  // (docs/post-video-<hoje> existe), sai limpo — evita cron + dispatch manual colidirem no mesmo dia.
  if (!DRY_RUN && existsSync(resolve(DOCS, `post-video-${hoje()}`))) {
    console.log(`[video] docs/post-video-${hoje()} já existe — post de hoje já saiu. Saindo limpo (anti-duplo).`);
    return;
  }

  const temas = await lerJSON(TEMAS);
  const estado = await lerJSON(ESTADO);
  const idx = process.env.INDICE ? parseInt(process.env.INDICE, 10) : estado.indice_atual;
  const t = temas[idx];
  if (!t) {
    console.log(`[video] fila acabou (idx ${idx} >= ${temas.length} temas). Saindo limpo.`);
    return;
  }
  console.log(`[video] tema #${idx}: "${t.tema}" (dryRun=${DRY_RUN}, modoSemanal=${MODO_SEMANAL})`);

  // 1. roteiro → script.json (onde o Remotion lê) + cópia pro artifact
  const script = await gerarScriptVideo({ tema: t.tema, resumo: t.resumo });
  // sanitiza a NARRAÇÃO por código antes do TTS (XTTS não pode ler símbolo/número solto)
  // e normaliza typo de TELA (3+ letras repetidas). A tela usa outros campos, não a narração.
  for (const c of script.cenas) {
    c.narracao = sanitizeNarracao(c.narracao);
    normalizarTela(c);
  }

  // Fundo automático POR POST (Nano Banana, 2026-07-19): prompt casado com a categoria do tema,
  // rodízio de variações (dry-run não gasta o rodízio). Se falhar (quota/timeout/sem key),
  // segue no marinho sólido — o post NUNCA deixa de sair pelo fundo.
  try {
    const { prompt, id } = escolherPromptFundo({ categoria: t.categoria, persistir: !DRY_RUN });
    const bgRel = `bg/video-${hoje()}.png`;
    await gerarFundo({ outPath: resolve(REMOTION, 'public', bgRel), prompt, aspectRatio: '9:16' });
    script.bg = bgRel;
    script.bgMode = 'foto';
    console.log(`[video] fundo nano banana ligado: ${bgRel} (prompt ${id}, categoria ${t.categoria || 'generico'})`);
  } catch (e) {
    console.warn('[video] fundo falhou — segue no marinho sólido:', e.message);
  }

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

  // 3b. ACELERA o pace no ffmpeg (asset único 9:16/H.264 p/ TikTok E IG).
  //   Voz agora NATURAL (XTTS speed=1.0 + tuning v2) — o pace fica em 1.3 (não precisa mais do 1.95).
  //   setpts=PTS/1.3 (vídeo) + atempo=1.3 (áudio: preserva o PITCH → voz natural, só mais rápida;
  //   NUNCA asetrate). atempo=1.3 = filtro único.
  //   ⚠️ O asset JÁ sai no pace final: o Lucas NÃO acelera mais no app.
  const PACE = 1.3;
  const MP4_FAST = resolve(REMOTION, 'out/dinheiro-vaza-fast.mp4');
  await run('ffmpeg', [
    '-y', '-i', MP4,
    '-filter_complex', `[0:v]setpts=PTS/${PACE}[v];[0:a]atempo=${PACE}[a]`,
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-c:a', 'aac',
    MP4_FAST,
  ], { cwd: REMOTION });
  await rename(MP4_FAST, MP4); // substitui o MP4 pelo acelerado (stage/caption usam este)
  console.log(`[video] MP4 no pace final ${PACE}x (voz natural via atempo) — Lucas posta o arquivo direto, sem acelerar no app`);

  // caption sugerida (sempre — o Lucas cola no app ao finalizar)
  // hashtags obrigatórias do Squad XP travadas por código (dedupe embutido) — TikTok e IG herdam
  await writeFile(CAPTION, garantirHashtags(montarCaption(script)));

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
  // caption junto no Pages: o Lucas abre .../post-video-DATA/caption.txt no celular e cola no app
  await copyFile(CAPTION, resolve(destDir, 'caption.txt'));
  const videoUrl = `${PAGES_BASE}/${postDir}/dinheiro-vaza.mp4`;
  console.log(`[video] caption no Pages: ${PAGES_BASE}/${postDir}/caption.txt`);
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
  if (!existsSync(MANIFEST)) {
    console.log('[video] sem manifesto (generate pulou — anti-duplo ou dry-run). Nada a postar, saindo limpo.');
    return;
  }
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
