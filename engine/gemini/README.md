# engine/gemini — Engine Nano Banana

> Substitui a engine `../vercel/` (Satori). Gera 5 imagens editoriais por post, com tipografia overlay renderizada pela IA. Mantém o resto da infraestrutura intacto: **n8n + Supabase + upload-post.com**.

**Criada em:** 2026-05-12 (pivô estrutural — ver [`../vercel/_ARQUIVADO.md`](../vercel/_ARQUIVADO.md))
**Status:** estrutura pronta · billing em ativação · implementação Milestone 2 pendente
**Plano de custo:** 1 post/dia × 5 slides × ~$0.04 = **~$6/mês**

---

## Por que Gemini Nano Banana

A engine antiga (`@vercel/og` + Satori) compunha tipografia + foto-fundo em SVG/PNG. Bug irrecuperável de espaçamento em texto multi-estilo nos containers flex matou esse caminho. A nova engine inverte: a **IA gera a imagem editorial completa, COM tipografia overlay**, num único passo.

Vantagens concretas do Gemini Nano Banana (`gemini-2.5-flash-image` e família):

- **Texto na imagem sai correto** — modelo treinado pra renderizar caracteres sem alucinação de letra. Resolve a categoria toda de bugs do Satori.
- **Consistência entre slides** via image-to-image (passar slide 1 como referência pra gerar slide 2 no mesmo estilo).
- **API simples** — `POST /v1beta/models/{model}:generateContent` com `responseModalities: ["IMAGE"]`. Sem SDK, fetch nativo do Node 18+.
- **Custo baixo** — ~$0.04 / imagem 1024² no modelo estável.
- **Mesma família** já cobre o texto (`gemini-2.5-flash` no free tier) pro gerador de roteiro.

## Modelos disponíveis

| Model ID | Apelido | Custo / img | Qualidade | Quando usar |
|---|---|---|---|---|
| `gemini-2.5-flash-image` | Nano Banana | ~$0.04 | boa | **default** — estável, produção diária |
| `gemini-3.1-flash-image-preview` | Nano Banana 2 | ~$0.06 est. | melhor | testar quando sair de preview |
| `gemini-3-pro-image-preview` | Nano Banana Pro | ~$0.10+ est. | máxima | capas / posts âncora |

Política: começar 100% no `gemini-2.5-flash-image` (estável). Subir individualmente pra Pro só em slide que precisa de fidelidade extra (capas de série, por exemplo).

## Setup

1. Gerar chave em https://aistudio.google.com/app/apikey
2. Ativar billing no Google Cloud Console (https://console.cloud.google.com/billing) — sem isso o endpoint de imagem retorna `HTTP 429 limit=0`
3. Salvar em env var local:
   ```powershell
   $env:GEMINI_API_KEY = "AIzaSy..."
   ```
   ou em `.env` (ver `.env.example`)
4. Rodar smoke test (na raiz do projeto TIKTOK):
   ```powershell
   node scripts/smoke-gemini.mjs $env:GEMINI_API_KEY
   ```
   Espera-se: PNG salvo em `scripts/smoke-gemini-output.png` + JSON com `usageMetadata` no stdout.

## Estrutura

```
engine/gemini/
├── README.md                   # este arquivo
├── style-guide.md              # paleta, tipografia, composição, metáforas
├── .gitignore                  # node_modules, .env, *.png
├── .env.example                # GEMINI_API_KEY=AIzaSy...
├── package.json                # type: module, deps zero (fetch nativo)
├── prompts/
│   ├── system-roteirista.md    # system prompt do gerador de roteiro (texto)
│   ├── system-visual.md        # template combinando style-guide + slots por slide
│   └── financas-comportamentais.md   # voz Pradex (adaptado da engine antiga)
└── src/
    ├── gemini-client.mjs       # wrapper fetch (generateText, generateImage)
    ├── gerar-roteiro.mjs       # stub — TODO Milestone 2
    ├── gerar-imagem.mjs        # stub — TODO Milestone 2
    └── gerar-carrossel.mjs     # stub — TODO Milestone 2
```

## Fluxo end-to-end

```
[Supabase.topics] --claim_next_topic()-->  tópico (1 row)
       │
       ▼
[gerar-roteiro.mjs]  --Gemini 2.5 Flash (texto, free tier)-->
       └─→ { caption, slides: [{ texto_overlay, texto_meta, sujeito_visual } × 5] }
       │
       ▼
[gerar-imagem.mjs]   --Gemini 2.5 Flash Image × 5-->
       └─→ 5 PNGs (1024×1280, formato 4:5 TikTok)
       │
       ▼
[Supabase Storage]   --upload bucket `carousels`-->
       └─→ 5 URLs públicas
       │
       ▼
[n8n] --HTTP POST upload-post.com-->
       └─→ carousel publicado no TikTok como inbox/draft (sem audit ainda)
```

## Próximos passos / TODO

- [ ] Lucas: ativar billing no Google Cloud Console
- [ ] Rodar `scripts/smoke-gemini.mjs` e confirmar PNG gerado + custo registrado
- [ ] **Milestone 2** — implementar `src/gemini-client.mjs` (wrapper) + os 3 stubs (`gerar-roteiro`, `gerar-imagem`, `gerar-carrossel`)
- [ ] Adaptar `prompts/financas-comportamentais.md` pro novo formato (slides com `sujeito_visual` em vez de templates)
- [ ] Atualizar n8n: novo HTTP node pra Gemini + remover node Vercel `/api/slide`
- [ ] Decidir se vale colocar engine `gemini/` num repo git próprio ou apensar à raiz do projeto TIKTOK

## Ver também

- [`style-guide.md`](./style-guide.md) — direção de arte (paleta, tipografia, composição, metáforas)
- [`prompts/system-roteirista.md`](./prompts/system-roteirista.md) — system prompt do gerador de roteiro
- [`prompts/system-visual.md`](./prompts/system-visual.md) — template visual por slide
- [`../vercel/_ARQUIVADO.md`](../vercel/_ARQUIVADO.md) — postmortem da engine anterior
- [`../secrets-tracker.md`](../secrets-tracker.md) — credenciais (não committar)
