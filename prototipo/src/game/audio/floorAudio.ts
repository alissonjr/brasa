/**
 * CAMADA JOGO (Brasa). ESTADO E PERFIS DE ÁUDIO POR ANDAR. Cada um dos 7 andares (mesma ordem
 * de FLOOR_THEMES em scenes/crypt/cryptTheme.ts: arenito frio, basalto, calcário com gelo,
 * ferro, osso e cal, vulcânico, obsidiana) tem um perfil de ambiência (o que se ouve ao fundo)
 * e um perfil musical (modo, raiz e progressão). Este módulo guarda o andar e o estado
 * (frio | combate | quente) correntes e avisa quem escuta (ambiência e música), para a troca
 * de sala reconstruir tudo com crossfade.
 *
 * Princípios: fundo SEMPRE sutil e agradável; nada de zumbido (nenhum par de graves a menos
 * de uma terça menor um do outro, sem dente de serra, sem tremolo rápido). Os ritmos
 * (gotas, estalos, rangidos) são esparsos e aleatórios; o resto é ruído filtrado que respira
 * devagar (LFO < 0,2 Hz).
 */

export type MusicState = "frio" | "combate" | "quente";

export interface AmbienceProfile {
  name: string;
  /** Vento fundo: passa-banda móvel sobre ruído rosa. Frequência central varia entre lo e hi. */
  wind: { lo: number; hi: number; q: number; level: number };
  /** Respiração do poço: swell grave e lento de ruído marrom (nível 0 = ausente). */
  breath: { level: number; period: [number, number] };
  /** Gotejamento (eventos por minuto; nível). */
  drip: { rate: number; level: number };
  /** Estalos de brasa (eventos por minuto; nível). */
  ember: { rate: number; level: number };
  /** Rangido de ferro (eventos por minuto; nível). */
  creak: { rate: number; level: number };
  /** Calibragem de loudness do andar (multiplica a cena inteira): iguala os 7 andares em ~-31 LUFS. */
  trim: number;
}

export interface MusicProfile {
  /** Nota raiz (MIDI) do modo, sempre >= 48 (C3) para o fundo soar em alto-falante de notebook. */
  root: number;
  /** Escala em semitons a partir da raiz (7 graus). */
  scale: number[];
  /** Progressão de acordes como graus da escala (0 = I). Cada acorde empilha terças da escala. */
  prog: number[];
  /** Registro (MIDI) da melodia esparsa. */
  motifLo: number;
  motifHi: number;
  /** Intervalo médio entre frases (s) no estado frio. */
  phraseGap: [number, number];
  /** Brilho do instrumento (corte do passa-baixa, Hz). */
  bright: number;
}

export const AMBIENCE_PROFILES: AmbienceProfile[] = [
  // 0 arenito frio: vento de poeira entre raízes, uma gota rara.
  { name: "arenito", wind: { lo: 200, hi: 420, q: 0.6, level: 0.042 }, breath: { level: 0.03, period: [10, 14] }, drip: { rate: 3, level: 0.03 }, ember: { rate: 0, level: 0 }, creak: { rate: 0, level: 0 }, trim: 1.29 },
  // 1 basalto: ar parado e pesado, cinzas, uma brasa que estala de longe (acampamento apagado).
  { name: "basalto", wind: { lo: 130, hi: 290, q: 0.6, level: 0.04 }, breath: { level: 0.04, period: [11, 15] }, drip: { rate: 5, level: 0.03 }, ember: { rate: 2, level: 0.02 }, creak: { rate: 0, level: 0 }, trim: 1.25 },
  // 2 calcário com gelo (cisterna): gotejamento constante e ar frio e arejado.
  { name: "calcario", wind: { lo: 260, hi: 520, q: 0.7, level: 0.03 }, breath: { level: 0.025, period: [10, 13] }, drip: { rate: 15, level: 0.05 }, ember: { rate: 0, level: 0 }, creak: { rate: 0, level: 0 }, trim: 1.66 },
  // 3 ferro: grades que rangem, primeiras brasas.
  { name: "ferro", wind: { lo: 150, hi: 330, q: 0.7, level: 0.036 }, breath: { level: 0.035, period: [10, 14] }, drip: { rate: 2, level: 0.025 }, ember: { rate: 5, level: 0.025 }, creak: { rate: 3, level: 0.04 }, trim: 1.4 },
  // 4 osso e cal (luto): respiração do poço em primeiro plano, vento fino como sussurro.
  { name: "osso", wind: { lo: 320, hi: 620, q: 0.8, level: 0.03 }, breath: { level: 0.042, period: [9, 12] }, drip: { rate: 3, level: 0.025 }, ember: { rate: 0, level: 0 }, creak: { rate: 0.5, level: 0.025 }, trim: 1.15 },
  // 5 vulcânico: rumor grave, brasas estalando, ferro que dilata.
  { name: "vulcanico", wind: { lo: 110, hi: 250, q: 0.6, level: 0.05 }, breath: { level: 0.045, period: [9, 12] }, drip: { rate: 0, level: 0 }, ember: { rate: 18, level: 0.035 }, creak: { rate: 1.5, level: 0.03 }, trim: 1.04 },
  // 6 obsidiana: o poço respira fundo; brasas lentas, quase nada além disso.
  { name: "obsidiana", wind: { lo: 90, hi: 200, q: 0.6, level: 0.038 }, breath: { level: 0.046, period: [8, 11] }, drip: { rate: 0, level: 0 }, ember: { rate: 10, level: 0.03 }, creak: { rate: 0, level: 0 }, trim: 1.05 },
];

