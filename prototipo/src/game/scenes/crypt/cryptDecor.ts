/**
 * CAMADA JOGO (Brasa). Fachada da cenografia do piso. O piso agora é GEOMETRIA 3D (lajes reais,
 * ossos, entulho, fendas, água, musgo, tapete...), montada em cryptFloor.ts com as ferramentas de
 * cryptGeo.ts; aqui fica só a reexportação (as poças de luz agora são um lote único, ver
 * createLightPoolBatch no engine).
 */

export { buildFloorScape } from "./cryptFloor";
export type { FloorScape } from "./cryptFloor";
export { inCalm, mulberry32 } from "./cryptGeo";
export type { Rng } from "./cryptGeo";
