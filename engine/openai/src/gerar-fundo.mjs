// gerar-fundo.mjs — gera a CENA de fundo (sem texto, sem pessoa) via gpt-image-1.
// A engine carimba o texto/ouro/LP por cima (texto sempre perfeito). Área escura vazia
// no topo-esquerda é FIXA (é onde o template põe o texto). Cache: não regera se já existe.
//
// CLI: node gerar-fundo.mjs <out.png> ["objetos custom"] [--forcar]
import { writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImage } from './openai-client.mjs';

// Cena on-brand. {OBJETOS} varia por tema; o negative space no topo-esquerda é fixo.
const PROMPT_BASE =
  'Cinematic editorial photograph, ultra-premium private-banking aesthetic. ' +
  'Deep navy and charcoal tones, moody and elegant. A polished dark desk on the RIGHT ' +
  'with refined objects ({OBJETOS}). The TOP-LEFT two-thirds is a calm deep-navy wall in ' +
  'shadow, large empty negative space. Soft warm directional key light, shallow depth of ' +
  'field, expensive and minimal. No text, no logos, no people, no charts with legible numbers.';

const OBJETOS_PADRAO = 'leather notebook, fountain pen, espresso cup, small plant, classic watch';

/**
 * Gera (ou reusa do cache) a imagem de fundo.
 * @returns {Promise<string>} caminho do PNG
 */
export async function gerarFundo({ outPath, objetos = OBJETOS_PADRAO, quality = 'medium', forcar = false } = {}) {
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
  const prompt = PROMPT_BASE.replace('{OBJETOS}', objetos);
  console.log(`[fundo] gerando cena (gpt-image-1, ${quality})...`);
  const { buffer, usage } = await generateImage({ prompt, size: '1024x1536', quality });
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, buffer);
  console.log(`[fundo] salvo: ${outPath} (${Math.round(buffer.length / 1024)} KB)`, usage ? JSON.stringify(usage) : '');
  return outPath;
}

// CLI
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const args = process.argv.slice(2);
  const out = args[0] || resolve(__dirname, '../../remotion/public/bg/test.png');
  const objetos = args[1] && !args[1].startsWith('--') ? args[1] : OBJETOS_PADRAO;
  gerarFundo({ outPath: out, objetos, forcar: args.includes('--forcar') }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
