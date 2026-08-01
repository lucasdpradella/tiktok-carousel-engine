// run-carrossel-expert.mjs — publica carrossel PRÉ-PRONTO (assets finais em
// docs/post-carrossel-expert-{a,b,c}/, já commitados no Pages). NÃO gera nada
// (sem roteirista/Gemini/Remotion), NÃO toca estado-carrossel.json (fila do
// gerador intacta), NÃO mexe no post-video.yml.
//
//   CARROSSEL=a|b|c  DRY_RUN=true|false  node engine/video/run-carrossel-expert.mjs
//
//   dry_run: valida Pages (todas as URLs 200) + imprime caption/title. Não posta.
//   real:    TikTok inbox (PHOTO, rascunho — Lucas confirma no app) e, se
//            IG_CROSSPOST=on, publica o CAROUSEL no Instagram (full-auto,
//            isolado: falha no IG nunca derruba o caminho TikTok).
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refreshAccessToken, postarTikTokInbox, getPostStatus, montarTextos } from '../openai/src/postar.mjs';
import { getIgToken, getIgUserId } from '../openai/src/ig-token.mjs';
import { registrarPost } from './anti-repeticao.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../..');
const PAGES_BASE = (process.env.PAGES_BASE_URL || 'https://lucasdpradella.github.io/tiktok-carousel-engine').replace(/\/$/, '');
const DRY_RUN = (process.env.DRY_RUN ?? 'true') !== 'false';
const QUAL = (process.env.CARROSSEL || '').toLowerCase();

const NOMES = { a: 'Gestores/CDI', b: 'FII cota/volatilidade', c: 'FII papel vs tijolo' };
// tema/categoria de cada um, pro append em data/historico.json (a trava anti-repetição precisa
// enxergar os posts da Expert como enxerga os do gerador — senão nasce cega pra eles).
const TEMAS = {
  a: { tema: 'Gestores da Expert XP: por que o CDI é o pior lugar pro longo prazo', categoria: 'investimento' },
  b: { tema: 'FII: a cota cai, o imóvel continua lá — volatilidade não é perda de fundamento', categoria: 'fii' },
  c: { tema: 'FII de papel ou FII de tijolo: você comprou qual?', categoria: 'fii' },
};
if (!['a', 'b', 'c'].includes(QUAL)) { console.error(`[expert] CARROSSEL inválido: "${QUAL}" (use a|b|c)`); process.exit(1); }

const postDir = `post-carrossel-expert-${QUAL}`;
const dir = resolve(REPO, 'docs', postDir);
if (!existsSync(dir)) { console.error(`[expert] docs/${postDir} não existe`); process.exit(1); }

const slides = readdirSync(dir).filter((f) => /^slide-\d{2}\.jpg$/.test(f)).sort();
if (slides.length !== 8) { console.error(`[expert] esperava 8 slides, achei ${slides.length}`); process.exit(1); }
const caption = (await readFile(resolve(dir, 'caption.txt'), 'utf-8')).trim();
const photoUrls = slides.map((s) => `${PAGES_BASE}/${postDir}/${s}`);
// caption.md já vem FINAL (CTA + hashtags + menções) — hashtags:[] pra não duplicar.
const { title, description } = montarTextos({ caption, hashtags: [] });

console.log(`[expert] Carrossel ${QUAL.toUpperCase()} — ${NOMES[QUAL]} · ${slides.length} slides · DRY_RUN=${DRY_RUN}`);
console.log(`[expert] title (${title.length}): ${title}`);
console.log(`[expert] description (${description.length} chars):\n${description}\n`);

// Pages: todas as URLs precisam estar públicas (200)
let pagesOk = true;
for (const u of photoUrls) {
  const r = await fetch(u, { method: 'HEAD', redirect: 'manual' }).catch(() => ({ status: 'ERR' }));
  if (r.status !== 200) { pagesOk = false; console.error(`[expert] Pages NÃO serve (${r.status}): ${u}`); }
}
console.log(pagesOk ? `[expert] Pages OK — ${photoUrls.length} URLs públicas ✓` : '[expert] Pages INCOMPLETO');
if (!pagesOk) process.exit(1);

if (DRY_RUN) { console.log('[expert] DRY_RUN — validação encerrada, nada postado.'); process.exit(0); }

// ── TikTok inbox (rascunho; Lucas cola a caption e confirma no app) ──────────
const tok = await refreshAccessToken({
  clientKey: process.env.TIKTOK_CLIENT_KEY,
  clientSecret: process.env.TIKTOK_CLIENT_SECRET,
  refreshToken: process.env.TIKTOK_REFRESH_TOKEN,
});
if (tok.rotated) console.warn('[expert] ⚠️ TIKTOK_REFRESH_TOKEN rotacionou — atualizar o Secret.');
const { publishId } = await postarTikTokInbox({ photoUrls, title, description, accessToken: tok.accessToken });
console.log(`[expert] TikTok inbox OK — publish_id=${publishId}`);
console.log(`[expert] caption pro app: ${PAGES_BASE}/${postDir}/caption.txt`);
try { console.log('[expert] status:', JSON.stringify(await getPostStatus({ publishId, accessToken: tok.accessToken }))); }
catch (e) { console.warn('[expert] status fetch falhou (ignorado):', e.message); }

// memória do post: o workflow commita data/historico.json depois deste passo.
await registrarPost({
  data: new Date().toISOString().slice(0, 10),
  tipo: 'carrossel',
  ...TEMAS[QUAL],
  origem: 'expert',
  run_id: process.env.GITHUB_RUN_ID || '',
});

// ── IG cross-post (full-auto, ISOLADO — falha nunca derruba o TikTok) ────────
if ((process.env.IG_CROSSPOST || 'off').toLowerCase() !== 'on') {
  console.log('[expert] IG_CROSSPOST != on → IG pulado.');
  process.exit(0);
}
try {
  const igToken = getIgToken();
  const igUserId = getIgUserId();
  const GRAPH = 'https://graph.instagram.com/v23.0';
  const igPost = async (path, params) => {
    const res = await fetch(`${GRAPH}/${path}`, { method: 'POST', body: new URLSearchParams({ ...params, access_token: igToken }) });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(`[ig] POST ${path}: ${JSON.stringify(json.error || json)}`);
    return json;
  };
  const ids = [];
  for (const url of photoUrls) {
    const { id } = await igPost(`${igUserId}/media`, { image_url: url, is_carousel_item: 'true' });
    ids.push(id); console.log(`[expert][ig] slide container=${id}`);
  }
  const { id: containerId } = await igPost(`${igUserId}/media`, { media_type: 'CAROUSEL', children: ids.join(','), caption });
  console.log(`[expert][ig] carrossel container=${containerId}`);
  // status best-effort (foto costuma ficar pronto rápido)
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(igToken)}`);
      const { status_code } = await r.json();
      console.log(`[expert][ig] status=${status_code}`);
      if (status_code === 'FINISHED') break;
    } catch { /* segue */ }
    await new Promise((r) => setTimeout(r, 20000));
  }
  const pub = await igPost(`${igUserId}/media_publish`, { creation_id: containerId });
  console.log(`[expert][ig] Carrossel PUBLICADO no IG media_id=${pub.id} ✓`);
} catch (e) {
  console.error('[expert][ig] IG FALHOU (isolado, TikTok intacto):', e.message);
}
