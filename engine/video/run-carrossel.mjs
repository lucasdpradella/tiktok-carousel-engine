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
import { escolherPromptFundo } from '../openai/src/prompts-fundo.mjs';
import { garantirHashtags } from '../openai/src/hashtags.mjs';
import { refreshAccessToken, postarTikTokInbox, getPostStatus, montarTextos } from '../openai/src/postar.mjs';
import { lerHistorico, registrarPost, checarCandidato, primeiroElegivel, jaPostouEm, REGRAS_CURADO } from './anti-repeticao.mjs';
import { lerPauta, proximoPendente, marcarItem, lerAssets, lerCaption, escreverStatusFila } from './pauta.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../..');
const REMOTION = resolve(REPO, 'engine/remotion');
const REMO_CARROSSEL = resolve(REMOTION, 'src/carrossel.json');
const JPG_OUT = resolve(REMOTION, 'out/carrossel'); // slides JPEG do run
const VIDEO_OUT = resolve(__dirname, 'out');
const MANIFEST = resolve(VIDEO_OUT, 'carrossel-post.json');
const CAPTION = resolve(VIDEO_OUT, 'carrossel-caption.txt');
const ESTADO = resolve(__dirname, 'estado-carrossel.json');
const TEMAS = resolve(__dirname, 'temas-carrossel.json'); // fila própria (gama Igor), separada do vídeo
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

// tema: env TOPICO / argv (após flags) / fila de RESERVA temas-carrossel.json[estado-carrossel].
// A trava anti-repetição (anti-repeticao.mjs) decide o que pode virar post; nada aqui rebobina.
//
// TOPICO manual roda só com a regra do slug (o Lucas escolheu na mão — heurística de recência não
// veta decisão humana), mas repetir tema já publicado continua proibido. FORCAR=true fura a trava.
async function resolverTopico(historico) {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const custom = process.env.TOPICO || arg;
  if (custom) {
    const candidato = { tema: custom, categoria: process.env.CATEGORIA || 'generico' };
    const { ok, motivo } = checarCandidato(candidato, historico, { regras: REGRAS_CURADO });
    if (!ok && process.env.FORCAR !== 'true') {
      console.log(`::warning::[trava] TOPICO manual "${custom}" BLOQUEADO — ${motivo}`);
      console.log('[carrossel] use FORCAR=true se for intencional. Saindo limpo, nada postado.');
      return null;
    }
    if (!ok) console.log(`::warning::[trava] FORCAR=true — postando mesmo bloqueado (${motivo})`);
    return { topico: custom, categoria: candidato.categoria, origem: 'manual', indice: null };
  }

  const temas = await lerJSON(TEMAS);
  const desde = existsSync(ESTADO) ? (await lerJSON(ESTADO)).indice_atual || 0 : 0;
  // WRAP CIRCULAR MORTO (era `raw % temas.length`, causa raiz do dólar repetido em 31/07):
  // a fila acabou, ela NÃO rebobina.
  if (desde >= temas.length) {
    console.log(`::warning::[carrossel] fila de reserva acabou (idx ${desde} >= ${temas.length} temas) — nada a gerar.`);
    return null;
  }
  // pula os bloqueados e pega o primeiro elegível daqui pra frente
  const { item, indice } = primeiroElegivel(temas, historico, { desde, rotulo: 'reserva-carrossel' });
  if (!item) {
    console.log('::warning::[carrossel] nenhum tema elegível na fila de reserva — a trava bloqueou todos.');
    return null;
  }
  return { topico: item.tema, categoria: item.categoria || 'generico', origem: 'fila-auto', indice };
}

// ── PRÉ-PRONTO ───────────────────────────────────────────────────────────────
// Item de pauta curada COM assets: publica a pasta como está. Sem roteirista, sem Gemini,
// sem gerar fundo, sem Remotion. Os assets já estão commitados (logo, já no Pages).
async function prepararPrePronto(item) {
  const { postDir, arquivos, capPath, tipoAsset } = lerAssets(item.assets);
  if (tipoAsset !== 'foto') throw new Error(`[carrossel] ${item.assets} tem MP4, não JPEG — isso é pauta de vídeo`);
  const caption = await lerCaption(capPath);
  // caption do pré-pronto já vem FINAL (CTA + hashtags) — hashtags:[] pra não duplicar; o
  // garantirHashtags segue valendo (dedupe embutido) pra travar as obrigatórias do Squad XP.
  const { title, description } = montarTextos({ caption, hashtags: [] });
  const descricaoFinal = garantirHashtags(description).trimEnd();
  const photoUrls = arquivos.map((f) => `${PAGES_BASE}/${postDir}/${f}`);

  console.log(`[carrossel] PRÉ-PRONTO "${item.id}" — ${photoUrls.length} slides de ${item.assets} (nada é gerado)`);
  await mkdir(VIDEO_OUT, { recursive: true });
  await writeFile(CAPTION, `${title}\n\n${descricaoFinal}\n`);
  await writeFile(
    MANIFEST,
    JSON.stringify(
      { postDir, photoUrls, title, description: descricaoFinal, origem: 'pauta-curada', pautaId: item.id, tema: item.tema, categoria: item.categoria, indice: null },
      null,
      2,
    ) + '\n',
  );
}

