// tiktok-status.mjs — consulta o status/fail_reason de publishes no TikTok.
// Criado 2026-08-07: dois posts de carrossel morreram silenciosamente em
// PROCESSING_DOWNLOAD (runs 31182073015 e 31198387176) e a engine so olha o
// status uma vez, 3s depois do init. Este script pergunta de novo, quando quisermos.
// Uso (CI): PUBLISH_IDS="id1,id2" node scripts/tiktok-status.mjs
import { refreshAccessToken, getPostStatus } from '../engine/openai/src/postar.mjs';

const ids = (process.env.PUBLISH_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!ids.length) {
  console.error('PUBLISH_IDS vazio — passe um ou mais publish_id separados por virgula.');
  process.exit(1);
}

const tok = await refreshAccessToken({
  clientKey: process.env.TIKTOK_CLIENT_KEY,
  clientSecret: process.env.TIKTOK_CLIENT_SECRET,
  refreshToken: process.env.TIKTOK_REFRESH_TOKEN,
});
if (tok.rotated) console.warn('⚠️ refresh_token ROTACIONOU — atualize o Secret TIKTOK_REFRESH_TOKEN.');

for (const id of ids) {
  const st = await getPostStatus({ publishId: id, accessToken: tok.accessToken });
  console.log(`\n=== ${id} ===`);
  console.log(JSON.stringify(st, null, 2));
}
