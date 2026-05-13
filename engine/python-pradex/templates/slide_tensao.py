"""
Render SLIDE TENSÃO (1/2) - Manual do Dinheiro / Pradex
1024 x 1536 PNG editorial: paleta creme + terracota + charcoal.

Layout fixo (Layout A — capa de capítulo), data-driven. Recebe:
- texto_meta: "MANUAL DO DINHEIRO  ·  CAP. 04" (caps, tracked, orange, top-left)
- numero_grande: "04" (decorativo Lora-Italic gigante, top-right, alpha 90)
- titulo: lista de (texto, estilo) onde estilo ∈ {'r','i'} — 2-4 linhas grandes
- cap_num: "04" (string com zero à esquerda)
- cap_nome: "A Reserva de Emergência"
- cap_desc: lista de 1-3 strings (descrição curta do capítulo)
- cap_total: "08" (default, aparece no rodapé "uma série em 8 partes")

CLI: python slide_tensao.py <input_json> <output_png>
"""
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from pathlib import Path
import sys
import json

# Canvas — matching slide_resolucao.py (1024x1536, 2:3 vertical)
W, H = 1024, 1536
M = 80  # margem lateral

# Paleta (idêntica ao slide_resolucao.py)
BG       = (241, 236, 226)   # creme
INK      = (21, 23, 28)      # charcoal
INK_SOFT = (60, 64, 72)      # graphite
ACCENT   = (184, 69, 31)     # terracota

FONTS_DIR = Path(__file__).parent.parent / 'fonts'

_FONT_FILES = {
    'lora-r': 'Lora-Regular.ttf',
    'lora-i': 'Lora-Italic.ttf',
    'pop-r':  'Poppins-Regular.ttf',
    'pop-m':  'Poppins-Medium.ttf',
    'pop-b':  'Poppins-Bold.ttf',
}


def F(name, size):
    return ImageFont.truetype(str(FONTS_DIR / _FONT_FILES[name]), size)


