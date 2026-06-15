import { type CharacterSave, readCharacter } from "./character";

/**
 * CAMADA JOGO. Forma do payload `game` dentro do SaveData (a plataforma o trata
 * como opaco). Aqui o jogo define o que guarda e lê de volta com defesa (campos
 * ausentes/corrompidos viram default seguro).
 */
export interface GameSaveData {
  chapter: string;
  checkpoint: string;
  objectives: string[];
  inkState: string;
  achievements: string[];
  character: CharacterSave;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
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
  };
}
