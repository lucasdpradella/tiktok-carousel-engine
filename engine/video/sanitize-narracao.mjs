// sanitize-narracao.mjs — limpa a NARRAÇÃO antes do XTTS (por CÓDIGO, não por prompt).
// O XTTS lê pontuação/símbolo em voz alta ("dois pontos", "porcento", "cifrão"...). Aqui:
//   - R$ 400 -> "quatrocentos reais" ; 50% -> "cinquenta por cento" (moeda/percentual por extenso)
//   - qualquer número solto -> por extenso
//   - símbolos que o TTS fala (: ; — – · ( ) " ' | # * % $ e reticências) -> removidos/viram pausa
//   - sobra só: letras + espaço + vírgula + ponto final, em frases fluidas.
// Só age na narração que vai pro TTS. A TELA (texto on-screen) mantém símbolos/números normais.

const UNID = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ10 = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function ate999(n) {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  const out = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c) out.push(CEM[c]);
  if (resto) {
    if (resto < 10) out.push(UNID[resto]);
    else if (resto < 20) out.push(DEZ10[resto - 10]);
    else {
      const u = resto % 10;
      out.push(u ? `${DEZ[Math.floor(resto / 10)]} e ${UNID[u]}` : DEZ[Math.floor(resto / 10)]);
    }
  }
  return out.join(' e ');
}

export function numeroPorExtenso(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'zero';
  if (n < 1000) return ate999(n);
  if (n < 1000000) {
    const mil = Math.floor(n / 1000);
    const resto = n % 1000;
    let p = mil === 1 ? 'mil' : `${ate999(mil)} mil`;
    if (resto) p += (resto < 100 || resto % 100 === 0 ? ' e ' : ' ') + ate999(resto);
    return p;
  }
  // milhões (raro em narração) — fallback simples
  const mi = Math.floor(n / 1000000);
  const resto = n % 1000000;
  let p = mi === 1 ? 'um milhão' : `${ate999(mi)} milhões`;
  if (resto) p += ' e ' + numeroPorExtenso(resto);
  return p;
}

function reais(intStr, centStr) {
  const v = parseInt(intStr.replace(/\./g, ''), 10) || 0;
  let s = v === 1 ? 'um real' : `${numeroPorExtenso(v)} reais`;
  if (centStr) {
    const c = parseInt(centStr, 10);
    if (c) s += ` e ${numeroPorExtenso(c)} ${c === 1 ? 'centavo' : 'centavos'}`;
  }
  return s;
}

export function sanitizeNarracao(text) {
  if (!text) return '';
  let t = text;
  // 1. moeda: R$ 1.200,50 -> "mil e duzentos reais e cinquenta centavos"
  //    (\d+(?:\.\d+)* não engole o ponto final da frase)
  t = t.replace(/R\$\s*(\d+(?:\.\d+)*)(?:,(\d{1,2}))?/gi, (_, i, c) => ' ' + reais(i, c) + ' ');
  // 2. percentual: 50% -> "cinquenta por cento"
  t = t.replace(/(\d+(?:\.\d+)*)\s*%/g, (_, d) => ' ' + numeroPorExtenso(parseInt(d.replace(/\./g, ''), 10)) + ' por cento ');
  // 3. qualquer número que sobrou -> por extenso
  t = t.replace(/\d+(?:\.\d+)*/g, (d) => ' ' + numeroPorExtenso(parseInt(String(d).replace(/\./g, ''), 10)) + ' ');
  // 4. reticências e terminadores (? !) viram vírgula (o XTTS-v2 PT fala "." como "ponto")
  t = t.replace(/…|\.{2,}/g, ', ');
  t = t.replace(/[?!]+/g, ', ');
  // 5. símbolos de pausa (— – · : ;) viram vírgula
  t = t.replace(/\s*[—–·:;]+\s*/g, ', ');
  // 6. PONTOS internos viram vírgula (narração fluida, sem ponto seco que o TTS verbaliza)
  t = t.replace(/\./g, ', ');
  // 7. whitelist final: SÓ letras (com acento), espaço e vírgula — sem ponto, sem símbolo
  t = t.replace(/[^A-Za-zÀ-ÿ ,]/g, ' ');
  // 8. arruma espaços e vírgulas duplicadas
  t = t.replace(/\s+,/g, ',');
  t = t.replace(/,(\s*,)+/g, ',');
  t = t.replace(/\s{2,}/g, ' ').trim();
  // 9. remove vírgula/espaço soltos do começo e do FIM (sem ponto/vírgula final)
  t = t.replace(/^[,\s]+/, '').replace(/[,\s]+$/, '');
  return t;
}
