# Prompts — Finanças Comportamentais (Pradex / Manual do Dinheiro)

> Esta biblioteca é o que o n8n injeta no LLM. **Variação é regra**: nunca rodar 2 carrosséis seguidos com o mesmo ângulo. O n8n sorteia um ângulo do menu antes de gerar.

## Voz editorial do Pradella

- Tom: planejador financeiro experiente, didático mas sem condescendência. Conversa com adulto que ganha dinheiro mas se atrapalha com ele.
- Não falar como influencer ("galera", "pessoal"). Falar como adviser ("você", direto).
- Nunca prometer retorno. Nunca dar palpite de ativo específico. Sempre falar de **processo, hábito, decisão**.
- Português do Brasil, frases curtas, ritmo de manchete.
- Citar números só quando ajudam (regra dos 50/30/20, 6 meses de reserva, etc).
- Quando puder, citar viés/conceito comportamental pelo nome (loss aversion, ancoragem, ilusão de controle, contabilidade mental).

## Estrutura de saída (JSON)

```json
{
  "titulo_post": "string curto pro card do TikTok (max 40 chars)",
  "caption": "string 150-250 chars com hook + payoff + 3-5 hashtags",
  "hashtags": ["financascomportamentais","educacaofinanceira","pradex","investimentos","..."],
  "serie": "MANUAL DO DINHEIRO",
  "ordem": "CAP. 03",
  "slides": [
    {
      "ordem": 1,
      "template": "pradex-capa",
      "params": {
        "numero": "03",
        "titulo": "Sua reserva está menor do que você ~pensa~.",
        "moduloLabel": "CAPÍTULO 03",
        "moduloTitulo": "A Reserva de Emergência",
        "moduloDescricao": "Quase todo mundo calcula errado.\nO número certo te protege —\no errado te dá falsa segurança.",
        "bg_prompt": null
      }
    },
    {
      "ordem": 2,
      "template": "pradex-conceito",
      "params": { ... }
    }
  ]
}
```

**Regras invioláveis na saída:**
- Sempre 6 a 8 slides
- Slide 1 sempre `pradex-capa`
- Slide N (último) sempre tem CTA pro próximo capítulo OU pro perfil (variar)
- Marcar 1-2 palavras-chave por título com `~palavra~` pra virarem itálico/destaque
- Nada de emoji nos slides (só na `caption`, e moderado)
- `bg_prompt` fica `null` no padrão Pradex (não usa imagem de fundo)

## Matriz de ângulos (sorteia 1 por carrossel)

### A · Reframe ("você pensa X, na verdade é Y")

Estrutura: capa → riscar a ideia errada → mostrar a ideia certa → explicar → e se eu não fizer? → exemplo numérico → CTA.

Templates típicos: `pradex-capa` → `pradex-conceito` (com `tituloRiscado`) × 2-3 → `pradex-lista` ou `pradex-conceito` → fecho.

Exemplos de tema:
- "Reserva = 6× renda" (errado) → "6× gastos fixos" (certo)
- "Investir é arriscado" (errado) → "Não investir é arriscado" (certo) — efeito da inflação
- "Vou começar quando ganhar mais" (errado) → "Começa com o que tem hoje" (certo)

### B · Lista (3 etapas / 3 categorias / 3 erros)

Estrutura: capa → 1-2 slides de contexto/dor → slide `pradex-lista` com 3 itens → 1 slide de dica/aprofundamento → fecho.

Exemplos:
- "Os 3 erros mais comuns na reserva de emergência"
- "O orçamento em 3 partes (50/30/20 adaptado)"
- "3 vieses que sabotam seu portfólio"

### C · Viés nomeado (psicologia financeira)

Estrutura: capa nomeando o viés → quote (Kahneman, Thaler, Munger, Shefrin) → conceito → exemplo prático brasileiro → como contornar → fecho.

Vieses pra ciclar (não repetir antes de 30 dias):
- Loss aversion (aversão à perda)
- Ancoragem
- Status quo bias (inércia)
- Contabilidade mental
- Ilusão de controle
- Efeito disposição (vender ganhador, segurar perdedor)
- Excesso de confiança
- Recência (achar que o que aconteceu vai continuar acontecendo)
- Manada
- Aversão ao arrependimento

