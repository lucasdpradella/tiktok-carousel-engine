# EXECUÇÃO — passo a passo orquestrado por Cowork + Claude in Chrome

> Diferente do `MANUAL-DEPLOY.md` (que é o "se eu fizesse tudo sozinho"), este documento é o plano executado **a 6 mãos**: Cowork (arquivos no PC), Claude in Chrome (navegador), Lucas (decisões e OAuth/2FA).

**Tempo total ativo:** ~40 min (não conta espera passiva do audit TikTok)
**Última atualização:** 2026-05-12

## Decisões já tomadas

- n8n: **n8n Cloud** (app.n8n.cloud)
- upload-post.com: **trial gratuito** primeiro; revisitar pagamento quando esgotar
- Padrão visual: **Pradex Manual do Dinheiro** (creme + laranja-tijolo, 4 templates)
- Nicho: **finanças comportamentais** (10 ângulos rotacionados)
- TikTok Dev: status desconhecido, Chrome vai abrir e checar

## Quem faz o quê

| Ator | Faz |
|---|---|
| **Cowork** (Claude desktop) | Escreve/edita arquivos locais, roda bash, gera tokens aleatórios, lê secrets do tracker |
| **Claude in Chrome** | Navega painéis web (Supabase, Vercel, GitHub, TikTok Dev, n8n Cloud, upload-post), preenche formulários, copia chaves |
| **Lucas** | OAuth (autoriza apps com tua conta), 2FA, decisões de plano/região, criar repo no GitHub (1 clique) |

## Pré-execução · Cowork (eu rodo, ~2 min)

- [ ] Apagar de verdade os 4 stubs DEPRECATED em `vercel/lib/templates/` (uso o tool de delete que tem permissão diferente do bash)
- [ ] Criar `engine/secrets-tracker.md` com placeholders pra todos os valores que vamos coletar
- [ ] Gerar `VERCEL_RENDER_TOKEN` aleatório e salvar no tracker
- [ ] Validar que `package.json` aponta versões corretas
- [ ] `git init` + primeiro commit em `engine/vercel/` (deixo o repo local pronto, falta só o `git remote add` na Fase 3)

## Fase 1 · TikTok for Developers (Chrome + Lucas, ~5 min ativos)

**Por que primeiro:** audit demora 1-3 semanas; deixa rodando em paralelo enquanto fazemos o resto.

- [ ] Chrome abre https://developers.tiktok.com
- [ ] Lucas: confirma se já tem conta (visualizamos juntos). Se não: criar com login TikTok (precisa do 2FA do app)
- [ ] Chrome: **Manage Apps → Connect an app** → nome `tiktok-carousel-engine`
- [ ] Chrome: **Add Products** → Login Kit + Content Posting API
- [ ] Chrome: Content Posting API → marcar **Direct Post + Photo Post**
- [ ] Chrome: configurar Redirect URI = `https://tiktok-carousel-engine.vercel.app/api/oauth/callback` (vai existir depois, podemos deixar placeholder)
- [ ] Chrome: anota Client Key + Client Secret no tracker
- [ ] Chrome: **App Review** → submeter audit
- [ ] Chrome: em **URL Properties**, adicionar `tiktok-carousel-engine.vercel.app` (vamos verificar depois do deploy)

**Verificação:** app aparece em "Manage Apps" com status "Under Review". Client Key + Secret salvos no tracker.

## Fase 2 · Supabase (Chrome + Lucas, ~6 min)

- [ ] Chrome abre https://supabase.com → login
- [ ] Chrome: **New Project**. Lucas escolhe: região (sugiro `sa-east-1` São Paulo) e senha do banco (Lucas inventa, salvo no tracker)
- [ ] Chrome: aguarda provisionamento (~2 min) — Lucas pode fazer outra coisa
- [ ] Chrome: copia `Project URL`, `anon key`, `service_role key` pro tracker
- [ ] Chrome: **SQL Editor** → New query → cola conteúdo de `engine/supabase/migrations/0001_init.sql` → Run
- [ ] Chrome: confirma que apareceram 5 tabelas + 30 topics seed
- [ ] Chrome: **Storage → New bucket** → nome `carousels` → **Public ✓** → criar

**Verificação:** Lucas confere que vê as 30 linhas em `Table Editor → topics`.

## Fase 3 · GitHub (Lucas 1 clique + Cowork ~2 min)

- [ ] Lucas: abre https://github.com/new, cria repo **privado** `tiktok-carousel-engine`, NÃO marca "add README/gitignore", cria.
- [ ] Lucas cola pra mim a URL SSH do repo (ex: `git@github.com:lucasdpradella/tiktok-carousel-engine.git`)
- [ ] Cowork: roda `git remote add origin <URL>` + `git push -u origin main` na pasta `engine/vercel/`

**Verificação:** Cowork confirma push. Lucas vê os arquivos no GitHub web.

## Fase 4 · Vercel (Chrome + Lucas, ~6 min)

- [ ] Chrome abre https://vercel.com/new
- [ ] Chrome: **Import Git Repository** → seleciona `tiktok-carousel-engine`
- [ ] Chrome: framework = Next.js, root = `/`, build = default
- [ ] Chrome: **Environment Variables** — adiciona (lendo do tracker):
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `VERCEL_RENDER_TOKEN` (gerado por mim na Pré-execução)
- [ ] Chrome: **Deploy** → aguarda (~2 min)
- [ ] Chrome: copia URL final pro tracker (ex: `tiktok-carousel-engine-xxx.vercel.app`)
- [ ] Chrome: testa `/api/healthcheck` (deve retornar `{ok: true}`)
- [ ] Chrome: testa `/api/slide?template=pradex-capa&numero=01&titulo=Antes+de+investir+~organize-se~&moduloLabel=MÓDULO+01&moduloTitulo=Organização+Financeira&moduloDescricao=Teste&token=<TOKEN>` — deve baixar PNG 1080×1920

