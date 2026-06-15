import type { Vector3 } from "@babylonjs/core";
import type { Health, Hurtbox } from "@engine";

/**
 * CAMADA JOGO. O que o CombatDirector precisa de qualquer coisa que o herói possa
 * acertar (alvo de treino, defensor, futuros inimigos): vida, hurtbox e como receber um
 * golpe. `guardBreak` indica um golpe que ignora a guarda frontal (ataque pesado).
 */
export interface CombatTarget {
  readonly health: Health;
  readonly hurtbox: Hurtbox;
  /** Recebe um golpe. Retorna se foi amortecido pela guarda (para o feedback de "bloqueado"). */
  takeHit(damage: number, dir: Vector3, knockback: number, guardBreak?: boolean): { guarded: boolean };
}
