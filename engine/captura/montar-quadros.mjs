// Fecha o pipeline do storyboard: pega os quadros gerados (2:3), corta pra 9:16 e
// compõe o polvo oficial nos que têm espaço reservado.
//
// Por que o corte: o gerador de imagem não aceita 9:16 nativo, só 2:3 (784×1168).
// `object-fit: cover` num palco 1080×1920 faz corte central horizontal — perde 16% da
// largura, e nas composições do storyboard isso não derruba nada porque o assunto está
// sempre centrado. Verificado quadro a quadro antes de automatizar.
//
// Por que compor aqui e não deixar o modelo desenhar: o polvo do pack sai do SVG
// oficial, idêntico nos cinco episódios. Modelo generativo redesenha o personagem a
// cada quadro — foi o que matou os v5, v6 e v7.
//
// Uso:
//   node montar-quadros.mjs <pasta-com-ep01..ep05>

import { chromium } from "playwright";
import { readFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const ENTRADA = process.argv[2];
if (!ENTRADA) { console.error("Uso: node montar-quadros.mjs <pasta>"); process.exit(1); }

const MARCA = String.raw`C:\Users\lucas\OneDrive\Área de Trabalho\Chave Mestre\Projetos\PRADEX\marca`;
const PACK = path.join(MARCA, "polvo-pack");
const OUT = process.env.PDX_OUT || String.raw`C:\Users\lucas\OneDrive\Área de Trabalho\Chave Mestre\Projetos\PRADEX\dorama-quadros`;

const W = 1080, H = 1920;

// Onde o polvo entra, por quadro. As posições vêm do storyboard — o modelo foi
// instruído a deixar esses cantos limpos, então aqui é só encaixar.
const MASCOTE = {
  "01.8": { arq: "polvo_canto_400.png", larg: 300, css: "right:56px;bottom:170px" },
  "02.6": { arq: "polvo_canto_400.png", larg: 300, css: "left:56px;bottom:170px" },
  "03.6": { arq: "polvo_canto_400.png", larg: 300, css: "right:56px;bottom:170px" },
  "03.7": { arq: "polvo_terco_700.png", larg: 360, css: "right:40px;top:50%;transform:translateY(-50%)" },
  "04.6": { arq: "polvo_canto_400.png", larg: 290, css: "right:56px;top:180px" },
  "04.7": { arq: "polvo_canto_400.png", larg: 290, css: "right:56px;top:180px" },
  "04.8": { arq: "polvo_canto_400.png", larg: 300, css: "right:56px;bottom:170px" },
  "05.3": { arq: "polvo_canto_400.png", larg: 300, css: "right:56px;bottom:170px" },
  "05.4": { arq: "polvo_canto_400.png", larg: 280, css: "right:36px;top:50%;transform:translateY(-50%)" },
  "05.8": { arq: "polvo_terco_700.png", larg: 520, css: "left:50%;bottom:150px;transform:translateX(-50%)" },
};

const cache = new Map();
async function dataUri(arquivoAbsoluto, mime) {
  if (!cache.has(arquivoAbsoluto)) {
    const b64 = (await readFile(arquivoAbsoluto)).toString("base64");
    cache.set(arquivoAbsoluto, `data:${mime};base64,${b64}`);
  }
  return cache.get(arquivoAbsoluto);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  let n = 0, comMascote = 0;

  try {
    const eps = (await readdir(ENTRADA, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && /^ep\d\d$/.test(d.name))
      .map((d) => d.name).sort();

    for (const ep of eps) {
      const dir = path.join(ENTRADA, ep);
      const arquivos = (await readdir(dir)).filter((f) => /\.jpe?g$/i.test(f)).sort();

      for (const f of arquivos) {
        // "03.6_vinte-e-seis.jpg" -> "03.6"
        const id = f.match(/^(\d\d\.\d)/)?.[1];
        const fundo = await dataUri(path.join(dir, f), "image/jpeg");

        let camada = "";
        const m = MASCOTE[id];
        if (m) {
          const src = await dataUri(path.join(PACK, m.arq), "image/png");
          camada = `<img src="${src}" style="position:absolute;${m.css};width:${m.larg}px;height:auto">`;
          comMascote++;
        }

        await page.setContent(
          `<body style="margin:0;background:#0C0E14">
             <div style="position:relative;width:${W}px;height:${H}px;overflow:hidden">
               <img src="${fundo}" style="width:${W}px;height:${H}px;object-fit:cover;display:block">
               ${camada}
             </div>
           </body>`,
          { waitUntil: "load" },
        );
        await page.waitForTimeout(120);

        const saida = path.join(OUT, f.replace(/\.jpe?g$/i, ".png"));
        await page.screenshot({ path: saida });
        console.log(`✓ ${f.padEnd(28)} ${m ? "+ polvo" : ""}`);
        n++;
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${n} quadros em 1080×1920 · ${comMascote} com o polvo composto`);
  console.log(`→ ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
