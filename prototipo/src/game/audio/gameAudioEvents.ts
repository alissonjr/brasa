/**
 * CAMADA JOGO (Brasa). LIGAÇÃO DO ÁUDIO AOS EVENTOS DO JOGO. Uma chamada no boot
 * (`bindGameAudio(platform.events, ...)` no main.ts) liga os sons que dependem de eventos já
 * existentes no barramento `platform.events`, sem tocar em atores nem cenas:
 *  - enemy:died   -> ossos que desmontam (sfx.playEnemyDeath);
 *  - hero:perfect -> não toca (o combatDirector já chama perfectDodgeChime), só o ducking;
 *  - passos       -> `updateFootsteps(dt, speed, grounded, surface)`, chamado todo quadro.
 * Eventos que o combatDirector já resolve com chamadas diretas (hitThunk, swingWhoosh, heroHurt,
 * shieldClank, healChime) NÃO são religados aqui, para não soar em dobro.
 */
import { createFootstepper, playEnemyDeath, surfaceForFloor, type Surface } from "./sfx";

interface EventsLike {
  on(name: string, fn: (payload: never) => void): unknown;
}

const stepper = createFootstepper();

/** Liga os efeitos que dependem de eventos. Retorna uma função que desfaz (não usada no jogo). */
export function bindGameAudio(events: EventsLike): void {
  events.on("enemy:died", () => playEnemyDeath());
}

/** Passos pela distância percorrida. Chamar todo quadro de jogo com a velocidade plana do herói (m/s). */
export function updateFootsteps(dt: number, speed: number, grounded: boolean, floorIndex: number, molhado = false): void {
  const surface: Surface = surfaceForFloor(floorIndex, molhado);
  stepper.update(dt, speed, grounded, surface);
}

export function resetFootsteps(): void {
  stepper.reset();
}
