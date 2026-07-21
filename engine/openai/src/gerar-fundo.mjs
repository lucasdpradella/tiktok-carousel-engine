// gerar-fundo.mjs — gera a CENA de fundo (sem texto, sem pessoa) via Nano Banana
// (gemini-2.5-flash-image), mesma GEMINI_API_KEY do roteirista. Trocado de gpt-image-1 em
// 2026-07-19 (briefing fundo automático): fundo por post, em runtime, pra sempre.
//
// CASCATA de providers (2026-07-21): Nano Banana → gpt-image-1 → (throw → caller → SÓLIDO).
// O free tier do Gemini está com imagem ZERADA (429 permanente até ligar billing); o gpt-image-1
// (OPENAI_API_KEY, já em uso desde a Fase 2) cobre o meio. Quando o billing do Gemini ligar,
// o Nano assume sozinho — sem mudança de código. O post NUNCA deixa de sair pelo fundo.
// Cache: não regera se o arquivo já existe (1 imagem por run). A engine aplica overlay marinho
// + scrim por cima (Background.tsx) — texto marfim sempre legível.
//
// CLI: node gerar-fundo.mjs <out.png> ["prompt custom"] [--forcar] [--aspect=9:16|4:5]
import { writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImage as gerarImagemOpenAI } from './openai-client.mjs';

const NB_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

const PROMPT_PADRAO =
  'Elegant dark navy home-office desk at night, leather notebook, fountain pen, espresso cup, ' +
  'soft warm rim light, deep #122033 tones, cinematic low-key private-banking aesthetic, generous ' +
  'darker negative space for text overlay, absolutely no text no words no letters no logos no ' +
  'watermark, no people, photorealistic, vertical.';

async function chamarNanoBanana({ prompt, aspectRatio }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('[fundo] GEMINI_API_KEY ausente — sem Nano Banana (caller cai no sólido)');
  const montarBody = (comAspect) => {
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    if (comAspect && aspectRatio) body.generationConfig = { imageConfig: { aspectRatio } };
    return body;
  };
  let res = await fetch(NB_URL, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(montarBody(true)),
  });
  // se a versão do modelo não aceitar imageConfig (400), tenta sem — o objectFit:cover recorta
  if (res.status === 400 && aspectRatio) {
    console.warn('[fundo] imageConfig rejeitado (400) — tentando sem aspectRatio (cover recorta)');
    res = await fetch(NB_URL, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(montarBody(false)),
    });
  }
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`[fundo] Nano Banana HTTP ${res.status}: ${errBody.slice(0, 300)}`);
  }
  const raw = await res.json();
  const parts = raw?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p?.inlineData?.data);
  if (!img) throw new Error(`[fundo] resposta sem inlineData: ${JSON.stringify(raw).slice(0, 250)}`);
  return Buffer.from(img.inlineData.data, 'base64');
}

/**
 * Gera (ou reusa do cache) a imagem de fundo via Nano Banana.
 * @param {object} opts
 * @param {string} opts.outPath — destino do PNG (public/bg/..., gitignored)
 * @param {string} [opts.prompt] — prompt completo (vem de prompts-fundo.mjs); default on-brand
 * @param {string} [opts.aspectRatio] — '9:16' (vídeo) | '4:5' (carrossel)
 * @param {boolean} [opts.forcar] — ignora o cache
 * @returns {Promise<string>} caminho do PNG
 */
export async function gerarFundo({ outPath, prompt = PROMPT_PADRAO, aspectRatio = '9:16', forcar = false } = {}) {
  if (!outPath) throw new Error('[fundo] outPath obrigatório');
  if (!forcar) {
    try {
      await access(outPath);
      console.log(`[fundo] cache hit (não regera): ${outPath}`);
      return outPath;
    } catch {
      /* não existe, gera */
    }
  }
  let buffer;
  try {
    console.log(`[fundo] gerando cena (nano banana, ${aspectRatio})...`);
    buffer = await chamarNanoBanana({ prompt, aspectRatio });
    console.log('[fundo] provider: nano banana ✓');
  } catch (e) {
    console.warn(`[fundo] nano banana falhou (${e.message.slice(0, 90)}) — tentando gpt-image-1`);
    // gpt-image-1: 1024x1536 (vertical) serve 9:16 e 4:5 — o objectFit:cover recorta
    const { buffer: b } = await gerarImagemOpenAI({ prompt, size: '1024x1536', quality: 'medium' });
    buffer = b;
    console.log('[fundo] provider: gpt-image-1 ✓ (fallback)');
  }
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buffer);
  console.log(`[fundo] salvo: ${outPath} (${Math.round(buffer.length / 1024)} KB)`);
  return outPath;
}

// CLI
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const args = process.argv.slice(2);
  const out = args[0] || resolve(__dirname, '../../remotion/public/bg/test.png');
  const prompt = args[1] && !args[1].startsWith('--') ? args[1] : PROMPT_PADRAO;
  const aspect = (args.find((a) => a.startsWith('--aspect=')) || '--aspect=9:16').split('=')[1];
  gerarFundo({ outPath: out, prompt, aspectRatio: aspect, forcar: args.includes('--forcar') }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
