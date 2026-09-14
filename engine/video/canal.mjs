// canal.mjs — de qual CANAL esta run é.
//
// A engine serve dois canais de TikTok com o MESMO app de developers (o app é o cliente,
// a conta é quem autoriza), então tudo que é "memória" tem que ser separado por canal:
// fila, estado, histórico da trava anti-repetição e pasta de stage no Pages.
//
//   pradella (default) → @pradella.lucas — canal pessoal, Manual do Dinheiro
//   pradex             → @pradexapp      — o app PRADEX Finanças
//
// O canal pessoal é o DEFAULT e não leva sufixo em arquivo nenhum: os caminhos dele
// continuam byte a byte o que sempre foram. Isso é de propósito — ele está em produção,
// e um canal novo não pode renomear arquivo de quem já roda.
//
// O refresh token NÃO é resolvido aqui: cada workflow injeta o secret do seu canal em
// TIKTOK_REFRESH_TOKEN. client key/secret são compartilhados (mesmo app).

const CANAIS = ['pradella', 'pradex'];

export const CANAL = (process.env.CANAL || 'pradella').trim().toLowerCase();

if (!CANAIS.includes(CANAL)) {
  throw new Error(`[canal] CANAL="${CANAL}" inválido — use um de: ${CANAIS.join(', ')}`);
}

/** '' pro canal pessoal, '-pradex' pros demais. Entra no nome dos arquivos de memória. */
export const SUFIXO = CANAL === 'pradella' ? '' : `-${CANAL}`;

/** nome-base + sufixo do canal, preservando a extensão. sufixado('historico.json') → 'historico-pradex.json' */
export function sufixado(nome) {
  const i = nome.lastIndexOf('.');
  return i === -1 ? `${nome}${SUFIXO}` : `${nome.slice(0, i)}${SUFIXO}${nome.slice(i)}`;
}
