import { Color3, Matrix, MeshBuilder, Mesh, StandardMaterial, TransformNode, VertexBuffer, VertexData } from "@babylonjs/core";
import type { InstancedMesh, Scene } from "@babylonjs/core";
import { getActorLight } from "@engine";

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

  // Funde as 3 peças de bronze numa malha só (2 draw calls por espada em vez de 4, em todo passe).
  for (const m of [pommel, guard]) m.removeVerticesData(VertexBuffer.UVKind); // a lâmina não tem UV: atributos iguais para fundir
  const bronzeParts = Mesh.MergeMeshes([pommel, guard, blade], true, true, undefined, false, false);
  if (bronzeParts) {
    bronzeParts.name = "swordBronze";
    bronzeParts.parent = root;
    bronzeParts.isPickable = false;
  }
  grip.isPickable = false;
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

/**
 * ARMAS CAPTURADAS (spec-armas-capturadas 4.3 e 5): modelos procedurais FUNDIDOS em 2 malhas por
 * arma (uma por material; a clava de antes tinha 9). Cada arma tem UM modelo-fonte por cena (invisível,
 * incluído na luz dos atores) e todo uso (na mão da heroína, na mão dos mortos, no chão) é uma
 * INSTÂNCIA dele: N armas iguais custam o mesmo número de chamadas de desenho que uma só. Nascem com a
 * empunhadura na ORIGEM e o eixo maior em +Y; quem usa gira conforme a pose (`WeaponDef.hold`).
 * Sem contorno de tinta (`noOutline`) e fora do shadowCaster (sombra: só a de contato do ator).
 * A versão CINZA (`cinza: true`) é a arma depois do braseiro ou da quebra: mesmas malhas, outro material.
 */
export type ArmaModeloId = "lanca" | "clava" | "cajado";

interface ArmaFonte {
  meshes: Mesh[];
  /** Altura (em +Y) da ponta da arma, onde nasce o rastro do golpe. */
  tipY: number;
  /** Escala do drop no chão (a câmera alta precisa ler a silhueta). */
  chao: number;
}

const fontes = new WeakMap<Scene, Map<string, ArmaFonte>>();

/** Material liso da arma; 8 luzes simultâneas (o orçamento padrão de 4 deixava a luz de aro dos atores de fora). */
function armaMat(scene: Scene, name: string, hex: string, emissive = "#000000"): StandardMaterial {
  const m = flatMat(scene, name, hex, emissive);
  m.maxSimultaneousLights = 8;
  return m;
}

/** Funde as peças por material em uma malha cada (a ordem de `grupos` é a ordem de `nomes`). */
function fundir(grupos: Mesh[][], nomes: string[]): Mesh[] {
  const out: Mesh[] = [];
  grupos.forEach((g, i) => {
    if (g.length === 0) return;
    for (const m of g) m.removeVerticesData(VertexBuffer.UVKind);
    const merged = g.length === 1 ? g[0]! : Mesh.MergeMeshes(g, true, true, undefined, false, false);
    if (!merged) return;
    merged.name = nomes[i]!;
    merged.isPickable = false;
    out.push(merged);
  });
  return out;
}

/** Desloca uma malha fundida em Y (leva a empunhadura para a origem). */
function levarMao(meshes: Mesh[], dy: number): void {
  const t = Matrix.Translation(0, dy, 0);
  for (const m of meshes) m.bakeTransformIntoVertices(t);
}

