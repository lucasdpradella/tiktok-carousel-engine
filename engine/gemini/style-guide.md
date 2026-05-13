# style-guide.md — Direção de arte Pradex / Manual do Dinheiro

> Este guia é o **DNA visual** que o Nano Banana precisa repetir em **todos** os slides. É consumido pelo `prompts/system-visual.md` como bloco fixo no início de cada chamada de imagem.

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

- **Headlines / overlay principal:** Playfair Display 700 (serif editorial italic-friendly). Tamanho generoso (10–12% da altura do canvas). Tracking justo. Pode ter palavra italic dentro de roman pra grifo (cuidado pro Nano Banana não embaralhar letra — incluir como instrução explícita no prompt).
- **Subtextos / metadados:** Inter 700–800 (sans condensed). Versalete (UPPERCASE) com letter-spacing 0.12em. Cor `ink-soft`.
- **Numeração:** Playfair Display 900 em accent quando for "CAPÍTULO 03", "01 / 05", etc.

## Iluminação

- Side light **dramática** da esquerda, ângulo ~30° acima.
- Sombras longas, **suaves** (não duras tipo flash).
- Tom analógico/filme (grão sutil, leve halação nas highlights). **NUNCA** flat lighting digital.
- Highlights creme amarelado, sombras quase pretas mas com matiz azul-quente.

## Composição

- **Canvas:** 4:5 vertical (1024 × 1280) — formato carrossel TikTok.
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

## Prompt template universal (a copiar pelo `gerar-imagem.mjs`)

> Use os slots `{texto_overlay}`, `{texto_meta}`, `{sujeito_visual}`, `{angulo_editorial}` — preenchidos pelo `gerar-roteiro.mjs`.

```
Editorial photography for a financial behavior carousel, magazine-page composition.

CANVAS: 4:5 vertical, 1024×1280.

PALETTE (strict): cream background #F0EAE0 dominant, deep ink #1A1A1A for type and shadow, muted warm gray #5F5C57 for secondary type, ONE single brick-orange accent #C04A2B used in a small detail only.

LIGHTING: dramatic side light from the upper-left ~30°, long soft shadows, analog film grain, subtle halation in highlights. NO flat lighting, NO digital studio look.

COMPOSITION: subject = {sujeito_visual}, placed slightly off-center to the right (rule of thirds). Top third of the frame intentionally empty for typography overlay. Shallow depth of field. Generous negative space.

TYPOGRAPHY OVERLAY (render INSIDE the image, sharp, perfectly legible, no letter errors):
- Top: "{texto_meta}" — Inter 800 uppercase, tracking 0.12em, color #5F5C57, small (~24pt).
- Headline: "{texto_overlay}" — Playfair Display 700, color #1A1A1A, large (~96pt), tight tracking. Editorial angle: {angulo_editorial}.

EXCLUSIONS: no people, no faces, no hands with identifiable skin, no brand logos, no neon, no gradients, no flat icons, no stock-photo cliches, no watermarks, no emoji, no Portuguese typo.

MOOD: New Yorker cover, Bloomberg Businessweek, Monocle. Serious, human, anti-influencer.
```

Aderência: o `gerar-imagem.mjs` deve enviar esse prompt **literal** com os slots preenchidos, sem reformulação. Variação fica só nos slots — o resto é blindado.
