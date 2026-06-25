# engine/remotion/audio — narração com voz clonada (grátis)

> Camada de áudio do faceless (briefing 2026-06-19). Narração em **voz clonada do Lucas**
> via **XTTS-v2** (Coqui, open-source), rodando no **Google Colab grátis** (GPU). **R$0, sem
> API paga em runtime.** O MP4 leva **só a narração** — a música o Lucas escolhe no app
> (trending sound) ao postar; nada de trilha embutida.

## Pré-requisito (Lucas)

Gravar **1 sample de voz limpo** (briefing §2): ~1-2 min, fala natural (tom de conversa),
ambiente quieto, mic perto. Salvar em `audio/voice/sample.wav` (ou `.mp3`).
**Não vai pro git** (gitignored).

## GATE (rodar ANTES do pipeline cheio) — Colab

1. Abrir `clone_voz.ipynb` no [Google Colab](https://colab.research.google.com) (File → Upload notebook).
2. Runtime → Change runtime type → **GPU (T4)**.
3. Rodar as células 1–2 (instala XTTS + sobe o sample).
4. **Célula 3 (GATE):** gera 1 frase-teste → ouvir. **Soa como você?**
   - ✅ Sim → segue.
   - ❌ Não → tenta sample mais limpo/longo; fallbacks no briefing §3.2 (voz neutra grátis;
     pago só com OK explícito — é refém).

## Pipeline cheio (só após aprovar o clone)

5. Célula 4–5: subir `src/script.json` → gera `out/<cena>.wav` (1 por cena, do campo
   `narracao`) + `out/durations.json` (duração medida de cada cena) → baixa `narracao.zip`.
6. Descompactar em `engine/remotion/public/narracao/`.
7. Avisar o Claude Code: ele liga o áudio no Remotion (`<Audio>` por cena + sincroniza a
   duração das cenas pelas durações da narração) e re-renderiza o MP4 **com som**.

## Regras (briefing §4)

- **R$0**, open-source, sem API paga em runtime.
- Sample de voz, `*.wav/*.mp3` e modelos **fora do git** (ver `.gitignore`).
- **Não** toca na engine de carrossel / `postar.mjs` — tudo isolado aqui.
- Postagem de vídeo no TikTok (`video.upload`) é **briefing à parte**.
