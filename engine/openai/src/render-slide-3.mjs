// render-slide-3.mjs
// Wrapper Node → Python: chama o template Pradex (slide_solucao.py) com JSON e devolve o caminho do PNG.
//
// O template Python vive em ../../python-pradex/templates/slide_solucao.py e renderiza
// o 3º slide "solução" (pitch do PRADEX) — SÓ em posts-puxada:
//   - header meta (igual aos outros) + PRADEX
//   - hook serif (2 linhas) + contraste (1 linha sans)
//   - mock de WhatsApp (2 balões estilizados na paleta)
//   - fecho serif laranja + CTA pill "Grátis · link na bio"
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
  '../../python-pradex/templates/slide_solucao.py'
);

/**
 * Renderiza o slide 3 (SOLUÇÃO — pitch PRADEX) via Python PIL template.
 *
 * @param {object} slide — objeto slide3 vindo do gerar-roteiro (tipo: 'solucao')
 * @param {Array<[string,string]>} slide.hook — 2 linhas [texto, estilo ('r'|'i')]
 * @param {string} slide.contraste — 1 linha sans
 * @param {string} slide.mock_enviado — texto do balão enviado
 * @param {string} slide.mock_resposta — texto do balão PRADEX
 * @param {string[]} slide.fecho — 2-4 linhas serif laranja
 * @param {string} [slide.cta] — pill (default "Grátis · link na bio")
 * @param {string} slide.texto_meta — "MANUAL DO DINHEIRO  ·  CAP. NN" (já substituído)
 * @param {string} outPath — caminho de saída do PNG
 * @param {string} [pythonBin] — default 'python3'; em Windows pode precisar 'python'
 * @returns {Promise<{ path: string, sizeBytes: number }>}
 */
export async function renderSlide3(slide, outPath, pythonBin = 'python3') {
  if (slide.tipo && slide.tipo !== 'solucao') {
    throw new Error(`[render-slide-3] tipo deve ser 'solucao', recebi '${slide.tipo}'`);
  }

  const payload = {
    texto_meta: slide.texto_meta,
    hook: slide.hook,
    contraste: slide.contraste,
    mock_enviado: slide.mock_enviado,
    mock_resposta: slide.mock_resposta,
    fecho: slide.fecho,
    cta: slide.cta || 'Grátis · link na bio',
  };

  const inputPath = resolve(tmpdir(), `slide3-input-${Date.now()}.json`);
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
          `[render-slide-3] falha ao executar '${pythonBin}': ${err.message}. ` +
            `Tente OPENAI_PYTHON_BIN=python ou caminho absoluto.`
        )
      );
    });
    proc.on('close', async (code) => {
      if (code !== 0) {
        rejectP(
          new Error(
            `[render-slide-3] Python saiu com código ${code}.\nstderr:\n${stderr}\nstdout:\n${stdout}`
          )
        );
        return;
      }
      try {
        const buf = await readFile(outPath);
        resolveP({ path: outPath, sizeBytes: buf.length });
      } catch (e) {
        rejectP(new Error(`[render-slide-3] PNG não encontrado em ${outPath}: ${e.message}`));
      }
    });
  });
}

// CLI: node src/render-slide-3.mjs <input.json> <output.png>
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [inputJsonPath, outputPath] = process.argv.slice(2);
  if (!inputJsonPath || !outputPath) {
    console.error('Uso: node render-slide-3.mjs <slide.json> <output.png>');
    process.exit(1);
  }
  (async () => {
    try {
      const slide = JSON.parse(await readFile(inputJsonPath, 'utf-8'));
      const r = await renderSlide3(slide, outputPath, process.env.OPENAI_PYTHON_BIN || 'python3');
      console.log(`OK: ${r.sizeBytes} bytes -> ${r.path}`);
    } catch (e) {
      console.error(e.message);
      process.exit(2);
    }
  })();
}
