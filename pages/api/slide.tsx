import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { PradexCapa } from '../../lib/templates/pradex-capa';
import { PradexConceito } from '../../lib/templates/pradex-conceito';
import { PradexLista } from '../../lib/templates/pradex-lista';
import { PradexQuote } from '../../lib/templates/pradex-quote';

export const config = { runtime: 'edge' };

const WIDTH = 1080;
const HEIGHT = 1920;

// ── Fontes carregadas em runtime (jsDelivr + fontsource — formato TTF) ──
// Satori (engine do @vercel/og) NÃO suporta WOFF2 — só TTF/OTF.
// jsDelivr serve TTF do projeto fontsource com URLs estáveis e versionadas.
const FONT_URLS = {
  interRegular:
    'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf',
  interBold:
    'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf',
  interExtraBold:
    'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-800-normal.ttf',
  playfairRegular:
    'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-500-normal.ttf',
  playfairBold:
    'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-normal.ttf',
  playfairItalic:
    'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-500-italic.ttf',
  playfairBoldItalic:
    'https://cdn.jsdelivr.net/fontsource/fonts/playfair-display@latest/latin-700-italic.ttf',
};

async function loadFonts() {
  const fetchFont = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font fetch failed (${res.status}): ${url}`);
    return await res.arrayBuffer();
  };
  const [inR, inB, inEB, pfR, pfB, pfI, pfBI] = await Promise.all([
    fetchFont(FONT_URLS.interRegular),
    fetchFont(FONT_URLS.interBold),
    fetchFont(FONT_URLS.interExtraBold),
    fetchFont(FONT_URLS.playfairRegular),
    fetchFont(FONT_URLS.playfairBold),
    fetchFont(FONT_URLS.playfairItalic),
    fetchFont(FONT_URLS.playfairBoldItalic),
  ]);
  return [
    { name: 'Inter', data: inR, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: inB, weight: 700 as const, style: 'normal' as const },
    { name: 'Inter', data: inEB, weight: 800 as const, style: 'normal' as const },
    { name: 'Playfair', data: pfR, weight: 500 as const, style: 'normal' as const },
    { name: 'Playfair', data: pfB, weight: 700 as const, style: 'normal' as const },
    { name: 'Playfair', data: pfI, weight: 500 as const, style: 'italic' as const },
    { name: 'Playfair', data: pfBI, weight: 700 as const, style: 'italic' as const },
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
