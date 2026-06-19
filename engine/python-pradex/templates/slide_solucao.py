"""
Render SLIDE SOLUÇÃO (3/3) - Manual do Dinheiro / Pradex - LAYOUT C
1024 x 1536 PNG: o slide de pitch do PRADEX, SÓ em posts-puxada.
Mesma marca dos slides 1 e 2 (creme + terracota + Lora/Poppins + header) — não é
um anúncio de fora, é a mesma família visual. NÃO substitui slide_tensao/resolucao.

Layout fixo, data-driven. Recebe:
- texto_meta: "MANUAL DO DINHEIRO  ·  CAP. NN" (caps, tracked, orange, top-left)
- hook: lista de (texto, estilo) ∈ {'r','i'} — 2 linhas grandes serif (auto-fit)
- contraste: string curta (1 linha sans, ink_soft) — ex "Planilha trava. A cabeça esquece."
- mock_enviado: texto do balão "enviado" (à direita, verde suave) — ex "gastei 25 no almoço"
- mock_resposta: texto do balão PRADEX (à esquerda, branco) — ex "✓ Lançado em Alimentação — R$25"
- fecho: lista de strings — 2-4 linhas curtas serif laranja (auto-fit)
- cta: string da pill laranja (default "Grátis · link na bio")

CLI: python slide_solucao.py <input_json> <output_png>
"""
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from pathlib import Path
import sys
import json

# Canvas — idêntico aos slides 1 e 2 (1024x1536, 2:3 vertical)
W, H = 1024, 1536
M = 80  # margem lateral

# Paleta (idêntica aos outros templates)
BG       = (241, 236, 226)   # creme
INK      = (21, 23, 28)      # charcoal
INK_SOFT = (60, 64, 72)      # graphite
ACCENT   = (184, 69, 31)     # terracota
WHITE    = (255, 255, 255)
SENT     = (212, 224, 199)   # verde suave (balão "enviado", harmoniza com o creme)

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


def _fit_serif(lines, max_size, min_size, max_width):
    """Acha o maior tamanho de fonte serif em que todas as linhas cabem em max_width.
    `lines` é lista de (texto, estilo) — estilo ∈ {'r','i'}."""
    size = max_size
    while size >= min_size:
        ok = True
        for text, style in lines:
            font = F('lora-i' if style == 'i' else 'lora-r', size)
            box = font.getbbox(text)
            if (box[2] - box[0]) > max_width:
                ok = False
                break
        if ok:
            return size
        size -= 4
    return min_size


