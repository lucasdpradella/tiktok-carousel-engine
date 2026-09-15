// Monta os quadros do dorama que NÃO precisam de geração: fundo chapado + polvo + tipo.
//
// São 6 dos 40 quadros do storyboard. Pedir esses ao modelo seria pagar geração pra
// receber um fundo de cor sólida — e ainda correr o risco de ele redesenhar o polvo.
// Aqui saem exatos, de graça, e o mascote é o PNG oficial.
//
// Uso:
//   node render-quadros-chapados.mjs

import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const MARCA = String.raw`C:\Users\lucas\OneDrive\Área de Trabalho\Chave Mestre\Projetos\PRADEX\marca`;
const PACK = path.join(MARCA, "polvo-pack");
const OUT = process.env.PDX_OUT || String.raw`C:\Users\lucas\OneDrive\Área de Trabalho\Chave Mestre\Projetos\PRADEX\dorama-quadros`;

const FUNDO = "#0C0E14";
const TEXTO = "#F1F2F4";

// 1080×1920 é o nativo do TikTok. Os quadros gerados pelo modelo entram na mesma
// grade, então tudo compõe sem reescala.
const W = 1080, H = 1920;

// O PNG entra como data URI, não como file://. `setContent` dá à página a origem
// `about:blank`, e daí o Chromium BLOQUEIA subrecurso file:// — a imagem sai quebrada
// e o quadro renderiza com o retângulo vazio, sem erro nenhum no console.
const cache = new Map();
async function polvo(arquivo) {
  if (!cache.has(arquivo)) {
    const b64 = (await readFile(path.join(PACK, arquivo))).toString("base64");
    cache.set(arquivo, `data:image/png;base64,${b64}`);
  }
  return cache.get(arquivo);
}

const QUADROS = [
  {
    id: "01.1_gancho",
    dur: "2.0s",
    nota: "EP01 — gancho",
    linhas: ["Naquela sexta,", "ele jurou que era só hoje."],
    mascote: { arquivo: "polvo_terco_700.png", largura: 620, bottom: 210, left: "50%" },
    textoTop: 420,
  },
  {
    id: "02.7_tres_vezes",
    dur: "3.0s",
    nota: "EP02 — close do rosto, o quadro de maior risco do storyboard",
    linhas: ["3×"],
    mascote: { arquivo: "polvo_rosto-close_1200.png", largura: 1080, bottom: 560, left: "50%" },
    textoTop: 1420,
    tamanhoTexto: 190,
  },
  {
    id: "03.1_gancho",
    dur: "2.0s",
    nota: "EP03 — gancho",
    linhas: ["Tinha uma tela no app", "que ele nunca tinha aberto."],
    mascote: { arquivo: "polvo_canto_400.png", largura: 360, bottom: 150, left: "72%" },
    textoTop: 430,
  },
  {
    id: "03.8_gentil",
    dur: "3.0s",
    nota: "EP03 — fecho",
    linhas: ["Foi a coisa mais gentil", "que o app já tinha dito."],
    mascote: { arquivo: "polvo_centro_1000.png", largura: 700, bottom: 380, left: "50%" },
    textoTop: 330,
  },
  {
    id: "05.1_gancho",
    dur: "2.0s",
    nota: "EP05 — gancho",
    linhas: ["Ele fez a conta", "que vinha evitando há dois anos."],
    mascote: { arquivo: "polvo_terco_700.png", largura: 560, bottom: 190, left: "50%" },
    textoTop: 430,
  },
  {
    id: "05.6_menos_que_delivery",
    dur: "3.0s",
    nota: "EP05 — a virada",
    linhas: ["R$ 125 por mês.", "Menos do que o delivery."],
    mascote: { arquivo: "polvo_terco_700.png", largura: 560, bottom: 190, left: "50%" },
    textoTop: 430,
  },
];

const html = (q, src) => `
  <div class="palco">
    <p class="txt">${q.linhas.map((l) => `<span>${l}</span>`).join("")}</p>
    <img class="mascote" src="${src}">
  </div>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
    .palco{width:${W}px;height:${H}px;background:${FUNDO};position:relative;overflow:hidden;
           font-family:'DM Sans',system-ui,sans-serif}
    .txt{position:absolute;top:${q.textoTop}px;left:0;right:0;margin:0;padding:0 96px;
         text-align:center;color:${TEXTO};font-size:${q.tamanhoTexto || 68}px;font-weight:500;
         line-height:1.28;letter-spacing:-0.02em}
    .txt span{display:block}
    /* translateX(-50%) com left em %: centra sem depender da largura da imagem */
    .mascote{position:absolute;bottom:${q.mascote.bottom}px;left:${q.mascote.left};
             transform:translateX(-50%);width:${q.mascote.largura}px;height:auto}
  </style>`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });

  try {
    for (const q of QUADROS) {
      // networkidle: espera a DM Sans do Google e o PNG do pack carregarem. Sem isso
      // o quadro sai em fonte de fallback e o kerning muda.
      const src = await polvo(q.mascote.arquivo);
      await page.setContent(`<body style="margin:0;background:${FUNDO}">${html(q, src)}</body>`,
        { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      const arquivo = path.join(OUT, `${q.id}.png`);
      await page.screenshot({ path: arquivo });
      console.log(`✓ ${q.id.padEnd(28)} ${q.dur.padEnd(6)} ${q.nota}`);
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${QUADROS.length} quadros em ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