def draw_tracked(draw, xy, text, font, fill, tracking=0):
    """Desenha texto com letter-spacing manual em px."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        bbox = font.getbbox(ch)
        x += (bbox[2] - bbox[0]) + tracking
    return x


def measure_tracked(text, font, tracking=0):
    w = 0
    for ch in text:
        bbox = font.getbbox(ch)
        w += (bbox[2] - bbox[0]) + tracking
    return max(0, w - tracking)


def add_grain(img, intensity=6):
    arr = np.array(img)
    if arr.ndim == 2:
        arr = np.stack([arr]*3, axis=-1)
    has_alpha = arr.shape[2] == 4
    rgb = arr[:, :, :3].astype(np.int16)
    noise = np.random.normal(0, intensity, rgb.shape).astype(np.int16)
    rgb = np.clip(rgb + noise, 0, 255).astype(np.uint8)
    if has_alpha:
        out = np.concatenate([rgb, arr[:, :, 3:4]], axis=2)
    else:
        out = rgb
    return Image.fromarray(out)


def _fit_title_size(titulo, max_size=110, min_size=64, max_width=W - 2 * M):
    """Decide o tamanho da fonte do hero pra que a linha mais larga caiba na área útil."""
    size = max_size
    while size >= min_size:
        ok = True
        for line, style in titulo:
            font_key = 'lora-i' if style == 'i' else 'lora-r'
            font = F(font_key, size)
            bbox = font.getbbox(line)
            if (bbox[2] - bbox[0]) > max_width:
                ok = False
                break
        if ok:
            return size
        size -= 6
    return min_size


def render_slide_tensao(
    out_path,
    texto_meta='MANUAL DO DINHEIRO  ·  CAP. 04',
    numero_grande='04',
    titulo=(('Sua reserva', 'r'),
            ('está menor', 'r'),
            ('do que você', 'r'),
            ('pensa.', 'i')),
    cap_num='04',
    cap_nome='A Reserva de Emergência',
    cap_desc=('Quase todo mundo calcula errado.',
              'O número certo te protege —',
              'o errado te dá falsa segurança.'),
    cap_total='08',
):
    base = Image.new('RGBA', (W, H), (*BG, 255))
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    # 1. Moldura fina (INK alpha=40)
    d.rectangle([(40, 40), (W - 40, H - 40)], outline=(*INK, 40), width=2)

    # 2. TOPO - tag à esquerda
    tag_font = F('pop-m', 24)
    draw_tracked(d, (M, 100), texto_meta, tag_font, ACCENT, tracking=3)

    # 2. TOPO - PRADEX à direita
    pradex_font = F('pop-b', 22)
    pbox = pradex_font.getbbox('PRADEX')
    pradex_w = pbox[2] - pbox[0]
    d.text((W - M - pradex_w, 102), 'PRADEX', font=pradex_font, fill=INK)

    # 2. TOPO - linha horizontal
    d.line([(M, 145), (W - M, 145)], fill=(*INK, 90), width=2)

    # 3. NÚMERO DECORATIVO (Lora-Italic, gigante, top-right, alpha 90)
    num_font_size = 230
    num_font = F('lora-i', num_font_size)
    nbox = num_font.getbbox(numero_grande)
    num_w = nbox[2] - nbox[0]
    d.text((W - M - num_w, 180), numero_grande, font=num_font, fill=(*ACCENT, 95))

    # 4. HERO TEXT (Lora, 2-4 linhas, alterna regular/italic)
    titulo_list = list(titulo)
    headline_size = _fit_title_size(titulo_list, max_size=118, min_size=66)
    # Posição vertical: arranja o bloco entre y=490 e y=~1080 (acima do bloco capítulo).
    n_lines = len(titulo_list)
    line_h = int(headline_size * 1.16)
    block_h = n_lines * line_h
    y_start = 490
    # se o bloco for muito alto, encolhe line_h um pouco
    max_block_h = 1100 - y_start  # até começar bloco capítulo
    if block_h > max_block_h:
        line_h = max_block_h // n_lines
    y = y_start
    for line, style in titulo_list:
        font_key = 'lora-i' if style == 'i' else 'lora-r'
        font = F(font_key, headline_size)
        d.text((M, y), line, font=font, fill=INK)
        y += line_h

    # 5. BLOCO CAPÍTULO (linha curta + CAPÍTULO XX + nome + descrição)
    bloco_y = 1140
    # Linha curta terracota
    d.rectangle([(M, bloco_y), (M + 64, bloco_y + 3)], fill=ACCENT)
    # CAPÍTULO XX
    d.text((M, bloco_y + 24), f'CAPÍTULO {cap_num}', font=F('pop-b', 30), fill=INK)
    # Nome do capítulo (Lora regular)
    d.text((M, bloco_y + 68), cap_nome, font=F('lora-r', 44), fill=INK)
    # Descrição (até 3 linhas)
    desc_y = bloco_y + 128
    desc_font = F('pop-r', 22)
    for line in list(cap_desc)[:3]:
        d.text((M, desc_y), line, font=desc_font, fill=INK_SOFT)
        desc_y += 32

    # 6. RODAPÉ — "deslize ››" à esquerda + "uma série em N partes" à direita
    rodape_y = 1430
    d.text((M, rodape_y), 'deslize  ›  ›', font=F('pop-m', 24), fill=ACCENT)
    serie_font = F('pop-r', 22)
    serie_text = f'uma série em {int(cap_total)} partes'
    sbox = serie_font.getbbox(serie_text)
    serie_w = sbox[2] - sbox[0]
    d.text((W - M - serie_w, rodape_y + 2), serie_text, font=serie_font, fill=INK_SOFT)

    composed = Image.alpha_composite(base, overlay).convert('RGB')
    final = add_grain(composed, intensity=5)
    final.save(out_path, 'PNG', optimize=True)
    return out_path


# CLI: python slide_tensao.py input.json output.png
# input.json schema:
# {
#   "texto_meta": "MANUAL DO DINHEIRO  ·  CAP. 04",
#   "numero_grande": "04",
#   "titulo": [["Sua reserva", "r"], ["está menor", "r"], ["do que você", "r"], ["pensa.", "i"]],
#   "cap_num": "04",
#   "cap_nome": "A Reserva de Emergência",
#   "cap_desc": ["Quase todo mundo calcula errado.", "O número certo te protege —", "o errado te dá falsa segurança."],
#   "cap_total": "08"
# }
if __name__ == '__main__':
    if len(sys.argv) < 3:
        out = sys.argv[1] if len(sys.argv) > 1 else 'slide-tensao-smoke.png'
        render_slide_tensao(out)
        print(f'Smoke test salvo: {out}')
    else:
        input_path = sys.argv[1]
        out_path = sys.argv[2]
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if 'titulo' in data:
            data['titulo'] = [tuple(t) for t in data['titulo']]
        import inspect
        valid_keys = set(inspect.signature(render_slide_tensao).parameters.keys()) - {'out_path'}
        clean_data = {k: v for k, v in data.items() if k in valid_keys}
        render_slide_tensao(out_path, **clean_data)
        print(f'Salvo: {out_path}')
