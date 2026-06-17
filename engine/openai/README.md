# engine/openai — Engine OpenAI (ATIVA)

> Engine de produção do projeto TIKTOK. Gera as imagens editoriais Pradex por post, com tipografia overlay determinística (templates Python). Roda 100% dentro do GitHub Actions a custo zero: a fila de temas e a numeração de capítulo vivem versionadas em `data/temas.json` + `data/estado.json` (sem Supabase desde 2026-06-17).

**Criada em:** 2026-05-13 (pivô Gemini → OpenAI — billing Google travou)
**Status:** estrutura completa + smoke test individual `gpt-image-1` OK · smoke test carrossel pendente run pelo Lucas
**Plano de custo:** 1 post/dia × 5 slides × ~$0.04 (medium) + ~500 tokens de roteiro = **~$6.50/mês**

---

## Por que OpenAI (e não Gemini)

A engine `engine/gemini/` foi escolhida em 2026-05-12 como pivô da `engine/vercel/` (Satori). Estrutura ficou pronta (style-guide, prompts, gemini-client.mjs), mas o billing do Google Cloud não passou: CPF do Lucas ficou preso em fraud-detection paranoica do Google Pay, repetidas tentativas falharam. **Como o endpoint de imagem da Gemini retorna `HTTP 429 limit=0` sem billing ativo, nenhuma imagem chegou a ser gerada via Nano Banana.**

Decisão em 2026-05-13: trocar provedor pra OpenAI. Billing pré-pago de $10 passou tranquilo, smoke test do `gpt-image-1` retornou PNG 2.6MB no estilo editorial Pradex em ~20s.

A pasta `engine/gemini/` **permanece como referência arquivada**. Não usar em produção.

## Modelos usados

| Model ID | Função | Custo aproximado |
|---|---|---|
| `gpt-image-1` | imagem (1024×1536 portrait, qualidade `medium`) | ~$0.04 / imagem (`medium`), ~$0.08 (`high`) |
| `gpt-4o-mini` | texto (roteiro JSON estruturado) | $0.15 / 1M tokens input, $0.60 / 1M tokens output |

Política: rodar 100% no `medium` em produção diária. Subir pra `high` só em capa de série ou post âncora que pede fidelidade visual extra.

## Setup

1. Salvar a chave OpenAI (já em `engine/secrets-tracker.md`) numa env var local:
   ```powershell
   $env:OPENAI_API_KEY = "sk-proj-..."
   ```
   ou em `.env` (ver `.env.example`).
2. Conferir que o `process.version` é Node 18+ (`fetch` nativo).
3. Rodar smoke test do carrossel completo (5 slides):
   ```powershell
   cd "C:\Users\lucas\OneDrive\Área de Trabalho\Chave Mestre\Projetos\TIKTOK\scripts"
   node smoke-carrossel.mjs $env:OPENAI_API_KEY
   ```
   Espera-se: 5 PNGs + `roteiro.json` salvos em `engine/openai/outputs/carrossel-{timestamp}/`. Custo ~$0.20.

## Estrutura

```
engine/openai/
├── README.md                   # este arquivo
├── style-guide.md              # paleta, tipografia, composição, metáforas (cópia adaptada da gemini)
├── .gitignore                  # node_modules, .env, *.png, outputs/
├── .env.example                # OPENAI_API_KEY=sk-proj-...
├── package.json                # type: module, deps zero (fetch nativo)
├── prompts/
│   ├── system-roteirista.md          # system prompt do gerador de roteiro (gpt-4o-mini)
│   ├── system-visual.md              # template completo pra gpt-image-1
│   └── financas-comportamentais.md   # voz Pradex + biblioteca de ângulos e temas seed
└── src/
    ├── openai-client.mjs       # wrapper fetch nativo (chat + image)
    ├── gerar-roteiro.mjs       # tópico → JSON estruturado de carrossel
    ├── gerar-imagem.mjs        # prompt visual → PNG buffer
    └── gerar-carrossel.mjs     # orquestrador (paraleliza 5 imagens)
```

## Fluxo end-to-end

```
tópico (string)
   │
   ▼
[gerar-roteiro.mjs]  --gpt-4o-mini, response_format: json_object-->
   └─→ { caption, hashtags[], slides: [{ ordem, texto_overlay, texto_meta, sujeito_visual } × 5] }
   │
   ▼
[gerar-imagem.mjs × 5 em paralelo]   --gpt-image-1, size 1024x1536, quality medium-->
   └─→ 5 PNGs (portrait 2:3, ~500KB-2.6MB cada)
   │
   ▼
[gerar-carrossel.mjs]   --escreve PNGs + roteiro.json em outputs/-->
   └─→ { caption, hashtags, slidePaths[5] }
```

## Fila de temas + numeração de capítulo (sem Supabase)

Desde 2026-06-17 a engine não fala mais com o Supabase. A fila e a numeração
vivem em dois arquivos versionados em `data/`:

- **`data/temas.json`** — array ordenado dos temas que faltam publicar, na ordem de publicação.
  Cada item: `{ tema, angulo, serie, ordem_serie, notas }`. `tema` → `opts.topico`, `angulo` → `opts.angulo`.
- **`data/estado.json`** — `{ indice_atual, capitulo_offset, total_capitulos }`.
  - Próximo post = `temas[indice_atual]`.
  - Número do capítulo = `capitulo_offset + indice_atual`.

O `src/run-completo.mjs` lê esses arquivos, gera o carrossel e (em `DRY_RUN`, modo manual
de hoje) deixa o artifact **sem** avançar o índice. Depois de postar manualmente, o Lucas
roda `npm run avancar` (incrementa `indice_atual`, regrava `estado.json`) + commit.

Próximas integrações (fora da engine):

- Publicação no TikTok via upload-post.com / Content Posting API (Fase 4, pós-audit)

## Ver também

- [`style-guide.md`](./style-guide.md) — direção de arte (paleta, tipografia, composição, metáforas)
- [`prompts/system-roteirista.md`](./prompts/system-roteirista.md) — system prompt do gerador de roteiro
- [`prompts/system-visual.md`](./prompts/system-visual.md) — template visual por slide
- [`../secrets-tracker.md`](../secrets-tracker.md) — credenciais (não committar)
- [`../gemini/README.md`](../gemini/README.md) — engine pivô anterior (arquivada)
- [`../../scripts/smoke-openai.mjs`](../../scripts/smoke-openai.mjs) — smoke test 1 imagem
- [`../../scripts/smoke-carrossel.mjs`](../../scripts/smoke-carrossel.mjs) — smoke test 5 slides