// ── GERAR ────────────────────────────────────────────────────────────────────
async function gerar() {
  // IDEMPOTÊNCIA POR DIA (anti post-duplo): run REAL só 1x por dia (cron + dispatch não colidem).
  // Agora pelo HISTÓRICO, não pela pasta em docs/ — a checagem por pasta bloquearia um
  // pré-pronto cuja pasta de assets casasse com a data do dia. A de pasta virou guarda do
  // caminho GERADO (é ele que cria docs/post-carrossel-<hoje>), lá no gerarComRoteirista.
  const historico = await lerHistorico();
  if (!DRY_RUN && jaPostouEm(historico, { data: hoje(), tipo: 'carrossel' })) {
    console.log(`[carrossel] histórico já tem carrossel de ${hoje()} — post de hoje já saiu. Saindo limpo (anti-duplo).`);
    return;
  }

  // 1º a FILA CURADA (data/pauta.json). O roteirista automático é RESERVA.
  const pauta = await lerPauta();
  const item = proximoPendente(pauta, 'carrossel', hoje());

  if (item) {
    // Item aprovado na mão pelo Lucas → só a regra do slug (não repetir o que já saiu).
    const { ok, motivo } = checarCandidato({ tema: item.tema, categoria: item.categoria }, historico, { regras: REGRAS_CURADO });
    if (!ok) {
      console.log(`::warning::[trava] pauta "${item.id}" BLOQUEADA — ${motivo}`);
      if (!DRY_RUN) await marcarItem(item.id, 'bloqueado', { motivo });
      console.log('[carrossel] item curado marcado como bloqueado. Saindo limpo, nada postado.');
      return;
    }
    if (item.assets) {
      if (DRY_RUN) {
        const { arquivos } = lerAssets(item.assets);
        console.log(`[carrossel] DRY_RUN + PRÉ-PRONTO "${item.id}": publicaria ${arquivos.length} slides de ${item.assets}. Nada gerado, nada postado.`);
        return;
      }
      await prepararPrePronto(item);
      return;
    }
    // pauta SEM assets: o roteirista escreve em cima do tema/resumo dados, sem escolher assunto.
    console.log(`[carrossel] pauta curada "${item.id}" (sem assets) → roteirista escreve sobre o tema dado`);
    return gerarComRoteirista({
      topico: item.resumo ? `${item.tema}\n\nÂngulo definido pela pauta: ${item.resumo}` : item.tema,
      tema: item.tema,
      categoria: item.categoria || 'generico',
      origem: 'pauta-curada',
      pautaId: item.id,
      indice: null,
    });
  }

  // fila curada vazia → roteirista automático COM A TRAVA VALENDO.
  console.log('[carrossel] fila curada vazia → caindo na reserva (temas-carrossel.json) com a trava ligada');
  const escolha = await resolverTopico(historico);
  if (!escolha) {
    console.log('[carrossel] sem tema elegível. Saindo limpo, NADA POSTADO (nunca postar repetido "porque era a vez dele").');
    return;
  }
  return gerarComRoteirista({
    topico: escolha.topico,
    tema: escolha.topico,
    categoria: escolha.categoria,
    origem: escolha.origem,
    pautaId: null,
    indice: escolha.indice,
  });
}

