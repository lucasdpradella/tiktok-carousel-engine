# tiktok-carousel-engine

> Engine pessoal do Lucas pra gerar, compor e publicar carrosséis no TikTok via IA, automaticamente. Nicho duplo: finanças/investimentos e marca pessoal.

**Stack:** n8n · Supabase · Vercel (@vercel/og) · OpenAI/Claude · Ideogram/Flux · TikTok Content Posting API · GitHub

## Arquitetura em uma frase

`n8n` agenda → LLM escreve roteiro → modelo de imagem gera backgrounds → Vercel renderiza slides finais → Supabase guarda URLs → TikTok publica (ou upload-post.com como fallback).

```
┌──────────────┐    ┌────────────┐    ┌────────────┐    ┌─────────────┐
│ n8n cron     │───▶│ OpenAI /   │───▶│ Ideogram / │───▶│ Vercel og   │
│ (1×/dia)     │    │ Claude     │    │ Flux       │    │ /api/slide  │
└──────────────┘    │ (roteiro)  │    │ (bg img)   │    │ (composição)│
                    └────────────┘    └────────────┘    └─────────────┘
                                                              │
                                                              ▼
┌──────────────┐    ┌────────────┐    ┌─────────────────────────────┐
│ TikTok       │◀───│ TikTok     │◀───│ Supabase Storage (público)  │
│ feed         │    │ Content    │    │ + Supabase Postgres (estado)│
│              │    │ Posting API│    └─────────────────────────────┘
└──────────────┘    └────────────┘
                    ↑ ou upload-post.com (Workflow B fallback)
```

## Estrutura

```
engine/
├── README.md                ← este arquivo
├── MANUAL-DEPLOY.md         ← passo a passo cronometrado de ~30 min
├── .env.example             ← variáveis necessárias
├── .gitignore
│
├── vercel/                  ← projeto Next.js minimal só com a função @vercel/og
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── pages/
│   │   ├── index.tsx
│   │   └── api/
│   │       ├── slide.tsx    ← endpoint principal (carrega fonts Google em runtime)
│   │       └── healthcheck.ts
│   └── lib/templates/
│       ├── pradex-capa.tsx       ← capa de série/módulo, número grande em itálico laranja
│       ├── pradex-conceito.tsx   ← reframe "ideia errada (riscada) → ideia certa"
│       ├── pradex-lista.tsx      ← 3 itens com badge + título + descrição
│       └── pradex-quote.tsx      ← frase de impacto comportamental (Kahneman, Munger, etc)
│
├── supabase/
│   └── migrations/
│       └── 0001_init.sql    ← schema completo + RLS
│
├── n8n/
│   ├── workflow-A-nativo.json       ← TikTok API direto
│   └── workflow-B-upload-post.json  ← via upload-post.com (fallback enquanto audit)
│
└── prompts/
    └── financas-comportamentais.md  ← system prompt + matriz de 10 ângulos + 30 temas seed
```

## Como começar

Abre `MANUAL-DEPLOY.md` e segue os 8 passos. Em ~30 min você está rodando.
