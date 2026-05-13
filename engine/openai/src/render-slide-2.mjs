// render-slide-2.mjs
// Wrapper Node → Python: chama o template Pradex (slide_resolucao.py) com JSON e devolve o caminho do PNG.
//
// O template Python vive em ../../python-pradex/templates/slide_resolucao.py e renderiza:
//   - fundo creme + frame + meta no topo
//   - titulo (Lora) em 1-2 linhas com underline opcional
//   - 1-4 bullets numerados
//   - tagline italic no bottom-left
//   - sticker do Lucas + pill "DICA DO PRADELLA" no bottom-right
//
// Requer Python 3 + Pillow + numpy disponíveis no PATH.

import { spawn } from 'node:child_process';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PYTHON_TEMPLATE = resolve(
  __dirname,
  '../../python-pradex/templates/slide_resolucao.py'
);
const STICKER_PATH = resolve(
  __dirname,
  '../../python-pradex/assets/lucas_sticker_headset.png'
);

/**
 * Renderiza o slide 2 (RESOLUÇÃO) via Python PIL template.
 *
 * @param {object} slide — objeto do slide 2 vindo do gerar-roteiro (tipo: 'resolucao')
 * @param {Array<[string,string]>} slide.titulo — 1-2 linhas [texto, estilo]
 * @param {Array<[string,string,string]>} slide.bullets — 1-4 items [num, titulo, desc]
 * @param {string[]} slide.tagline — 1-3 linhas
 * @param {string} slide.texto_meta — "MANUAL DO DINHEIRO  ·  02 / 02"
 * @param {string} [slide.proximo] — opcional; se omitido, sem footer
 * @param {string} outPath — caminho de saída do PNG
 * @param {string} [pythonBin] — default 'python3'; em Windows pode precisar 'python'
 * @returns {Promise<{ path: string, sizeBytes: number }>}
 */
export async function renderSlide2(slide, outPath, pythonBin = 'python3') {
  if (slide.tipo && slide.tipo !== 'resolucao') {
    throw new Error(`[render-slide-2] tipo deve ser 'resolucao', recebi '${slide.tipo}'`);
  }

  // monta payload pro Python — apenas as chaves que o template aceita como kwargs
  const payload = {
    texto_meta: slide.texto_meta,
    titulo: slide.titulo,
    bullets: slide.bullets,
    tagline: slide.tagline,
    sticker_path: STICKER_PATH,
    proximo: slide.proximo ?? null,
  };

  // grava input em arquivo temp (mais robusto que stdin pra emoji/acento)
  const inputPath = resolve(tmpdir(), `slide2-input-${Date.now()}.json`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(inputPath, JSON.stringify(payload), 'utf-8');

  return new Promise((resolveP, rejectP) => {
    const proc = spawn(pythonBin, [PYTHON_TEMPLATE, inputPath, outPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err) => {
      rejectP(
        new Error(
          `[render-slide-2] falha ao executar '${pythonBin}': ${err.message}. ` +
            `Tente OPENAI_PYTHON_BIN=python ou caminho absoluto.`
        )
      );
    });
    proc.on('close', async (code) => {
      if (code !== 0) {
        rejectP(
          new Error(
            `[render-slide-2] Python saiu com código ${code}.\nstderr:\n${stderr}\nstdout:\n${stdout}`
          )
        );
        return;
      }
      try {
        const buf = await readFile(outPath);
        resolveP({ path: outPath, sizeBytes: buf.length });
      } catch (e) {
        rejectP(new Error(`[render-slide-2] PNG não encontrado em ${outPath}: ${e.message}`));
      }
    });
  });
}

// CLI: node src/render-slide-2.mjs <input.json> <output.png>
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [inputJsonPath, outputPath] = process.argv.slice(2);
  if (!inputJsonPath || !outputPath) {
    console.error('Uso: node render-slide-2.mjs <slide.json> <output.png>');
    process.exit(1);
  }
  (async () => {
    try {
      const slide = JSON.parse(await readFile(inputJsonPath, 'utf-8'));
      const r = await renderSlide2(slide, outputPath, process.env.OPENAI_PYTHON_BIN || 'python3');
      console.log(`OK: ${r.sizeBytes} bytes -> ${r.path}`);
    } catch (e) {
      console.error(e.message);
      process.exit(2);
    }
  })();
}
