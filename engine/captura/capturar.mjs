// Captura as telas REAIS do PWA Pradex, em viewport de celular, contra a conta de
// demo. Alimenta a Fase 3 do canal @pradexapp: o MP4 entra como asset no Remotion,
// dentro de moldura de celular, com legenda e narracao por cima.
//
// Por que captura e nao IA generativa: modelo inventa interface — botao que nao
// existe, numero que nao bate. Demo de produto e tela real, sempre.
//
// 🔴 SO CONTRA A CONTA DE DEMO. Nunca a conta do Lucas, nunca dado de producao.
// Regra dura pos-incidente de 2026-06-01. O script nao le nada alem do que a
// sessao do demo enxerga, e nao escreve nada em lugar nenhum.
//
// Uso:
//   PDX_EMAIL=demo@pradex.com.br PDX_SENHA=... node capturar.mjs
//   PDX_EMAIL=... PDX_SENHA=... node capturar.mjs --cena=diagnostico
//
// Saida em out/: um PNG por cena + um WEBM da sessao inteira.

import { chromium } from "playwright";
import { mkdir, rm, readdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// A saida mora no PROJETO PRADEX, nao aqui. O codigo vive em C:\Dev (regra dura do
// vault: nada de repo dentro do OneDrive), mas as imagens sao entregavel do PRADEX e
// a casa delas e a pasta do projeto — senao o Lucas procura material do app dentro do
// repo de TikTok, que e o lugar errado.
const OUT = process.env.PDX_OUT || String.raw`C:\Users\lucas\OneDrive\Área de Trabalho\Chave Mestre\Projetos\PRADEX\capturas-app`;

const APP = process.env.PDX_APP || "https://pradex-financas.vercel.app";
const EMAIL = process.env.PDX_EMAIL;
const SENHA = process.env.PDX_SENHA;

// iPhone 14: e o aparelho que o recorte 9:16 do TikTok assume.
const VIEWPORT = { width: 390, height: 844 };

// Uma cena = uma tela que vira post. `abrir` recebe a page e deixa a tela pronta;
// `espera` e o tempo depois de abrir, pra animacao assentar antes do clique do obturador.
const CENAS = [
  {
    id: "dashboard",
    titulo: "Dashboard do mes",
    espera: 1200,
    abrir: async (p) => irPara(p, "Dashboard"),
  },
  {
    id: "lancar",
    titulo: "Lancar um gasto",
    espera: 900,
    abrir: async (p) => irPara(p, "Lançar"),
  },
  {
    id: "historico",
    titulo: "Historico de lancamentos",
    espera: 900,
    abrir: async (p) => irPara(p, "Histórico"),
  },
  {
    id: "teto",
    titulo: "Teto por categoria + score de disciplina",
    espera: 1200,
    abrir: async (p) => irPara(p, "Teto"),
  },
  {
    id: "fp-perfil",
    titulo: "Planejamento — Perfil",
    espera: 1000,
    abrir: async (p) => { await irPara(p, "Plan."); await irParaAba(p, "Perfil"); },
  },
  {
    id: "fp-objetivos",
    titulo: "Planejamento — Objetivos",
    espera: 900,
    abrir: async (p) => { await irPara(p, "Plan."); await irParaAba(p, "Objetivos"); },
  },
  {
    id: "fp-rendas",
    titulo: "Planejamento — Rendas e despesas",
    espera: 900,
    abrir: async (p) => { await irPara(p, "Plan."); await irParaAba(p, "Rendas"); },
  },
  {
    id: "fp-investimentos",
    titulo: "Planejamento — Investimentos",
    espera: 900,
    abrir: async (p) => { await irPara(p, "Plan."); await irParaAba(p, "Invest."); },
  },
  {
    id: "fp-bens",
    titulo: "Planejamento — Bens",
    espera: 900,
    abrir: async (p) => { await irPara(p, "Plan."); await irParaAba(p, "Bens"); },
  },
  {
    // A cena mais importante do canal: e a que responde "vai dar?" com numero na tela.
    // Espera maior porque o grafico do Chart.js anima na entrada.
    id: "diagnostico",
    titulo: "Diagnostico — a idade em que o dinheiro acaba",
    espera: 2500,
    abrir: async (p) => { await irPara(p, "Plan."); await irParaAba(p, "Diagnóstico"); },
  },
];

async function irPara(page, label) {
  // O menu do mobile e um botao com o rotulo literal. `getByRole` evita casar com
  // texto solto no corpo da pagina que por acaso diga a mesma coisa.
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(400);
}

async function irParaAba(page, label) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(400);
}

