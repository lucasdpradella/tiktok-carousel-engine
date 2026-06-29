// run-carrossel.mjs — orquestrador do CARROSSEL multi-slide (Parte 2). Espelha run-video,
// mas o carrossel é de FOTO (silencioso): renderiza a composição Remotion `Carrossel` em
// N stills JPEG (1 por slide, direto pelo Remotion — sem Python) e posta como PHOTO no inbox.
//
//   gerar (default): tema → roteiro → fundo por-run → render N JPEG → (se !dry) stage docs + manifesto
//   --post:          espera Pages → refresh → content/init (PHOTO, N photo_images) → avança estado
//
// DRY_RUN=true: para nos JPEGs (não stage docs, não posta, não avança). NÃO toca no carrossel
// PIL de 2 slides (rede de segurança §0) — é engine nova e isolada.

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarRoteiroCarrossel } from '../openai/src/gerar-roteiro-carrossel.mjs';
import { gerarFundo } from '../openai/src/gerar-fundo.mjs';
import { refreshAccessToken, postarTikTokInbox, getPostStatus, montarTextos } from '../openai/src/postar.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../..');
const REMOTION = resolve(REPO, 'engine/remotion');
const REMO_CARROSSEL = resolve(REMOTION, 'src/carrossel.json');
const JPG_OUT = resolve(REMOTION, 'out/carrossel'); // slides JPEG do run
const VIDEO_OUT = resolve(__dirname, 'out');
const MANIFEST = resolve(VIDEO_OUT, 'carrossel-post.json');
const CAPTION = resolve(VIDEO_OUT, 'carrossel-caption.txt');
const ESTADO = resolve(__dirname, 'estado-carrossel.json');
const TEMAS = resolve(__dirname, 'temas-video.json');
const DOCS = resolve(REPO, 'docs');

const PAGES_BASE = (process.env.PAGES_BASE_URL || 'https://lucasdpradella.github.io/tiktok-carousel-engine').replace(/\/$/, '');
const DRY_RUN = process.env.DRY_RUN === 'true';
const POST_PHASE = process.argv.includes('--post');
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 10 * 1000;

const lerJSON = async (p) => JSON.parse(await readFile(p, 'utf-8'));
const hoje = () => new Date().toISOString().slice(0, 10);
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx'; // Windows: npx é .cmd

// CTA da caption TRAVADA (igual ao último slide): tira o CTA genérico do modelo e crava o nosso.
const LOCKED_CTA = 'Comenta PRADEX que eu te mando o link no direto. E me segue pra não morrer sem dinheiro.';
function captionComCtaTravado(captionBruta) {
  const frases = String(captionBruta || '')
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => !/coment|me segue|\blink\b|receb|material|pradex/i.test(f)); // remove CTA genérico
  return [frases.join(' '), LOCKED_CTA].filter(Boolean).join('\n\n');
}

