# system-visual.md — Template visual por slide (gpt-image-1)

> Template Markdown que o `gerar-imagem.mjs` preenche com os slots vindos do roteirista e envia pro `gpt-image-1`. Estrutura nova (2026-05-13): suporta **headline GRANDE + sub-texto MENOR** no mesmo slide (formato 2-slides TENSÃO → RESOLUÇÃO).
>
> Slots variáveis: `{headline}`, `{subtexto}`, `{texto_meta}`, `{sujeito_visual}`. Estética editorial Pradex mantida: creme `#F0EAE0` + laranja-tijolo `#C04A2B` + Playfair Display para headline + Inter para subtexto e meta.

**Por que o template é tão detalhado:** o `gpt-image-1` é forte mas precisa de blindagem prompt-side pra não escorregar pra estética influencer / stock photo / digital flat. Cada cláusula aqui responde a um failure mode conhecido.

---

## Template literal (a ser usado em `gerar-imagem.mjs`)

A vertical portrait editorial photograph (1024x1536) in the spirit of The New Yorker, Bloomberg Businessweek, and Magnetic Times covers.

SUBJECT: {sujeito_visual}

COLOR PALETTE (strict — do not deviate):
- Background: warm cream beige, hex #F0EAE0
- Sparingly used accent: brick orange, hex #C04A2B
- Main text and shadows: deep ink black, hex #1A1A1A
- Secondary text: warm gray, hex #5F5C57

LIGHTING: soft dramatic side light from upper left. Long gentle shadows. Analog film aesthetic with visible grain. NOT digital flat. NOT studio sterile.

COMPOSITION: top half visually clean — reserved for typography overlay. Subject in bottom half, slightly off-center to the right, occupying middle-to-lower frame.

TYPOGRAPHY OVERLAY (render literally inside the image, in Portuguese as provided):
- HEADLINE at top center: "{headline}" — large elegant serif Playfair Display style, bold weight, deep ink color (#1A1A1A), tight letter-spacing, leading 1.0. Should occupy 2-3 lines max, dominating the upper third.
- SUB-TEXT directly beneath headline, smaller: "{subtexto}" — sans-serif Inter style, medium weight, warm gray color (#5F5C57), comfortable letter-spacing, leading 1.3. Should read as supporting context, NOT compete with headline.
- META at very top of frame, much smaller: "{texto_meta}" — sans-serif Inter style, all-caps, brick orange color (#C04A2B), wide letter-spacing.

CONSTRAINTS:
- NO people, faces, hands
- NO logos other than the typography overlay
- NO emojis, NO neon, NO gradients, NO digital flat icons
- NO stock-photo cliches
- NO clutter — generous negative space
- Tasteful, serious but humane. Anti-influencer aesthetic.
- The text must be perfectly legible and orthographically correct in Portuguese.

---

## Como o `gerar-imagem.mjs` consome este template

1. Lê este arquivo (cache em memória após a primeira chamada).
2. Faz `String.replaceAll('{headline}', slide.headline)` e idem para `{subtexto}`, `{texto_meta}`, `{sujeito_visual}`.
3. Envia o prompt completo (sem os marcadores de seção markdown — o template acima é o prompt literal) como `prompt` na chamada `POST /v1/images/generations`.
4. `size: '1024x1536'` (portrait), `quality: 'medium'` (default), `n: 1`.
5. Salva o `b64_json` retornado como PNG.

## Notas sobre o `gpt-image-1`

- Não há `responseModalities` aqui (isso era da Gemini). O modelo sempre retorna `b64_json`.
- Custo: ~$0.04 / imagem em `medium`, ~$0.08 em `high`.
- Tempo médio observado: 20-40s por imagem em `medium`.
- O modelo é melhor que DALL-E 3 em fidelidade de texto dentro da imagem — é a razão de termos abandonado o Satori.
- Render de Portuguese accents (á, é, í, ó, ú, ã, õ, ç): exigir explicitamente no prompt, validar manualmente nos primeiros 10 posts.
