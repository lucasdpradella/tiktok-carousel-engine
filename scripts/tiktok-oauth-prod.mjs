// tiktok-oauth-prod.mjs
// One-off: autoriza @pradella.lucas no app PRADEX em PRODUCTION e devolve o
// refresh_token (365 dias) que vira o GitHub Secret TIKTOK_REFRESH_TOKEN.
//
// NÃO faz upload de nada. Só OAuth: monta a URL de authorize e troca o code
// por tokens. Roda 1x só, na máquina do Lucas (terminal do VS Code), nunca no CI.
//
// ── Segredos (tudo local, NADA no chat) ─────────────────────────────────────
//   Credenciais vêm de scripts/.tiktok-prod.local.json (gitignored) OU de env vars.
//   Crie o arquivo UMA vez (no teu editor, não no chat):
//     scripts/.tiktok-prod.local.json
//     { "client_key": "...", "client_secret": "<o secret rotacionado>" }
//   O refresh_token é gravado em scripts/.tiktok-tokens.local.json (gitignored)
//   e impresso no teu terminal pra colar no GitHub Secret. Não copie pro chat.
//
// ── Uso (no terminal do VS Code) ────────────────────────────────────────────
//   # 1) gerar a URL de authorize (abre logado como @pradella.lucas):
//   node scripts/tiktok-oauth-prod.mjs url
//
//   # 2) depois de autorizar, o script PEDE o `code` no terminal (cola lá, não aqui):
//   node scripts/tiktok-oauth-prod.mjs exchange
//   #   (ou, se preferir passar direto:  node ... exchange "<code>")
//
// Pré-requisitos (Passo 0 do briefing, já verdes):
//   - Production tem Content Posting API + scope video.upload.
//   - redirect_uri abaixo registrada no app.

import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';

const CREDS_FILE = resolve(import.meta.dirname, '.tiktok-prod.local.json');
const TOKENS_FILE = resolve(import.meta.dirname, '.tiktok-tokens.local.json');

async function loadCreds() {
  // Prioridade: arquivo local gitignored → env vars (fallback).
  let fromFile = {};
  try {
    fromFile = JSON.parse(await readFile(CREDS_FILE, 'utf-8'));
  } catch {
    // sem arquivo, tenta env
  }
  return {
    clientKey: fromFile.client_key || process.env.TIKTOK_CLIENT_KEY,
    clientSecret: fromFile.client_secret || process.env.TIKTOK_CLIENT_SECRET,
  };
}

const { clientKey: CLIENT_KEY, clientSecret: CLIENT_SECRET } = await loadCreds();
const REDIRECT_URI = 'https://lucasdpradella.github.io/tiktok-carousel-engine/oauth-callback.html';
const SCOPE = 'user.info.basic,video.upload';
const STATE = 'pradex';

const mode = process.argv[2];

function requireKey() {
  if (!CLIENT_KEY) {
    console.error('Erro: client_key ausente. Crie scripts/.tiktok-prod.local.json com');
    console.error('  { "client_key": "...", "client_secret": "..." }');
    console.error('(ou defina $env:TIKTOK_CLIENT_KEY / $env:TIKTOK_CLIENT_SECRET).');
    process.exit(1);
  }
}

async function promptCode() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question('Cole o `code` da página de callback (aqui no terminal, NÃO no chat): ')).trim();
  rl.close();
  return code;
}

function buildAuthorizeUrl() {
  const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
  u.searchParams.set('client_key', CLIENT_KEY);
  u.searchParams.set('scope', SCOPE);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', REDIRECT_URI);
  u.searchParams.set('state', STATE);
  return u.toString();
}

async function exchange(rawCode) {
  if (!CLIENT_SECRET) {
    console.error('Erro: defina $env:TIKTOK_CLIENT_SECRET (client secret de Production) antes de rodar.');
    process.exit(1);
  }
  // O code pode vir URL-encoded (ex: termina em %2A). Decodifica se precisar.
  const code = rawCode.includes('%') ? decodeURIComponent(rawCode) : rawCode;

  console.log('=== Trocando code por tokens (Production) ===');
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    console.error('FALHA no /v2/oauth/token/:', JSON.stringify(json, null, 2));
    console.error('Causas comuns: code expirado (vale ~10min, use logo), redirect_uri diferente do authorize, ou client_key/secret de Sandbox em vez de Production.');
    process.exit(2);
  }

  // Valida o access_token e confirma a conta antes de mostrar o refresh_token.
  console.log('=== Validando com /v2/user/info/ ===');
  const userRes = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
    { headers: { Authorization: 'Bearer ' + json.access_token } }
  );
  const userJson = await userRes.json();
  const displayName = userJson.data?.user?.display_name;
  if (userJson.error?.code === 'ok') {
    console.log('✓ token válido. Conta autorizada:', displayName);
  } else {
    console.warn('⚠ user.info não confirmou (segue assim mesmo):', JSON.stringify(userJson));
  }

  console.log('');
  console.log('open_id            :', json.open_id);
  console.log('scope concedido    :', json.scope);
  console.log('access_token expira :', json.expires_in, 's (~24h, efêmero — NÃO vira Secret)');
  console.log('refresh expira em   :', json.refresh_expires_in, 's (~365 dias)');
  console.log('');
  // Grava num arquivo local gitignored pra você não precisar copiar do terminal.
  await writeFile(
    TOKENS_FILE,
    JSON.stringify(
      { refresh_token: json.refresh_token, open_id: json.open_id, scope: json.scope },
      null,
      2
    ) + '\n'
  );

  console.log('────────────────────────────────────────────────────────────────');
  console.log(' refresh_token salvo em: scripts/.tiktok-tokens.local.json (gitignored)');
  console.log(' Abra esse arquivo, copie o refresh_token pro GitHub Secret');
  console.log(' TIKTOK_REFRESH_TOKEN (Settings → Secrets and variables → Actions).');
  console.log(' NÃO cole em chat, repo ou log público. Apague o arquivo depois se quiser.');
  console.log('────────────────────────────────────────────────────────────────');
  console.log('');
  console.log('Confira que "scope concedido" acima contém video.upload. Se faltar, refaça o authorize marcando a permissão.');
}

if (mode === 'url') {
  requireKey();
  console.log('Abra esta URL no navegador, LOGADO como @pradella.lucas:');
  console.log('');
  console.log(buildAuthorizeUrl());
  console.log('');
  console.log('Depois de aprovar, a página de callback mostra o `code`. Copie e rode:');
  console.log('  node scripts/tiktok-oauth-prod.mjs exchange "<code>"');
} else if (mode === 'exchange') {
  requireKey();
  // code via argumento OU prompt no terminal (preferido — não fica no histórico de shell/chat).
  const code = process.argv[3] || (await promptCode());
  if (!code) {
    console.error('Nenhum code informado.');
    process.exit(1);
  }
  await exchange(code);
} else {
  console.error('Uso:');
  console.error('  node scripts/tiktok-oauth-prod.mjs url        # gera a URL de authorize');
  console.error('  node scripts/tiktok-oauth-prod.mjs exchange   # pede o code no terminal e troca por tokens');
  process.exit(1);
}