function run(cmd, args, opts = {}) {
  return new Promise((res, rej) => {
    // shell:true → Windows resolve npx.cmd; Linux/CI resolve npx normalmente
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
    p.on('error', rej);
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} ${args.join(' ')} → exit ${code}`))));
  });
}

// tema: env TOPICO / argv (após flags) / fila temas-video.json[estado-carrossel.indice_atual]
async function resolverTopico() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (process.env.TOPICO) return process.env.TOPICO;
  if (arg) return arg;
  const temas = await lerJSON(TEMAS);
  const idx = existsSync(ESTADO) ? (await lerJSON(ESTADO)).indice_atual : 0;
  return temas[idx]?.tema;
}

// ── GERAR ────────────────────────────────────────────────────────────────────
async function gerar() {
  const topico = await resolverTopico();
  if (!topico) throw new Error('[carrossel] sem tópico (passe TOPICO=... ou argumento)');
  console.log(`[carrossel] tema: "${topico}" (dryRun=${DRY_RUN})`);

  // 1. roteiro multi-slide (validador de caractere + compliance + CTA travada já embutidos)
  const script = await gerarRoteiroCarrossel({ topico });
  console.log(`[carrossel] roteiro: ${script.slides.length} slides`);

  // 2. fundo fotográfico por-run (liga 'foto' só neste run; fallback sólido se falhar)
  try {
    const bgRel = `bg/carrossel-${hoje()}.png`;
    await gerarFundo({ outPath: resolve(REMOTION, 'public', bgRel) });
    script.bg = bgRel;
    script.bgMode = 'foto';
    console.log(`[carrossel] fundo ligado: ${bgRel}`);
  } catch (e) {
    console.warn('[carrossel] fundo falhou — segue no marinho sólido:', e.message);
  }

  // 3. escreve o carrossel.json que a composição Remotion lê
  await writeFile(REMO_CARROSSEL, JSON.stringify(script, null, 2) + '\n');

  // 4. render N stills JPEG (1 por slide) direto pelo Remotion (sem Python)
  await mkdir(JPG_OUT, { recursive: true });
  const jpgs = [];
  for (let i = 0; i < script.slides.length; i++) {
    const name = `slide-${String(i + 1).padStart(2, '0')}.jpg`;
    const out = resolve(JPG_OUT, name);
    await run(NPX, ['remotion', 'still', 'src/index.ts', 'Carrossel', out, `--frame=${i}`, '--image-format=jpeg'], { cwd: REMOTION });
    jpgs.push({ name, out });
    console.log(`[carrossel] slide ${i + 1}/${script.slides.length} → ${name}`);
  }

  // caption sugerida sempre (carrossel: a API de foto aceita title/description; mantemos a caption)
  const { title, description } = montarTextos({ caption: captionComCtaTravado(script.caption), hashtags: script.hashtags });
  await mkdir(VIDEO_OUT, { recursive: true });
  await writeFile(CAPTION, `${title}\n\n${description}\n`);

  if (DRY_RUN) {
    console.log(`[carrossel] DRY_RUN=true → ${jpgs.length} JPEGs em ${JPG_OUT}. NÃO posta, NÃO stage docs.`);
    return;
  }

  // 5. stage dos JPEGs em docs/post-carrossel-DATE/ (workflow comita → Pages); manifesto p/ --post.
  // Prefixo próprio (não 'post-DATE') p/ NÃO colidir com o PIL de 2 slides durante a transição (§0).
  const postDir = `post-carrossel-${hoje()}`;
  const destDir = resolve(DOCS, postDir);
  await mkdir(destDir, { recursive: true });
  const photoUrls = [];
  for (const j of jpgs) {
    await copyFile(j.out, resolve(destDir, j.name));
    photoUrls.push(`${PAGES_BASE}/${postDir}/${j.name}`);
  }
  await writeFile(MANIFEST, JSON.stringify({ postDir, photoUrls, title, description }, null, 2) + '\n');
  console.log(`[carrossel] ${photoUrls.length} JPEGs staged em docs/${postDir}/ — workflow comita e roda --post`);
}

// ── POST ─────────────────────────────────────────────────────────────────────
async function esperarPages(url) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let n = 0;
  for (;;) {
    n++;
    try {
      const r = await fetch(url, { method: 'HEAD', redirect: 'manual' });
      if (r.status === 200) return console.log(`[carrossel] Pages OK (${n}x): ${url}`);
      console.log(`[carrossel] Pages ainda não publicou (HTTP ${r.status}, ${n})`);
    } catch (e) {
      console.log(`[carrossel] HEAD falhou (${n}): ${e.message}`);
    }
    if (Date.now() > deadline) throw new Error(`[carrossel] timeout esperando Pages: ${url}`);
    await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS));
  }
}

async function postar() {
  const m = await lerJSON(MANIFEST);
  const { photoUrls, title, description } = m;
  if (!Array.isArray(photoUrls) || !photoUrls.length) throw new Error('[carrossel] manifesto sem photoUrls — rode o gerar (modo real) antes');
  for (const u of photoUrls) await esperarPages(u);

  const tok = await refreshAccessToken({
    clientKey: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    refreshToken: process.env.TIKTOK_REFRESH_TOKEN,
  });
  if (tok.rotated) console.warn('[carrossel] ⚠️ refresh_token ROTACIONOU — atualize o Secret TIKTOK_REFRESH_TOKEN.');

  const { publishId } = await postarTikTokInbox({ photoUrls, title, description, accessToken: tok.accessToken });
  console.log(`[carrossel] content/init OK — publish_id=${publishId} (rascunho no inbox)`);
  try {
    console.log('[carrossel] status:', JSON.stringify(await getPostStatus({ publishId, accessToken: tok.accessToken })));
  } catch (e) {
    console.warn('[carrossel] status fetch falhou (ignorado):', e.message);
  }

  // avança estado-carrossel.json (só em post real)
  const estado = existsSync(ESTADO) ? await lerJSON(ESTADO) : { indice_atual: 0 };
  estado.indice_atual = (estado.indice_atual || 0) + 1;
  await writeFile(ESTADO, JSON.stringify(estado, null, 2) + '\n');
  console.log(`[carrossel] estado-carrossel.json avançado → indice_atual=${estado.indice_atual}`);
}

const main = POST_PHASE ? postar : gerar;
main().catch((e) => {
  console.error('[carrossel] FALHA:', e.message);
  console.error(e.stack);
  process.exit(1);
});