export const MUSIC_PROFILES: MusicProfile[] = [
  // 0 arenito: ré dórico, aberto e frio.
  { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 6, 3, 6], motifLo: 64, motifHi: 81, phraseGap: [7, 12], bright: 2400 },
  // 1 basalto: mi frígio, pesado.
  { root: 52, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 6], motifLo: 64, motifHi: 79, phraseGap: [8, 13], bright: 1900 },
  // 2 calcário: fá# lídio, vítreo, notas mais agudas.
  { root: 54, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 1, 0, 4], motifLo: 69, motifHi: 88, phraseGap: [6, 10], bright: 3600 },
  // 3 ferro: sol eólio, grave e sóbrio.
  { root: 55, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 6, 4], motifLo: 64, motifHi: 79, phraseGap: [9, 14], bright: 1800 },
  // 4 osso e cal (luto): lá eólio, lento.
  { root: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], motifLo: 64, motifHi: 81, phraseGap: [9, 15], bright: 2200 },
  // 5 vulcânico: ré frígio dominante, sombrio e quente.
  { root: 50, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 1, 0, 2], motifLo: 64, motifHi: 79, phraseGap: [7, 11], bright: 2100 },
  // 6 obsidiana: dó frígio, bem esparso.
  { root: 48, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 4], motifLo: 64, motifHi: 82, phraseGap: [10, 16], bright: 2000 },
];

/** Perfil da tela-título: ré eólio quente, esparso. */
export const TITLE_MUSIC: MusicProfile = { root: 50, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 0, 6], motifLo: 64, motifHi: 79, phraseGap: [9, 14], bright: 2300 };
export const TITLE_AMBIENCE: AmbienceProfile = { name: "titulo", wind: { lo: 150, hi: 320, q: 0.6, level: 0.03 }, breath: { level: 0.035, period: [10, 14] }, drip: { rate: 0, level: 0 }, ember: { rate: 14, level: 0.03 }, creak: { rate: 0, level: 0 }, trim: 1.3 };

export const FLOOR_COUNT = AMBIENCE_PROFILES.length;

let floor = 0;
let mood: MusicState = "frio";
const floorListeners = new Set<(f: number) => void>();
const moodListeners = new Set<(m: MusicState) => void>();

export function currentFloor(): number {
  return floor;
}
export function currentMood(): MusicState {
  return mood;
}

/** Define o andar (índice do tema, 0..6). Avisa ambiência e música só se mudou. */
export function setFloorAudio(i: number): void {
  const f = Math.max(0, Math.min(FLOOR_COUNT - 1, Math.round(i)));
  if (f === floor) return;
  floor = f;
  for (const fn of floorListeners) fn(f);
}

export function setMood(m: MusicState): void {
  if (m === mood) return;
  mood = m;
  for (const fn of moodListeners) fn(m);
}

export function onFloorChange(fn: (f: number) => void): () => void {
  floorListeners.add(fn);
  return () => floorListeners.delete(fn);
}
export function onMoodChange(fn: (m: MusicState) => void): () => void {
  moodListeners.add(fn);
  return () => moodListeners.delete(fn);
}

/** Só para testes: volta ao andar 0 / frio sem avisar ninguém. */
export function resetFloorAudio(): void {
  floor = 0;
  mood = "frio";
}
