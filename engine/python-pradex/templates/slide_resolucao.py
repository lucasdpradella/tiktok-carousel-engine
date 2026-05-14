"""
Render SLIDE RESOLUÇÃO (2/2) - Manual do Dinheiro / Pradex
1024 x 1536 PNG editorial: paleta creme + terracota + charcoal.

Layout fixo, data-driven. Recebe:
- texto_meta: "MANUAL DO DINHEIRO · 02 / 02" (caps, tracked, orange, top-left)
- titulo: lista de (texto, estilo) onde estilo ∈ {'r','i','i_underline'}
- bullets: lista de (numero, titulo, descricao) — 1..4 itens
- tagline: lista de strings (cada item = 1 linha italic, bottom-left)
- proximo: string opcional (footer "Próximo: ..."); None = footer vazio
- sticker_path: caminho do PNG do sticker
- dica_label: texto do pill (default "DICA DO PRADELLA")

CLI: python slide_resolucao.py <input_json> <output_png>
    onde input_json é um JSON com os parametros acima.
"""
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from pathlib import Path
import sys
import json

# Canvas (matching gpt-image-1 slide 1 output)
W, H = 1024, 1536
M = 80  # margem lateral

# Paleta (idêntica ao capa.py)
BG       = (241, 236, 226)   # creme
INK      = (21, 23, 28)      # charcoal
INK_SOFT = (60, 64, 72)      # graphite
ACCENT   = (184, 69, 31)     # terracota
WHITE    = (255, 255, 255)

FONTS_DIR  = Path(__file__).parent.parent / 'fonts'
ASSETS_DIR = Path(__file__).parent.parent / 'assets'

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
    return x  # devolve x final pra calcular largura


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


def render_pill(draw, xy, text, font, fill_bg, fill_text, padding_x=22, padding_y=10, tracking=2):
    """Desenha pill arredondado (fundo + texto centralizado). Retorna (largura, altura) do pill."""
    text_w = measure_tracked(text, font, tracking)
    bbox = font.getbbox(text)
    text_h = bbox[3] - bbox[1]
    pill_w = text_w + 2 * padding_x
    pill_h = text_h + 2 * padding_y
    x, y = xy
    # rounded rectangle
    draw.rounded_rectangle(
        [(x, y), (x + pill_w, y + pill_h)],
        radius=pill_h // 2,
        fill=fill_bg,
    )
    # texto centralizado verticalmente (com pequeno ajuste pro baseline do Poppins)
    text_x = x + padding_x
    text_y = y + padding_y - bbox[1]  # subtrai o ascender offset
    draw_tracked(draw, (text_x, text_y), text, font, fill_text, tracking=tracking)
    return pill_w, pill_h


