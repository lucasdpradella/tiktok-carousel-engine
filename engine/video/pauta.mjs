// pauta.mjs — a FILA CURADA (data/pauta.json), abastecida pelo Cowork com aprovação do Lucas.
// É a fonte PRIMÁRIA dos runners; as temas-*.json viraram RESERVA (roteirista automático).
//
// Item da pauta:
//   {
//     "id": "2026-08-04-fii-papel-tijolo",
//     "tipo": "carrossel" | "video",
//     "tema": "Você comprou o FII errado",
//     "resumo": "opcional — o ângulo que o roteirista deve seguir",
//     "categoria": "fii",
//     "assets": "docs/post-carrossel-manual-2026-08-04",   // vazio = só pauta
//     "agendar": "2026-08-04",                              // vazio = assim que der
//     "status": "pendente" | "postado" | "bloqueado"
//   }
//
// assets PREENCHIDO  → post PRÉ-PRONTO: publica os JPEG/MP4 + caption.txt da pasta COMO ESTÃO.
//                      Sem roteirista, sem Gemini, sem gerar fundo. (Caminho da Expert XP,
//                      generalizado.) Os assets já estão commitados → já estão no Pages.
// assets VAZIO       → só pauta: o roteirista escreve EM CIMA do tema/resumo dados; ele não
//                      escolhe assunto sozinho.
//
// Publicou um item curado → status "postado", entra no histórico com origem "pauta-curada" e
// os estado-*.json NÃO se mexem (as filas de reserva ficam paradas onde estão).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(__dirname, '../..');
export const PAUTA = resolve(REPO, 'data/pauta.json');
export const STATUS_FILA = resolve(REPO, 'data/status-fila.json');

/** lê data/pauta.json (array). Não existe ainda → []. */
export async function lerPauta() {
  if (!existsSync(PAUTA)) return [];
  const raw = JSON.parse(await readFile(PAUTA, 'utf-8'));
  return Array.isArray(raw) ? raw : [];
}

async function gravarPauta(pauta) {
  await mkdir(dirname(PAUTA), { recursive: true });
  await writeFile(PAUTA, JSON.stringify(pauta, null, 2) + '\n');
}

/**
 * Primeiro item `pendente` do tipo pedido cuja `agendar` já chegou (ou que não tem data).
 * Respeita a ORDEM do arquivo — a fila é do Cowork, o runner não reordena.
 */
export function proximoPendente(pauta, tipo, hoje) {
  return (
    pauta.find(
      (it) =>
        it &&
        it.tipo === tipo &&
        (it.status || 'pendente') === 'pendente' &&
        (!it.agendar || String(it.agendar) <= hoje),
    ) || null
  );
}

/** marca um item como postado (ou bloqueado, com motivo) e regrava a pauta. */
export async function marcarItem(id, status, extra = {}) {
  const pauta = await lerPauta();
  const it = pauta.find((x) => x && x.id === id);
  if (!it) {
    console.warn(`[pauta] item "${id}" não encontrado — nada a marcar.`);
    return null;
  }
  it.status = status;
  Object.assign(it, extra);
  await gravarPauta(pauta);
  console.log(`[pauta] "${id}" → status=${status}${extra.motivo ? ` (${extra.motivo})` : ''}`);
  return it;
}

/**
 * Assets de um post PRÉ-PRONTO. Lê a pasta committada e devolve os arquivos publicáveis + caption.
 * @returns {{dir:string, postDir:string, arquivos:string[], caption:string, tipoAsset:'foto'|'video'}}
 */
export function lerAssets(relDir) {
  const dir = resolve(REPO, relDir);
  if (!existsSync(dir)) throw new Error(`[pauta] assets não existem: ${relDir}`);
  const todos = readdirSync(dir);

  const fotos = todos.filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
  const videos = todos.filter((f) => /\.mp4$/i.test(f)).sort();
  if (!fotos.length && !videos.length) throw new Error(`[pauta] ${relDir} não tem JPEG/PNG nem MP4`);

  const capPath = resolve(dir, 'caption.txt');
  if (!existsSync(capPath)) throw new Error(`[pauta] ${relDir} sem caption.txt`);

  return {
    dir,
    postDir: relDir.replace(/^docs\//, '').replace(/\/$/, ''),
    arquivos: videos.length ? videos : fotos,
    tipoAsset: videos.length ? 'video' : 'foto',
    capPath,
  };
}

/** lê a caption de um pré-pronto (já vem final; o runner só garante as hashtags obrigatórias). */
export async function lerCaption(capPath) {
  return (await readFile(capPath, 'utf-8')).trim();
}

/**
 * data/status-fila.json — é o que o Cowork lê pra saber quando cobrar pauta nova do Lucas,
 * ANTES de o roteirista automático assumir. Commitado ao fim de todo run real.
 */
export async function escreverStatusFila({ agora, reservaCarrossel, reservaVideo }) {
  const pauta = await lerPauta();
  const pend = (tipo) => pauta.filter((it) => it && it.tipo === tipo && (it.status || 'pendente') === 'pendente');
  const pc = pend('carrossel');
  const pv = pend('video');
  const proximo = [...pc, ...pv].sort((a, b) => String(a.agendar || '9999').localeCompare(String(b.agendar || '9999')))[0];

  const status = {
    pendentes_carrossel: pc.length,
    pendentes_video: pv.length,
    proximo: proximo ? `${proximo.agendar || 'sem data'} · ${proximo.tipo} · ${proximo.tema}` : null,
    reserva_carrossel_restante: reservaCarrossel,
    reserva_video_restante: reservaVideo,
    atualizado_em: agora,
  };
  await mkdir(dirname(STATUS_FILA), { recursive: true });
  await writeFile(STATUS_FILA, JSON.stringify(status, null, 2) + '\n');

  if (!pc.length && !pv.length) {
    console.log('::warning::[pauta] FILA CURADA VAZIA — sem pauta aprovada, os próximos runs caem no roteirista automático (ou saem limpos se a trava bloquear tudo).');
  }
  console.log(`[pauta] status-fila: carrossel=${pc.length} pendentes, vídeo=${pv.length} pendentes, reserva=${reservaCarrossel}/${reservaVideo}`);
  return status;
}
