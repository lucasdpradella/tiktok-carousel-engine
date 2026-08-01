# `data/` — memória e fila do conteúdo

Três arquivos. Os runners (`engine/video/run-carrossel.mjs`, `run-video.mjs`) leem os três e
commitam de volta `historico.json`, `pauta.json` e `status-fila.json` no mesmo passo em que hoje
avançam `estado-*.json`.

## `historico.json` — o que JÁ FOI PUBLICADO (append-only)

Base da trava anti-repetição. Um append por post REAL (carrossel, vídeo, manual, expert):

```json
{ "data": "2026-07-31", "tipo": "carrossel", "tema": "Dólar não é aposta, é estrutura",
  "categoria": "investimento", "slug": "dolar-aposta-estrutura",
  "origem": "fila-auto", "run_id": "30632052786" }
```

- `slug` — tema normalizado (minúsculas, sem acento, sem stopword). É o que a trava compara.
- `origem` — `pauta-curada` | `fila-auto` | `manual` | `expert` | `pil`.
- Backfilled em 2026-08-01 a partir dos commits de `estado-*.json` (qual índice cada run
  consumiu) + captions/capas dos `docs/post-*/`. **Nunca editar à mão para "limpar"**: post
  publicado que sumir daqui volta a poder repetir.

## `pauta.json` — a FILA CURADA (fonte primária)

Alimentada pelo Cowork, cada item aprovado pelo Lucas. O runner consome **desta fila primeiro**;
as `engine/video/temas-*.json` são apenas RESERVA.

```json
[
  {
    "id": "2026-08-04-fii-papel-tijolo",
    "tipo": "carrossel",
    "tema": "Você comprou o FII errado",
    "resumo": "opcional — o ângulo que o roteirista deve seguir",
    "categoria": "fii",
    "assets": "docs/post-carrossel-manual-2026-08-04",
    "agendar": "2026-08-04",
    "status": "pendente"
  }
]
```

| campo | efeito |
|---|---|
| `tipo` | `carrossel` ou `video` — define qual cron consome o item |
| `assets` **preenchido** | post **PRÉ-PRONTO**: publica os JPEG/MP4 + `caption.txt` da pasta como estão. Sem roteirista, sem Gemini, sem gerar fundo. Os assets precisam estar **commitados** (logo, no Pages) antes do run |
| `assets` **vazio** | só pauta: o roteirista escreve **em cima** do `tema`/`resumo`, sem escolher assunto sozinho |
| `agendar` | vazio = assim que der; com data = só a partir dela |
| `status` | `pendente` → `postado` (ou `bloqueado`, se a trava pegar o tema como já publicado) |

Ao publicar um item curado: `status: "postado"`, entra no histórico com `origem: "pauta-curada"`,
e os `estado-*.json` **não se mexem** (as filas de reserva ficam paradas onde estão).

## `status-fila.json` — o aviso de que a fila vai secar

Reescrito ao fim de todo run real. É o que o Cowork lê pra saber quando cobrar pauta nova do
Lucas, **antes** de o roteirista automático assumir. Fila curada vazia → o run emite
`::warning::` nos logs do Actions.

---

## A trava anti-repetição (`engine/video/anti-repeticao.mjs`)

Roda **antes de gerar**, nos dois runners. Bloqueia o candidato se:

| regra | o quê | prazo |
|---|---|---|
| R1 `slug` | tema já postado **alguma vez**, em qualquer tipo | **nenhum** — bloqueio eterno |
| R2 `categoria` | mesma categoria nos últimos 4 posts (os dois tipos juntos) | 4 posts |
| R3 `jaccard` | similaridade de título ≥ 0,6 entre os slugs tokenizados | histórico inteiro |
| R4 `assunto` | mesmo assunto-chave (dólar/câmbio, CDI, FII, Selic…) | 8 posts **ou** 60 dias, o que vier primeiro |

A R4 tem prazo de propósito: bloqueio eterno de assunto trava a fila inteira com o tempo. Sair
de qualquer uma das duas condições já libera — inclusive quando a publicação desacelera e a
contagem de posts sozinha nunca soltaria. Só a R1 é sem prazo.

Bloqueou → pula pro próximo elegível da fila e loga `::warning::`. Nenhum elegível → **sai limpo
sem postar**. Nunca postar repetido "porque era a vez dele".

**Dois conjuntos de regras** (`REGRAS_AUTOMATICO` / `REGRAS_CURADO`, exportados pelo módulo):

- **roteirista automático** — escolhendo tema sozinho: R1 + R2 + R3 + R4.
- **pauta curada e `TOPICO=` manual** — só a **R1**. O Lucas aprovou o item na mão, então
  recência de categoria/assunto não veta decisão humana; repetir tema já publicado, sim.
  `FORCAR=true` fura até a R1 num dispatch manual.

Ensinar um assunto novo à R4 = acrescentar um apelido em `TERMOS_ASSUNTO`, no topo do módulo.
