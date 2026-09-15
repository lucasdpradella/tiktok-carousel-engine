// Renderiza os ativos de marca do canal @pradexapp a partir do SVG do polvo.
//
// O SVG e a fonte da verdade (vive na Chave Mestre, versao v6). Aqui ele vira PNG nos
// tamanhos que as plataformas pedem. Rasterizar no Chromium em vez de exportar a mao
// mantem os dois lados sincronizados: mudou o SVG, roda de novo.
//
// Uso:
//   node render-marca.mjs
//   POLVO=/caminho/outro.svg node render-marca.mjs

import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(AQUI, "out-marca");

const POLVO = process.env.POLVO ||
  "C:/Users/lucas/OneDrive/Área de Trabalho/Chave Mestre/Projetos/PRADEX/marca/2026-09-14_mascote-polvo_v6.svg";

// Paleta do canal (briefing §2). Nao inventar cor aqui — ela e decisao de marca.
const FUNDO = "#0C0E14";
const INDIGO = "#4F46E5";
const CIANO = "#22D3EE";

const PECAS = [
  {
    id: "perfil-1080",
    titulo: "Foto de perfil (1080x1080)",
    w: 1080, h: 1080,
    // O avatar do TikTok e recortado em CIRCULO. Tudo que importa precisa caber no
    // circulo inscrito, e ainda sobrar margem: a moldura de "live"/borda come a beirada.
    html: (svg) => `
      <div class="palco">
        <div class="halo"></div>
        <div class="mascote">${svg}</div>
      </div>
      <style>
        .palco{width:1080px;height:1080px;background:${FUNDO};display:flex;
               align-items:center;justify-content:center;position:relative;overflow:hidden}
        .halo{position:absolute;width:820px;height:820px;border-radius:50%;
              background:radial-gradient(circle, ${INDIGO}33 0%, ${INDIGO}0D 55%, transparent 72%)}
        /* 62% de 1080 = 670px: folgado dentro do circulo inscrito, sobra respiro */
        .mascote{position:relative;width:670px;height:670px}
        .mascote svg{width:100%;height:100%}
      </style>`,
  },
  {
    id: "capa-1080",
    titulo: "Capa quadrada com nome (1080x1080)",
    w: 1080, h: 1080,
    html: (svg) => `
      <div class="palco">
        <div class="mascote">${svg}</div>
        <p class="nome">PRADEX</p>
        <p class="sub">organiza o mês. projeta o plano.</p>
      </div>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap');
        .palco{width:1080px;height:1080px;background:${FUNDO};display:flex;flex-direction:column;
               align-items:center;justify-content:center;gap:8px;font-family:'DM Sans',system-ui,sans-serif}
        .mascote{width:430px;height:430px}
        .mascote svg{width:100%;height:100%}
        .nome{margin:26px 0 0;font-size:104px;font-weight:700;color:#F1F2F4;letter-spacing:-.04em;line-height:1}
        .sub{margin:0;font-size:34px;font-weight:400;color:${CIANO};letter-spacing:.01em}
      </style>`,
  },
  {
    id: "fundo-vertical",
    titulo: "Fundo vertical do canal (1080x1920)",
    w: 1080, h: 1920,
    html: () => `
      <div class="palco"><div class="brilho"></div></div>
      <style>
        .palco{width:1080px;height:1920px;background:${FUNDO};position:relative;overflow:hidden}
        .brilho{position:absolute;inset:0;
          background:radial-gradient(1100px 760px at 50% 18%, ${INDIGO}26 0%, transparent 62%),
                     radial-gradient(760px 620px at 82% 88%, ${CIANO}14 0%, transparent 66%)}
      </style>`,
  },
];

async function main() {
  const svg = await readFile(POLVO, "utf8");
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const peca of PECAS) {
      const page = await browser.newPage({
        viewport: { width: peca.w, height: peca.h },
        deviceScaleFactor: 1,
      });
      await page.setContent(
        `<body style="margin:0;background:${FUNDO}">${peca.html(svg)}</body>`,
        { waitUntil: "networkidle" }, // networkidle: espera a DM Sans do Google chegar
      );
      await page.waitForTimeout(400);
      const arquivo = path.join(OUT, `${peca.id}.png`);
      await page.screenshot({ path: arquivo });
      await page.close();
      console.log(`✓ ${peca.id.padEnd(18)} ${peca.titulo}`);
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${PECAS.length} peças em ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
