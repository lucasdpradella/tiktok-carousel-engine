// avancar.mjs
// Avanço explícito da fila no modo manual (transitório, pré-audit).
//
// O run em DRY_RUN gera o carrossel mas NÃO mexe no estado. Depois de postar
// manualmente o artifact no TikTok, o Lucas roda `npm run avancar` (+ commit) pra
// apontar a fila pro próximo capítulo. Avanço explícito evita "buracos" de capítulo
// caso o cron dispare num dia em que ele não postou.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');
const TEMAS_PATH = resolve(DATA_DIR, 'temas.json');
const ESTADO_PATH = resolve(DATA_DIR, 'estado.json');

async function lerJSON(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function main() {
  const temas = await lerJSON(TEMAS_PATH);
  const estado = await lerJSON(ESTADO_PATH);

  const anterior = estado.indice_atual;
  const temaAnterior = temas[anterior];
  if (temaAnterior) {
    const capAnterior = estado.capitulo_offset + anterior;
    console.log(`[avancar] passou: CAP. ${capAnterior} — "${temaAnterior.tema}"`);
  }

  estado.indice_atual = anterior + 1;
  await writeFile(ESTADO_PATH, JSON.stringify(estado, null, 2) + '\n');

  const idx = estado.indice_atual;
  if (idx >= temas.length) {
    console.log(
      `[avancar] indice_atual=${idx} — fila acabou (${temas.length} temas). Adicione novos temas a data/temas.json.`
    );
  } else {
    const proximo = temas[idx];
    const capProximo = estado.capitulo_offset + idx;
    console.log(`[avancar] próximo: CAP. ${capProximo} — "${proximo.tema}" (ângulo=${proximo.angulo})`);
  }
  console.log('[avancar] estado.json regravado. Não esqueça do commit.');
}

main().catch((e) => {
  console.error('[avancar] FALHA:', e.message);
  process.exit(1);
});