def render_pill(draw, xy, text, font, fill_bg, fill_text, padding_x=24, padding_y=12, tracking=2):
    """Pill arredondado (fundo + texto). Retorna (largura, altura)."""
    text_w = measure_tracked(text, font, tracking)
    bbox = font.getbbox(text)
    text_h = bbox[3] - bbox[1]
    pill_w = text_w + 2 * padding_x
    pill_h = text_h + 2 * padding_y
    x, y = xy
    draw.rounded_rectangle([(x, y), (x + pill_w, y + pill_h)], radius=pill_h // 2, fill=fill_bg)
    draw_tracked(draw, (x + padding_x, y + padding_y - bbox[1]), text, font, fill_text, tracking=tracking)
    return pill_w, pill_h


def render_bubble(draw, top_y, text, font, *, align, bg, fg, max_w, accent_first_token=False):
    """Desenha um balão de chat (rounded rect + cauda) e retorna a altura ocupada.

    align='right' → cola na margem direita (mensagem enviada).
    align='left'  → cola na margem esquerda (resposta PRADEX).
    accent_first_token → se a 1ª linha começa com "✓", desenha um check VETORIAL em
        ACCENT no lugar do glifo (Poppins não tem U+2713) e segue o texto normal.
    """
    pad_x, pad_y = 28, 22
    inner_max = max_w - 2 * pad_x
    lines = _wrap_text(text, font, inner_max) or ['']
    line_h = font.size + 12

    text_w = max((font.getbbox(ln)[2] - font.getbbox(ln)[0]) for ln in lines)
    bubble_w = min(max_w, text_w + 2 * pad_x)
    bubble_h = len(lines) * line_h + 2 * pad_y

    if align == 'right':
        x1 = W - M - bubble_w
    else:
        x1 = M
    x2 = x1 + bubble_w
    y1, y2 = top_y, top_y + bubble_h

    # corpo do balão
    if bg == WHITE:
        draw.rounded_rectangle([(x1, y1), (x2, y2)], radius=26, fill=bg, outline=(*INK, 35), width=2)
    else:
        draw.rounded_rectangle([(x1, y1), (x2, y2)], radius=26, fill=bg)

    # cauda (triângulo no topo, do lado correto)
    if align == 'right':
        draw.polygon([(x2 - 22, y1), (x2 + 6, y1), (x2 - 22, y1 + 22)], fill=bg)
    else:
        draw.polygon([(x1 + 22, y1), (x1 - 6, y1), (x1 + 22, y1 + 22)], fill=bg)

    # texto
    ty = y1 + pad_y
    for i, ln in enumerate(lines):
        tx = x1 + pad_x
        if i == 0 and accent_first_token and ln.startswith('✓'):
            # Poppins não tem o glifo U+2713 (sai tofu) → desenha o check à mão,
            # vetorial em ACCENT, alinhado à altura da maiúscula. Não depende de fonte.
            rest = ln[1:].lstrip()
            cap = font.getbbox('R')
            cap_top, cap_h = cap[1], cap[3] - cap[1]
            weight = max(3, font.size // 8)
            cx, cyt = tx, ty + cap_top
            draw.line(
                [(cx + cap_h * 0.12, cyt + cap_h * 0.55),
                 (cx + cap_h * 0.42, cyt + cap_h * 0.82),
                 (cx + cap_h * 0.92, cyt + cap_h * 0.16)],
                fill=ACCENT, width=weight, joint='curve',
            )
            space_adv = font.getbbox(' ')[2] - font.getbbox(' ')[0]
            rx = cx + cap_h + max(space_adv, int(font.size * 0.28))
            draw.text((rx, ty), rest, font=font, fill=fg)
        else:
            draw.text((tx, ty), ln, font=font, fill=fg)
        ty += line_h

    return bubble_h


def render_slide_solucao(
    out_path,
    texto_meta='MANUAL DO DINHEIRO  ·  CAP. 11',
    hook=(('E na prática,', 'r'), ('como você controla?', 'i')),
    contraste='Planilha trava. A cabeça esquece.',
    mock_enviado='gastei 25 no almoço',
    mock_resposta='✓ Lançado em Alimentação — R$25. Esse mês: 48% do essencial.',
    fecho=('No PRADEX você lança', 'pelo WhatsApp.', 'Ele divide o 50/30/20', 'por você.'),
    cta='Grátis · link na bio',
):
    base = Image.new('RGBA', (W, H), (*BG, 255))
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    # 1. Moldura fina (INK alpha=40) — igual aos outros
    d.rectangle([(40, 40), (W - 40, H - 40)], outline=(*INK, 40), width=2)

    # 2. HEADER — tag à esquerda + PRADEX à direita + linha (idêntico aos slides 1/2)
    draw_tracked(d, (M, 100), texto_meta, F('pop-m', 24), ACCENT, tracking=3)
    pradex_font = F('pop-b', 22)
    pbox = pradex_font.getbbox('PRADEX')
    d.text((W - M - (pbox[2] - pbox[0]), 102), 'PRADEX', font=pradex_font, fill=INK)
    d.line([(M, 145), (W - M, 145)], fill=(*INK, 90), width=2)

    # 3. HOOK (serif Lora, 2 linhas, auto-fit)
    hook_lines = [tuple(h) for h in hook]
    available_w = W - 2 * M
    hook_size = _fit_serif(hook_lines, max_size=92, min_size=54, max_width=available_w)
    hook_lh = int(hook_size * 1.16)
    y = 220
    for text, style in hook_lines:
        d.text((M, y), text, font=F('lora-i' if style == 'i' else 'lora-r', hook_size), fill=INK)
        y += hook_lh

    # 4. CONTRASTE (1 linha sans menor)
    y += 8
    contraste_font = F('pop-r', 26)
    for ln in _wrap_text(contraste, contraste_font, available_w)[:2]:
        d.text((M, y), ln, font=contraste_font, fill=INK_SOFT)
        y += 36

    # 5. MOCK DE WHATSAPP (centro visual): balão enviado (dir) + resposta PRADEX (esq)
    bubbles_y = max(y + 40, 560)
    bubble_font = F('pop-r', 30)
    bubble_max_w = int((W - 2 * M) * 0.74)
    h_sent = render_bubble(
        d, bubbles_y, mock_enviado, bubble_font,
        align='right', bg=SENT, fg=INK, max_w=bubble_max_w,
    )
    h_resp = render_bubble(
        d, bubbles_y + h_sent + 28, mock_resposta, bubble_font,
        align='left', bg=WHITE, fg=INK, max_w=bubble_max_w, accent_first_token=True,
    )
    bubbles_bottom = bubbles_y + h_sent + 28 + h_resp

    # 6. FECHO (serif laranja, 2-4 linhas, auto-fit)
    fecho_lines = [(ln, 'r') for ln in fecho]
    fecho_size = _fit_serif(fecho_lines, max_size=58, min_size=38, max_width=available_w)
    fecho_lh = int(fecho_size * 1.24)
    fecho_block_h = len(fecho_lines) * fecho_lh
    # ancora o fecho mais perto dos balões (subido ~50px), sem colar neles
    fecho_y = max(bubbles_bottom + 30, 1260 - fecho_block_h)
    for ln, _ in fecho_lines:
        d.text((M, fecho_y), ln, font=F('lora-r', fecho_size), fill=ACCENT)
        fecho_y += fecho_lh

    composed = Image.alpha_composite(base, overlay)

    # 7. CTA (pill laranja, centralizada no rodapé)
    overlay_pill = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dp = ImageDraw.Draw(overlay_pill)
    pill_font = F('pop-b', 24)
    pill_w = measure_tracked(cta, pill_font, tracking=2) + 2 * 30
    pill_x = (W - pill_w) // 2
    render_pill(dp, (pill_x, 1410), cta, pill_font, fill_bg=ACCENT, fill_text=WHITE,
                padding_x=30, padding_y=14, tracking=2)
    composed = Image.alpha_composite(composed, overlay_pill)

    final = add_grain(composed.convert('RGB'), intensity=5)
    final.save(out_path, 'PNG', optimize=True)
    return out_path


# CLI: python slide_solucao.py input.json output.png
# input.json schema:
# {
#   "texto_meta": "MANUAL DO DINHEIRO  ·  CAP. 11",
#   "hook": [["E na prática,", "r"], ["como você controla?", "i"]],
#   "contraste": "Planilha trava. A cabeça esquece.",
#   "mock_enviado": "gastei 25 no almoço",
#   "mock_resposta": "✓ Lançado em Alimentação — R$25. Esse mês: 48% do essencial.",
#   "fecho": ["No PRADEX você lança", "pelo WhatsApp.", "Ele divide o 50/30/20", "por você."],
#   "cta": "Grátis · link na bio"
# }
if __name__ == '__main__':
    if len(sys.argv) < 3:
        out = sys.argv[1] if len(sys.argv) > 1 else 'slide-solucao-smoke.png'
        render_slide_solucao(out)
        print(f'Smoke test salvo: {out}')
    else:
        input_path = sys.argv[1]
        out_path = sys.argv[2]
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if 'hook' in data:
            data['hook'] = [tuple(t) for t in data['hook']]
        import inspect
        valid_keys = set(inspect.signature(render_slide_solucao).parameters.keys()) - {'out_path'}
        clean_data = {k: v for k, v in data.items() if k in valid_keys}
        render_slide_solucao(out_path, **clean_data)
        print(f'Salvo: {out_path}')
