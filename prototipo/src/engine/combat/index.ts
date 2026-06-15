/**
 * CAMADA ENGINE - primitivas genéricas de combate (barrel interno). Reexportadas
 * pelo barrel da engine (@engine). Crescem por incremento (ver docs/plano-m2-combate.md):
 * M2.0 = AttackState (3 fases); M2.1 = Health, Hitbox/overlap, HitStop.
 */
export { AttackState } from "./attack";
export type { AttackPhase, AttackTiming } from "./attack";
export { Health } from "./health";
export { overlapSpheres } from "./hitbox";
export type { Hurtbox } from "./hitbox";
export { HitStop } from "./hitStop";
