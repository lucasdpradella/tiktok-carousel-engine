#!/usr/bin/env python3
# tts_ci.py — gera a narração do vídeo no GitHub Actions (§2c do briefing-mestre).
# Usa os speaker latents JÁ DECIFRADOS (não precisa do WAV original) + XTTS-v2.
# Por cena: model.inference(narracao, "pt", latents, speed=1.0 + temp/rep_penalty) -> WAV -> EQ de-muffle
# (speed=1.0 = voz natural; a aceleração do pace vem toda do ffmpeg no run-video, preservando o timbre)
# + loudnorm (ffmpeg) -> mede duração. Escreve <id>.wav + durations.json no outdir.
#
# Uso: python tts_ci.py <script.json> <speaker_latents.pth> <outdir>
import os
os.environ.setdefault("COQUI_TOS_AGREED", "1")
import sys
import json
import wave
import subprocess
import numpy as np
import torch
from TTS.api import TTS

# de-muffle + loudnorm (mesmos parâmetros do tuning local): corte leve em 300Hz,
# presença em 3.5kHz (treble = high-shelf no ffmpeg), loudnorm pra nível consistente.
AF = "equalizer=f=300:width_type=q:w=1:g=-3,treble=g=4:f=3500,loudnorm=I=-16:TP=-1.5:LRA=11"


def sanitize(t):
    """Rede de segurança: tira travessão/símbolo/aspas antes do TTS (o roteirista já limpa)."""
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


def save_wav_int16(path, wav_float, sr):
    a = np.asarray(wav_float, dtype=np.float32)
    a = np.clip(a, -1.0, 1.0)
    pcm = (a * 32767.0).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def main():
    script_path, latents_path, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(outdir, exist_ok=True)

    print("[tts] carregando XTTS-v2 (CPU)...")
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2", gpu=False)
    model = tts.synthesizer.tts_model
    try:
        sr = int(model.config.audio.output_sample_rate)
    except Exception:
        sr = 24000

    d = torch.load(latents_path, map_location="cpu")
    gpt_cond_latent = d["gpt_cond_latent"]
    speaker_embedding = d["speaker_embedding"]

    script = json.load(open(script_path, encoding="utf-8"))
    durs = {}
    for c in script["cenas"]:
        text = sanitize(c.get("narracao") or "")
        if not text:
            continue
        out = model.inference(
            text, "pt", gpt_cond_latent, speaker_embedding,
            speed=1.0, enable_text_splitting=True,
            temperature=0.60, repetition_penalty=5.0,
            top_p=0.80, top_k=40,
        )
        wav = out["wav"]
        if hasattr(wav, "cpu"):
            wav = wav.cpu().numpy()
        raw = os.path.join(outdir, c["id"] + ".raw.wav")
        final = os.path.join(outdir, c["id"] + ".wav")
        save_wav_int16(raw, wav, sr)
        subprocess.run(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", raw,
             "-af", AF, "-ar", str(sr), "-ac", "1", "-c:a", "pcm_s16le", final],
            check=True,
        )
        os.remove(raw)
        with wave.open(final) as w:
            durs[c["id"]] = round(w.getnframes() / float(w.getframerate()), 3)
        print(f"[tts] {c['id']}: {durs[c['id']]}s")

    json.dump(durs, open(os.path.join(outdir, "durations.json"), "w", encoding="utf-8"),
              indent=2, ensure_ascii=False)
    print(f"[tts] total narração: {round(sum(durs.values()), 1)}s ({len(durs)} cenas)")


if __name__ == "__main__":
    main()
