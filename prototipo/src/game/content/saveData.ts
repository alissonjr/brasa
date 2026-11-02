import { type CharacterSave, readCharacter } from "./character";
import { markFloor, markRead } from "./codex";

/**
 * CAMADA JOGO. Forma do payload `game` dentro do SaveData (a plataforma o trata
 * como opaco). Aqui o jogo define o que guarda e lê de volta com defesa (campos
 * ausentes/corrompidos viram default seguro).
 */
/**
 * Estado da DESCIDA em andamento (run roguelite). Checkpoint = braseiro aceso. Permite
 * fechar o jogo e retomar no andar certo com Fagulha/dádivas/poções. `upgrades` guarda os
 * NOMES das dádivas compradas, reaplicadas em ordem sobre o herói recém-criado ao carregar.
 */
export interface RunSave {
  active: boolean;
  floorIndex: number;
  fagulhas: number;
  pocaoVida: number;
  pocaoFuria: number;
  upgrades: string[];
  seed: number; // semente da run (variação determinística de posições/ofertas); 0 = legado
}

export interface GameSaveData {
  chapter: string;
  checkpoint: string;
  objectives: string[];
  inkState: string;
  achievements: string[];
  /** Marcas vistas da Crônica (andares alcançados, inscrições lidas, queda do Guardião). */
  codex: string[];
  character: CharacterSave;
  run: RunSave;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function readRun(v: unknown): RunSave {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    active: o.active === true,
    floorIndex: Math.max(0, Math.floor(num(o.floorIndex))),
    fagulhas: Math.max(0, Math.floor(num(o.fagulhas))),
    pocaoVida: Math.max(0, Math.floor(num(o.pocaoVida))),
    pocaoFuria: Math.max(0, Math.floor(num(o.pocaoFuria))),
    upgrades: strArray(o.upgrades),
    seed: Math.max(0, Math.floor(num(o.seed))),
  };
}

/**
 * Marcas da Crônica. Save novo: lê `codex` como veio. Save antigo (sem o campo): quem já estava
 * numa descida passou pelos andares até o atual e leu (ou pôde ler) os já deixados para trás,
 * então semeia essas marcas: a descida não volta atrás, e a leitura nunca foi guardada.
 */
function readCodex(o: Record<string, unknown>, run: RunSave): string[] {
  if (Array.isArray(o.codex)) return strArray(o.codex);
  const seeded: string[] = [];
  if (run.active) {
    for (let n = 1; n <= run.floorIndex + 1; n++) seeded.push(markFloor(n));
    for (let n = 1; n <= run.floorIndex; n++) seeded.push(markRead(n));
  }
  return seeded;
}

export function readGameSave(blob: Record<string, unknown> | undefined): GameSaveData {
  const o = blob ?? {};
  const run = readRun(o.run);
  return {
    chapter: typeof o.chapter === "string" ? o.chapter : "",
    checkpoint: typeof o.checkpoint === "string" ? o.checkpoint : "",
    objectives: strArray(o.objectives),
    inkState: typeof o.inkState === "string" ? o.inkState : "",
    achievements: strArray(o.achievements),
    codex: readCodex(o, run),
    character: readCharacter(o.character as Record<string, unknown> | undefined),
    run,
  };
}
