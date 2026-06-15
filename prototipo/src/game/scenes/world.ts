/**
 * CAMADA JOGO (Brasa). Altura do piso do mundo. Na cripta o piso é PLANO (y = 0):
 * cada sala é fechada e modular, sem o terreno aberto 600x600 da era anterior (removido
 * na virada para Brasa). A função permanece porque os utilitários de assentamento
 * (sceneKit, vegetation) e a IA do inimigo (defender) a consultam para pousar no chão.
 */
export function terrainHeightAt(_x: number, _z: number): number {
  return 0;
}
