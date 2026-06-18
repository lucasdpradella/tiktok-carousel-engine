// converter-jpeg.mjs
// Converte PNG → JPEG via Pillow (já é dep do render Python), sem dep npm nova.
//
// Por quê: a Content Posting API de FOTO do TikTok aceita só JPEG/WebP — NÃO PNG.
// Os templates Pradex renderizam PNG, então antes de hospedar pra PULL_FROM_URL
// a gente converte pra JPEG (qualidade ~90, bem abaixo do limite de 20MB).
//
// Requer Python 3 + Pillow no PATH (mesmo pré-requisito do render dos slides).

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

// Script Python inline: abre o PNG, achata pra RGB e salva como JPEG.
const PY = [
  'import sys',
  'from PIL import Image',
  "Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'JPEG', quality=int(sys.argv[3]), optimize=True)",
].join('; ');

/**
 * Converte um PNG em JPEG.
 *
 * @param {string} pngPath — caminho do PNG de entrada
 * @param {string} jpgPath — caminho do JPEG de saída
 * @param {object} [opts]
 * @param {number} [opts.quality=90]
 * @param {string} [opts.pythonBin] — default env OPENAI_PYTHON_BIN ou 'python3'
 * @returns {Promise<{ path: string, sizeBytes: number }>}
 */
export async function pngToJpeg(
  pngPath,
  jpgPath,
  { quality = 90, pythonBin = process.env.OPENAI_PYTHON_BIN || 'python3' } = {}
) {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn(pythonBin, ['-c', PY, pngPath, jpgPath, String(quality)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err) => {
      rejectP(
        new Error(
          `[converter-jpeg] falha ao executar '${pythonBin}': ${err.message}. ` +
            `Tente OPENAI_PYTHON_BIN=python ou caminho absoluto.`
        )
      );
    });
    proc.on('close', async (code) => {
      if (code !== 0) {
        rejectP(new Error(`[converter-jpeg] Python saiu com código ${code}.\nstderr:\n${stderr}`));
        return;
      }
      try {
        const buf = await readFile(jpgPath);
        resolveP({ path: jpgPath, sizeBytes: buf.length });
      } catch (e) {
        rejectP(new Error(`[converter-jpeg] JPEG não encontrado em ${jpgPath}: ${e.message}`));
      }
    });
  });
}

// CLI: node src/converter-jpeg.mjs <in.png> <out.jpg> [quality]
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [pngPath, jpgPath, q] = process.argv.slice(2);
  if (!pngPath || !jpgPath) {
    console.error('Uso: node converter-jpeg.mjs <in.png> <out.jpg> [quality]');
    process.exit(1);
  }
  pngToJpeg(pngPath, jpgPath, { quality: q ? parseInt(q, 10) : 90 })
    .then((r) => console.log(`OK: ${r.sizeBytes} bytes -> ${r.path}`))
    .catch((e) => {
      console.error(e.message);
      process.exit(2);
    });
}