function construirFonte(scene: Scene, id: ArmaModeloId, cinza: boolean): ArmaFonte {
  const sufixo = cinza ? "Cinza" : "";
  const madeira = armaMat(scene, `armaMadeira${sufixo}`, cinza ? "#4d4a46" : "#6a4526", cinza ? "#17161a" : "#1c1209");
  const ferro = armaMat(scene, `armaFerro${sufixo}`, cinza ? "#5d5f63" : id === "lanca" ? "#9aa4b0" : "#6b7380", cinza ? "#17181b" : "#14161a");
  let meshes: Mesh[];
  let mao = 0; // altura da empunhadura contada da base da arma
  let tipY: number;
  let chao = 1.4;

  if (id === "lanca") {
    // Haste longa (~2,0 m) com ponta de folha de ferro: a mais alta e fina das armas; lê-se como uma linha vertical.
    const haste = MeshBuilder.CreateCylinder("lancaHaste", { height: 1.7, diameter: 0.05, tessellation: 6 }, scene);
    haste.position.y = 0.85;
    haste.material = madeira;
    const ponta = MeshBuilder.CreateCylinder("lancaPonta", { height: 0.5, diameterTop: 0, diameterBottom: 0.2, tessellation: 4 }, scene);
    ponta.position.y = 1.93;
    ponta.scaling.z = 0.3;
    ponta.material = ferro;
    const colar = MeshBuilder.CreateCylinder("lancaColar", { height: 0.1, diameter: 0.075, tessellation: 6 }, scene);
    colar.position.y = 1.7;
    colar.material = ferro;
    const conto = MeshBuilder.CreateCylinder("lancaConto", { height: 0.1, diameterTop: 0.05, diameterBottom: 0.02, tessellation: 6 }, scene);
    conto.position.y = -0.04;
    conto.material = ferro;
    meshes = fundir([[haste], [ponta, colar, conto]], ["lancaMadeira", "lancaFerro"]);
    mao = 0.6;
    tipY = 2.18;
    chao = 1.1;
  } else if (id === "clava") {
    // Cabo grosso e cabeça em cone invertido com cinta e tachas de ferro: a maior massa do conjunto.
    const cabo = MeshBuilder.CreateCylinder("clavaCabo", { height: 0.7, diameterTop: 0.07, diameterBottom: 0.05, tessellation: 7 }, scene);
    cabo.position.y = 0.35;
    cabo.material = madeira;
    const cabeca = MeshBuilder.CreateCylinder("clavaCabeca", { height: 0.55, diameterTop: 0.46, diameterBottom: 0.18, tessellation: 7 }, scene);
    cabeca.position.y = 0.88;
    cabeca.material = madeira;
    const aro = MeshBuilder.CreateTorus("clavaAro", { diameter: 0.3, thickness: 0.04, tessellation: 10 }, scene);
    aro.position.y = 0.98;
    aro.scaling.set(1.5, 1, 1.5);
    aro.material = ferro;
    const ferros: Mesh[] = [aro];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const tacha = MeshBuilder.CreateCylinder("clavaTacha", { height: 0.09, diameterTop: 0, diameterBottom: 0.05, tessellation: 5 }, scene);
      tacha.material = ferro;
      tacha.position.set(Math.cos(a) * 0.2, 0.82 + (i % 2) * 0.1, Math.sin(a) * 0.2);
      tacha.rotation.z = -Math.cos(a) * 1.2;
      tacha.rotation.x = Math.sin(a) * 1.2;
      ferros.push(tacha);
    }
    meshes = fundir([[cabo, cabeca], ferros], ["clavaMadeira", "clavaFerro"]);
    mao = 0.23;
    tipY = 1.16;
  } else {
    // Cajado (versão de transição): vara torta, engaste de ferro e orbe de brasa no topo.
    const vara = MeshBuilder.CreateCylinder("cajadoVara", { height: 1.3, diameterTop: 0.06, diameterBottom: 0.045, tessellation: 7 }, scene);
    vara.position.y = 0.65;
    vara.material = madeira;
    const engaste = MeshBuilder.CreateTorus("cajadoEngaste", { diameter: 0.17, thickness: 0.035, tessellation: 9 }, scene);
    engaste.position.y = 1.3;
    engaste.material = ferro;
    const orbe = MeshBuilder.CreateSphere("cajadoOrbe", { diameter: 0.17, segments: 6 }, scene);
    orbe.position.y = 1.3;
    orbe.material = armaMat(scene, `cajadoBrasa${sufixo}`, cinza ? "#4d4a46" : "#ff8a2c", cinza ? "#17161a" : "#ff7a1c");
    meshes = fundir([[vara], [engaste], [orbe]], ["cajadoMadeira", "cajadoFerro", "cajadoBrasa"]);
    mao = 0.3;
    tipY = 1.4;
  }
  if (mao !== 0) levarMao(meshes, -mao);
  const actors = getActorLight(scene);
  for (const m of meshes) {
    m.isVisible = false; // só as instâncias aparecem
    m.metadata = { ...(m.metadata ?? {}), noOutline: true };
    m.receiveShadows = false;
    actors.include(m);
  }
  return { meshes, tipY: tipY - mao, chao };
}

function fonteDe(scene: Scene, id: ArmaModeloId, cinza: boolean): ArmaFonte {
  let porCena = fontes.get(scene);
  if (!porCena) {
    porCena = new Map();
    fontes.set(scene, porCena);
  }
  const key = id + (cinza ? ":cinza" : "");
  let f = porCena.get(key);
  if (!f) {
    f = construirFonte(scene, id, cinza);
    porCena.set(key, f);
  }
  return f;
}

