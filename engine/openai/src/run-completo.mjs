// run-completo.mjs
// Orquestrador end-to-end pro GitHub Actions cron.
//
// Pipeline:
//   1. Supabase: claim_next_topic() → pega próximo tópico pendente, marca in_progress
//   2. OpenAI: gerarRoteiro() → caption + hashtags + 2 slides estruturados
//   3. Em paralelo:
//      - slide 1 (TENSÃO) → gpt-image-1
//      - slide 2 (RESOLUÇÃO) → template Python (cream + sticker)
//   4. upload-post.com: postar imediatamente (DIRECT_POST) ou agendar
//   5. Supabase: marca topic como done, salva carousel + post
//
// Falhas em qualquer passo:
//   - logam stack
//   - rebobinam topic pra status=pending (idempotência simples)
//   - exit code != 0 (GitHub Actions marca o run como failed)

import { gerarCarrossel } from './gerar-carrossel.mjs';
import { postarTikTok } from './postar.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // service_role pra escrever em todas as tabelas
const NICHO = process.env.PIPELINE_NICHO || 'financas-comportamentais';
const SCHEDULED_DATE = process.env.SCHEDULED_DATE; // opcional ISO-8601
const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';
const DRY_RUN = process.env.DRY_RUN === 'true';
// CHAPTER_OFFSET = nº do PRÓXIMO capítulo a publicar quando ainda não há posts published.
// Default 4 porque o Lucas já tem CAP. 03 publicado fora desta engine (Manual do Dinheiro).
// Cada post published incrementa em 1. Pra resetar/forçar, edita o env no GitHub Secrets.
const CHAPTER_OFFSET = parseInt(process.env.CHAPTER_OFFSET || '4', 10);
const CHAPTER_TOTAL = parseInt(process.env.CHAPTER_TOTAL || '8', 10);

async function supabase(path, init = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('[run-completo] SUPABASE_URL / SUPABASE_KEY ausentes');
  }
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1${path}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // resposta pode ser vazia (DELETE/PATCH)
    }
  }
  if (!res.ok) {
    throw new Error(
      `[supabase] ${init.method || 'GET'} ${path} → HTTP ${res.status}: ${text.slice(0, 400)}`
    );
  }
  return json;
}

async function countPublishedPosts() {
  // Conta posts em status='published' pra calcular o próximo capítulo.
  // Usa header Prefer: count=exact pra pegar o count no Content-Range.
  if (!SUPABASE_URL || !SUPABASE_KEY) return 0;
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/posts?select=id&status=eq.published`;
  const res = await fetch(url, {
    method: 'HEAD',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  if (!res.ok) {
    console.warn(`[chapter] falha ao contar posts published: HTTP ${res.status}. Usando 0.`);
    return 0;
  }
  // Content-Range: "0-0/N" (N = total). Pode vir como "*/0" se vazio.
  const cr = res.headers.get('content-range') || '';
  const m = cr.match(/\/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function claimNextTopic(nicho) {
  const r = await supabase('/rpc/claim_next_topic', {
    method: 'POST',
    body: JSON.stringify({ p_nicho: nicho }),
  });
  // RPC retorna a row inteira ou null. PostgREST envolve em array quando há row.
  if (!r) return null;
  if (Array.isArray(r)) return r[0] || null;
  return r;
}

async function markTopicStatus(topicId, status) {
  await supabase(`/topics?id=eq.${topicId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status }),
  });
}

async function saveCarousel({ topicId, nicho, titulo, caption, hashtags, status }) {
  const r = await supabase('/carousels', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      topic_id: topicId,
      nicho,
      titulo,
      caption,
      hashtags,
      status,
      llm_model: 'gpt-4o-mini',
      image_model: 'pradex-template-only',
    }),
  });
  return Array.isArray(r) ? r[0] : r;
}

async function updateCarousel(carouselId, fields) {
  await supabase(`/carousels?id=eq.${carouselId}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(fields),
  });
}

async function savePost({ carouselId, requestId, jobId, raw, status }) {
  await supabase('/posts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      carousel_id: carouselId,
      via: 'upload-post',
      request_id: requestId || jobId || null,
      status,
      response_raw: raw,
    }),
  });
}

async function main() {
  console.log(`[run] iniciando — nicho=${NICHO}, dryRun=${DRY_RUN}`);

  // 1. Pega próximo tópico
  console.log(`[run] supabase: claim_next_topic('${NICHO}')`);
  const topic = await claimNextTopic(NICHO);
  if (!topic || !topic.id) {
    console.log(`[run] não há tópico pendente em ${NICHO}. Saindo limpo.`);
    return;
  }
  console.log(`[run] tópico claimado: #${topic.id} — "${topic.tema}" (ângulo=${topic.angulo})`);

  // 1.5. Calcula o número do capítulo: OFFSET + posts já published
  const publishedCount = await countPublishedPosts();
  const chapterNumber = CHAPTER_OFFSET + publishedCount;
  console.log(
    `[run] chapter = OFFSET(${CHAPTER_OFFSET}) + published(${publishedCount}) = ${chapterNumber} / ${CHAPTER_TOTAL}`
  );

  let carousel;
  try {
    // 2. Gera roteiro + 3. gera 2 slides em paralelo
    const r = await gerarCarrossel({
      topico: topic.tema,
      angulo: topic.angulo,
      chapterNumber,
      chapterTotal: CHAPTER_TOTAL,
    });
    console.log(`[run] carrossel pronto em ${r.outputDir}`);

    // 4a. Cria registro do carousel em rendering → ready
    carousel = await saveCarousel({
      topicId: topic.id,
      nicho: topic.nicho,
      titulo: topic.tema,
      caption: r.caption,
      hashtags: r.hashtags,
      status: 'ready',
    });
    console.log(`[run] carousel salvo: ${carousel.id}`);

    if (DRY_RUN) {
      console.log('[run] DRY_RUN=true → pulando post real. Marcando topic como pending de volta.');
      await markTopicStatus(topic.id, 'pending');
      await updateCarousel(carousel.id, { status: 'aborted' });
      return;
    }

    // 4b. Posta
    console.log(`[run] postando via upload-post.com (scheduled=${SCHEDULED_DATE || 'imediato'})`);
    await updateCarousel(carousel.id, { status: 'posting' });
    const postResult = await postarTikTok({
      slidePaths: r.slidePaths,
      caption: r.caption,
      hashtags: r.hashtags,
      scheduledDate: SCHEDULED_DATE,
      timezone: SCHEDULED_DATE ? TIMEZONE : undefined,
    });
    console.log(`[run] post OK. request_id=${postResult.request_id}, job_id=${postResult.job_id}`);

    // 5. Marca tudo como done
    await savePost({
      carouselId: carousel.id,
      requestId: postResult.request_id,
      jobId: postResult.job_id,
      raw: postResult.raw,
      status: SCHEDULED_DATE ? 'queued' : 'published',
    });
    await updateCarousel(carousel.id, {
      status: 'posted',
      posted_at: new Date().toISOString(),
    });
    await markTopicStatus(topic.id, 'done');

    console.log('[run] PIPELINE COMPLETO ✓');
  } catch (e) {
    console.error('[run] FALHA:', e.message);
    console.error(e.stack);

    // rebobina: topic volta pra pending, carousel marca como failed
    try {
      if (carousel?.id) {
        await updateCarousel(carousel.id, { status: 'failed', error: e.message });
      }
      await markTopicStatus(topic.id, 'pending');
    } catch (rollbackErr) {
      console.error('[run] erro no rollback:', rollbackErr.message);
    }

    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
