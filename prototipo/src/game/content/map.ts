/**
 * CAMADA JOGO (Brasa). Dados do mapa da descida: o ponto de entrada, os marcos de
 * profundidade do poço-cripta e o nome do capítulo. Consumido pelo minimapa do HUD e
 * pela tela de mapa (corte do poço). O mundo do protótipo é uma sala fechada; o eixo
 * Z faz as vezes de profundidade na leitura do mapa.
 */
export const WORLD_HALF = 40;

/**
 * Ponto onde a Acendedora entra na sala-cripta (junto ao vão de porta, lado -Z).
 * Fonte única: spawn do herói e gatilhos de objetivo derivam daqui.
 */
export const CRYPT_SPAWN = { x: 0, z: -5 };

export type LandmarkKind = "entrada" | "camara" | "brasa";

export interface Landmark {
  id: string;
  name: string;
  x: number;
  z: number;
  kind: LandmarkKind;
}

export const LANDMARKS: Landmark[] = [
  { id: "entrada", name: "Boca do poço", x: 0, z: -6, kind: "entrada" },
  { id: "camara", name: "Câmara de guarda", x: 0, z: 0, kind: "camara" },
  { id: "brasa", name: "A Brasa", x: 0, z: 6, kind: "brasa" },
];

export const OBJECTIVE_TEXT = "Acender o braseiro da câmara";
export const CHAPTER_NAME = "A Descida";
