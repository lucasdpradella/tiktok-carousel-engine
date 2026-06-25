# engine/remotion — POC de vídeo faceless PRADEX (Remotion)

> POC do briefing "Engine de vídeo faceless self-host (custo zero)", 2026-06-19.
> Render local de **1 vídeo** de tipografia cinética no padrão PRADEX, **R$0** (sem IA paga
> em runtime). **Isolado** da engine de carrossel — não toca `postar.mjs` nem o cron atual.

## O que é

- `DinheiroVaza` — vídeo 9:16 (1080×1920), ~30s, "Seu dinheiro não some, ele vaza".
- Stack: [Remotion](https://remotion.dev) (React → Chromium headless + FFmpeg → MP4).
  - Licença grátis (indivíduo/empresa ≤3 funcionários, uso comercial, self-host).
  - O Remotion baixa o próprio Chromium e traz o FFnmpeg — nada extra pra instalar.
- Roteiro em `src/script.json` (data-driven, mesma filosofia do roteirista de carrossel).
- Marca: creme `#F0EAE0` + terracota `#C04A2B`, Lora (serif) + Poppins (sans), as mesmas
  TTFs do `engine/python-pradex/fonts` (copiadas em `public/fonts/`).
- Texto na **zona segura**: centro-superior; os ~20% de baixo ficam livres (UI do TikTok).

## Rodar

```bash
cd engine/remotion
npm install            # baixa Remotion (+ Chromium no 1º render)
npm run render         # → out/dinheiro-vaza.mp4
npm run studio         # preview interativo (opcional)
npm run still          # 1 frame PNG p/ conferir layout (opcional)
```

## Estrutura

```
engine/remotion/
├── package.json
├── tsconfig.json
├── public/fonts/            # Lora + Poppins (TTFs da marca)
└── src/
    ├── index.ts             # registerRoot
    ├── Root.tsx             # <Composition> (duração = soma das cenas do JSON)
    ├── DinheiroVaza.tsx     # composição: cenas + animações + ícones + header de marca
    ├── script.json          # roteiro (9 cenas) — hardcoded p/ a POC
    ├── theme.ts             # paleta + fontes + zona segura
    └── fonts.ts             # carrega as TTFs via FontFace
```

## Escopo (briefing §7, §9)

- POC = **só renderizar o MP4 local**. Postagem de vídeo no TikTok (`video.upload`) é
  **briefing à parte** — não implementado aqui.
- **Não** mexer na engine de carrossel / `postar.mjs` / cron — a auto-postagem semi-auto
  está no ar e não pode regredir.
