// gerar-carrossel.mjs
// Orquestrador: tópico → roteiro (gpt-4o-mini) → 2 PNGs (templates Python) → output local.
//   - slide 1 (TENSÃO):    template Pradex capa-de-capítulo (slide_tensao.py)
//   - slide 2 (RESOLUÇÃO): template Pradex (slide_resolucao.py)
//
// 2026-05-13 refactor 2: dropado gpt-image-1 do pipeline. Ambos slides são templates
// determinísticos. Cap_num/numero_grande vêm de fora (chapter, decidido pelo run-completo).

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarRoteiro } from './gerar-roteiro.mjs';
import { renderSlide1 } from './render-slide-1.mjs';
import { renderSlide2 } from './render-slide-2.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Orquestra o pipeline inteiro: tópico → roteiro → 2 imagens (templates) → arquivos salvos.
 *
 * @param {object} opts
 * @param {string} opts.topico — ex: "Reserva de emergência se mede pelo custo de viver"
 * @param {string} [opts.angulo] — opcional, ângulo editorial
 * @param {string} [opts.outputDir] — default: ../outputs/
 * @param {number} [opts.chapterNumber=4] — número do capítulo (vira "CAP. NN" e número grande)
 * @param {number} [opts.chapterTotal=8] — total da série (vira "uma série em N partes")
 * @param {string} [opts.pythonBin='python3']
 * @returns {Promise<{
 *   caption: string,
 *   hashtags: string[],
 *   slidePaths: string[],
 *   roteiroPath: string,
 *   outputDir: string,
 *   chapterNumber: number
 * }>}
 */
export async function gerarCarrossel({
  topico,
  angulo,
  outputDir,
  chapterNumber = 4,
  chapterTotal = 8,
  pythonBin = process.env.OPENAI_PYTHON_BIN || 'python3',
} = {}) {
  if (!topico) {
    throw new Error('[gerar-carrossel] opts.topico obrigatorio');
  }

  console.log(`[carrossel] gerando roteiro para: "${topico}" (CAP. ${chapterNumber})`);
  const t0Total = Date.now();
  const roteiro = await gerarRoteiro({ topico, angulo });
  console.log(`[carrossel] roteiro pronto. Caption: "${roteiro.caption.slice(0, 80)}..."`);

  const baseDir = outputDir || resolve(__dirname, '../outputs');
  const dir = resolve(baseDir, `carrossel-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  // substitui placeholder {{CAP}} no texto_meta dos slides
  const capStr = String(chapterNumber).padStart(2, '0');
  const capTotalStr = String(chapterTotal).padStart(2, '0');
  for (const s of roteiro.slides) {
    if (typeof s.texto_meta === 'string') {
      s.texto_meta = s.texto_meta.replaceAll('{{CAP}}', capStr);
    }
  }

  // extras pro slide 1 (capa de capítulo)
  const extrasSlide1 = {
    numero_grande: capStr,
    cap_num: capStr,
    cap_total: capTotalStr,
  };

  // gera em paralelo: slide 1 e slide 2, ambos templates Python
  const promises = roteiro.slides.map(async (slide, idx) => {
    const slideNum = idx + 1;
    const path = resolve(dir, `slide-${String(slideNum).padStart(2, '0')}.png`);
    const t0 = Date.now();

    if (slide.tipo === 'tensao') {
      const tituloStr = slide.titulo.map((t) => t[0]).join(' ');
      console.log(
        `[carrossel] slide ${slideNum}/${roteiro.slides.length} (TENSÃO via template Pradex) — "${tituloStr}"`
      );
      const r = await renderSlide1(slide, extrasSlide1, path, pythonBin);
      console.log(
        `[carrossel] slide ${slideNum} (TENSÃO) OK (${Math.round((Date.now() - t0) / 1000)}s, ${r.sizeBytes} bytes)`
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
    chapterNumber,
  };
}

// CLI: node src/gerar-carrossel.mjs "tópico" [chapter_number]
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const topico = process.argv[2];
  const chapterNumber = parseInt(process.argv[3] || process.env.CHAPTER_NUMBER || '4', 10);
  if (!topico) {
    console.error('Uso: node gerar-carrossel.mjs "Topico em pt-BR" [chapter_number]');
    process.exit(1);
  }
  gerarCarrossel({ topico, chapterNumber })
    .then((r) => {
      console.log('---');
      console.log('caption:', r.caption);
      console.log('hashtags:', r.hashtags.join(' '));
      console.log('chapter:', r.chapterNumber);
      console.log('slides:');
      r.slidePaths.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(2);
    });
}
