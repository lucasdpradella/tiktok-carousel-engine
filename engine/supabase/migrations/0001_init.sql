-- ─────────────────────────────────────────────────────────────
-- tiktok-carousel-engine — schema inicial
-- Rodar no SQL Editor do Supabase. Idempotente.
-- ─────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ── Tópicos: backlog do que postar ─────────────────────────────
create table if not exists topics (
  id            bigserial primary key,
  nicho         text not null check (nicho in ('financas-comportamentais', 'marca-pessoal')),
  tema          text not null,
  angulo        text,                          -- A..J (ver prompts/financas-comportamentais.md)
  prioridade    int default 5,                 -- 1 = mais urgente
  status        text not null default 'pending'
                check (status in ('pending', 'in_progress', 'done', 'skipped')),
  notas         text,
  serie         text default 'MANUAL DO DINHEIRO',
  ordem_serie   text,                          -- "CAP. 03" | "MÓDULO 01"
  created_at    timestamptz not null default now(),
  used_at       timestamptz
);

create index if not exists idx_topics_nicho_angulo
  on topics (nicho, angulo);

create index if not exists idx_topics_status_prioridade
  on topics (status, prioridade) where status = 'pending';

-- ── Carrosséis gerados ─────────────────────────────────────────
create table if not exists carousels (
  id            uuid primary key default uuid_generate_v4(),
  topic_id      bigint references topics(id) on delete set null,
  nicho         text not null,
  titulo        text not null,
  caption       text not null,                 -- copy do post no TikTok
  hashtags      text[] default '{}',
  status        text not null default 'drafting'
                check (status in ('drafting', 'rendering', 'ready', 'posting',
                                  'posted', 'failed', 'aborted')),
  llm_model     text,                          -- "gpt-4o-mini" | "claude-sonnet-4-6"
  image_model   text,                          -- "ideogram-v3" | "flux-1.1-pro"
  total_cost_usd numeric(10,4) default 0,
  tiktok_post_id text,                         -- id retornado pela API após publicação
  tiktok_url    text,
  created_at    timestamptz not null default now(),
  posted_at     timestamptz,
  error         text
);

create index if not exists idx_carousels_status on carousels (status);
create index if not exists idx_carousels_nicho_created on carousels (nicho, created_at desc);

-- ── Slides individuais ─────────────────────────────────────────
create table if not exists slides (
  id            uuid primary key default uuid_generate_v4(),
  carousel_id   uuid not null references carousels(id) on delete cascade,
  ordem         int not null,                  -- 1..N
  template      text not null,                 -- "financa-capa" | "financa-corpo" | ...
  titulo        text not null,
  corpo         text,
  bg_prompt     text,                          -- prompt usado pro modelo de imagem
  bg_url        text,                          -- URL no Supabase Storage do bg gerado
  composed_url  text,                          -- URL final (Vercel og) no Storage
  unique (carousel_id, ordem)
);

create index if not exists idx_slides_carousel on slides (carousel_id, ordem);