def render_slide_resolucao(
    out_path,
    texto_meta='MANUAL DO DINHEIRO  ·  02 / 02',
    titulo=(('Por onde', 'r'), ('começar.', 'i_underline')),
    bullets=(
        ('01', 'Mapear', 'Saber pra onde seu dinheiro está indo todo mês.'),
        ('02', 'Reservar', 'Construir a reserva de emergência antes de qualquer investimento.'),
        ('03', 'Direcionar', 'Definir objetivos com prazo e valor — não só desejos.'),
    ),
    tagline=('Não pule a etapa 02.', 'Investir sem reserva é', 'construir em areia.'),
    proximo='como montar seu mapa',
    sticker_path=None,
    dica_label='DICA DO PRADELLA',
):
    base = Image.new('RGBA', (W, H), (*BG, 255))
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    # 1. Moldura fina (INK alpha=40)
    d.rectangle([(40, 40), (W - 40, H - 40)], outline=(*INK, 40), width=2)

    # 2. TOPO - tag à esquerda (tracking 3)
    tag_font = F('pop-m', 24)
    draw_tracked(d, (M, 100), texto_meta, tag_font, ACCENT, tracking=3)

    # 2. TOPO - PRADEX à direita
    pradex_font = F('pop-b', 22)
    pbox = pradex_font.getbbox('PRADEX')
    pradex_w = pbox[2] - pbox[0]
    d.text((W - M - pradex_w, 102), 'PRADEX', font=pradex_font, fill=INK)

    # 2. TOPO - linha horizontal
    d.line([(M, 145), (W - M, 145)], fill=(*INK, 90), width=2)

    # 3. HEADLINE (Lora, 2 linhas, suporta italic + underline orange)
    # Auto-fit: se alguma linha estourar a largura útil (W - 2*M), encolhe a fonte até caber.
    # Evita o caso clássico de o modelo gerar linha 2 longa demais (ex: "com base nos gastos").
    y = 230
    max_size = 105
    min_size = 60
    available_w = W - 2 * M
    headline_size = max_size
    while headline_size >= min_size:
        ok = True
        for line, style in titulo:
            font_key = 'lora-i' if style.startswith('i') else 'lora-r'
            font = F(font_key, headline_size)
            box = font.getbbox(line)
            if (box[2] - box[0]) > available_w:
                ok = False
                break
        if ok:
            break
        headline_size -= 5
    # Espaço entre linhas escala com o tamanho da fonte
    line_h = int(headline_size * 1.19)
    for line, style in titulo:
        font_key = 'lora-i' if style.startswith('i') else 'lora-r'
        font = F(font_key, headline_size)
        d.text((M, y), line, font=font, fill=INK)
        if style == 'i_underline':
            box = font.getbbox(line)
            line_w = box[2] - box[0]
            # underline bem abaixo do descender pra não bater no "ç" ou "ç"
            underline_y = y + headline_size + int(headline_size * 0.21)
            d.rectangle(
                [(M, underline_y), (M + line_w, underline_y + 4)],
                fill=ACCENT,
            )
        y += line_h

    # 4. BULLETS — 3 itens com numero grande à esquerda
    # Ocupa só metade esquerda pra deixar espaço pro sticker à direita
    bullets_y_start = 540
    bullet_spacing = 115
    num_font = F('lora-i', 56)
    title_font = F('pop-b', 29)
    desc_font = F('pop-r', 20)
    num_col_w = 70
    bullets_max_width = (W // 2) - 20 - M - num_col_w  # texto não invade área do sticker

    for idx, (numero, titulo_b, desc) in enumerate(bullets):
        by = bullets_y_start + idx * bullet_spacing
        # número
        d.text((M, by - 8), numero, font=num_font, fill=ACCENT)
        # título
        d.text((M + num_col_w, by), titulo_b, font=title_font, fill=INK)
        # descrição (quebra em 2 linhas se for longa)
        desc_lines = _wrap_text(desc, desc_font, max_width=bullets_max_width)
        for li, line in enumerate(desc_lines[:2]):  # cap em 2 linhas
            d.text((M + num_col_w, by + 42 + li * 27), line, font=desc_font, fill=INK_SOFT)

    # 5. TAGLINE (italic, bottom-left) — ocupa só metade esquerda
    tagline_y = 1180
    tagline_font = F('lora-i', 34)
    tagline_lh = 46
    for i, line in enumerate(tagline):
        d.text((M, tagline_y + i * tagline_lh), line, font=tagline_font, fill=INK)

    # 6. RODAPÉ "Próximo:"
    if proximo:
        d.text((M, 1410), 'Próximo:', font=F('pop-r', 20), fill=INK_SOFT)
        d.text((M, 1438), f'{proximo}  ›', font=F('pop-m', 26), fill=ACCENT)

    # 7. STICKER (canto direito, protagonista) + PILL acima
    # Composição com sticker se fornecido
    composed = Image.alpha_composite(base, overlay)

    sticker_target_h = 280  # protagonista mas sem invadir tagline / bullets
    pill_font = F('pop-b', 20)
    pill_padding_x = 20
    pill_padding_y = 9
    pill_text_w = measure_tracked(dica_label, pill_font, tracking=2)
    pill_w = pill_text_w + 2 * pill_padding_x

    if sticker_path:
        sticker_p = Path(sticker_path)
        if not sticker_p.is_absolute():
            sticker_p = ASSETS_DIR / sticker_p
        if sticker_p.exists():
            sticker = Image.open(sticker_p).convert('RGBA')
            ratio = sticker_target_h / sticker.height
            target_w = int(sticker.width * ratio)
            sticker = sticker.resize((target_w, sticker_target_h), Image.LANCZOS)
            # posicionar à direita, vertical centralizado na zona inferior
            sticker_x = W - M - target_w + 35
            sticker_y = 940
            composed.paste(sticker, (sticker_x, sticker_y), sticker)
            # pill flutuando sobre o topo do sticker
            pill_x = sticker_x + (target_w - pill_w) // 2
            pill_y = sticker_y - 10
        else:
            pill_x = W - M - pill_w
            pill_y = 1080
    else:
        pill_x = W - M - pill_w
        pill_y = 1080

    # desenha o pill DEPOIS do paste do sticker (fica por cima)
    overlay_pill = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dp = ImageDraw.Draw(overlay_pill)
    render_pill(dp, (pill_x, pill_y), dica_label, pill_font,
                fill_bg=ACCENT, fill_text=WHITE,
                padding_x=pill_padding_x, padding_y=pill_padding_y, tracking=2)
    composed = Image.alpha_composite(composed, overlay_pill)

    final = add_grain(composed.convert('RGB'), intensity=5)
    final.save(out_path, 'PNG', optimize=True)
    return out_path


def _wrap_text(text, font, max_width):
    """Quebra texto em linhas que cabem em max_width pixels."""
    words = text.split()
    lines = []
    current = []
    for w in words:
        test = ' '.join(current + [w])
        box = font.getbbox(test)
        if (box[2] - box[0]) <= max_width:
            current.append(w)
        else:
            if current:
                lines.append(' '.join(current))
            current = [w]
    if current:
        lines.append(' '.join(current))
    return lines


# CLI: python slide_resolucao.py input.json output.png
# input.json schema:
# {
#   "texto_meta": "MANUAL DO DINHEIRO  ·  02 / 02",
#   "titulo": [["Por onde", "r"], ["começar.", "i_underline"]],
#   "bullets": [
#     ["01", "Mapear", "Saber pra onde..."],
#     ["02", "Reservar", "Construir a..."],
#     ["03", "Direcionar", "Definir objetivos..."]
#   ],
#   "tagline": ["Não pule a etapa 02.", "Investir sem reserva...", "...em areia."],
#   "proximo": "como montar seu mapa",
#   "sticker_path": "lucas_sticker_headset.png",
#   "dica_label": "DICA DO PRADELLA"
# }
if __name__ == '__main__':
    if len(sys.argv) < 3:
        # smoke test usando defaults
        out = sys.argv[1] if len(sys.argv) > 1 else 'slide-resolucao-smoke.png'
        render_slide_resolucao(out, sticker_path='lucas_sticker_headset.png')
        print(f'Smoke test salvo: {out}')
    else:
        input_path = sys.argv[1]
        out_path = sys.argv[2]
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # converter listas de listas pra tuplas (titulo + bullets)
        if 'titulo' in data:
            data['titulo'] = [tuple(t) for t in data['titulo']]
        if 'bullets' in data:
            data['bullets'] = [tuple(b) for b in data['bullets']]
        import inspect
        valid_keys = set(inspect.signature(render_slide_resolucao).parameters.keys()) - {'out_path'}
        clean_data = {k: v for k, v in data.items() if k in valid_keys}
        render_slide_resolucao(out_path, **clean_data)
        print(f'Salvo: {out_path}')
