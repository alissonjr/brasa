import { type CharacterSave, readCharacter } from "./character";

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
}

export interface GameSaveData {
  chapter: string;
  checkpoint: string;
  objectives: string[];
  inkState: string;
  achievements: string[];
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
  };
}

export function readGameSave(blob: Record<string, unknown> | undefined): GameSaveData {
  const o = blob ?? {};
  return {
    chapter: typeof o.chapter === "string" ? o.chapter : "",
    checkpoint: typeof o.checkpoint === "string" ? o.checkpoint : "",
    objectives: strArray(o.objectives),
    inkState: typeof o.inkState === "string" ? o.inkState : "",
    achievements: strArray(o.achievements),
    character: readCharacter(o.character as Record<string, unknown> | undefined),
    run: readRun(o.run),
  };
}
