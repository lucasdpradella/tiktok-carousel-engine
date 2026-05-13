// postar.mjs
// Posta um carrossel (2 PNGs) no TikTok via upload-post.com API.
//
// Spec: https://docs.upload-post.com/api/upload-photo
// Endpoint: POST https://api.upload-post.com/api/upload_photos
// Auth: header `Authorization: Apikey <UPLOAD_POST_API_KEY>`
// Multipart fields:
//   - photos[] (1..N arquivos)
//   - user (profile name na upload-post; ex: "lucaspradella")
//   - platform[] = "tiktok"
//   - title (max 90 chars) — vira a caption visível do TikTok
//   - description (max 4000) — descrição interna do photo post
//   - tiktok_title / tiktok_description (overrides por plataforma)
//   - post_mode=DIRECT_POST (default — publica imediatamente)
//   - privacy_level=PUBLIC_TO_EVERYONE (default)
//   - photo_cover_index=0 (capa = slide 1)
//   - auto_add_music=false (sem música automática)
// Scheduling opcional:
//   - scheduled_date (ISO-8601) + timezone (IANA)

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const UPLOAD_POST_ENDPOINT = 'https://api.upload-post.com/api/upload_photos';
const DEFAULT_USER_PROFILE = process.env.UPLOAD_POST_USER || 'lucaspradella';
const TIKTOK_TITLE_MAX = 90;
const TIKTOK_DESC_MAX = 4000;

/**
 * Posta carrossel no TikTok via upload-post.com.
 *
 * @param {object} opts
 * @param {string[]} opts.slidePaths — caminhos dos PNGs em ordem (slide 1, slide 2)
 * @param {string} opts.caption — caption completa do roteirista (200-280 chars)
 * @param {string[]} [opts.hashtags] — array sem "#", virá appendado na caption final
 * @param {string} [opts.apiKey] — JWT da upload-post.com; default env UPLOAD_POST_API_KEY
 * @param {string} [opts.userProfile] — profile name na upload-post; default env UPLOAD_POST_USER ou 'lucaspradella'
 * @param {string} [opts.scheduledDate] — ISO-8601 (ex "2026-05-14T07:00:00") pra agendar
 * @param {string} [opts.timezone] — IANA tz (ex 'America/Sao_Paulo'); só relevante se scheduledDate
 * @param {boolean} [opts.dryRun=false] — se true, monta o payload mas não faz a chamada (debug)
 * @returns {Promise<{ success: boolean, request_id?: string, job_id?: string, results?: object, raw: object }>}
 */
export async function postarTikTok({
  slidePaths,
  caption,
  hashtags = [],
  apiKey = process.env.UPLOAD_POST_API_KEY,
  userProfile = DEFAULT_USER_PROFILE,
  scheduledDate,
  timezone,
  dryRun = false,
} = {}) {
  if (!Array.isArray(slidePaths) || slidePaths.length < 1) {
    throw new Error('[postar] slidePaths precisa ser array com pelo menos 1 PNG');
  }
  if (!caption || typeof caption !== 'string') {
    throw new Error('[postar] caption obrigatorio (string)');
  }
  if (!apiKey) {
    throw new Error('[postar] UPLOAD_POST_API_KEY ausente (env var ou opts.apiKey)');
  }

  // monta caption + hashtags
  const hashtagsStr = hashtags
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
    .join(' ');
  const fullCaption = hashtagsStr ? `${caption}\n\n${hashtagsStr}` : caption;

  // title = primeiros 87 chars (máx 90 com "...") sem cortar palavra
  const title = truncateAtWord(caption, TIKTOK_TITLE_MAX - 3, '...');
  const description = fullCaption.slice(0, TIKTOK_DESC_MAX);

  // monta FormData multipart com Blobs (Node 18+ nativo)
  const form = new FormData();
  form.append('user', userProfile);
  form.append('platform[]', 'tiktok');
  form.append('title', title);
  form.append('tiktok_title', title);
  form.append('description', description);
  form.append('tiktok_description', description);
  form.append('post_mode', 'DIRECT_POST');
  form.append('privacy_level', 'PUBLIC_TO_EVERYONE');
  form.append('auto_add_music', 'false');
  form.append('photo_cover_index', '0');

  if (scheduledDate) {
    form.append('scheduled_date', scheduledDate);
    if (timezone) form.append('timezone', timezone);
  }

  // append fotos em ordem
  for (const p of slidePaths) {
    const buf = await readFile(p);
    const blob = new Blob([buf], { type: 'image/png' });
    form.append('photos[]', blob, basename(p));
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      payload: {
        endpoint: UPLOAD_POST_ENDPOINT,
        user: userProfile,
        platform: 'tiktok',
        title,
        title_len: title.length,
        description_len: description.length,
        scheduled_date: scheduledDate || null,
        timezone: timezone || null,
        slides: slidePaths.length,
      },
      raw: {},
    };
  }

  const res = await fetch(UPLOAD_POST_ENDPOINT, {
    method: 'POST',
    headers: {
      // FormData define Content-Type sozinho com boundary correto
      Authorization: `Apikey ${apiKey}`,
    },
    body: form,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `[postar] resposta não-JSON da upload-post (${res.status}): ${text.slice(0, 500)}`
    );
  }

  if (!res.ok || json.success === false) {
    const msg = json.message || json.error || `HTTP ${res.status}`;
    const usage = json.usage ? ` (usage: ${JSON.stringify(json.usage)})` : '';
    throw new Error(`[postar] upload falhou: ${msg}${usage}\n${JSON.stringify(json).slice(0, 500)}`);
  }

  return {
    success: true,
    request_id: json.request_id,
    job_id: json.job_id,
    results: json.results,
    raw: json,
  };
}

/** Trunca a string em N chars, terminando na última palavra. Adiciona suffix se cortar. */
function truncateAtWord(str, maxLen, suffix = '') {
  if (str.length <= maxLen) return str;
  const cut = str.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + suffix;
}

// CLI: node src/postar.mjs <output_dir_do_carrossel> [--dry-run] [--scheduled "ISO" --tz "America/Sao_Paulo"]
// Espera estrutura: <dir>/slide-01.png, slide-02.png, roteiro.json
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  (async () => {
    const args = process.argv.slice(2);
    const dir = args[0];
    if (!dir) {
      console.error(
        'Uso: node postar.mjs <carrossel_dir> [--dry-run] [--scheduled ISO --tz IANA]'
      );
      process.exit(1);
    }
    const dryRun = args.includes('--dry-run');
    const schedIdx = args.indexOf('--scheduled');
    const tzIdx = args.indexOf('--tz');
    const scheduledDate = schedIdx >= 0 ? args[schedIdx + 1] : undefined;
    const timezone = tzIdx >= 0 ? args[tzIdx + 1] : undefined;

    const { resolve } = await import('node:path');
    const roteiroPath = resolve(dir, 'roteiro.json');
    const slidePaths = [resolve(dir, 'slide-01.png'), resolve(dir, 'slide-02.png')];

    const roteiro = JSON.parse(await readFile(roteiroPath, 'utf-8'));
    try {
      const r = await postarTikTok({
        slidePaths,
        caption: roteiro.caption,
        hashtags: roteiro.hashtags,
        scheduledDate,
        timezone,
        dryRun,
      });
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      console.error(e.message);
      process.exit(2);
    }
  })();
}