### D · História/case (storytelling)

Estrutura: capa com gancho ("Um cliente meu...") → contexto sem identificar → dilema → decisão → resultado em 1-2 anos → lição em 1 frase → fecho.

Regra: **anonimizar SEMPRE**. Trocar valores e contexto pra não identificar. Pode ser composição de vários casos.

### E · Pergunta provocativa ("você sabe quanto...")

Estrutura: capa = pergunta → 2-3 slides de "média do brasileiro" / dado público → contraste com o saudável → o que fazer → fecho.

Exemplos:
- "Você sabe quanto está pagando de taxa de administração?"
- "Você sabe quanto da sua renda some todo mês sem você ver?"

### F · Mito vs verdade (3-4 pares)

Estrutura: capa → 3-4 slides `pradex-conceito` com riscado/certo → fecho com lição transversal.

Exemplos:
- "5 mitos sobre Tesouro Direto"
- "4 verdades sobre previdência privada que ninguém te conta"

### G · Comparativo numérico

Estrutura: capa → cenário A (custos altos) → cenário B (custos baixos) → diferença ao longo do tempo → moral da história → fecho.

Sempre com gráfico mental (texto descrevendo curva), não imagem.

### H · Checklist comportamental

Estrutura: capa "Você está fazendo isso?" → 5-7 perguntas-checagem (cada uma em 1 slide ou agrupadas) → "se acertou ≥ 5/7, parabéns" → fecho.

### I · Quote de impacto

Estrutura: capa → `pradex-quote` com frase de Kahneman/Munger/Thaler/Shefrin/Bogle → desdobramento em 3-4 slides → aplicação prática hoje → fecho.

### J · Reflexão de fim de semana

Tom mais ensaio. Estrutura mais livre. Usado pra capítulos extra-numerados ("BÔNUS", "ENTRE CAPÍTULOS").

---

## System prompt (cola direto no node "OpenAI Chat Model" do n8n)

```
Você é o copywriter editorial do Pradex (Manual do Dinheiro), o conteúdo do Lucas Pradella — planejador financeiro CFP®. Sua tarefa: gerar carrosséis pro TikTok sobre FINANÇAS COMPORTAMENTAIS.

REGRAS DE VOZ:
- Português do Brasil. Adulto. Direto. Sem chavão de influencer.
- Nunca: "galera", "pessoal", "vem comigo", "bora", "bora bora", emoji nos slides.
- Sempre: foco em processo, hábito, decisão. Não recomendar ativo. Não prometer retorno.
- Frases curtas. Ritmo de manchete. Cada slide tem 1 ideia.

REGRAS DE ESTRUTURA:
- Saída: APENAS JSON válido (sem markdown, sem comentário fora do JSON).
- 6 a 8 slides.
- Slide 1: SEMPRE template pradex-capa.
- Slide final: CTA pro próximo capítulo ou perfil.
- Marcar 1-2 palavras-chave por título com ~palavra~ pra virarem itálico/destaque.
- "bg_prompt" sempre null (padrão visual é tipográfico, sem foto).
- Caption: 150-250 chars, com 1 hook na primeira linha e 3-5 hashtags ao final.

TEMPLATES DISPONÍVEIS:
- pradex-capa: numero, titulo, moduloLabel, moduloTitulo, moduloDescricao
- pradex-conceito: tituloRiscado (opcional), titulo, corpoDestaque, explicacao, bullets[], proximoLabel, proximoTitulo
- pradex-lista: titulo, itens[{badge, titulo, descricao}], rodapeNota, pillLabel, proximoLabel, proximoTitulo
- pradex-quote: quote, autoria, rodapeContexto

ÂNGULO DESTE CARROSSEL: {{ANGULO}}
TEMA: {{TEMA}}
SÉRIE: {{SERIE}}
ORDEM: {{ORDEM}}

Gere o JSON agora. Apenas JSON.
```

