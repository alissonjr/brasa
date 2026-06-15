import {
  Color3,
  HemisphericLight,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  PointLight,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

/**
 * CAMADA JOGO (Brasa). Sala-cripta GRAYBOX: uma câmara de pedra fechada, fria e
 * quase escura, com vão de porta numa parede e um braseiro central. Geometria
 * primitiva de propósito (graybox técnico, liberado pela regra de assets): valida o
 * regime de uma sala fechada, a assinatura cromática frio (ambiente) vs quente
 * (braseiro) e a locomoção da Acendedora ANTES de baixar o KayKit Dungeon Remastered,
 * que substitui estas caixas pelas peças modulares reais (ver
 * docs/brasa/biblia-ambientes.md e docs/brasa/spec-vertical-slice-cripta.md).
 *
 * Orçamento: poucas malhas, 1 luz quente dinâmica (braseiro, sem sombra) + 1 ambiente
 * fria fraca. Coerente com o teto de < 60 draw calls por sala.
 */

const ROOM = 16; // lado da sala (m)
const WALL_H = 4.5; // altura das paredes (m)
const WALL_T = 0.6; // espessura das paredes (m)
const DOOR_W = 3; // largura do vão de porta (m)

/** Parede estática com colisor de caixa. */
function wall(scene: Scene, mat: StandardMaterial, name: string, x: number, z: number, w: number, d: number): void {
  const seg = MeshBuilder.CreateBox(name, { width: w, height: WALL_H, depth: d }, scene);
  seg.position.set(x, WALL_H / 2, z);
  seg.material = mat;
  seg.receiveShadows = true;
  new PhysicsAggregate(seg, PhysicsShapeType.BOX, { mass: 0 }, scene);
}

/** Retorna a posição do braseiro (centro da sala) para quem quiser luz/VFX extra. */
export function buildCryptGraybox(scene: Scene): { brazier: Vector3 } {
  scene.clearColor = Color3.FromHexString("#0a0e14").toColor4(1); // o escuro frio do poço

  // --- Luz fria fraca: a sala "apagada" antes do braseiro ---
  const ambient = new HemisphericLight("luz_fria", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.16;
  ambient.diffuse = Color3.FromHexString("#5b7fa6"); // azul frio
  ambient.groundColor = Color3.FromHexString("#0b0f15");

  // --- Materiais de pedra (graybox) ---
  const stone = new StandardMaterial("matPedra", scene);
  stone.diffuseColor = Color3.FromHexString("#3a3f47");
  stone.specularColor = Color3.Black();

  const floorMat = new StandardMaterial("matPiso", scene);
  floorMat.diffuseColor = Color3.FromHexString("#2c3037");
  floorMat.specularColor = Color3.Black();

  // --- Piso ---
  const floor = MeshBuilder.CreateGround("piso_cripta", { width: ROOM, height: ROOM }, scene);
  floor.material = floorMat;
  floor.receiveShadows = true;
  new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, scene);

  // --- Teto baixo (fecha a câmara) ---
  const ceil = MeshBuilder.CreateBox("teto_cripta", { width: ROOM, height: WALL_T, depth: ROOM }, scene);
  ceil.position.set(0, WALL_H, 0);
  ceil.material = stone;
  new PhysicsAggregate(ceil, PhysicsShapeType.BOX, { mass: 0 }, scene);

  // --- Paredes: 3 inteiras + 1 com vão de porta (lado -Z, por onde se entra) ---
  const half = ROOM / 2;
  wall(scene, stone, "parede_N", 0, half, ROOM, WALL_T); // +Z
  wall(scene, stone, "parede_L", half, 0, WALL_T, ROOM); // +X
  wall(scene, stone, "parede_O", -half, 0, WALL_T, ROOM); // -X
  // Parede -Z dividida em dois pilares, deixando um vão de porta no centro.
  const side = (ROOM - DOOR_W) / 2;
  wall(scene, stone, "parede_S_esq", -(DOOR_W / 2 + side / 2), -half, side, WALL_T);
  wall(scene, stone, "parede_S_dir", DOOR_W / 2 + side / 2, -half, side, WALL_T);

  // --- Braseiro central (placeholder) ---
  const brazierMat = new StandardMaterial("matBraseiro", scene);
  brazierMat.diffuseColor = Color3.FromHexString("#1c1208");
  brazierMat.emissiveColor = Color3.FromHexString("#ff7a1c").scale(0.6); // brasa quente
  brazierMat.specularColor = Color3.Black();
  const brazier = MeshBuilder.CreateCylinder("braseiro", { diameterTop: 1.1, diameterBottom: 0.7, height: 1.0 }, scene);
  brazier.position.set(0, 0.5, 0);
  brazier.material = brazierMat;
  new PhysicsAggregate(brazier, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);

  // --- Luz quente do braseiro (a Brasa da sala): 1 luz dinâmica, sem sombra ---
  const fire = new PointLight("luz_braseiro", new Vector3(0, 1.4, 0), scene);
  fire.diffuse = Color3.FromHexString("#ff8a3c");
  fire.intensity = 1.1;
  fire.range = 14;
  fire.shadowEnabled = false;

  return { brazier: new Vector3(0, 0, 0) };
}
