import type { ProgressionState } from "@platform";
import { CRYPT_SPAWN } from "./map";

/**
 * CAMADA JOGO (Brasa). Definição da campanha (capítulos e objetivos da descida) e os
 * resolvedores que traduzem o estado genérico de progressão (ProgressionService, da
 * plataforma) em texto de objetivo atual, nome do capítulo e progresso (%). É AQUI que
 * mora o conteúdo; a plataforma só guarda ids. Cada objetivo tem um gatilho de mundo
 * (trigger) que o app avalia (ex.: chegar perto de um ponto da sala).
 */
export interface Objective {
  id: string;
  text: string;
  points: number;
  /** Gatilho por proximidade: completa ao chegar a `radius` de (x,z). */
  near?: { x: number; z: number; radius: number };
}

export interface Chapter {
  id: string;
  name: string;
  objectives: Objective[];
}

export const CAMPAIGN: Chapter[] = [
  {
    id: "descida",
    name: "A Descida (protótipo)",
    objectives: [
      { id: "entrar-cripta", text: "Entrar na sala-cripta", points: 10, near: { x: CRYPT_SPAWN.x, z: CRYPT_SPAWN.z, radius: 4 } },
      { id: "aproximar-braseiro", text: "Aproximar-se do braseiro central", points: 20, near: { x: 0, z: 0, radius: 3 } },
      { id: "alcancar-fundo", text: "Alcançar o fundo da câmara", points: 30, near: { x: 0, z: 6, radius: 3 } },
    ],
  },
];

export const DEFAULT_CHAPTER = CAMPAIGN[0]!.id;

export function findChapter(state: ProgressionState): Chapter {
  return CAMPAIGN.find((c) => c.id === state.chapterId) ?? CAMPAIGN[0]!;
}

/** Texto do objetivo atual: o primeiro não concluído do capítulo (ou conclusão). */
export function currentObjective(state: ProgressionState): string {
  const ch = findChapter(state);
  const next = ch.objectives.find((o) => !state.objectivesDone.includes(o.id));
  return next ? next.text : `Capítulo concluído: ${ch.name}`;
}

export function chapterName(state: ProgressionState): string {
  return findChapter(state).name;
}

/** Progresso da campanha inteira (objetivos concluídos / total), 0..100. */
export function progressPercent(state: ProgressionState): number {
  const total = CAMPAIGN.reduce((n, c) => n + c.objectives.length, 0);
  if (total === 0) return 0;
  const done = CAMPAIGN.reduce(
    (n, c) => n + c.objectives.filter((o) => state.objectivesDone.includes(o.id)).length,
    0
  );
  return Math.round((done / total) * 100);
}

/** Lista plana de objetivos (para o app avaliar gatilhos). */
export function allObjectives(): Objective[] {
  return CAMPAIGN.flatMap((c) => c.objectives);
}
