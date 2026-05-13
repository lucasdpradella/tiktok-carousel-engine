// gerar-imagem.mjs
// Recebe 1 slide (headline + subtexto + texto_meta + sujeito_visual) → preenche o template
// em prompts/system-visual.md → chama gpt-image-1 → devolve PNG buffer.

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImage } from './openai-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let CACHED_TEMPLATE = null;
async function getTemplate() {
  if (!CACHED_TEMPLATE) {
    CACHED_TEMPLATE = await readFile(
      resolve(__dirname, '../prompts/system-visual.md'),
      'utf-8'
    );
  }
  return CACHED_TEMPLATE;
}

/**
 * Gera 1 imagem (slide) com tipografia overlay no estilo Pradex (headline + subtexto).
 *
 * @param {object} opts
 * @param {string} opts.headline — ex: "Reserva NÃO é 6× salário"
 * @param {string} opts.subtexto — ex: "A maioria calcula pela renda. O problema aparece quando ela some"
 * @param {string} opts.texto_meta — ex: "MANUAL DO DINHEIRO · 01 / 02"
 * @param {string} opts.sujeito_visual — ex: "jarra de vidro com grãos de feijão pela metade em mesa de madeira"
 * @param {'low'|'medium'|'high'|'auto'} [opts.quality='medium']
 * @param {string} [opts.size='1024x1536']
 * @param {string} [opts.model='gpt-image-1']
 * @returns {Promise<{ buffer: Buffer, mimeType: string, usage: object }>}
 */
export async function gerarImagem({
  headline,
  subtexto,
  texto_meta,
  sujeito_visual,
  quality = 'medium',
  size = '1024x1536',
  model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
} = {}) {
  if (!headline || !subtexto || !texto_meta || !sujeito_visual) {
    throw new Error(
      '[gerar-imagem] opts.headline, opts.subtexto, opts.texto_meta e opts.sujeito_visual sao obrigatorios'
    );
  }

  const template = await getTemplate();
  const prompt = template
    .replaceAll('{headline}', headline)
    .replaceAll('{subtexto}', subtexto)
    .replaceAll('{texto_meta}', texto_meta)
    .replaceAll('{sujeito_visual}', sujeito_visual);

  const { buffer, mimeType, usage } = await generateImage({
    model,
    prompt,
    size,
    quality,
  });
  return { buffer, mimeType, usage };
}

// CLI: node src/gerar-imagem.mjs "HEADLINE" "SUBTEXTO" "META" "sujeito visual"
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [headline, subtexto, texto_meta, sujeito_visual] = process.argv.slice(2);
  if (!headline || !subtexto || !texto_meta || !sujeito_visual) {
    console.error('Uso: node gerar-imagem.mjs "HEADLINE" "SUBTEXTO" "TEXTO META" "sujeito visual"');
    process.exit(1);
  }
  const out = resolve(__dirname, `../outputs/cli-${Date.now()}.png`);
  gerarImagem({ headline, subtexto, texto_meta, sujeito_visual })
    .then(async ({ buffer }) => {
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, buffer);
      console.log(`OK: ${buffer.length} bytes -> ${out}`);
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(2);
    });
}
