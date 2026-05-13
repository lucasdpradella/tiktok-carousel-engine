# system-visual.md — Template visual por slide

> Template Markdown que o `gerar-imagem.mjs` preenche com os slots vindos do roteirista e envia pro `gemini-2.5-flash-image`. Combina o `style-guide.md` (regras fixas) + os slots variáveis ({texto_overlay}, {texto_meta}, {sujeito_visual}, {angulo_editorial}).

**Por que esse template é tão detalhado:** Nano Banana é forte mas precisa de blindagem prompt-side pra não escorregar pra estética influencer / stock photo / digital flat. Cada cláusula aqui responde a um failure mode conhecido.

---

## Template literal (a ser usado em `gerar-imagem.mjs`)

```
Editorial photography for a financial behavior carousel by PRADEX (CFP planner brand, "Manual do Dinheiro" series). Magazine-page composition, anti-influencer aesthetic.

CANVAS: 4:5 vertical, 1024×1280 pixels.

PALETTE (strict, do not deviate):
- Background dominant: cream paper #F0EAE0
- Type primary: deep ink #1A1A1A
- Type secondary: muted warm gray #5F5C57
- Accent (ONE small detail only, never large area): brick orange #C04A2B

LIGHTING: dramatic side light from upper-left at ~30° above horizon. Long, soft shadows. Analog film grain (subtle, not heavy). Slight halation in highlights. Warm-cool contrast (highlights warm cream, shadows cool deep). NO flat lighting. NO digital studio look. NO ring light. NO HDR.

COMPOSITION:
- Subject: {sujeito_visual}
- Subject placed slightly off-center to the right (rule of thirds, right vertical line).
- Top 1/3 of frame intentionally empty for typography overlay (cream background visible, or subject shadow projecting up but not competing with type).
- Shallow depth of field, focus on subject, background falls off softly.
- Generous negative space — if it feels "empty", it is correct.

TYPOGRAPHY (render INSIDE the image, sharp, perfectly legible, NO letter errors, NO typo, NO blur):
- Top metadata bar (small, ~24pt): "{texto_meta}"
  - Font: Inter 800 uppercase
  - Tracking: 0.12em
  - Color: #5F5C57
  - Position: top edge, left-aligned, ~80px from top, ~80px from left
- Headline (large, ~96pt, primary visual element):
  - Text: "{texto_overlay}"
  - Font: Playfair Display 700 (serif, editorial)
  - Color: #1A1A1A
  - Tracking: tight (-0.01em)
  - Position: occupies upper portion below the metadata bar, left-aligned
  - Editorial angle / tone: {angulo_editorial}
  - If text has an italic word in source, render that word in Playfair Display 700 Italic (same size). NO confusion between letters.

BRAND MARK (bottom-right, very small):
- Text "PRADEX" in Inter 800 uppercase, ~16pt, color #C04A2B, tracking 0.2em.
- Position: ~60px from bottom edge, ~60px from right edge.

EXCLUSIONS (hard rules, do not break):
- NO people. NO faces. NO hands with identifiable skin, fingerprints, or jewelry.
- NO brand logos other than the PRADEX wordmark described above.
- NO neon, fluorescent, or saturated colors outside the palette.
- NO gradients, glow, lens flare, bokeh-as-decoration.
- NO flat-design icons (Material, Apple emoji style).
- NO stock-photo cliches (corporate handshake, growing chart, smartphone in hand, hourglass split-screen).
- NO emoji anywhere in the image.
- NO Portuguese typos. NO repeated letters. NO character glitches in the typography. If unsure of a Portuguese accent (á, é, ã, ç), render it correctly or omit the word.
- NO watermarks, signatures, copyright symbols.

MOOD REFERENCES: The New Yorker cover illustration, Bloomberg Businessweek photography, Monocle, Magnetic Times. Serious, human, slow. The image should feel like a printed magazine page from 2008, not a 2025 Instagram post.

OUTPUT: single PNG, 1024×1280, full bleed (no white margin around).
```

---

## Como o `gerar-imagem.mjs` consome este template

1. Lê este arquivo (cache em memória após primeira chamada).
2. Faz `String.replaceAll('{texto_overlay}', slide.texto_overlay)` (e demais slots).
3. `{angulo_editorial}` é injetado a partir de `topics.angulo` do Supabase OU derivado do `caption` quando faltar.
4. Envia como `contents[0].parts[0].text` na chamada `:generateContent`.
5. Para slide 2-5 do mesmo post: incluir o PNG do slide anterior como `inlineData` extra pra **forçar consistência de estilo** (image-to-image).

## Versionamento

Quando este template mudar, bump em `engine/gemini/package.json` → `version`. O Supabase guarda em `posts.engine_version` qual versão gerou cada post (auditoria).