// gera o carrossel de fato (roteirista → fundo → render N JPEG → stage docs + manifesto)
async function gerarComRoteirista({ topico, tema, categoria, origem, pautaId, indice }) {
  // anti-duplo do caminho GERADO: é este que faz stage em docs/post-carrossel-<hoje>.
  if (!DRY_RUN && existsSync(resolve(DOCS, `post-carrossel-${hoje()}`))) {
    console.log(`[carrossel] docs/post-carrossel-${hoje()} já existe — post de hoje já saiu. Saindo limpo (anti-duplo).`);
    return;
  }
  console.log(`[carrossel] tema: "${tema}" (categoria=${categoria}, origem=${origem}, dryRun=${DRY_RUN})`);

  // 1. roteiro multi-slide (validador de caractere + compliance + CTA travada já embutidos)
  const script = await gerarRoteiroCarrossel({ topico });
  console.log(`[carrossel] roteiro: ${script.slides.length} slides`);

  // 2. fundo automático POR POST (Nano Banana): prompt pela categoria do tema, rodízio de
  // variações (dry-run não gasta), 4:5. Falhou (quota/sem key)? Sólido marinho — nunca quebra.
  try {
    const { prompt, id } = escolherPromptFundo({ categoria, persistir: !DRY_RUN });
    const bgRel = `bg/carrossel-${hoje()}.png`;
    await gerarFundo({ outPath: resolve(REMOTION, 'public', bgRel), prompt, aspectRatio: '4:5' });
    script.bg = bgRel;
    script.bgMode = 'foto';
    console.log(`[carrossel] fundo nano banana ligado: ${bgRel} (prompt ${id}, categoria ${categoria})`);
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
    // retry: o Chromium do Remotion às vezes crasha nativo (transiente) — 1 retry evita
    // derrubar o post inteiro por uma falha esporádica de render.
    for (let tent = 1; tent <= 2; tent++) {
      try {
        await run(NPX, ['remotion', 'still', 'src/index.ts', 'Carrossel', out, `--frame=${i}`, '--image-format=jpeg'], { cwd: REMOTION });
        break;
      } catch (e) {
        if (tent === 2) throw e;
        console.warn(`[carrossel] render do slide ${i + 1} falhou (${e.message}) — retry 2/2`);
      }
    }
    jpgs.push({ name, out });
    console.log(`[carrossel] slide ${i + 1}/${script.slides.length} → ${name}`);
  }

  // caption sugerida sempre (carrossel: a API de foto aceita title/description; mantemos a caption)
  const { title, description } = montarTextos({ caption: captionComCtaTravado(script.caption), hashtags: script.hashtags });
  // hashtags obrigatórias do Squad XP travadas por código (dedupe) — inbox TikTok, Pages e IG herdam
  const descricaoFinal = garantirHashtags(description).trimEnd();
  await mkdir(VIDEO_OUT, { recursive: true });
  await writeFile(CAPTION, `${title}\n\n${descricaoFinal}\n`);

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
  // caption junto no Pages: o Lucas abre .../post-carrossel-DATA/caption.txt no celular e cola no app
  await copyFile(CAPTION, resolve(destDir, 'caption.txt'));
  console.log(`[carrossel] caption no Pages: ${PAGES_BASE}/${postDir}/caption.txt`);
  await writeFile(
    MANIFEST,
    JSON.stringify({ postDir, photoUrls, title, description: descricaoFinal, origem, pautaId, tema, categoria, indice }, null, 2) + '\n',
  );
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
  if (!existsSync(MANIFEST)) {
    console.log('[carrossel] sem manifesto (generate pulou — anti-duplo ou dry-run). Nada a postar, saindo limpo.');
    return;
  }
  const m = await lerJSON(MANIFEST);
  const { photoUrls, title, description, origem, pautaId, tema, categoria, indice } = m;
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

  // ── memória do post (o passo que faltava e cegava a trava) ────────────────
  await registrarPost({
    data: hoje(),
    tipo: 'carrossel',
    tema,
    categoria,
    origem: origem || 'fila-auto',
    run_id: process.env.GITHUB_RUN_ID || '',
  });

  if (pautaId) {
    // pauta curada: marca o item e NÃO mexe em estado-carrossel.json (a reserva fica parada)
    await marcarItem(pautaId, 'postado', { postado_em: hoje() });
    console.log('[carrossel] origem pauta-curada → estado-carrossel.json intocado (reserva parada onde estava)');
  } else {
    // fila de reserva: avança pro ÍNDICE REALMENTE CONSUMIDO + 1 (a trava pode ter pulado itens)
    const estado = existsSync(ESTADO) ? await lerJSON(ESTADO) : { indice_atual: 0 };
    estado.indice_atual = (typeof indice === 'number' ? indice : estado.indice_atual || 0) + 1;
    await writeFile(ESTADO, JSON.stringify(estado, null, 2) + '\n');
    console.log(`[carrossel] estado-carrossel.json avançado → indice_atual=${estado.indice_atual}`);
  }

  await escreverStatusFila({ agora: new Date().toISOString(), ...(await restantesReserva()) });
}

/** quantos temas ainda sobram em cada fila de RESERVA (pro status-fila). */
async function restantesReserva() {
  const conta = async (temasPath, estadoPath) => {
    if (!existsSync(temasPath)) return 0;
    const temas = await lerJSON(temasPath);
    const idx = existsSync(estadoPath) ? (await lerJSON(estadoPath)).indice_atual || 0 : 0;
    return Math.max(0, temas.length - idx);
  };
  return {
    reservaCarrossel: await conta(TEMAS, ESTADO),
    reservaVideo: await conta(resolve(__dirname, 'temas-video.json'), resolve(__dirname, 'estado-video.json')),
  };
}

const main = POST_PHASE ? postar : gerar;
main().catch((e) => {
  console.error('[carrossel] FALHA:', e.message);
  console.error(e.stack);
  process.exit(1);
});
