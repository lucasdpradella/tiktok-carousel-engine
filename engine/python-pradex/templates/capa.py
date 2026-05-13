"""
Render CAPA - Post 4 do Manual do Dinheiro / Pradex
1080 x 1920 PNG editorial: paleta creme + terracota + charcoal.
"""
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from pathlib import Path

W, H = 1080, 1920
M = 90

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


def measure_tracked(text, font, tracking=0):
    """Calcula a largura total de uma string com letter-spacing."""
    w = 0
    for ch in text:
        bbox = font.getbbox(ch)
        w += (bbox[2] - bbox[0]) + tracking
    return max(0, w - tracking)  # último char nao precisa tracking depois


def add_grain(img, intensity=6):
    """Ruido gaussiano leve sobre RGB. Preserva alpha se houver."""
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


def render_capa(out_path,
                num='04',
                cap_num='01',
                cap_total='08',
                cap_nome='Os 3 erros',
                cap_desc=('Por que tanta gente tenta se',
                          'organizar financeiramente e',
                          'trava no primeiro mês.'),
                hero_lines=(('Se você', 'r'),
                            ('faz isso,', 'i'),
                            ('nunca vai', 'r'),
                            ('sair do lugar.', 'i'))):
    # Trabalhamos em RGBA pra suportar alpha em alguns elementos
    base = Image.new('RGBA', (W, H), (*BG, 255))
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    # 1. Moldura fina (INK alpha=40)
    d.rectangle([(40, 40), (W - 40, H - 40)], outline=(*INK, 40), width=2)

    # 2. TOPO - tag à esquerda (tracking ajustado: 6 fica MUITO espacado, uso 4)
    tag_text = f"MANUAL DO DINHEIRO  ·  {num} DE {cap_total}"
    tag_font = F('pop-m', 30)
    draw_tracked(d, (M, 110), tag_text, tag_font, ACCENT, tracking=4)

    # 2. TOPO - PRADEX à direita
    pradex_font = F('pop-b', 24)
    pbox = pradex_font.getbbox('PRADEX')
    pradex_w = pbox[2] - pbox[0]
    # Alinhar baseline com a tag: tag é maior, então alinhamos verticalmente
    # pelo topo do glifo; ajuste fino +10 px
    d.text((W - M - pradex_w, 120), 'PRADEX', font=pradex_font, fill=INK)

    # 2. TOPO - linha horizontal
    d.line([(M, 168), (W - M, 168)], fill=(*INK, 90), width=2)

    # 3. Número decorativo "04" - Lora Italic 200pt alpha=90 top-right
    num_font = F('lora-i', 200)
    nbox = num_font.getbbox(num)
    num_w = nbox[2] - nbox[0]
    d.text((W - M - num_w, 240), num, font=num_font, fill=(*ACCENT, 90))

    # 4. HERO TEXT (4 linhas alternando regular / italic)
    y = 480
    line_h = 155
    for line, style in hero_lines:
        font = F('lora-i' if style == 'i' else 'lora-r', 140)
        d.text((M, y), line, font=font, fill=INK)
        y += line_h

    # 5. BLOCO CAPÍTULO
    # Linha curta terracota
    d.rectangle([(M, 1380), (M + 80, 1384)], fill=ACCENT)
    # CAPÍTULO XX
    d.text((M, 1408), f"CAPÍTULO {cap_num}", font=F('pop-b', 38), fill=INK)
    # Nome do capítulo
    d.text((M, 1460), cap_nome, font=F('lora-r', 58), fill=INK)
    # Descrição (3 linhas)
    desc_y = 1530
    desc_font = F('pop-r', 28)
    for ln in cap_desc:
        d.text((M, desc_y), ln, font=desc_font, fill=INK_SOFT)
        desc_y += 42

    # 6. RODAPÉ (y = 1790)
    d.text((M, 1790), 'deslize  ›  ›', font=F('pop-m', 28), fill=ACCENT)
    serie_font = F('pop-r', 26)
    serie_text = 'uma série em 8 partes'
    sbox = serie_font.getbbox(serie_text)
    serie_w = sbox[2] - sbox[0]
    d.text((W - M - serie_w, 1790), serie_text, font=serie_font, fill=INK_SOFT)

    # Composição final
    composed = Image.alpha_composite(base, overlay).convert('RGB')

    # Grain
    final = add_grain(composed, intensity=6)

    final.save(out_path, 'PNG', optimize=True)
    return out_path


if __name__ == '__main__':
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else 'capa-post-04.png'
    render_capa(out)
    print(f'Salvo: {out}')
