// postar-video.mjs — joga o MP4 faceless no INBOX do TikTok (scope video.upload).
// Semi-auto: cai como rascunho; o Lucas abre no app, cola a caption, põe trending sound e posta.
// Reusa refreshAccessToken/postarVideoInbox do fluxo de fotos (engine/openai/src/postar.mjs).
// NÃO toca no carrossel de fotos. NÃO usa video.publish/DIRECT_POST (seria full-auto, exige audit).
//
// Duas fases (a API puxa o MP4 por URL → precisa estar público no Pages ANTES do init):
//   node postar-video.mjs stage   → copia out/dinheiro-vaza.mp4 p/ docs/post-video-DATA/ + gera out/caption.txt
//   (Lucas: git add docs/post-video-DATA/ && commit && push   → Pages publica)
//   node postar-video.mjs post    → espera o Pages (HEAD 200) → refresh → inbox/video/init → publish_id
//
// Segredos: lê de scripts/.tiktok-prod.local.json (+ .tiktok-tokens.local.json) ou das env
// TIKTOK_CLIENT_KEY/SECRET/REFRESH_TOKEN. NUNCA imprime valores de token.

import { existsSync, readFileSync } from 'node:fs';
import { readFile as read, writeFile as write, mkdir as mkdirp, copyFile as cp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshAccessToken, postarVideoInbox, getPostStatus } from '../openai/src/postar.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../..');
const MP4 = resolve(__dirname, 'out/dinheiro-vaza.mp4');
const MANIFEST = resolve(__dirname, 'out/video-post.json');
const CAPTION = resolve(__dirname, 'out/caption.txt');
const DOCS = resolve(REPO, 'docs');
const PAGES_BASE = (
  process.env.PAGES_BASE_URL || 'https://lucasdpradella.github.io/tiktok-carousel-engine'
).replace(/\/$/, '');

const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 10 * 1000;

// Caption sugerida (o inbox NÃO seta caption via API — o Lucas cola isto no app ao finalizar).
const CAPTION_TEXT = `O dinheiro raramente some de uma vez. Ele vaza nos pequenos: o delivery de terça, a assinatura esquecida, o cafezinho de todo dia. Sozinhos, R$ 15. Juntos, R$ 600 no fim do mês. O problema não é gastar — é não enxergar. Quem anota, controla; quem controla, sobra. Começa hoje: anota UM gasto. Só um.

Comenta PRADEX que eu te mando o link do app no direto — é grátis.
E me segue pra não morrer sem dinheiro.

#financaspessoais #organizacaofinanceira #educacaofinanceira #planejamentofinanceiro #dinheiro #pradex
`;

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function loadCreds() {
  // arquivos locais (gitignored) do one-off OAuth → fallback env. Nunca logar valores.
  const readJson = (p) => {
    try {
      return JSON.parse(readFileSync(p, 'utf-8'));
    } catch {
      return {};
    }
  };
  const prod = readJson(resolve(REPO, 'scripts/.tiktok-prod.local.json'));
  const toks = readJson(resolve(REPO, 'scripts/.tiktok-tokens.local.json'));
  return {
    clientKey: prod.client_key || process.env.TIKTOK_CLIENT_KEY,
    clientSecret: prod.client_secret || process.env.TIKTOK_CLIENT_SECRET,
    refreshToken: toks.refresh_token || process.env.TIKTOK_REFRESH_TOKEN,
  };
}

async function stage() {
  if (!existsSync(MP4)) throw new Error(`[video] MP4 não encontrado: ${MP4} (renderize antes)`);
  const postDir = `post-video-${hoje()}`;
  const destDir = resolve(DOCS, postDir);
  await mkdirp(destDir, { recursive: true });
  await cp(MP4, resolve(destDir, 'dinheiro-vaza.mp4'));
  const videoUrl = `${PAGES_BASE}/${postDir}/dinheiro-vaza.mp4`;
  await mkdirp(resolve(__dirname, 'out'), { recursive: true });
  await write(MANIFEST, JSON.stringify({ postDir, videoUrl }, null, 2) + '\n');
  await write(CAPTION, CAPTION_TEXT);
  console.log(`[video] MP4 staged em docs/${postDir}/dinheiro-vaza.mp4`);
  console.log(`[video] URL do Pages: ${videoUrl}`);
  console.log(`[video] caption sugerida: ${CAPTION}`);
  console.log('[video] AGORA (Lucas): git add docs/' + postDir + '/ && commit && push');
  console.log('[video] depois do push: node postar-video.mjs post');
}

async function pollPages(url) {
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

async function post() {
  const manifest = JSON.parse(await read(MANIFEST, 'utf-8'));
  const { videoUrl } = manifest;
  if (!videoUrl) throw new Error('[video] manifest sem videoUrl — rode `stage` primeiro');

  await pollPages(videoUrl);

  const { clientKey, clientSecret, refreshToken } = loadCreds();
  if (!clientKey || !clientSecret || !refreshToken) {
    throw new Error(
      '[video] credenciais ausentes — preencha scripts/.tiktok-prod.local.json + .tiktok-tokens.local.json ou as env TIKTOK_*'
    );
  }
  const tok = await refreshAccessToken({ clientKey, clientSecret, refreshToken });
  console.log(`[video] access_token ok (scope=${tok.scope})`);
  if (tok.rotated) {
    console.warn('[video] ⚠️ refresh_token ROTACIONOU — atualize scripts/.tiktok-tokens.local.json e o GitHub Secret.');
  }

  const { publishId } = await postarVideoInbox({ videoUrl, accessToken: tok.accessToken });
  console.log(`[video] inbox/video/init OK — publish_id=${publishId}`);
  console.log('[video] Confira o INBOX/notificações do @pradella.lucas no app.');

  try {
    const st = await getPostStatus({ publishId, accessToken: tok.accessToken });
    console.log('[video] status:', JSON.stringify(st));
  } catch (e) {
    console.warn('[video] status fetch falhou (ignorado):', e.message);
  }
  console.log(`[video] Caption sugerida pra colar no app: ${CAPTION}`);
}

const mode = process.argv[2];
const run = mode === 'stage' ? stage : mode === 'post' ? post : null;
if (!run) {
  console.error('Uso: node postar-video.mjs <stage|post>');
  process.exit(1);
}
run().catch((e) => {
  console.error('[video] FALHA:', e.message);
  process.exit(1);
});
