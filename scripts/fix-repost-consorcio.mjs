// fix-repost-consorcio.mjs — repõe a peça de 07/08 na fila curada depois do
// publish que morreu em PROCESSING_DOWNLOAD (run 31182073015, inbox nunca chegou).
// Reverte o status na pauta E remove a linha do histórico (senão a trava R1 barra o repost).
import { readFileSync, writeFileSync } from 'node:fs';

const pauta = JSON.parse(readFileSync('data/pauta.json', 'utf8'));
const it = pauta.find((x) => x.id === '2026-08-07-campanha-consorcio-abertura');
if (!it) throw new Error('item nao encontrado na pauta');
it.status = 'pendente';
delete it.postado_em;
it.obs = (it.obs || '') + ' REPOST: 1a tentativa (run 31182073015) morreu em PROCESSING_DOWNLOAD no TikTok, inbox nunca chegou.';
writeFileSync('data/pauta.json', JSON.stringify(pauta, null, 2) + '\n');

let hist = JSON.parse(readFileSync('data/historico.json', 'utf8'));
const antes = hist.length;
hist = hist.filter((x) => !(x.data === '2026-08-07' && x.origem === 'pauta-curada' && /consorcio/.test(x.slug || '')));
writeFileSync('data/historico.json', JSON.stringify(hist, null, 2) + '\n');

const sf = JSON.parse(readFileSync('data/status-fila.json', 'utf8'));
sf.pendentes_carrossel = pauta.filter((x) => x.tipo === 'carrossel' && x.status === 'pendente').length;
sf.proximo = '2026-08-07 · carrossel · Campanha de consórcio (REPOST)';
writeFileSync('data/status-fila.json', JSON.stringify(sf, null, 2) + '\n');

console.log(`ok: pauta=pendente, historico ${antes}->${hist.length}, pendentes_carrossel=${sf.pendentes_carrossel}`);