**Verificação:** Lucas abre o PNG e confirma que tá no padrão Pradex (creme, frame, laranja).

**Se algo destoar** das referências: a gente itera nos templates `.tsx` aqui antes de seguir. Cowork edita, push, Vercel redeploy automático, retesta.

## Fase 5 · upload-post.com (Chrome + Lucas, ~5 min)

- [ ] Chrome abre https://upload-post.com → Sign up (free trial)
- [ ] Lucas: confirma email (1 clique no Gmail)
- [ ] Chrome: cria profile `lucaspradella`
- [ ] Chrome: clica **Connect TikTok** → abre popup OAuth
- [ ] **Lucas**: aprova o OAuth com tua conta TikTok (essa parte é tua porque é tua conta pessoal)
- [ ] Chrome: copia API key pro tracker
- [ ] Chrome: verifica se o trial cobre photo carousel (anota no tracker o limite)

**Verificação:** upload-post mostra TikTok conectado e profile ativo.

## Fase 6 · LLM (~2 min, depende de qual API key Lucas já tem)

- [ ] Lucas: confere se já tem `OPENAI_API_KEY` ou `ANTHROPIC_API_KEY` ativa
- [ ] Se não tiver: Chrome cria em platform.openai.com (cartão de crédito necessário — Lucas decide)
- [ ] Salva no tracker

## Fase 7 · n8n Cloud (Chrome + Lucas, ~8 min)

- [ ] Chrome abre https://app.n8n.cloud → login Lucas
- [ ] Chrome: **Credentials → New** → criar 3 credenciais:
  - **Postgres** (Supabase): host = `db.<id>.supabase.co`, port `5432`, db `postgres`, user `postgres`, password = a do tracker, SSL = require
  - **OpenAI** (ou Anthropic): API key do tracker
  - **HTTP Header Auth** (upload-post): name = `Authorization`, value = `Bearer <UPLOAD_POST_API_KEY>`
- [ ] Chrome: **Variables** → adicionar variáveis de ambiente (n8n Cloud aceita): `SUPABASE_URL`, `UPLOAD_POST_API_KEY`, `UPLOAD_POST_PROFILE`, `VERCEL_RENDER_URL`, `VERCEL_RENDER_TOKEN`
- [ ] Chrome: **Workflows → Import from File** → seleciona `engine/n8n/workflow-B-upload-post.json`
- [ ] Chrome: percorre cada node Postgres/OpenAI/HTTP e seleciona a credencial criada
- [ ] Chrome: **Save** (não ativa ainda — vamos rodar manual no smoke test)

**Verificação:** workflow aparece na lista, sem erros vermelhos em nenhum nó.

## Fase 8 · Smoke test (Cowork + Chrome + Lucas, ~4 min)

- [ ] Cowork: via Supabase SQL Editor (ou direto pelo Postgres do n8n) inserir 1 topic de teste:
  ```sql
  insert into topics (nicho, tema, angulo, prioridade, serie, ordem_serie, status)
  values ('financas-comportamentais', 'Reserva = gastos fixos × 6, não renda × 6', 'A', 1, 'MANUAL DO DINHEIRO', 'CAP. 03', 'pending');
  ```
- [ ] Chrome: no n8n, abre Workflow B → **Execute Workflow** (manual)
- [ ] Chrome: acompanha execução nó a nó
- [ ] Cowork: se erro, leio o stacktrace e proponho fix
- [ ] Se sucesso: Chrome abre Supabase → `carousels` → confirma linha com `status = 'posted'`
- [ ] Lucas: abre TikTok app/web → vê o carrossel postado (modo privado até audit TikTok aprovar)

**Se passar:** Chrome ativa o cron do workflow (cron já configurado pra 09:00 BRT). Daqui pra frente posta sozinho.

**Se falhar:** debug iterativo. Os pontos mais comuns de falha: credencial Postgres (SSL/senha), JSON do LLM fora do schema, URL de imagem inacessível.

## Pós-deploy (Lucas)

- [ ] Aguarda audit TikTok (1-3 semanas)
- [ ] Quando aprovar: Chrome importa `workflow-A-nativo.json`, configura credenciais TikTok, troca privacy_level pra `PUBLIC_TO_EVERYONE`, ativa A e desativa B
- [ ] Em 4 semanas: revisar métricas e ângulos que performaram melhor

## Pontos onde EU PRECISO de você (resumo)

1. **Fase 1**: confirmar 2FA TikTok Dev
2. **Fase 2**: escolher região + senha banco Supabase
3. **Fase 3**: criar repo GitHub vazio (1 clique) + colar URL
4. **Fase 4**: revisar primeiro slide renderizado e aprovar visual
5. **Fase 5**: aprovar OAuth TikTok no upload-post
6. **Fase 6**: decidir provedor de LLM se ainda não tiver
7. **Fase 7**: confirmar login n8n Cloud
8. **Fase 8**: ver o post no TikTok e dar GO pra ativar o cron

Tudo entre esses pontos é Chrome trabalhando sozinho, eu monitorando.
