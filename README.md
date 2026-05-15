# tiktok-carousel-engine

> Engine pessoal de publicação automatizada de carrosséis no TikTok da conta [@pradella.lucas](https://www.tiktok.com/@pradella.lucas), parte da série autoral **Manual do Dinheiro** sob a marca **PRADEX**.

**Site / documentos legais:** https://lucasdpradella.github.io/tiktok-carousel-engine/

## O que faz

Cada execução do cron gera 2 slides PNG (1024×1536, formato editorial Pradex — fundo creme, serif Playfair Display, laranja-tijolo) e uma caption autoral, e os publica como carrossel no TikTok do dono via Content Posting API.

- **Slide 1 (TENSÃO):** capa de capítulo. Número gigante, hero serif 2-4 linhas, bloco CAPÍTULO + descrição.
- **Slide 2 (RESOLUÇÃO):** bullets numerados + pill "DICA DO PRADELLA" com sticker do dono.

Conteúdo é roteirizado pela OpenAI (gpt-4o-mini) sobre uma fila de temas seed em Supabase, sob curadoria do dono. Imagens são renderizadas por templates Python (PIL) determinísticos — sem geração de imagem por IA, pra garantir consistência editorial absoluta.

## Stack

- **GitHub Actions** — cron `0 10 */2 * *` (7h BRT a cada 2 dias) + workflow_dispatch pra runs manuais.
- **Python + PIL** — templates determinísticos `slide_tensao.py` e `slide_resolucao.py`.
- **Node.js** — orquestrador (`run-completo.mjs`), gerador de roteiro via OpenAI, integração com Content Posting API.
- **Supabase** — fila de temas (`tiktok-engine.topics`) com `claim_next_topic('financas-comportamentais')`.
- **TikTok Content Posting API** — destino final. App em audit no momento; publicações operam em modo manual (engine gera + dono publica do artifact) até audit aprovar.

## Escopo

App **pessoal** e **single-user**: publica conteúdo autoral do dono na própria conta TikTok. Não acessa dados de terceiros, não posta em outras contas, não coleta métricas externas. Detalhes nos [Termos de Uso](https://lucasdpradella.github.io/tiktok-carousel-engine/terms.html) e na [Política de Privacidade](https://lucasdpradella.github.io/tiktok-carousel-engine/privacy.html).

## Contato

Lucas Pradella · lucasdpradella@gmail.com