export interface ArmaModelo {
  /** Raiz: empunhadura na origem, eixo maior em +Y. O uso a gira e a escala. */
  root: TransformNode;
  /** Ponta da arma (para o rastro do golpe). */
  tip: TransformNode;
  /** Escala sugerida para o drop no chão. */
  chao: number;
}

/** Nova instância da arma capturada (2 instâncias, uma por malha fundida). `root.dispose()` a libera. */
export function criarArmaCapturada(scene: Scene, id: ArmaModeloId, opts: { cinza?: boolean } = {}): ArmaModelo {
  const f = fonteDe(scene, id, !!opts.cinza);
  const root = new TransformNode(`arma_${id}`, scene);
  for (const m of f.meshes) {
    const inst: InstancedMesh = m.createInstance(`${m.name}_i`);
    inst.parent = root;
    inst.isPickable = false;
    inst.receiveShadows = false;
    inst.metadata = { noOutline: true };
  }
  const tip = new TransformNode("weapon_tip", scene);
  tip.parent = root;
  tip.position.y = f.tipY;
  return { root, tip, chao: f.chao };
}


// COMPATIBILIDADE: o combatDirector ainda usa a versão antiga das armas capturadas até a fase de
// integração das armas novas (criarArmaCapturada) ser ligada. Remover junto com essa ligação.
/**
 * Armas capturadas (drop no chão e arma em mãos): clava de madeira com tachas de ferro, espada
 * curta de bronze e cajado com orbe de brasa. Todas nascem com o eixo maior em +Y (como a espada
 * do herói); quem usa deita ou inclina. Substituem as caixas e cilindros emissivos de antes,
 * que liam como "bastões" soltos no chão.
 */
export function buildCapturedWeapon(scene: Scene, kind: "clava" | "cajado" | "espada"): TransformNode {
  if (kind === "espada") {
    const sword = buildSword(scene);
    sword.scaling.setAll(1.7);
    return sword;
  }
  const root = new TransformNode(`arma_${kind}`, scene);
  const wood = flatMat(scene, "armaMadeira", "#6a4526", "#1c1209");
  const iron = flatMat(scene, "armaFerro", "#6b7380", "#14161a");

  if (kind === "clava") {
    const handle = MeshBuilder.CreateCylinder("clavaCabo", { height: 0.7, diameterTop: 0.07, diameterBottom: 0.05, tessellation: 7 }, scene);
    handle.material = wood;
    handle.parent = root;
    handle.position.y = 0.35;
    const head = MeshBuilder.CreateCylinder("clavaCabeca", { height: 0.5, diameterTop: 0.34, diameterBottom: 0.16, tessellation: 7 }, scene);
    head.material = wood;
    head.parent = root;
    head.position.y = 0.86;
    const band = MeshBuilder.CreateTorus("clavaAro", { diameter: 0.3, thickness: 0.04, tessellation: 10 }, scene);
    band.material = iron;
    band.parent = root;
    band.position.y = 0.95;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const stud = MeshBuilder.CreateCylinder("clavaTacha", { height: 0.09, diameterTop: 0, diameterBottom: 0.05, tessellation: 5 }, scene);
      stud.material = iron;
      stud.parent = root;
      stud.position.set(Math.cos(a) * 0.17, 0.82 + (i % 2) * 0.1, Math.sin(a) * 0.17);
      stud.rotation.z = -Math.cos(a) * 1.2;
      stud.rotation.x = Math.sin(a) * 1.2;
      stud.isPickable = false;
    }
    for (const m of [handle, head, band]) m.isPickable = false;
    return root;
  }

  // cajado: vara torta de madeira, engaste de ferro e orbe de brasa no topo
  const staff = MeshBuilder.CreateCylinder("cajadoVara", { height: 1.3, diameterTop: 0.06, diameterBottom: 0.045, tessellation: 7 }, scene);
  staff.material = wood;
  staff.parent = root;
  staff.position.y = 0.65;
  const claw = MeshBuilder.CreateTorus("cajadoEngaste", { diameter: 0.17, thickness: 0.035, tessellation: 9 }, scene);
  claw.material = iron;
  claw.parent = root;
  claw.position.y = 1.3;
  const orb = MeshBuilder.CreateSphere("cajadoOrbe", { diameter: 0.17, segments: 6 }, scene);
  orb.material = flatMat(scene, "cajadoBrasa", "#ff8a2c", "#ff7a1c");
  orb.parent = root;
  orb.position.y = 1.3;
  for (const m of [staff, claw, orb]) m.isPickable = false;
  return root;
}
