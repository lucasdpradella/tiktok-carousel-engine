// postar.mjs
// Posta um carrossel no inbox/rascunho do TikTok via Content Posting API (semi-auto).
//
// Trilho semi-auto (Fase 4): scope `video.upload` → post_mode MEDIA_UPLOAD.
// A API puxa as imagens por URL pública (PULL_FROM_URL) e joga no inbox do
// @pradella.lucas; ele finaliza o post dentro do TikTok. Não publica sozinho,
// então qualquer falha é reversível por construção. (DIRECT_POST = full-auto,
// exige scope video.publish + novo audit — ver briefing-fase4-fullauto.md.)
//
// Docs (consultadas 2026-06-18):
//   - Photo post / content/init: https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
//   - Media transfer (PULL_FROM_URL): https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide
//   - OAuth (refresh + rotação):     https://developers.tiktok.com/doc/oauth-user-access-token-management
//
// Segredos: client_key/secret/refresh_token vêm de env (GitHub Secrets no CI).
// NUNCA logar valores de token — só prefixos mascarados.

const OAUTH_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const CONTENT_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/content/init/';
const STATUS_FETCH_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';

const TIKTOK_TITLE_MAX = 90; // UTF-16 runes (caption visível)
const TIKTOK_DESC_MAX = 4000; // UTF-16 runes (descrição)

/**
 * Gera um access_token fresco a partir do refresh_token (grant_type=refresh_token).
 *
 * A doc avisa: o refresh pode devolver um refresh_token NOVO e invalidar o antigo.
 * Sinalizamos isso em `rotated` pra o caller decidir (logar aviso / regravar Secret).
 *
 * @param {object} opts
 * @param {string} opts.clientKey
 * @param {string} opts.clientSecret
 * @param {string} opts.refreshToken
 * @returns {Promise<{ accessToken: string, refreshToken: string, rotated: boolean, expiresIn: number, scope: string, openId: string }>}
 */
export async function refreshAccessToken({ clientKey, clientSecret, refreshToken } = {}) {
  if (!clientKey || !clientSecret || !refreshToken) {
    throw new Error('[postar] refreshAccessToken: clientKey, clientSecret e refreshToken são obrigatórios');
  }

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    // json.error pode ser string (OAuth) — não logar o body inteiro por garantia.
    const err = typeof json.error === 'string' ? json.error : JSON.stringify(json.error || {});
    throw new Error(
      `[postar] refresh falhou (HTTP ${res.status}): ${err} — ${json.error_description || ''}. ` +
        `Se o refresh_token expirou/rotacionou, refaça o one-off OAuth (scripts/tiktok-oauth-prod.mjs).`
    );
  }

  const newRefresh = json.refresh_token || refreshToken;
  return {
    accessToken: json.access_token,
    refreshToken: newRefresh,
    rotated: Boolean(json.refresh_token) && json.refresh_token !== refreshToken,
    expiresIn: json.expires_in,
    scope: json.scope,
    openId: json.open_id,
  };
}

/**
 * Inicia um post de FOTO no inbox (MEDIA_UPLOAD) via PULL_FROM_URL.
 *
 * @param {object} opts
 * @param {string[]} opts.photoUrls — URLs HTTPS públicas dos JPEGs, em ordem (capa = índice 0)
 * @param {string} opts.title — caption visível (≤90 runes)
 * @param {string} opts.description — caption + hashtags (≤4000 runes)
 * @param {string} opts.accessToken
 * @returns {Promise<{ publishId: string, raw: object }>}
 */
export async function postarTikTokInbox({ photoUrls, title, description, accessToken } = {}) {
  if (!Array.isArray(photoUrls) || photoUrls.length < 1) {
    throw new Error('[postar] postarTikTokInbox: photoUrls precisa ser array com ≥1 URL');
  }
  if (!photoUrls.every((u) => typeof u === 'string' && u.startsWith('https://'))) {
    throw new Error('[postar] postarTikTokInbox: todas as photoUrls precisam ser HTTPS públicas (sem redirect)');
  }
  if (!accessToken) {
    throw new Error('[postar] postarTikTokInbox: accessToken ausente');
  }

  // MEDIA_UPLOAD não precisa de privacy_level / brand toggles / auto_add_music.
  const body = {
    post_info: {
      title: (title || '').slice(0, TIKTOK_TITLE_MAX),
      description: (description || '').slice(0, TIKTOK_DESC_MAX),
    },
    source_info: {
      source: 'PULL_FROM_URL',
      photo_cover_index: 0,
      photo_images: photoUrls,
    },
    post_mode: 'MEDIA_UPLOAD',
    media_type: 'PHOTO',
  };

  const res = await fetch(CONTENT_INIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  const code = json.error?.code;
  if (!res.ok || code !== 'ok') {
    throw new Error(
      `[postar] content/init falhou (HTTP ${res.status}): code=${code} ` +
        `msg="${json.error?.message || ''}" log_id=${json.error?.log_id || 'n/a'}`
    );
  }

  return { publishId: json.data?.publish_id, raw: json };
}

/**
 * (Opcional) Consulta o status do publish. Não bloqueia sucesso — em MEDIA_UPLOAD
 * o post só completa quando o Lucas finaliza no app. Útil pra logar o download.
 *
 * @param {object} opts
 * @param {string} opts.publishId
 * @param {string} opts.accessToken
 * @returns {Promise<object>} data do status (ex: { status: 'PROCESSING_UPLOAD', ... })
 */
export async function getPostStatus({ publishId, accessToken } = {}) {
  if (!publishId || !accessToken) {
    throw new Error('[postar] getPostStatus: publishId e accessToken obrigatórios');
  }
  const res = await fetch(STATUS_FETCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const json = await res.json();
  if (!res.ok || json.error?.code !== 'ok') {
    // status é best-effort — não derruba o run
    return { _error: json.error?.code || `HTTP ${res.status}`, raw: json };
  }
  return json.data;
}

/**
 * Monta title (≤90, sem cortar palavra) e description (caption + hashtags, ≤4000).
 *
 * @param {object} opts
 * @param {string} opts.caption
 * @param {string[]} [opts.hashtags] — com ou sem "#"
 * @returns {{ title: string, description: string }}
 */
export function montarTextos({ caption, hashtags = [] }) {
  const hashtagsStr = hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const fullCaption = hashtagsStr ? `${caption}\n\n${hashtagsStr}` : caption;
  const title = truncateAtWord(caption, TIKTOK_TITLE_MAX, '');
  const description = fullCaption.slice(0, TIKTOK_DESC_MAX);
  return { title, description };
}

/** Trunca a string em N chars, terminando na última palavra. Adiciona suffix se cortar. */
function truncateAtWord(str, maxLen, suffix = '') {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  const room = Math.max(0, maxLen - suffix.length);
  const cut = str.slice(0, room);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + suffix;
}
