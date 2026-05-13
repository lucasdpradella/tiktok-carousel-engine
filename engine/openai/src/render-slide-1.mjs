// render-slide-1.mjs
// Wrapper Node → Python: chama o template Pradex (slide_tensao.py) com JSON e devolve o caminho do PNG.
//
// O template Python vive em ../../python-pradex/templates/slide_tensao.py e renderiza:
//   - fundo creme + frame + meta no topo (CAP. NN)
//   - número decorativo gigante (NN) em Lora-Italic alpha 95
//   - hero text em 2-4 linhas grandes (Lora regular/italic alternados)
//   - bloco CAPÍTULO NN + nome + descrição (2-3 linhas)
//   - rodapé "deslize ››" + "uma série em N partes"
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
  '../../python-pradex/templates/slide_tensao.py'
);

/**
 * Renderiza o slide 1 (TENSÃO — capa de capítulo) via Python PIL template.
 *
 * @param {object} slide — objeto do slide 1 vindo do gerar-roteiro (tipo: 'tensao')
 * @param {Array<[string,string]>} slide.titulo — 2-4 linhas [texto, estilo ('r' ou 'i')]
 * @param {string} slide.cap_nome — nome do capítulo (3-6 palavras)
 * @param {string[]} slide.cap_desc — 1-3 linhas curtas de descrição
 * @param {string} slide.texto_meta — "MANUAL DO DINHEIRO  ·  CAP. 04" (já substituído)
 * @param {object} extras — campos injetados pelo orquestrador
 * @param {string} extras.numero_grande — "04" (decorativo gigante)
 * @param {string} extras.cap_num — "04" (no bloco CAPÍTULO)
 * @param {string} [extras.cap_total='08']
 * @param {string} outPath — caminho de saída do PNG
 * @param {string} [pythonBin] — default 'python3'; em Windows pode precisar 'python'
 * @returns {Promise<{ path: string, sizeBytes: number }>}
 */
export async function renderSlide1(slide, extras, outPath, pythonBin = 'python3') {
  if (slide.tipo && slide.tipo !== 'tensao') {
    throw new Error(`[render-slide-1] tipo deve ser 'tensao', recebi '${slide.tipo}'`);
  }

  const payload = {
    texto_meta: slide.texto_meta,
    titulo: slide.titulo,
    cap_nome: slide.cap_nome,
    cap_desc: slide.cap_desc,
    numero_grande: extras.numero_grande,
    cap_num: extras.cap_num,
    cap_total: extras.cap_total || '08',
  };

  const inputPath = resolve(tmpdir(), `slide1-input-${Date.now()}.json`);
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
          `[render-slide-1] falha ao executar '${pythonBin}': ${err.message}. ` +
            `Tente OPENAI_PYTHON_BIN=python ou caminho absoluto.`
        )
      );
    });
    proc.on('close', async (code) => {
      if (code !== 0) {
        rejectP(
          new Error(
            `[render-slide-1] Python saiu com código ${code}.\nstderr:\n${stderr}\nstdout:\n${stdout}`
          )
        );
        return;
      }
      try {
        const buf = await readFile(outPath);
        resolveP({ path: outPath, sizeBytes: buf.length });
      } catch (e) {
        rejectP(new Error(`[render-slide-1] PNG não encontrado em ${outPath}: ${e.message}`));
      }
    });
  });
}

// CLI: node src/render-slide-1.mjs <input.json> <output.png>
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [inputJsonPath, outputPath] = process.argv.slice(2);
  if (!inputJsonPath || !outputPath) {
    console.error('Uso: node render-slide-1.mjs <slide.json> <output.png>');
    process.exit(1);
  }
  (async () => {
    try {
      const payload = JSON.parse(await readFile(inputJsonPath, 'utf-8'));
      // Aceita tanto o shape "slide + extras separados" quanto plano (achatado)
      const slide = payload.slide || payload;
      const extras = payload.extras || {
        numero_grande: payload.numero_grande || payload.cap_num || '04',
        cap_num: payload.cap_num || payload.numero_grande || '04',
        cap_total: payload.cap_total || '08',
      };
      const r = await renderSlide1(slide, extras, outputPath, process.env.OPENAI_PYTHON_BIN || 'python3');
      console.log(`OK: ${r.sizeBytes} bytes -> ${r.path}`);
    } catch (e) {
      console.error(e.message);
      process.exit(2);
    }
  })();
}
