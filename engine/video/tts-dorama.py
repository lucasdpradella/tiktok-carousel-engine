#!/usr/bin/env python3
# tts-dorama.py — narração do dorama do canal @pradexapp.
#
# DIFERENÇA PRO tts_ci.py: aquele usa os speaker latents do Lucas, porque o canal
# pessoal é ele falando em primeira pessoa. Aqui o narrador é personagem, não o Lucas —
# então usa as vozes PRONTAS do XTTS-v2, sem clonagem e sem tocar nos latents cifrados.
#
# E são TRÊS vozes, não uma. O dorama vive do contraste entre o drama do menino e a
# frieza do app: dar o mesmo timbre pros dois mata a piada e mata o soco.
#
# Uso: python tts-dorama.py <falas.json> <outdir> [--listar]

import os
os.environ.setdefault("COQUI_TOS_AGREED", "1")
import sys
import json
import wave
import subprocess
import numpy as np
import torch
from TTS.api import TTS

# Mesmo tratamento do tts_ci.py: de-muffle + nível consistente. Não reinventar —
# se divergir, um canal sai mais alto que o outro no feed.
AF = "equalizer=f=300:width_type=q:w=1:g=-3,treble=g=4:f=3500,loudnorm=I=-16:TP=-1.5:LRA=11"

# `speed` por personagem é metade da direção de atuação. O PRADEX lê plano e um pouco
# devagar porque é máquina; o Léo fala rápido porque tem 19 anos e está se explicando.
PADRAO = {
    "NARRADOR": {"speed": 0.92},
    "LEO":      {"speed": 1.06},
    "PRADEX":   {"speed": 0.97},
    "MAE":      {"speed": 0.95},
}


def sanitize(t):
    """Tira travessão/símbolo/aspas antes do TTS — o modelo lê alguns em voz alta."""
    if not t:
        return ""
    for d in ("—", "–", "―"):
        t = t.replace(d, ", ")
    for q in ('"', "'", "“", "”", "‘", "’", "«", "»", "„"):
        t = t.replace(q, "")
    for s in ("*", "_", "#", "~", "^", "|", "/", "<", ">", "=", "+", "`", "@", "&", "[", "]", "{", "}"):
        t = t.replace(s, " ")
    while "  " in t:
        t = t.replace("  ", " ")
    for p in (",", ".", "!", "?", ";", ":"):
        t = t.replace(" " + p, p)
    return t.strip()


def duracao(caminho):
    with wave.open(caminho, "rb") as w:
        return round(w.getnframes() / float(w.getframerate()), 3)


def main():
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
    disponiveis = list(getattr(tts.synthesizer.tts_model, "speaker_manager").speakers.keys())

    if "--listar" in sys.argv:
        print("\n".join(sorted(disponiveis)))
        return

    falas_json, outdir = sys.argv[1], sys.argv[2]
    dados = json.load(open(falas_json, encoding="utf-8"))
    os.makedirs(outdir, exist_ok=True)

    vozes = dados["vozes"]

    # Falhar AQUI, antes de sintetizar, com a lista na tela. Descobrir no meio de 40
    # falas que um nome de voz não existe custa um run inteiro do Actions.
    faltando = [f"{p}={v}" for p, v in vozes.items() if v not in disponiveis]
    if faltando:
        print("Voz inexistente no XTTS: " + ", ".join(faltando), file=sys.stderr)
        print("\nDisponíveis:\n" + "\n".join(sorted(disponiveis)), file=sys.stderr)
        sys.exit(1)

    duracoes = {}
    for i, fala in enumerate(dados["falas"], 1):
        personagem = fala["quem"]
        texto = sanitize(fala["texto"])
        if not texto:
            continue

        bruto = os.path.join(outdir, f"_{fala['id']}.wav")
        final = os.path.join(outdir, f"{fala['id']}.wav")

        tts.tts_to_file(
            text=texto,
            speaker=vozes[personagem],
            language="pt",
            speed=fala.get("speed", PADRAO.get(personagem, {}).get("speed", 1.0)),
            file_path=bruto,
        )
        subprocess.run(["ffmpeg", "-y", "-i", bruto, "-af", AF, final],
                       check=True, capture_output=True)
        os.remove(bruto)

        duracoes[fala["id"]] = duracao(final)
        print(f"  {i:>2}. {fala['id']:<12} {personagem:<9} {duracoes[fala['id']]:>5.2f}s  {texto[:52]}")

    json.dump(duracoes, open(os.path.join(outdir, "duracoes.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print(f"\n{len(duracoes)} falas · {sum(duracoes.values()):.1f}s de narração")


if __name__ == "__main__":
    main()