async function entrar(page) {
  await page.goto(APP, { waitUntil: "domcontentloaded" });

  // Desde o PR #64 a raiz e pagina de vendas com o formulario dentro. O campo de
  // e-mail so existe depois que o React monta — o HTML da raiz e conteudo pra robo.
  await page.getByPlaceholder("Email").waitFor({ state: "visible", timeout: 30000 });
  await page.getByPlaceholder("Email").fill(EMAIL);
  await page.getByPlaceholder("Senha").fill(SENHA);
  // Ha DOIS "Entrar" na tela: a aba do alternador (Entrar | Criar conta) e o botao
  // que submete. O de submeter e o ultimo — clicar no primeiro so reafirma a aba.
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click();

  // O app carrega quando o menu aparece. Nao basta o botao sumir: a sessao ainda
  // busca perfil, plano e lancamentos antes da tela ficar apresentavel.
  await page.getByRole("button", { name: "Dashboard", exact: true }).first()
    .waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(2000);
}

async function main() {
  if (!EMAIL || !SENHA) {
    console.error("Faltou PDX_EMAIL e/ou PDX_SENHA no ambiente.");
    console.error("Ex: PDX_EMAIL=demo@pradex.com.br PDX_SENHA=... node capturar.mjs");
    process.exit(1);
  }

  const filtro = process.argv.find((a) => a.startsWith("--cena="))?.split("=")[1];
  const cenas = filtro ? CENAS.filter((c) => c.id === filtro) : CENAS;
  if (!cenas.length) {
    console.error(`Cena "${filtro}" nao existe. Disponiveis: ${CENAS.map((c) => c.id).join(", ")}`);
    process.exit(1);
  }

  // So limpa em captura COMPLETA. Com --cena=X, apagar a pasta levaria junto as
  // outras nove capturas — recapturar uma cena nao pode custar as demais.
  if (!filtro && existsSync(OUT)) await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 3, // retina: o PNG sai em 1170x2532 e aguenta o 1080 do Remotion
    isMobile: true,
    hasTouch: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: "dark",
    recordVideo: { dir: OUT, size: VIEWPORT },
  });

  const page = await context.newPage();
  let falhas = 0;

  try {
    console.log(`→ entrando em ${APP} como ${EMAIL}`);
    await entrar(page);
    console.log("✓ logado\n");

    for (const cena of cenas) {
      try {
        await cena.abrir(page);
        await page.waitForTimeout(cena.espera);
        const arquivo = path.join(OUT, `${cena.id}.png`);
        await page.screenshot({ path: arquivo });
        console.log(`✓ ${cena.id.padEnd(20)} ${cena.titulo}`);
      } catch (e) {
        falhas++;
        console.log(`✗ ${cena.id.padEnd(20)} ${e.message.split("\n")[0]}`);
      }
    }
  } finally {
    // O video so e escrito no close do contexto — fechar o browser antes o perde.
    await context.close();
    await browser.close();
  }

  // O Playwright nomeia o video com um hash. Renomeia pra algo que se ache depois.
  const videos = (await readdir(OUT)).filter((f) => f.endsWith(".webm"));
  if (videos[0]) {
    await rename(path.join(OUT, videos[0]), path.join(OUT, "sessao.webm"));
  }

  console.log(`\n${cenas.length - falhas}/${cenas.length} cenas capturadas em ${OUT}`);
  if (falhas) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
