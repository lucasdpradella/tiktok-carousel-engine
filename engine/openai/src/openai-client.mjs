// openai-client.mjs
// Wrapper minimalista pra OpenAI (chat + image).
// Sem deps externas — usa fetch nativo do Node 18+.
//
// Uso:
//   import { chat, generateImage } from './openai-client.mjs';
//   const { text, usage } = await chat({ model: 'gpt-4o-mini', messages: [...] });
//   const { buffer, mimeType, usage } = await generateImage({ prompt: '...' });

const BASE_URL = 'https://api.openai.com/v1';

function readKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('[openai-client] OPENAI_API_KEY ausente no process.env');
  }
  return key;
}

/**
 * Parsea o corpo de erro do OpenAI e re-lança com contexto util pra debug.
 * @param {Response} res
 * @param {string} model
 * @param {string} [promptHint] — primeiros chars do prompt, opcional
 */
async function throwApiError(res, model, promptHint) {
  let body;
  try {
    body = await res.json();
  } catch {
    body = { error: { message: await res.text() } };
  }
  const apiMsg = body?.error?.message || JSON.stringify(body).slice(0, 300);
  const truncated = promptHint ? ` | prompt: "${promptHint.slice(0, 100)}..."` : '';
  const err = new Error(
    `[openai-client] HTTP ${res.status} em ${model}: ${apiMsg}${truncated}`
  );
  err.status = res.status;
  err.apiBody = body;
  throw err;
}

/**
 * Chama o endpoint /v1/chat/completions.
 * @param {object} opts
 * @param {string} opts.model — ex: 'gpt-4o-mini'
 * @param {Array<{role: string, content: string}>} opts.messages
 * @param {object} [opts.responseFormat] — ex: { type: 'json_object' } pra forçar JSON
 * @param {number} [opts.temperature=0.7]
 * @param {number} [opts.maxTokens]
 * @returns {Promise<{ text: string, usage: object, raw: object }>}
 */
export async function chat({
  model = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
  messages,
  responseFormat,
  temperature = 0.7,
  maxTokens,
} = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('[openai-client.chat] messages obrigatorio (array nao-vazio)');
  }
  const key = readKey();
  const body = {
    model,
    messages,
    temperature,
  };
  if (responseFormat) body.response_format = responseFormat;
  if (typeof maxTokens === 'number') body.max_tokens = maxTokens;

  const firstUserMsg = messages.find((m) => m.role === 'user');
  const promptHint = typeof firstUserMsg?.content === 'string' ? firstUserMsg.content : '';

  let res;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`[openai-client.chat] erro de rede em ${model}: ${e.message}`);
  }
  if (!res.ok) await throwApiError(res, model, promptHint);

  const raw = await res.json();
  const text = raw?.choices?.[0]?.message?.content ?? '';
  if (!text) {
    throw new Error(
      `[openai-client.chat] resposta sem content: ${JSON.stringify(raw).slice(0, 400)}`
    );
  }
  return { text, usage: raw.usage || {}, raw };
}

/**
 * Chama o endpoint /v1/images/generations (gpt-image-1).
 * @param {object} opts
 * @param {string} [opts.model='gpt-image-1']
 * @param {string} opts.prompt
 * @param {string} [opts.size='1024x1536'] — portrait pra TikTok
 * @param {'low'|'medium'|'high'|'auto'} [opts.quality='medium']
 * @param {number} [opts.n=1]
 * @returns {Promise<{ buffer: Buffer, mimeType: string, usage: object, raw: object }>}
 */
export async function generateImage({
  model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
  prompt,
  size = '1024x1536',
  quality = 'medium',
  n = 1,
} = {}) {
  if (!prompt) throw new Error('[openai-client.generateImage] prompt obrigatorio');
  const key = readKey();
  const body = { model, prompt, size, quality, n };

  let res;
  try {
    res = await fetch(`${BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`[openai-client.generateImage] erro de rede em ${model}: ${e.message}`);
  }
  if (!res.ok) await throwApiError(res, model, prompt);

  const raw = await res.json();
  const first = raw?.data?.[0];
  const b64 = first?.b64_json;
  if (!b64) {
    throw new Error(
      `[openai-client.generateImage] resposta sem b64_json: ${JSON.stringify(raw).slice(0, 400)}`
    );
  }
  const buffer = Buffer.from(b64, 'base64');
  return { buffer, mimeType: 'image/png', usage: raw.usage || {}, raw };
}
