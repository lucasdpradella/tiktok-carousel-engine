// gerar-carrossel.mjs
// Orquestrador: tópico → roteiro (gpt-4o-mini) → 2 PNGs em paralelo → output local.
//   - slide 1 (TENSÃO):    gpt-image-1 (foto editorial com overlay)
//   - slide 2 (RESOLUÇÃO): template Pradex via Python PIL (cream + sticker)

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarRoteiro } from './gerar-roteiro.mjs';
import { gerarImagem } from './gerar-imagem.mjs';
import { renderSlide2 } from './render-slide-2.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Orquestra o pipeline inteiro: tópico → roteiro → 2 imagens → arquivos salvos.
 * As 2 imagens são geradas em paralelo: slide 1 via gpt-image-1, slide 2 via Python PIL.
 *
 * @param {object} opts
 * @param {string} opts.topico — ex: "Reserva de emergência se mede pelo custo de viver"
 * @param {string} [opts.angulo] — opcional, ângulo editorial
 * @param {string} [opts.outputDir] — default: ../outputs/
 * @param {'low'|'medium'|'high'|'auto'} [opts.quality='medium'] — qualidade do gpt-image-1 (slide 1)
 * @param {string} [opts.pythonBin='python3'] — binary do Python (slide 2)
 * @returns {Promise<{
 *   caption: string,
 *   hashtags: string[],
 *   slidePaths: string[],
 *   roteiroPath: string,
 *   outputDir: string
 * }>}
 */
export async function gerarCarrossel({
  topico,
  angulo,
  outputDir,
  quality = 'medium',
  pythonBin = process.env.OPENAI_PYTHON_BIN || 'python3',
} = {}) {
  if (!topico) {
    throw new Error('[gerar-carrossel] opts.topico obrigatorio');
  }

  console.log(`[carrossel] gerando roteiro para: "${topico}"`);
  const t0Total = Date.now();
  const roteiro = await gerarRoteiro({ topico, angulo });
  console.log(`[carrossel] roteiro pronto. Caption: "${roteiro.caption.slice(0, 80)}..."`);
  console.log(`[carrossel] ${roteiro.slides.length} slides a gerar (em paralelo)`);

  const baseDir = outputDir || resolve(__dirname, '../outputs');
  const dir = resolve(baseDir, `carrossel-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  // gera em paralelo: slide 1 = gpt-image-1, slide 2 = template Python
  const promises = roteiro.slides.map(async (slide, idx) => {
    const slideNum = idx + 1;
    const path = resolve(dir, `slide-${String(slideNum).padStart(2, '0')}.png`);
    const t0 = Date.now();

    if (slide.tipo === 'tensao') {
      console.log(
        `[carrossel] slide ${slideNum}/${roteiro.slides.length} (TENSÃO via gpt-image-1) — "${slide.headline}"`
      );
      const { buffer } = await gerarImagem({
        headline: slide.headline,
        subtexto: slide.subtexto,
        texto_meta: slide.texto_meta,
        sujeito_visual: slide.sujeito_visual,
        quality,
      });
      await writeFile(path, buffer);
      console.log(
        `[carrossel] slide ${slideNum} (TENSÃO) OK (${Math.round((Date.now() - t0) / 1000)}s, ${buffer.length} bytes)`
      );
    } else {
      const tituloStr = slide.titulo.map((t) => t[0]).join(' ');
      console.log(
        `[carrossel] slide ${slideNum}/${roteiro.slides.length} (RESOLUÇÃO via template Pradex) — "${tituloStr}"`
      );
      const r = await renderSlide2(slide, path, pythonBin);
      console.log(
        `[carrossel] slide ${slideNum} (RESOLUÇÃO) OK (${Math.round((Date.now() - t0) / 1000)}s, ${r.sizeBytes} bytes)`
      );
    }

    return path;
  });

  const slidePaths = await Promise.all(promises);

  // salva roteiro inteiro como JSON pra referencia / debug
  const roteiroPath = resolve(dir, 'roteiro.json');
  await writeFile(roteiroPath, JSON.stringify(roteiro, null, 2));

  const totalSec = Math.round((Date.now() - t0Total) / 1000);
  console.log(`[carrossel] TODOS os ${roteiro.slides.length} slides OK em ${totalSec}s (incl. roteiro)`);
  console.log(`[carrossel] outputs em: ${dir}`);

  return {
    caption: roteiro.caption,
    hashtags: roteiro.hashtags || [],
    slidePaths,
    roteiroPath,
    outputDir: dir,
  };
}

// CLI: node src/gerar-carrossel.mjs "tópico"
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const topico = process.argv[2];
  if (!topico) {
    console.error('Uso: node gerar-carrossel.mjs "Topico em pt-BR"');
    process.exit(1);
  }
  gerarCarrossel({ topico })
    .then((r) => {
      console.log('---');
      console.log('caption:', r.caption);
      console.log('hashtags:', r.hashtags.join(' '));
      console.log('slides:');
      r.slidePaths.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(2);
    });
}