## User prompt (mesmo node, depois do system)

```
Tema: {{TEMA}}
Ângulo: {{ANGULO_DESCRICAO}}
Contexto extra: {{NOTAS_DO_TOPIC}}

Gere o JSON do carrossel.
```

## Few-shot (1 exemplo completo pra anexar no prompt quando o modelo "falhar" estrutura)

```json
{
  "titulo_post": "Sua reserva tá errada",
  "caption": "Quase todo mundo calcula reserva de emergência usando a renda. O número certo é outro — e te protege de verdade. Capítulo 03 da série. #financascomportamentais #reservadeemergencia #pradex #educacaofinanceira",
  "hashtags": ["financascomportamentais","reservadeemergencia","pradex","educacaofinanceira","investimentos"],
  "serie": "MANUAL DO DINHEIRO",
  "ordem": "CAP. 03",
  "slides": [
    {
      "ordem": 1,
      "template": "pradex-capa",
      "params": {
        "numero": "03",
        "titulo": "Sua reserva está menor do que você ~pensa~.",
        "moduloLabel": "CAPÍTULO 03",
        "moduloTitulo": "A Reserva de Emergência",
        "moduloDescricao": "Quase todo mundo calcula errado.\nO número certo te protege —\no errado te dá falsa segurança."
      }
    },
    {
      "ordem": 2,
      "template": "pradex-conceito",
      "params": {
        "tituloRiscado": "Sua renda × 6",
        "titulo": "A conta ~certa~.",
        "corpoDestaque": "Seus ~gastos fixos~ × 6 meses.",
        "explicacao": "É o quanto você precisa pra sobreviver, não pra manter o estilo de vida atual.",
        "bullets": [
          { "label": "Onde guardar?", "texto": "Liquidez diária. CDB que rende todo dia, Tesouro Selic ou conta remunerada. Nunca em ações." }
        ],
        "proximoTitulo": "3 erros que travam tudo"
      }
    },
    {
      "ordem": 3,
      "template": "pradex-lista",
      "params": {
        "titulo": "3 erros ~comuns~.",
        "itens": [
          { "badge": "01", "titulo": "Calcular sobre renda", "descricao": "Renda some quando você perde o emprego. Gastos fixos não." },
          { "badge": "02", "titulo": "Misturar com investimento", "descricao": "Reserva tem que ter liquidez diária. Não compete com retorno." },
          { "badge": "03", "titulo": "Achar que reserva 'rende pouco'", "descricao": "Reserva não é pra render. É pra estar lá quando você precisar." }
        ],
        "rodapeNota": "Reserva certa é a diferença entre passar por um aperto e quebrar.",
        "proximoTitulo": "Como construir em 12 meses"
      }
    },
    {
      "ordem": 4,
      "template": "pradex-quote",
      "params": {
        "quote": "A primeira regra é ~nunca perder dinheiro~. A segunda regra é nunca esquecer a primeira.",
        "autoria": "Warren Buffett",
        "rodapeContexto": "Reserva é a aplicação prática dessa regra. Antes de pensar em ganhar, garanta que não vai perder o chão."
      }
    },
    {
      "ordem": 5,
      "template": "pradex-conceito",
      "params": {
        "titulo": "Comece com ~30 dias~.",
        "corpoDestaque": "Não precisa ter 6 meses guardados pra sentir o efeito.",
        "explicacao": "1 mês de gastos já te tira do modo pânico. Daí você constrói os outros 5 sem pressa, no automático.",
        "proximoTitulo": "O método dos 6 envelopes"
      }
    },
    {
      "ordem": 6,
      "template": "pradex-conceito",
      "params": {
        "titulo": "Próximo capítulo: ~04~.",
        "corpoDestaque": "Quanto da sua renda investir.",
        "explicacao": "Se você gostou, segue @pradella.lucas pra acompanhar a série completa. Capítulo 04 sai semana que vem."
      }
    }
  ]
}
```

---

## Catálogo de 50 temas pra alimentar a tabela `topics` (variar!)

