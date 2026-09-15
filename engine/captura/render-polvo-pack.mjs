// Pack do polvo pra composição de vídeo: PNG com fundo TRANSPARENTE, nos tamanhos
// que o storyboard usa.
//
// POR QUE ISTO EXISTE: no storyboard do dorama, todo quadro em que o polvo divide a
// tela com mão/celular é risco de o modelo generativo redesenhar o personagem —
// arredondar o olho, espelhar as sobrancelhas, iluminar o manto e perder o indigo.
// São exatamente os defeitos dos v5, v6 e v7, que foram descartados.
//
// A saída: o modelo gera SÓ o fundo (silhueta, quarto, mão, celular), onde variação
// não importa. O polvo entra por cima, recortado daqui. Determinístico, idêntico em
// todos os episódios, custo zero.
//
// Uso:
//   node render-polvo-pack.mjs

import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const MARCA = String.raw`C:\Users\lucas\OneDrive\Área de Trabalho\Chave Mestre\Projetos\PRADEX\marca`;
const OUT = process.env.PDX_OUT || path.join(MARCA, "polvo-pack");
const POLVO = process.env.POLVO || path.join(MARCA, "2026-09-15_mascote-polvo_OFICIAL.svg");

// O SVG é 200x200. Os tamanhos abaixo saem do uso real no storyboard, sempre com
// folga: PNG maior dá pra reduzir sem perda, o contrário não.
const TAMANHOS = [
  { id: "canto",  px: 400,  nota: "canto do quadro (01.8, 02.6, 04.6, 05.3)" },
  { id: "terco",  px: 700,  nota: "terço do quadro (03.1, 05.1, 05.6)" },
  { id: "centro", px: 1000, nota: "protagonista do quadro (03.8, 05.8)" },
];

// O close do rosto é o quadro de MAIOR risco (02.7): ampliar faz o modelo inventar
// pupila e suavizar o sorriso. Aqui é recorte puro do vetor, então não inventa nada.
// viewBox recortado na cabeça: x 24..176, y 46..150 do original.
const ROSTO = { id: "rosto-close", px: 1200, viewBox: "24 46 152 104" };

async function renderizar(page, svg, largura, altura, arquivo) {
  await page.setViewportSize({ width: largura, height: altura });
  await page.setContent(
    `<body style="margin:0;background:transparent">
       <div style="width:${largura}px;height:${altura}px">${svg}</div>
     </body>`,
    { waitUntil: "load" },
  );
  await page.waitForTimeout(150);
  // omitBackground: sem isto o PNG sai com fundo branco e o recorte fica com halo.
  await page.screenshot({ path: arquivo, omitBackground: true });
}

async function main() {
  const original = await readFile(POLVO, "utf8");
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    for (const t of TAMANHOS) {
      const svg = original
        .replace(/width="\d+"/, `width="${t.px}"`)
        .replace(/height="\d+"/, `height="${t.px}"`);
      const arquivo = path.join(OUT, `polvo_${t.id}_${t.px}.png`);
      await renderizar(page, svg, t.px, t.px, arquivo);
      console.log(`✓ ${t.id.padEnd(12)} ${t.px}×${t.px}  ${t.nota}`);
    }

    // Recorte do rosto: troca o viewBox e ajusta a proporção pra não distorcer.
    const alturaRosto = Math.round(ROSTO.px * (104 / 152));
    const svgRosto = original
      .replace(/viewBox="[^"]*"/, `viewBox="${ROSTO.viewBox}"`)
      .replace(/width="\d+"/, `width="${ROSTO.px}"`)
      .replace(/height="\d+"/, `height="${alturaRosto}"`);
    const arquivoRosto = path.join(OUT, `polvo_${ROSTO.id}_${ROSTO.px}.png`);
    await renderizar(page, svgRosto, ROSTO.px, alturaRosto, arquivoRosto);
    console.log(`✓ ${ROSTO.id.padEnd(12)} ${ROSTO.px}×${alturaRosto}  close do rosto (02.7 — o quadro de maior risco)`);
  } finally {
    await browser.close();
  }

  console.log(`\n4 peças em ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
