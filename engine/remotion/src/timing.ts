// timing.ts — sincroniza a duração das cenas com a narração gerada (voz clonada).
// As durações vêm de public/narracao/durations.json (medidas no Colab, por cena).
// Cada cena dura: narração + um respiro curto (TAIL) pro texto não cortar na fala.
import durations from '../public/narracao/durations.json';
import script from './script.json';

const TAIL = 12; // ~0.4s @30fps de respiro após a fala

export const sceneFrames = (id: string): number => {
  const sec = (durations as Record<string, number>)[id];
  if (sec && sec > 0) return Math.ceil(sec * script.fps) + TAIL;
  // fallback: cena sem narração cai no dur estático do script.json
  const c = script.cenas.find((x: any) => x.id === id);
  return c ? c.dur : 90;
};

export const totalFrames = script.cenas.reduce((acc: number, c: any) => acc + sceneFrames(c.id), 0);