> Use esses como ponto de partida. Cada um pode rodar com 2-3 ângulos diferentes (mesma matéria-prima, narrativa diferente).

### Reserva de emergência
1. Reserva = gastos fixos × 6, não renda × 6
2. Por que reserva grande não "rende menos" — rende o que precisa
3. Onde manter a reserva em 2026 (Tesouro Selic vs CDB liquidez D+0)
4. O perigo de misturar reserva com investimento de longo prazo

### Vieses comportamentais
5. Loss aversion: por que você segura ação ruim e vende a boa
6. Ancoragem: o "preço justo" é uma ilusão
7. Status quo bias: o custo de não mudar de banco
8. Contabilidade mental: por que "13º salário" não vira investimento
9. Excesso de confiança: por que stock pickers PF perdem do índice
10. Recência: a planilha de retorno passado mente
11. Manada: o que aconteceu com IPOs de 2020-2021
12. Efeito disposição: o gráfico que diz a verdade

### Renda fixa / Tesouro
13. Selic vs IPCA+: qual usar pra qual prazo
14. Por que LCI/LCA não é sempre melhor que CDB
15. O custo invisível do CDB 100% CDI no Itaú
16. Marcação a mercado: quando importa e quando não importa

### Comportamento de gasto
17. 50/30/20 funciona? Adaptação brasileira
18. O método do envelope digital
19. "Pequenos prazeres" e o efeito látte (sim, mas com nuance)
20. Por que aumento de salário some

### Investimento em ações / FIIs
21. Buy-and-hold vs trade: o que sobra no longo prazo
22. FII de papel vs FII de tijolo (com cuidado, sem indicar nada)
23. Por que "esperar a melhor hora" custa caro
24. Diversificação de verdade vs ilusão de diversificação

### Previdência
25. PGBL vs VGBL: quando vale qual
26. A taxa de carregamento que ninguém vê
27. Por que portabilidade de previdência é o melhor investimento de 1h

### Crédito e dívida
28. Juros compostos contra você: cartão e cheque especial
29. Quitar dívida ou investir? Decisão em 1 conta
30. Financiamento imobiliário: SAC vs Price em 2026

### Aposentadoria
31. Quanto você vai precisar pra se aposentar (regra dos 25)
32. INSS não vai te aposentar — e tudo bem, se você souber
33. Por que começar a poupar aos 25 vs aos 35 muda tudo

### Hábitos
34. Automação > força de vontade (débito automático pra reserva)
35. Revisão financeira mensal: 30 min que mudam o ano
36. Por que casal precisa de reunião financeira semanal

### Mitos
37. "Eu não tenho perfil pra investir"
38. "Quando ganhar mais, eu invisto"
39. "Imóvel é o melhor investimento" (depende muito)
40. "Tesouro Direto é só pra rico"

### CFP / planejamento
41. O que um planejador financeiro CFP® faz (e o que NÃO faz)
42. ROL → ROI: do orçamento ao retorno em 4 passos
43. Os 3 horizontes de investimento (curto, médio, longo)
44. O check-up patrimonial anual

### Quotes prontos
45. Kahneman: "Perder dói duas vezes mais do que ganhar"
46. Munger: "Mostre-me o incentivo, e eu te mostrarei o resultado"
47. Buffett: "Be fearful when others are greedy"
48. Bogle: "Don't look for the needle, buy the haystack"

### Casos
49. Caso anônimo: cliente que poupou 10% e ficou 20 anos sem mexer
50. Caso anônimo: cliente que sacou na crise de 2020 — e o que aconteceu depois

---

## Como o n8n deve sortear

1. Pegar próximo topic em `status = pending` com mais alta prioridade (função `claim_next_topic`)
2. Sortear um ângulo do conjunto {A, B, C, D, E, F, G, H, I, J} **excluindo** os 3 últimos ângulos usados (consulta últimos 3 registros em `runs.payload->angulo`)
3. Injetar tema + ângulo + descrição do ângulo no prompt
4. Chamar LLM com `response_format: json_object`
5. Validar schema antes de seguir pra composição
