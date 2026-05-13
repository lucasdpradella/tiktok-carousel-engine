// gemini-client.mjs
// Wrapper minimalista pra Google Gemini (texto + imagem).
// Sem deps externas — usa fetch nativo do Node 18+.
//
// Uso:
//   import { generateText, generateImage } from './gemini-client.mjs';
//   const { text } = await generateText({ prompt: 'oi' });
//   const { buffer, mimeType } = await generateImage({ prompt: '...' });

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function readKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('[gemini-client] GEMINI_API_KEY ausente no process.env');
  }
  return key;
}

async function callGemini(model, body) {
  const key = readKey();
  const url = `${BASE_URL}/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    const err = new Error(
      `[gemini-client] HTTP ${res.status} ${res.statusText} em ${model}: ${errBody.slice(0, 500)}`
    );
    err.status = res.status;
    err.body = errBody;
    throw err;
  }
  return res.json();
}

/**
 * Gera texto (ou JSON estruturado quando `schema` fornecido).
 * @param {object} opts
 * @param {string} [opts.model='gemini-2.5-flash']
 * @param {string} opts.prompt
 * @param {object|null} [opts.schema=null]  responseSchema JSON (opcional)
 * @param {number} [opts.temperature=0.7]
 * @returns {Promise<{ text: string, raw: object }>}
 */
export async function generateText({
  model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
  prompt,
  schema = null,
  temperature = 0.7,
} = {}) {
  if (!prompt) throw new Error('[gemini-client.generateText] prompt obrigatorio');
  const generationConfig = { temperature };
  if (schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = schema;
  }
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  };
  const raw = await callGemini(model, body);
  const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) {
    throw new Error(
      `[gemini-client.generateText] resposta sem text: ${JSON.stringify(raw).slice(0, 400)}`
    );
  }
  return { text, raw };
}

/**
 * Gera imagem PNG via Nano Banana.
 * @param {object} opts
 * @param {string} [opts.model='gemini-2.5-flash-image']
 * @param {string} opts.prompt
 * @returns {Promise<{ buffer: Buffer, mimeType: string, raw: object }>}
 */
export async function generateImage({
  model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
  prompt,
} = {}) {
  if (!prompt) throw new Error('[gemini-client.generateImage] prompt obrigatorio');
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
  const raw = await callGemini(model, body);
  const parts = raw?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p?.inlineData?.data);
  if (!imgPart) {
    throw new Error(
      `[gemini-client.generateImage] resposta sem inlineData: ${JSON.stringify(raw).slice(0, 400)}`
    );
  }
  const buffer = Buffer.from(imgPart.inlineData.data, 'base64');
  const mimeType = imgPart.inlineData.mimeType || 'image/png';
  return { buffer, mimeType, raw };
}
