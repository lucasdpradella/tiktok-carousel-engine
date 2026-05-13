# MANUAL-DEPLOY — colocar a engine no ar

> Sequência cronometrada. Tempo total estimado: **30–45 min** (sem contar tempo de audit do TikTok). Marque cada checkbox conforme avança.

**Pré-requisitos que você já tem:** n8n, GitHub, Supabase, Vercel, Cowork.

---

## Passo 1 · TikTok for Developers (5 min, faz primeiro porque audit demora)

- [ ] Abrir https://developers.tiktok.com → Login com sua conta TikTok
- [ ] Manage Apps → Connect an app → criar app `tiktok-carousel-engine`
- [ ] Em **Add Products**, adicionar **Login Kit** + **Content Posting API**
- [ ] Em Content Posting API → **Direct Post** (não Inbox), marcar Photo Post
- [ ] Anotar `Client Key` e `Client Secret` no `.env`
- [ ] Em **App Review**, submeter pra audit (sem isso, posts ficam private/sandbox)
- [ ] Em **URL Properties**, adicionar o domínio que vai hospedar as fotos (ver passo 3)

> Audit do TikTok demora **1–3 semanas**. Por isso o passo 1 vai primeiro. Enquanto isso, use o **Workflow B (upload-post.com)** pra começar a postar real hoje.

---

## Passo 2 · Supabase (5 min)

- [ ] Em https://supabase.com → New Project → nome `tiktok-engine`, região São Paulo (`sa-east-1`)
- [ ] Anotar `SUPABASE_URL`, `service_role key` e `anon key` no `.env`
- [ ] Em **Storage** → criar bucket `carousels` → marcar como **Public**
- [ ] Em **SQL Editor** → colar o conteúdo de `supabase/migrations/0001_init.sql` → Run
- [ ] (Opcional) Em **Settings → API → Custom Domains**, configurar domínio próprio pra Storage (necessário pra TikTok aceitar URLs do bucket). Default `xxxx.supabase.co` também pode ser aceito após verificação.

---

## Passo 3 · Vercel — função @vercel/og (10 min)

- [ ] No GitHub, criar repo privado `tiktok-carousel-engine`
- [ ] Subir a pasta `engine/vercel/` como raiz do repo:
  ```bash
  cd "C:\Users\lucas\OneDrive\Área de Trabalho\Chave Mestre\Projetos\TIKTOK\engine\vercel"
  git init && git add . && git commit -m "init engine"
  git remote add origin git@github.com:lucasdpradella/tiktok-carousel-engine.git
  git push -u origin main
  ```
- [ ] Em https://vercel.com → Add New → Project → importar o repo
- [ ] **Framework Preset:** Next.js. Build/output: defaults.
- [ ] **Environment Variables** (Production + Preview):
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (read-only)
  - `VERCEL_RENDER_TOKEN` (gera uma string aleatória se quiser proteger o endpoint)
- [ ] Deploy. Anotar URL final no `.env` como `VERCEL_RENDER_URL`.
- [ ] **Testar:**
  ```
  https://SUA-URL.vercel.app/api/slide?template=financa-capa&titulo=Teste&corpo=Funcionando&bg=https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3
  ```
  Deve retornar PNG 1080×1350.
- [ ] **Verificar domínio Vercel no TikTok Developer** (`URL Properties` do passo 1) — necessário pra Path A.

---

## Passo 4 · Modelo de imagem (5 min, escolher 1)

- [ ] **Ideogram** (recomendado, ~US$ 0,04/img, melhor com texto): https://ideogram.ai/manage-api → criar API key
- [ ] **OU Flux via Replicate:** https://replicate.com → token API
- [ ] **OU fal.ai** (também Flux): https://fal.ai → key
- [ ] Setar `.env` correspondente

---

## Passo 5 · LLM (2 min)

- [ ] Setar `OPENAI_API_KEY` (recomendado: `gpt-4o-mini` pra baratear) **ou** `ANTHROPIC_API_KEY` (Claude Sonnet 4.6)
- [ ] No n8n, criar credencial correspondente

---

## Passo 6 · upload-post.com (5 min, fallback enquanto TikTok audit roda)

- [ ] https://upload-post.com → criar conta → adicionar profile `lucaspradella`
- [ ] Conectar TikTok dentro do upload-post (OAuth deles, não o seu app)
- [ ] Anotar `UPLOAD_POST_API_KEY` no `.env`

---

## Passo 7 · n8n — importar workflows (5 min)

- [ ] No n8n, **Import from File** → `engine/n8n/workflow-B-upload-post.json` (começa por esse)
- [ ] Em cada nó, configurar credenciais (OpenAI/Anthropic, Ideogram/Replicate, Supabase, upload-post)
- [ ] **Activate** o workflow
- [ ] Disparar **Execute Workflow** manualmente — verificar que:
  - LLM gerou roteiro de 7 slides
  - Imagens foram geradas no Supabase Storage
  - PNG composto renderizou via Vercel
  - upload-post recebeu o carrossel e enfileirou no TikTok

Quando audit do TikTok sair (passo 1):

- [ ] Importar `workflow-A-nativo.json`, configurar credenciais TikTok
- [ ] Desativar workflow B, ativar workflow A

---

## Passo 8 · Smoke test ponta a ponta (3 min)

- [ ] Inserir manualmente um tópico na tabela `topics` do Supabase:
  ```sql
  insert into topics (nicho, tema, prioridade) values ('financa', 'Como funciona o FII de papel vs tijolo', 1);
  ```
- [ ] Disparar o workflow no n8n com payload `{ "topic_id": 1 }`
- [ ] Conferir em `Supabase → Table Editor → carousels` que apareceu novo registro com status `posted`
- [ ] Conferir no TikTok que o carrossel chegou (em sandbox até audit aprovar)

---

## Sobre os templates antigos (financa-*.tsx, marca-*.tsx)

Eu deixei eles no repo como stubs vazios com aviso de DEPRECATED porque o filesystem do Cowork não permite delete via bash. **Apaga eles manualmente quando rodar `git init`:**

```bash
rm engine/vercel/lib/templates/financa-capa.tsx
rm engine/vercel/lib/templates/financa-corpo.tsx
rm engine/vercel/lib/templates/marca-capa.tsx
rm engine/vercel/lib/templates/marca-corpo.tsx
```

Os ativos hoje são: `pradex-capa`, `pradex-conceito`, `pradex-lista`, `pradex-quote`.

## Troubleshooting rápido

| Sintoma | Causa provável | Fix |
|---|---|---|
| `/api/slide` retorna 500 | Satori não suporta a CSS | Trocar `display: grid` por `flex` |
| Imagem do bg não carrega | URL não pública ou CORS | Mover pro Supabase Storage com bucket público |
| TikTok rejeita upload | Domínio não verificado | Verificar em `URL Properties` |
| upload-post pendura no `pending` | TikTok rate-limit | Limitar a 6 posts/dia/conta |
| LLM gera bobagem | System prompt fraco | Iterar em `prompts/financa.md` ou `prompts/marca-pessoal.md` |

---

## Quando tudo estiver verde

- Configura cron no n8n pra rodar 1×/dia às 09:00 BRT (horário bom de engajamento)
- Adiciona 30 tópicos em `topics` de uma vez pra ter um mês de runway
- Monitora `runs` no Supabase pra ver custo por post (token + image gen)
- Em 2 semanas, revisa quais carrosséis performaram melhor (precisa puxar métricas TikTok via Display API depois)
