// chat-provider.mjs — provedor de TEXTO dos roteiristas (briefing-gemini, 2026-07-06).
// O gargalo do conteúdo raso era o modelo escritor (gpt-4o-mini). Este wrapper mantém o MESMO
// contrato do openai-client.chat({messages, responseFormat, temperature}) → { text }, mas:
//   1. GEMINI_API_KEY presente → Gemini (GEMINI_TEXT_MODEL, default gemini-2.5-pro, JSON mode).
//      Rate limit/erro do Pro → tenta o Flash. (Free tier do AI Studio; custo irrelevante.)
//   2. Sem GEMINI_API_KEY (ou Gemini caiu de vez) → fallback pro OpenAI (gpt-4o-mini) — o post
//      degrada de qualidade mas NUNCA deixa de sair.
// Guard-rails (compliance-guard, validadores, retry) rodam DEPOIS do modelo — intactos.

import { chat as chatOpenAI } from './openai-client.mjs';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_PRO = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-pro';
const MODEL_FLASH = 'gemini-2.5-flash';

async function chatGemini({ model, messages, responseFormat, temperature = 0.85 }) {
  const key = process.env.GEMINI_API_KEY;
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const user = messages.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n');
  const body = {
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (responseFormat?.type === 'json_object') body.generationConfig.responseMimeType = 'application/json';

  const res = await fetch(`${BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    const err = new Error(`[chat-provider] Gemini ${model} HTTP ${res.status}: ${errBody.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const raw = await res.json();
  const text = (raw?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text || '').join('');
  if (!text) throw new Error(`[chat-provider] Gemini ${model}: resposta sem texto (${JSON.stringify(raw).slice(0, 200)})`);
  return { text, raw };
}

/**
 * Mesmo contrato do openai-client.chat. O campo `model` recebido é IGNORADO quando o Gemini está
 * ativo (o modelo vem de GEMINI_TEXT_MODEL); no fallback OpenAI ele é repassado.
 */
export async function chat(opts) {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await chatGemini({ ...opts, model: MODEL_PRO });
    } catch (e) {
      console.warn(`[chat-provider] Gemini Pro falhou (${e.status || e.message.slice(0, 80)}) — tentando Flash`);
      try {
        return await chatGemini({ ...opts, model: MODEL_FLASH });
      } catch (e2) {
        console.warn(`[chat-provider] Gemini Flash também falhou — fallback OpenAI (${e2.status || ''})`);
      }
    }
  }
  return chatOpenAI(opts);
}
