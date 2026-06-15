import { Color3, MeshBuilder, Mesh, StandardMaterial, TransformNode, VertexData } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

/**
 * CAMADA JOGO. Armas low-poly procedurais (estilizado quente, fiel à doc): espada curta de
 * BRONZE com lâmina-FOLHA (< 50 cm, cananeia do Bronze Tardio; ver docs/personagens/01 e
 * spec-combate §3) e ESCUDO redondo com umbo de bronze. Geometria própria (sem Blender, que
 * não está instalado aqui; trocável depois por GLB do Blender/Tripo sob a mesma chamada).
 * O grip fica na origem e a lâmina aponta +Y, para encaixar no pivô da mão (heroCombat/defender).
 */
function flatMat(scene: Scene, name: string, hex: string, emissiveHex = "#000000"): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.emissiveColor = Color3.FromHexString(emissiveHex);
  m.specularColor = Color3.Black();
  return m;
}

function bronze(scene: Scene): StandardMaterial {
  return flatMat(scene, "bronze", "#c0883f", "#3a2810");
}

/** Lâmina-folha achatada (perfil que alarga no meio e afina na ponta), dupla face. */
function buildLeafBlade(scene: Scene, mat: StandardMaterial): Mesh {
  const ys = [0, 0.22, 0.38];
  const hw = [0.04, 0.058, 0.045];
  const tipY = 0.5;
  const positions: number[] = [];
  for (let i = 0; i < ys.length; i++) positions.push(-hw[i], ys[i], 0, hw[i], ys[i], 0);
  const tip = positions.length / 3;
  positions.push(0, tipY, 0);

  const indices: number[] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const l0 = 2 * i, r0 = 2 * i + 1, l1 = 2 * (i + 1), r1 = 2 * (i + 1) + 1;
    indices.push(l0, r0, r1, l0, r1, l1);
  }
  const ll = 2 * (ys.length - 1), rr = 2 * (ys.length - 1) + 1;
  indices.push(ll, rr, tip);

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  const blade = new Mesh("leafBlade", scene);
  vd.applyToMesh(blade);
  mat.backFaceCulling = false; // lâmina achatada visível dos dois lados
  blade.material = mat;
  blade.isPickable = false;
  return blade;
}

/** Espada curta de bronze (folha). Retorna um nó com o grip na origem e a lâmina em +Y. */
export function buildSword(scene: Scene): TransformNode {
  const root = new TransformNode("sword", scene);
  const mb = bronze(scene);
  const leather = flatMat(scene, "grip", "#3a2a18");

  const pommel = MeshBuilder.CreateSphere("pommel", { diameter: 0.06, segments: 6 }, scene);
  pommel.material = mb;
  pommel.parent = root;
  pommel.position.y = 0.02;

  const grip = MeshBuilder.CreateCylinder("grip", { height: 0.15, diameter: 0.035, tessellation: 8 }, scene);
  grip.material = leather;
  grip.parent = root;
  grip.position.y = 0.11;

  const guard = MeshBuilder.CreateBox("guard", { width: 0.18, height: 0.04, depth: 0.06 }, scene);
  guard.material = mb;
  guard.parent = root;
  guard.position.y = 0.19;

  const blade = buildLeafBlade(scene, mb);
  blade.parent = root;
  blade.position.y = 0.2;

  for (const m of [pommel, grip, guard, blade]) m.isPickable = false;
  return root;
}

/** Escudo redondo de madeira/couro com umbo (boss) e aro de bronze. Encara +Z. */
export function buildRoundShield(scene: Scene): TransformNode {
  const root = new TransformNode("shield", scene);
  const wood = flatMat(scene, "shieldWood", "#6e4a2a");
  const mb = bronze(scene);

  const disc = MeshBuilder.CreateCylinder("shieldDisc", { height: 0.06, diameter: 0.6, tessellation: 18 }, scene);
  disc.material = wood;
  disc.parent = root;
  disc.rotation.x = Math.PI / 2; // eixo Y -> Z: as faces circulares encaram a frente

  const rim = MeshBuilder.CreateTorus("shieldRim", { diameter: 0.6, thickness: 0.05, tessellation: 18 }, scene);
  rim.material = mb;
  rim.parent = root;
  rim.rotation.x = Math.PI / 2;

  const boss = MeshBuilder.CreateSphere("shieldBoss", { diameter: 0.16, segments: 8 }, scene);
  boss.material = mb;
  boss.parent = root;
  boss.position.z = 0.05;

  for (const m of [disc, rim, boss]) m.isPickable = false;
  return root;
}