-- ── Posts (uma linha por tentativa de publicação) ─────────────
create table if not exists posts (
  id            bigserial primary key,
  carousel_id   uuid not null references carousels(id) on delete cascade,
  via           text not null check (via in ('tiktok-direct', 'upload-post', 'postiz')),
  request_id    text,
  status        text not null default 'pending'
                check (status in ('pending', 'queued', 'published', 'failed')),
  response_raw  jsonb,
  error         text,
  attempt       int not null default 1,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index if not exists idx_posts_carousel on posts (carousel_id, attempt desc);

-- ── Runs (execução do workflow n8n, pra observabilidade) ──────
create table if not exists runs (
  id            bigserial primary key,
  workflow      text not null,                 -- "A-nativo" | "B-upload-post"
  carousel_id   uuid references carousels(id) on delete set null,
  status        text not null
                check (status in ('started', 'success', 'partial', 'failed')),
  duration_ms   int,
  llm_tokens_in int default 0,
  llm_tokens_out int default 0,
  image_count   int default 0,
  cost_usd      numeric(10,4) default 0,
  payload       jsonb,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index if not exists idx_runs_started on runs (started_at desc);

-- ── RLS: por enquanto single-tenant (você), service_role escreve, anon só lê posted ──
alter table topics    enable row level security;
alter table carousels enable row level security;
alter table slides    enable row level security;
alter table posts     enable row level security;
alter table runs      enable row level security;

-- service_role bypassa RLS naturalmente. Pra leitura anônima dos posted:
drop policy if exists "anon read posted carousels" on carousels;
create policy "anon read posted carousels"
  on carousels for select
  to anon
  using (status = 'posted');

drop policy if exists "anon read slides of posted" on slides;
create policy "anon read slides of posted"
  on slides for select
  to anon
  using (exists (
    select 1 from carousels c
    where c.id = slides.carousel_id and c.status = 'posted'
  ));

-- ── Função helper: pegar próximo tópico pendente e marcar como in_progress ──
create or replace function claim_next_topic(p_nicho text default null)
returns topics
language plpgsql
as $$
declare
  t topics;
begin
  select * into t from topics
   where status = 'pending'
     and (p_nicho is null or nicho = p_nicho)
   order by prioridade asc, created_at asc
   limit 1
   for update skip locked;

  if t.id is null then
    return null;
  end if;

  update topics set status = 'in_progress', used_at = now() where id = t.id;
  return t;
end;
$$;

-- ── Seed: 30 temas variados de finanças comportamentais ──────
-- Coluna angulo aceita: A (reframe), B (lista), C (vies-nomeado), D (caso),
--                       E (pergunta-provocativa), F (mitos), G (comparativo),
--                       H (checklist), I (quote), J (reflexao)
-- Variação é regra: n8n não repete os 3 últimos ângulos usados.

insert into topics (nicho, tema, angulo, prioridade, serie, ordem_serie, notas) values
  ('financas-comportamentais', 'Reserva = gastos fixos × 6, não renda × 6', 'A', 1, 'MANUAL DO DINHEIRO', 'CAP. 03', 'Reframe clássico, alta resposta esperada'),
  ('financas-comportamentais', 'Loss aversion: por que você segura ação ruim e vende a boa', 'C', 2, 'MANUAL DO DINHEIRO', 'CAP. 04', 'Citar Kahneman'),
  ('financas-comportamentais', 'Os 3 erros mais comuns na reserva de emergência', 'B', 3, 'MANUAL DO DINHEIRO', 'CAP. 03', NULL),
  ('financas-comportamentais', 'Ancoragem: o "preço justo" é uma ilusão', 'C', 4, 'MANUAL DO DINHEIRO', 'CAP. 05', NULL),
  ('financas-comportamentais', 'Status quo bias: o custo de não mudar de banco', 'C', 4, 'MANUAL DO DINHEIRO', 'CAP. 06', NULL),
  ('financas-comportamentais', '5 mitos sobre Tesouro Direto', 'F', 3, 'MANUAL DO DINHEIRO', 'CAP. 07', NULL),
  ('financas-comportamentais', 'Você sabe quanto está pagando de taxa de administração?', 'E', 2, 'MANUAL DO DINHEIRO', 'CAP. 08', 'Pode citar média de mercado'),
  ('financas-comportamentais', 'O orçamento em 3 partes — adaptação brasileira do 50/30/20', 'B', 3, 'MANUAL DO DINHEIRO', 'CAP. 02', NULL),
  ('financas-comportamentais', 'Contabilidade mental: por que "13º salário" não vira investimento', 'C', 4, 'MANUAL DO DINHEIRO', 'CAP. 09', NULL),
  ('financas-comportamentais', 'Quitar dívida ou investir? Decisão em 1 conta', 'G', 3, 'MANUAL DO DINHEIRO', 'CAP. 10', NULL),
  ('financas-comportamentais', '"Eu não tenho perfil pra investir" — desconstrução em 7 slides', 'F', 4, 'MANUAL DO DINHEIRO', 'CAP. 11', NULL),
  ('financas-comportamentais', 'Por que aumento de salário some', 'A', 3, 'MANUAL DO DINHEIRO', 'CAP. 12', 'Lifestyle creep'),
  ('financas-comportamentais', 'Caso anônimo: cliente que sacou na crise de 2020', 'D', 4, 'MANUAL DO DINHEIRO', 'EXTRA 01', 'Anonimizar valores'),
  ('financas-comportamentais', 'Excesso de confiança: por que stock pickers PF perdem do índice', 'C', 5, 'MANUAL DO DINHEIRO', 'CAP. 13', NULL),
  ('financas-comportamentais', 'Munger: "Mostre-me o incentivo, e eu te mostrarei o resultado"', 'I', 4, 'MANUAL DO DINHEIRO', 'BÔNUS 01', NULL),
  ('financas-comportamentais', '50/30/20 funciona no Brasil de 2026?', 'B', 4, 'MANUAL DO DINHEIRO', 'CAP. 02', NULL),
  ('financas-comportamentais', 'Você está fazendo isso com seu dinheiro? — checklist em 7 perguntas', 'H', 3, 'MANUAL DO DINHEIRO', 'CAP. 14', NULL),
  ('financas-comportamentais', 'Por que começar a poupar aos 25 vs aos 35 muda tudo', 'G', 2, 'MANUAL DO DINHEIRO', 'CAP. 15', 'Gráfico mental — não imagem'),
  ('financas-comportamentais', 'Automação > força de vontade: débito automático pra reserva', 'A', 3, 'MANUAL DO DINHEIRO', 'CAP. 16', NULL),
  ('financas-comportamentais', 'Manada: o que aconteceu com quem comprou IPO em 2021', 'D', 4, 'MANUAL DO DINHEIRO', 'EXTRA 02', NULL),
  ('financas-comportamentais', 'Efeito disposição: a planilha que mostra a verdade', 'C', 4, 'MANUAL DO DINHEIRO', 'CAP. 17', NULL),
  ('financas-comportamentais', 'O custo invisível do CDB 100% CDI', 'A', 3, 'MANUAL DO DINHEIRO', 'CAP. 18', NULL),
  ('financas-comportamentais', 'Reflexão de domingo: o dinheiro como ferramenta, não como placar', 'J', 5, 'MANUAL DO DINHEIRO', 'ENTRE CAPÍTULOS', NULL),
  ('financas-comportamentais', '3 vieses que sabotam seu portfólio (sem você ver)', 'B', 2, 'MANUAL DO DINHEIRO', 'CAP. 19', NULL),
  ('financas-comportamentais', 'PGBL vs VGBL: a conta que muda a decisão', 'G', 3, 'MANUAL DO DINHEIRO', 'CAP. 20', NULL),
  ('financas-comportamentais', 'Kahneman: "Perder dói duas vezes mais do que ganhar"', 'I', 3, 'MANUAL DO DINHEIRO', 'BÔNUS 02', NULL),
  ('financas-comportamentais', 'Por que "esperar a melhor hora" pra investir custa caro', 'A', 3, 'MANUAL DO DINHEIRO', 'CAP. 21', 'Market timing'),
  ('financas-comportamentais', 'Diversificação de verdade vs ilusão de diversificação', 'F', 4, 'MANUAL DO DINHEIRO', 'CAP. 22', NULL),
  ('financas-comportamentais', 'O check-up patrimonial anual em 30 min', 'B', 4, 'MANUAL DO DINHEIRO', 'CAP. 23', NULL),
  ('financas-comportamentais', 'Buffett: "Be fearful when others are greedy" — como aplicar sem timing', 'I', 4, 'MANUAL DO DINHEIRO', 'BÔNUS 03', NULL)
on conflict do nothing;
