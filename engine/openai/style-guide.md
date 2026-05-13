# style-guide.md — Direção de arte Pradex / Manual do Dinheiro

> Este guia é o **DNA visual** que o `gpt-image-1` precisa repetir em **todos** os slides. É consumido pelo `prompts/system-visual.md` como bloco fixo no início de cada chamada de imagem.

**Referências de mood:** New Yorker (cover illustration), Bloomberg Businessweek (data viz editorial), Magnetic Times, Monocle. **Anti-referências:** influencer financeiro brasileiro, neon, gradientes, ícones flat coloridos, fotos de stock saturadas.

---

## Paleta

Exatamente 4 cores. Não inventar variações.

| Token | Hex | Uso |
|---|---|---|
| `bg-creme` | `#F0EAE0` | fundo dominante (papel envelhecido) |
| `ink` | `#1A1A1A` | tipografia principal, sombras profundas |
| `ink-soft` | `#5F5C57` | tipografia metadado, sombras suaves |
| `accent` | `#C04A2B` | acento único (laranja-tijolo) — usar **uma vez só por slide**, em detalhe pequeno (selo, sublinhado, objeto pontual) |

Proibido: branco puro `#FFF`, preto puro `#000`, qualquer azul/verde/amarelo saturado.

## Tipografia

- **Headlines / overlay principal:** Playfair Display 700 (serif editorial italic-friendly). Tamanho generoso (10–12% da altura do canvas). Tracking justo. Pode ter palavra italic dentro de roman pra grifo (cuidado pro `gpt-image-1` não embaralhar letra — incluir como instrução explícita no prompt).
- **Subtextos / metadados:** Inter 700–800 (sans condensed). Versalete (UPPERCASE) com letter-spacing 0.12em. Cor `ink-soft`.
- **Numeração:** Playfair Display 900 em accent quando for "CAPÍTULO 03", "01 / 05", etc.

## Iluminação

- Side light **dramática** da esquerda, ângulo ~30° acima.
- Sombras longas, **suaves** (não duras tipo flash).
- Tom analógico/filme (grão sutil, leve halação nas highlights). **NUNCA** flat lighting digital.
- Highlights creme amarelado, sombras quase pretas mas com matiz azul-quente.

## Composição

- **Canvas:** 2:3 vertical (1024 × 1536) — formato retrato suportado pelo `gpt-image-1`, próximo do 9:16 do TikTok. Recorte/upscale eventual fica fora da engine (n8n ou pós-processamento).
- **1/3 superior limpo:** reservar pro overlay tipográfico. Esse terço pode ter o fundo creme exposto OU uma sombra projetada do sujeito que não compete com a tipografia.
- **Sujeito ligeiramente off-center à direita** (regra dos terços). Nunca centrado, nunca cortado pela borda.
- **Espaço negativo é regra**, não exceção. Se a composição parece "vazia", está certa.
- **Profundidade rasa** — foco no sujeito, fundo levemente desfocado mas legível.

## Sujeitos visuais (metáforas Pradex pra finanças comportamentais)

Sortear 1 do pool a cada slide, garantindo variedade dentro do mesmo post:

1. moedas em pilha (cobre/bronze envelhecido, mesa de madeira)
2. papel amassado (recibo, talão, cheque velho)
3. mão estendida (perspectiva over-the-shoulder, sem rosto)
4. peças de dominó (em pé, prestes a cair)
5. vela acesa (chama tremendo, cera derretendo)
6. balança antiga de 2 pratos (latão envelhecido)
7. semente germinando (vaso de barro pequeno, terra)
8. mapa rasgado (papel de mapa antigo, dobras)
9. jarra de vidro com grãos (feijão, café, lentilha)
10. calendário Risque (folhas arrancadas, marcações a caneta)
11. chave de bronze (sozinha, em superfície de madeira)
12. ampulheta (areia fina caindo, vidro com reflexo)
13. escada de madeira (degraus de marceneiro, encostada)
14. livro aberto (páginas amareladas, marcador de fita)
15. pedra equilibrando outras (cairn, contraste de tamanho)

Regra: nunca repetir o mesmo sujeito dois slides seguidos no mesmo post.

## Tom

- Sério mas humano. Adulto falando com adulto.
- **Anti-influencer:** zero "PARE TUDO", zero seta vermelha, zero emoji.
- **Anti-saturação:** se a imagem está "bonita demais", está errada. Buscar gravidade editorial.
- O slide deve parecer **uma página de revista**, não um post.

## Não-fazer (lista de exclusões hard pro prompt)

- Pessoas, rostos, mãos com identificação clara (privacidade + variedade entre posts)
- Logos de qualquer marca real (Apple, Nubank, etc) — **exceto** "PRADEX" tipografado em accent
- Cores neon, fluorescentes, saturadas
- Gradientes brilhantes, glow, lens flare
- Ícones flat coloridos (estilo Material Design / Apple emoji)
- Fotos de stock óbvias (handshake corporativo, gráfico subindo, smartphone na mão)
- Texto borrado / ilegível / com erro de letra (instrução explícita no prompt)
- Marcas d'água, assinaturas, copyright visível

## Notas específicas do `gpt-image-1`

- O modelo **renderiza texto na imagem com muito mais fidelidade que o DALL-E 3** — usar isso a favor (overlay tipográfico nasce dentro da própria imagem, não como camada CSS).
- Tamanhos suportados: `1024x1024`, `1024x1536` (portrait, default da engine), `1536x1024` (landscape), `auto`.
- Qualidade: `low` (~$0.011), `medium` (~$0.04, default), `high` (~$0.08), `auto`.
- Retorno: sempre `b64_json` (não há URL — copia o buffer direto e salva).
- Acentos pt-BR (á, é, ã, ç): instrução explícita no prompt + revisão manual nos primeiros 10 posts pra calibrar.
- Não aceita `responseModalities` (isso é da Gemini). A chamada é `POST /v1/images/generations`.

## Prompt template universal

O template literal vive em [`prompts/system-visual.md`](./prompts/system-visual.md). Os slots `{texto_overlay}`, `{texto_meta}`, `{sujeito_visual}` são preenchidos por `gerar-imagem.mjs` a partir do roteiro. O `gerar-imagem.mjs` deve enviar o prompt **literal** com os slots preenchidos, sem reformulação. Variação fica só nos slots — o resto é blindado.
