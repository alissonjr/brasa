import { Vector3 } from "@babylonjs/core";

/**
 * CAMADA JOGO. Tuning do mundo. A gravidade é um valor do jogo (um pouco mais
 * forte que o real para o pulo parecer ágil) injetado na engine de física.
 */
export const WORLD_GRAVITY = new Vector3(0, -18, 0);
