import { Vector3 } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Detecção de acerto simples por esferas (hitbox da arma x
 * hurtbox do alvo). Barato e suficiente para o duelo 1v1..1v3 do protótipo (spec-combate
 * §4: foco em duelo, não hordas). Volumes mais finos (cápsula/setor) entram se o feel pedir.
 */
export interface Hurtbox {
  /** Centro do volume em coordenadas de mundo. */
  readonly center: Vector3;
  readonly radius: number;
}

/** True se duas esferas se sobrepõem (distância <= soma dos raios). */
export function overlapSpheres(aCenter: Vector3, aRadius: number, bCenter: Vector3, bRadius: number): boolean {
  const r = aRadius + bRadius;
  return Vector3.DistanceSquared(aCenter, bCenter) <= r * r;
}
