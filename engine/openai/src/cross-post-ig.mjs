// cross-post-ig.mjs — cross-post FULL-AUTO no Instagram do MESMO asset que foi pro TikTok.
//
// ISOLAMENTO (regra de ouro): roda DEPOIS do commit do asset no Pages, atrás do kill-switch
// IG_CROSSPOST=on. Qualquer erro = log + EXIT 0 — NUNCA derruba o job nem o caminho TikTok.
//
//   node cross-post-ig.mjs --video      → Reel       (lê video-post.json + caption.txt)
//   node cross-post-ig.mjs --carrossel  → Carrossel  (lê carrossel-post.json + carrossel-caption.txt)
//
// API: Instagram com Instagram Login, host graph.instagram.com v23.0. O IG aceita `caption`
// na criação do container (diferente do TikTok). Reel = 3 chamadas (create→status→publish);
// carrossel = N itens + container CAROUSEL + publish (máx 10 slides, todos JPEG mesmo aspect).
//
// Docs Meta (consultadas no briefing 2026-06-30):
//   - Content publishing (REELS / CAROUSEL / status_code): developers.facebook.com/docs/instagram-platform/content-publishing

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getIgToken, getIgUserId } from './ig-token.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../../..'); // engine/openai/src → repo
const VIDEO_OUT = resolve(REPO, 'engine/video/out');

const GRAPH = 'https://graph.instagram.com';
const V = 'v23.0';
const POLL_MAX = 5; // ~5 min
const POLL_MS = 60 * 1000;

async function igPost(path, params, token) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH}/${V}/${path}`, { method: 'POST', body });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`[ig] POST ${path} falhou (HTTP ${res.status}): ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

async function igGet(path, token) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}/${V}/${path}${sep}access_token=${encodeURIComponent(token)}`);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`[ig] GET ${path} falhou (HTTP ${res.status}): ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

// Espera o container ficar FINISHED (vídeo precisa de transcode; foto costuma ser rápido).
async function esperarFinished(creationId, token, { obrigatorio = true } = {}) {
  for (let i = 1; i <= POLL_MAX; i++) {
    const { status_code } = await igGet(`${creationId}?fields=status_code`, token);
    console.log(`[ig] container ${creationId} status=${status_code} (${i}/${POLL_MAX})`);
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`[ig] container ${status_code}`);
    if (i < POLL_MAX) await new Promise((r) => setTimeout(r, POLL_MS));
  }
  if (obrigatorio) throw new Error('[ig] timeout esperando FINISHED');
}

async function crossPostReel({ igUserId, videoUrl, caption, token }) {
  const { id } = await igPost(`${igUserId}/media`, { media_type: 'REELS', video_url: videoUrl, caption }, token);
  console.log(`[ig] Reel container criado=${id}`);
  await esperarFinished(id, token);
  const pub = await igPost(`${igUserId}/media_publish`, { creation_id: id }, token);
  console.log(`[ig] Reel PUBLICADO media_id=${pub.id} ✓`);
  return pub.id;
}

async function crossPostCarrossel({ igUserId, photoUrls, caption, token }) {
  const slides = photoUrls.slice(0, 10); // máx 10 no carrossel IG
  if (photoUrls.length > 10) console.warn(`[ig] ⚠️ ${photoUrls.length} slides; IG aceita 10 — cortando.`);
  const ids = [];
  for (const url of slides) {
    const { id } = await igPost(`${igUserId}/media`, { image_url: url, is_carousel_item: 'true' }, token);
    ids.push(id);
    console.log(`[ig] slide container=${id}`);
  }
  const { id: containerId } = await igPost(
    `${igUserId}/media`,
    { media_type: 'CAROUSEL', children: ids.join(','), caption },
    token
  );
  console.log(`[ig] carrossel container=${containerId}`);
  // status do container do carrossel é best-effort (nem sempre vira FINISHED antes do publish)
  await esperarFinished(containerId, token, { obrigatorio: false }).catch((e) =>
    console.warn('[ig] status carrossel (ignorado):', e.message)
  );
  const pub = await igPost(`${igUserId}/media_publish`, { creation_id: containerId }, token);
  console.log(`[ig] Carrossel PUBLICADO media_id=${pub.id} ✓`);
  return pub.id;
}

async function main() {
  // KILL-SWITCH: só dispara com IG_CROSSPOST=on. Default off.
  if ((process.env.IG_CROSSPOST || 'off').toLowerCase() !== 'on') {
    console.log('[ig] IG_CROSSPOST != on → cross-post DESLIGADO. Pulando (TikTok intacto).');
    return;
  }

  const isVideo = process.argv.includes('--video');
  const isCarrossel = process.argv.includes('--carrossel');
  if (isVideo === isCarrossel) throw new Error('[ig] passe exatamente um: --video OU --carrossel');

  const token = getIgToken();
  const igUserId = getIgUserId();
  const manifestPath = resolve(VIDEO_OUT, isVideo ? 'video-post.json' : 'carrossel-post.json');
  const captionPath = resolve(VIDEO_OUT, isVideo ? 'caption.txt' : 'carrossel-caption.txt');
  if (!existsSync(manifestPath)) throw new Error(`[ig] manifesto ausente: ${manifestPath} (rode o generate real antes)`);
  const m = JSON.parse(await readFile(manifestPath, 'utf-8'));
  const caption = existsSync(captionPath) ? (await readFile(captionPath, 'utf-8')).trim() : '';

  if (isVideo) {
    if (!m.videoUrl) throw new Error('[ig] video-post.json sem videoUrl');
    await crossPostReel({ igUserId, videoUrl: m.videoUrl, caption, token });
  } else {
    if (!Array.isArray(m.photoUrls) || !m.photoUrls.length) throw new Error('[ig] carrossel-post.json sem photoUrls');
    await crossPostCarrossel({ igUserId, photoUrls: m.photoUrls, caption, token });
  }
}

// ISOLAMENTO TOTAL: erro no IG NUNCA derruba o job nem o TikTok — loga e sai 0.
main().catch((e) => {
  console.error('[ig] cross-post FALHOU (isolado, NÃO afeta TikTok):', e.message);
  process.exit(0);
});
