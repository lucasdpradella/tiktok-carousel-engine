import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { PradexCapa } from '../../lib/templates/pradex-capa';
import { PradexConceito } from '../../lib/templates/pradex-conceito';
import { PradexLista } from '../../lib/templates/pradex-lista';
import { PradexQuote } from '../../lib/templates/pradex-quote';

export const config = { runtime: 'edge' };

const WIDTH = 1080;
const HEIGHT = 1920;

// ── Fontes carregadas em runtime (Google Fonts CDN — Latin subset) ────
// Inter v20 e Playfair Display v40 são variable fonts:
//   - Inter normal: 1 URL serve 400/700/800
//   - Playfair Display: 1 URL pra normal, outra pra italic (variable axes)
// URLs auditadas em 2026-05-12 contra fonts.googleapis.com/css2.
// Se quebrarem, refazer via: fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&family=Playfair+Display:ital,wght@0,500;0,700;1,500;1,700&display=swap') e pegar as URLs Latin (unicode-range U+0000-00FF).
const FONT_URLS = {
  interLatin:
    'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2',
  playfairLatinNormal:
    'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgA.woff2',
  playfairLatinItalic:
    'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFkD-vYSZviVYUb_rj3ij__anPXDTnogkk7.woff2',
};

async function loadFonts() {
  const fetchFont = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font fetch failed (${res.status}): ${url}`);
    return await res.arrayBuffer();
  };
  const [inter, pfNormal, pfItalic] = await Promise.all([
    fetchFont(FONT_URLS.interLatin),
    fetchFont(FONT_URLS.playfairLatinNormal),
    fetchFont(FONT_URLS.playfairLatinItalic),
  ]);
  // Mesmo binário serve múltiplos weights pq são variable fonts; Satori usa o weight do estilo declarado.
  return [
    { name: 'Inter', data: inter, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: inter, weight: 700 as const, style: 'normal' as const },
    { name: 'Inter', data: inter, weight: 800 as const, style: 'normal' as const },
    { name: 'Playfair', data: pfNormal, weight: 500 as const, style: 'normal' as const },
    { name: 'Playfair', data: pfNormal, weight: 700 as const, style: 'normal' as const },
    { name: 'Playfair', data: pfItalic, weight: 500 as const, style: 'italic' as const },
    { name: 'Playfair', data: pfItalic, weight: 700 as const, style: 'italic' as const },
  ];
}

/**
 * Endpoint principal de composição de slide.
 *
 * Templates suportados:
 *   - pradex-capa          (capa de série/módulo)
 *   - pradex-conceito      (slide de reframe "ideia errada → ideia certa")
 *   - pradex-lista         (3 itens com badge)
 *   - pradex-quote         (frase de impacto)
 *
 * Use ~palavra~ no campo titulo/corpoDestaque/quote pra marcar palavra em itálico/destaque.
 *
 * Params comuns:
 *   - template, serie, ordem, marca, token (auth opcional)
 *
 * Outros params dependem do template. Body via querystring (todos JSON-escapados).
 * Pra payloads grandes (listas), aceita também POST com JSON body.
 */
export default async function handler(req: NextRequest) {
  try {
    let params: Record<string, any> = {};
    if (req.method === 'POST') {
      params = await req.json();
    } else {
      const { searchParams } = new URL(req.url);
      searchParams.forEach((v, k) => {
        params[k] = v;
      });
      // Tentar parsear "itens" como JSON se vier por querystring
      if (typeof params.itens === 'string') {
        try {
          params.itens = JSON.parse(params.itens);
        } catch {
          /* ignore */
        }
      }
      if (typeof params.bullets === 'string') {
        try {
          params.bullets = JSON.parse(params.bullets);
        } catch {
          /* ignore */
        }
      }
    }

    // Auth opcional
    const required = process.env.VERCEL_RENDER_TOKEN;
    if (required) {
      const got = params.token || req.headers.get('authorization')?.replace('Bearer ', '');
      if (got !== required) return new Response('unauthorized', { status: 401 });
    }

    const template = params.template ?? '';
    const serie = params.serie ?? 'MANUAL DO DINHEIRO';
    const ordem = params.ordem ?? '01 DE 08';
    const marca = params.marca ?? 'PRADEX';

    let element: React.ReactElement;

    switch (template) {
      case 'pradex-capa':
        element = (
          <PradexCapa
            serie={serie}
            ordem={ordem}
            marca={marca}
            numero={params.numero ?? '01'}
            titulo={params.titulo ?? ''}
            moduloLabel={params.moduloLabel ?? 'MÓDULO 01'}
            moduloTitulo={params.moduloTitulo ?? ''}
            moduloDescricao={params.moduloDescricao ?? ''}
            rodapeEsq={params.rodapeEsq}
            rodapeDir={params.rodapeDir}
          />
        );
        break;
      case 'pradex-conceito':
        element = (
          <PradexConceito
            serie={serie}
            ordem={ordem}
            marca={marca}
            tituloRiscado={params.tituloRiscado}
            titulo={params.titulo ?? ''}
            corpoDestaque={params.corpoDestaque ?? ''}
            explicacao={params.explicacao ?? ''}
            bullets={Array.isArray(params.bullets) ? params.bullets : []}
            proximoLabel={params.proximoLabel}
            proximoTitulo={params.proximoTitulo}
          />
        );
        break;
      case 'pradex-lista':
        if (!Array.isArray(params.itens) || params.itens.length === 0) {
          return new Response('missing or invalid: itens', { status: 400 });
        }
        element = (
          <PradexLista
            serie={serie}
            ordem={ordem}
            marca={marca}
            titulo={params.titulo ?? ''}
            itens={params.itens}
            rodapeNota={params.rodapeNota}
            proximoLabel={params.proximoLabel}
            proximoTitulo={params.proximoTitulo}
            pillLabel={params.pillLabel}
          />
        );
        break;
      case 'pradex-quote':
        element = (
          <PradexQuote
            serie={serie}
            ordem={ordem}
            marca={marca}
            quote={params.quote ?? ''}
            autoria={params.autoria}
            rodapeContexto={params.rodapeContexto}
          />
        );
        break;
      default:
        return new Response(
          'invalid template. options: pradex-capa, pradex-conceito, pradex-lista, pradex-quote',
          { status: 400 },
        );
    }

    const fonts = await loadFonts();

    return new ImageResponse(element, {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return new Response(`render error: ${msg}`, { status: 500 });
  }
}
