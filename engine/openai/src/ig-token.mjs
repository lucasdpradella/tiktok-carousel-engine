// ig-token.mjs — token do Instagram (long-lived), espelhando o padrão do TikTok (postar.mjs),
// mas no host graph.instagram.com (API com Instagram Login). Lê do GitHub Secret IG_ACCESS_TOKEN.
//
// Refresh (long-lived dura ~60 dias): GET /refresh_access_token?grant_type=ig_refresh_token.
// MVP (decisão do briefing): Secret ESTÁTICO + alerta pra re-OAuth manual a cada ~55 dias.
// O refresh aqui é utilitário (CLI/job futuro); NÃO auto-grava o Secret (precisaria de PAT).
//
// Segredo NUNCA em log/repo/chat — só prefixo mascarado.
//
// Docs Meta (host e grant): https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login

const GRAPH = 'https://graph.instagram.com';

const mask = (t) => (typeof t === 'string' && t.length > 8 ? `${t.slice(0, 4)}…${t.slice(-2)}` : '∅');

/** Lê o long-lived token do env (GitHub Secret). Lança se ausente. */
export function getIgToken() {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error('[ig-token] IG_ACCESS_TOKEN ausente no env (configure o GitHub Secret)');
  return token;
}

/** Lê o IG_USER_ID (não-secreto, mas vem do env pra não fixar no código). */
export function getIgUserId() {
  const id = process.env.IG_USER_ID;
  if (!id) throw new Error('[ig-token] IG_USER_ID ausente no env');
  return id;
}

/**
 * Renova o long-lived token (rodar quando tiver >50 dias). Devolve o novo token e loga um
 * ALERTA pra regravar o Secret manualmente (MVP sem PAT). NUNCA loga o valor do token.
 * @param {{token?: string}} [opts]
 * @returns {Promise<{ accessToken: string, expiresIn: number }>}
 */
export async function refreshIgToken({ token = process.env.IG_ACCESS_TOKEN } = {}) {
  if (!token) throw new Error('[ig-token] refresh: token ausente');
  const url = `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`[ig-token] refresh falhou (HTTP ${res.status}): ${JSON.stringify(json.error || json)}`);
  }
  console.log(
    `[ig-token] token renovado (expira em ~${json.expires_in}s). ⚠️ Regrave o Secret IG_ACCESS_TOKEN ` +
      `manualmente (novo=${mask(json.access_token)}).`
  );
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

// CLI: node ig-token.mjs refresh
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (process.argv.includes('refresh')) {
    refreshIgToken().catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
  } else {
    console.log('[ig-token] uso: node ig-token.mjs refresh');
  }
}
