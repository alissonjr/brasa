import {
  Color3,
  DefaultRenderingPipeline,
  DirectionalLight,
  GlowLayer,
  HemisphericLight,
  Matrix,
  Mesh,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  PointLight,
  Quaternion,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { AbstractMesh, AssetContainer, Camera, IDisposable, Observer, Scene } from "@babylonjs/core";
import { loadContainer } from "@engine";
import { pickLayout } from "./cryptLayouts";

/**
 * CAMADA JOGO (Brasa). Sala-cripta de referencia (KayKit Dungeon, CC0) montada para o
 * regime SALA-A-SALA: o "look" da cena (glow, nevoa, luzes globais, sombra, pos-proc)
 * e criado UMA vez em setupCryptScene(); cada ANDAR e um Room descartavel construido por
 * buildCryptRoom() e jogado fora (dispose) quando a Acendedora desce. Assim so uma sala
 * existe por vez (leveza). Cada Room rastreia tudo que cria (malhas, luzes, fisica,
 * casters de sombra, chamas, observer de tremulacao) para um descarte limpo.
 *
 * Pecas repetidas (piso, paredes, pilares E dressing repetido: caveiras, barris, caixas,
 * estandartes, escombros, etc.) por THIN INSTANCES (1 draw call por tipo, via batch()/
 * flushBatches()); props unicos por clone (placeProp). O DRESSING varia por TIPO DE SALA
 * (RoomDef.kind: guarda/salao/cisterna/santuario/guardiao) ligando clusters tematicos
 * diferentes sobre o mesmo layout-base. Ver docs/brasa/*.
 */

const K = "/assets/dungeon_kit/"; // KayKit Dungeon Remastered (mesmo atlas)
const KH = "/assets/halloween_kit/"; // KayKit Halloween Bits (atlas proprio, mesmo estilo)
const WALL_H = 4;
const ROOM_H = WALL_H * 2; // 8: sala alta (catedral-cripta) com teto e candelabros

export interface CryptCtx {
  shadow: ShadowGenerator;
  glow: GlowLayer;
  ambient: HemisphericLight; // luz fria ambiente (modulada na virada frio->quente)
  key: DirectionalLight; // luz-chave (sombra); cai um pouco ao acender o braseiro
}

export type RoomKind = "guarda" | "salao" | "cisterna" | "santuario" | "guardiao";

export interface RoomDef {
  index: number; // 0..N-1
  kind: RoomKind;
  enemies: number; // quantos mortos despertos a sala spawna
  boss?: boolean;
}

export interface Room {
  def: RoomDef;
  spawn: Vector3; // onde a Acendedora entra
  exit: { x: number; z: number; radius: number }; // a PASSAGEM (alçapão): pisar = descer
  enemyAnchor: { x: number; z: number }; // centro em torno do qual os inimigos surgem
  brazier: Vector3;
  /** Vira a luz da sala de fria (t=0) para quente (t=1): acende o braseiro + reaquece a cena. */
  setBrazierLit(t: number): void;
  /** Abre a passagem (alçapão): chamado após a Brasa ser acesa. */
  setCleared(open: boolean): void;
  dispose(): void;
}

// Containers do kit (carregados uma vez, compartilhados por todos os andares).
let cache: Record<string, AssetContainer> | null = null;
const PIECES = [
  "wall", "wall_broken", "wall_corner", "pillar", "pillar_broken", "torch_wall", "door", "torch",
  "floor", "floor_alt", "floor_deco", "floor_wood", "bookcase", "table", "bench", "chair",
  "banner", "rubble", "barrel", "crate", "chest", "weapon_rack", "skull", "pots", "bucket", "coins", "wall_deco_a", "trapdoor",
  // Lote 2026-06-14 (mesmo pacote Dungeon Remastered/atlas): enriquecimento de cenario.
  "bottle_A_green", "bottle_B_green", "bottle_C_brown", "candle_triple", "shelf_small_candles",
  "chest_gold", "coin_stack_large", "coin_stack_medium", "key", "sword_shield", "keg", "plate_food_A",
];
// KayKit Halloween Bits (CC0, mesmo autor/estilo): reforco de tom de cripta/catacumba.
const HALL = [
  "coffin", "coffin_decorated", "gravestone", "grave_A", "gravemarker_A",
  "bone_A", "bone_B", "bone_C", "ribcage", "skull_candle", "shrine_candles",
  "lantern_standing", "plaque_candles",
];

async function ensurePieces(scene: Scene): Promise<Record<string, AssetContainer>> {
  if (cache) return cache;
  const [du, ha] = await Promise.all([
    Promise.all(PIECES.map((n) => loadContainer(scene, K + n + ".glb"))),
    Promise.all(HALL.map((n) => loadContainer(scene, KH + n + ".glb"))),
  ]);
  cache = {};
  PIECES.forEach((n, i) => (cache![n] = du[i]!));
  HALL.forEach((n, i) => (cache![n] = ha[i]!));
  return cache;
}

/** Cria o "look" global da cena (uma vez): nevoa, glow, luz ambiente+direcional p/ sombra. */
export function setupCryptScene(scene: Scene, camera: Camera): CryptCtx {
  scene.clearColor = Color3.FromHexString("#05070b").toColor4(1);
  scene.collisionsEnabled = true;

  scene.fogMode = 2; // EXP2
  scene.fogColor = Color3.FromHexString("#1a2636");
  scene.fogDensity = 0.006;

  const glow = new GlowLayer("glow", scene, { blurKernelSize: 32 });
  glow.intensity = 0.8;

  const ambient = new HemisphericLight("luz_fria", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.62;
  ambient.diffuse = Color3.FromHexString("#8aa6c6");
  ambient.groundColor = Color3.FromHexString("#141b26");
  ambient.specular = Color3.Black();

  const key = new DirectionalLight("luz_sombra", new Vector3(-0.25, -1, -0.18), scene);
  key.position = new Vector3(4, 16, -2);
  key.intensity = 1.0;
  key.diffuse = Color3.FromHexString("#aebfd2");
  key.specular = Color3.Black();
  const shadow = new ShadowGenerator(1024, key);
  shadow.useBlurExponentialShadowMap = true;
  shadow.blurKernel = 32;
  shadow.darkness = 0.35;

  // Pos-processamento (bloom da Brasa, vignette, grao); sem ACES (esmaga low-poly).
  const pipe = new DefaultRenderingPipeline("criptaPipe", true, scene, [camera]);
  pipe.fxaaEnabled = true;
  pipe.bloomEnabled = true;
  pipe.bloomThreshold = 0.8;
  pipe.bloomWeight = 0.45;
  pipe.bloomKernel = 64;
  pipe.bloomScale = 0.5;
  pipe.imageProcessingEnabled = true;
  pipe.imageProcessing.toneMappingEnabled = false;
  pipe.imageProcessing.exposure = 1.05;
  pipe.imageProcessing.contrast = 1.12;
  pipe.imageProcessing.vignetteEnabled = true;
  pipe.imageProcessing.vignetteWeight = 1.1;
  pipe.imageProcessing.vignetteColor = new Color3(0.03, 0.04, 0.07).toColor4(1);
  pipe.grainEnabled = true;
  pipe.grain.intensity = 4;
  pipe.grain.animated = true;

  return { shadow, glow, ambient, key };
}

/** Constroi UM andar (descartavel). Precisa que ensureCryptPieces tenha rodado antes. */
export function buildCryptRoom(scene: Scene, ctx: CryptCtx, def: RoomDef): Room {
  const P = cache!;
  // PLANTA do andar (forma/dimensoes). A geometria abaixo deriva dela; o dressing por
  // tipo (clusters) se ajusta a HALFX/HALFZ e ao z do altar (AZ).
  const L = pickLayout(def);
  const HALFX = L.halfX;
  const HALFZ = L.halfZ;
  const AZ = L.altar.z; // z do altar/braseiro (fundo da sala)
  const roomRoot = new TransformNode("room_" + def.index, scene);
  const lights: IDisposable[] = [];
  const aggregates: PhysicsAggregate[] = [];
  const casters: AbstractMesh[] = [];
  // ignite (0..1): fator de aceso. Tochas de parede nascem 1 (sempre acesas); o BRASEIRO
  // nasce 0 (apagado) e sobe na virada frio->quente ao ser aceso.
  const flames: { mesh: Mesh; light: PointLight | null; base: number; seed: number; ignite: number }[] = [];
  const rng = (i: number) => Math.abs((Math.sin((i + def.index * 100) * 12.9898) * 43758.5453) % 1);

  const track = (m: AbstractMesh): AbstractMesh => {
    m.parent = roomRoot;
    return m;
  };

  function kitBase(container: AssetContainer, mode: "base" | "floor"): Mesh | null {
    const entries = container.instantiateModelsToScene(undefined, false);
    const root = entries.rootNodes[0] as TransformNode | undefined;
    if (!root) return null;
    root.computeWorldMatrix(true);
    const src = root.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0) as Mesh[];
    src.forEach((m) => m.computeWorldMatrix(true));
    const merged = Mesh.MergeMeshes(src, true, true, undefined, false, true);
    root.dispose();
    if (!merged) return null;
    const bb = merged.getBoundingInfo().boundingBox;
    const cx = (bb.minimum.x + bb.maximum.x) / 2;
    const cz = (bb.minimum.z + bb.maximum.z) / 2;
    merged.bakeTransformIntoVertices(Matrix.Translation(-cx, mode === "floor" ? -bb.maximum.y : -bb.minimum.y, -cz));
    merged.refreshBoundingInfo();
    merged.isPickable = false;
    merged.receiveShadows = true;
    merged.parent = roomRoot;
    return merged;
  }

  function kitInstances(base: Mesh, placements: { x: number; z: number; rotY?: number }[], y = 0, pitch = 0): void {
    base.thinInstanceAdd(
      placements.map((p) => Matrix.Compose(Vector3.One(), Quaternion.RotationYawPitchRoll(p.rotY ?? 0, pitch, 0), new Vector3(p.x, y, p.z)))
    );
  }

  function colliderBox(root: TransformNode, shrink: number): void {
    root.computeWorldMatrix(true);
    const { min, max } = root.getHierarchyBoundingVectors(true);
    const size = max.subtract(min);
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) return;
    const box = MeshBuilder.CreateBox("colisor", { width: size.x * shrink, height: size.y, depth: size.z * shrink }, scene);
    box.position = min.add(max).scale(0.5);
    box.isVisible = false;
    box.isPickable = false;
    box.checkCollisions = true;
    track(box);
    aggregates.push(new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene));
  }

  function placeProp(
    container: AssetContainer,
    o: { x: number; z: number; y?: number; rotY?: number; scale?: number; collider?: boolean; cast?: boolean }
  ): TransformNode | null {
    const entries = container.instantiateModelsToScene(undefined, false);
    const root = entries.rootNodes[0] as TransformNode | undefined;
    if (!root) return null;
    root.rotationQuaternion = null;
    root.position.setAll(0);
    root.rotation = new Vector3(0, o.rotY ?? 0, 0);
    root.scaling.setAll(o.scale ?? 1);
    root.computeWorldMatrix(true);
    const b = root.getHierarchyBoundingVectors(true);
    const cx = (b.min.x + b.max.x) / 2;
    const cz = (b.min.z + b.max.z) / 2;
    root.position.set(o.x - cx, (o.y ?? 0) - b.min.y, o.z - cz);
    root.parent = roomRoot;
    if (o.collider) colliderBox(root, 0.65); // pegada enxuta: mais espaço de caminhada entre props
    if (o.cast !== false) for (const m of root.getChildMeshes(false)) { ctx.shadow.addShadowCaster(m as AbstractMesh); casters.push(m as AbstractMesh); }
    return root;
  }

  function wallCollider(cx: number, cz: number, w: number, d: number): void {
    const box = MeshBuilder.CreateBox("colisor_parede", { width: w, height: ROOM_H, depth: d }, scene);
    box.position.set(cx, ROOM_H / 2, cz);
    box.isVisible = false;
    box.isPickable = false;
    box.checkCollisions = true;
    track(box);
    aggregates.push(new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene));
  }

  // --- INSTANCIAMENTO de dressing repetido (1 draw call por tipo) ---
  // Em vez de clonar cada copia de um prop (cada clone custa draw calls), acumulamos as
  // posicoes por tipo em batch() e, no flushBatches(), criamos UMA malha-base mesclada +
  // thin instances. Colisores (invisiveis, sem custo de draw call) sao criados a parte para
  // os props solidos. Props unicos (1 copia) continuam por placeProp() (clone).
  type Spot = { x: number; z: number; y?: number; rotY?: number; scale?: number; collider?: boolean };
  const batches = new Map<string, { cast: boolean; spots: Spot[] }>();
  function batch(name: string, spot: Spot, cast = false): void {
    let b = batches.get(name);
    if (!b) { b = { cast, spots: [] }; batches.set(name, b); }
    b.cast = b.cast || cast;
    b.spots.push(spot);
  }
  function propBase(container: AssetContainer, cast: boolean): Mesh | null {
    const entries = container.instantiateModelsToScene(undefined, false);
    const root = entries.rootNodes[0] as TransformNode | undefined;
    if (!root) return null;
    root.computeWorldMatrix(true);
    const src = root.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0) as Mesh[];
    src.forEach((m) => m.computeWorldMatrix(true));
    const merged = Mesh.MergeMeshes(src, true, true, undefined, false, true);
    root.dispose();
    if (!merged) return null;
    const bb = merged.getBoundingInfo().boundingBox;
    const cx = (bb.minimum.x + bb.maximum.x) / 2;
    const cz = (bb.minimum.z + bb.maximum.z) / 2;
    merged.bakeTransformIntoVertices(Matrix.Translation(-cx, -bb.minimum.y, -cz));
    merged.refreshBoundingInfo();
    merged.isPickable = false;
    merged.receiveShadows = true;
    merged.parent = roomRoot;
    if (cast) { ctx.shadow.addShadowCaster(merged); casters.push(merged); }
    return merged;
  }
  function flushBatches(): void {
    for (const [name, b] of batches) {
      const base = propBase(P[name]!, b.cast);
      if (!base) continue;
      base.thinInstanceAdd(
        b.spots.map((p) =>
          Matrix.Compose(
            new Vector3(p.scale ?? 1, p.scale ?? 1, p.scale ?? 1),
            Quaternion.RotationYawPitchRoll(p.rotY ?? 0, 0, 0),
            new Vector3(p.x, p.y ?? 0, p.z)
          )
        )
      );
      // Colisores invisiveis (so para os spots solidos): caixa AABB a partir do bbox local.
      const cb = base.getBoundingInfo().boundingBox;
      const ex = cb.maximum.x - cb.minimum.x;
      const ez = cb.maximum.z - cb.minimum.z;
      const ey = cb.maximum.y - cb.minimum.y;
      for (const p of b.spots) {
        if (!p.collider) continue;
        const s = p.scale ?? 1;
        const swap = Math.abs(Math.round((p.rotY ?? 0) / (Math.PI / 2))) % 2 === 1;
        const w = (swap ? ez : ex) * s * 0.65;
        const d = (swap ? ex : ez) * s * 0.65;
        const h = ey * s;
        if (w <= 0 || h <= 0 || d <= 0) continue;
        const box = MeshBuilder.CreateBox("colisor", { width: w, height: h, depth: d }, scene);
        box.position.set(p.x, (p.y ?? 0) + h / 2, p.z);
        box.isVisible = false;
        box.isPickable = false;
        box.checkCollisions = true;
        track(box);
        aggregates.push(new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene));
      }
    }
  }

  type Flame = { mesh: Mesh; light: PointLight | null; base: number; seed: number; ignite: number };
  function makeFlame(pos: Vector3, scale: number, lightInt: number, withLight: boolean): Flame {
    const mat = new StandardMaterial("flameMat", scene);
    mat.emissiveColor = Color3.FromHexString("#ff7a1c");
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    const flame = MeshBuilder.CreateCylinder("chama", { diameterTop: 0, diameterBottom: 0.32 * scale, height: 0.7 * scale, tessellation: 8 }, scene);
    flame.material = mat;
    flame.position.copyFrom(pos);
    flame.isPickable = false;
    flame.parent = roomRoot;
    ctx.glow.addIncludedOnlyMesh(flame);
    let light: PointLight | null = null;
    if (withLight) {
      light = new PointLight("luz_chama", pos.add(new Vector3(0, 0.2, 0)), scene);
      light.diffuse = Color3.FromHexString("#ffa24c");
      light.intensity = lightInt;
      light.range = 34;
      light.shadowEnabled = false;
      lights.push(light);
    }
    const entry: Flame = { mesh: flame, light, base: lightInt, seed: flames.length * 1.7, ignite: 1 };
    flames.push(entry);
    return entry;
  }

  // --- Piso fisico invisivel ---
  const ground = MeshBuilder.CreateGround("piso_fisico", { width: HALFX * 2 + 2, height: HALFZ * 2 + 2 }, scene);
  ground.isVisible = false;
  ground.checkCollisions = true;
  ground.parent = roomRoot;
  aggregates.push(new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene));

  // --- Piso ladrilhado (xadrez + rotacao) + medalhao + tabuas ---
  const tilesA: { x: number; z: number; rotY: number }[] = [];
  const tilesB: { x: number; z: number; rotY: number }[] = [];
  const coordsX = L.floorX;
  const coordsZ = L.floorZ;
  for (let ix = 0; ix < coordsX.length; ix++)
    for (let iz = 0; iz < coordsZ.length; iz++) {
      const t = { x: coordsX[ix]!, z: coordsZ[iz]!, rotY: ((ix * 7 + iz * 3) % 4) * (Math.PI / 2) };
      ((ix + iz) % 2 === 0 ? tilesA : tilesB).push(t);
    }
  const fa = kitBase(P.floor!, "floor");
  const fb = kitBase(P.floor_alt!, "floor");
  if (fa) kitInstances(fa, tilesA);
  if (fb) kitInstances(fb, tilesB);
  const fd = kitBase(P.floor_deco!, "floor");
  if (fd) kitInstances(fd, [{ x: 0, z: 0 }]);
  const fw = kitBase(P.floor_wood!, "floor");
  if (fw) kitInstances(fw, [{ x: -7, z: -3 }, { x: -7, z: -6 }]);

  // --- Paredes (thin instances) + variacao quebrada (da planta) ---
  const wallBase = kitBase(P.wall!, "base");
  const brokenBase = kitBase(P.wall_broken!, "base");
  if (wallBase) kitInstances(wallBase, L.walls);
  if (brokenBase && L.broken.length) kitInstances(brokenBase, L.broken);
  // 2a fileira de parede (sala alta): leva a parede de 4m para 8m (ROOM_H).
  if (wallBase) kitInstances(wallBase, L.walls, WALL_H);
  if (brokenBase && L.broken.length) kitInstances(brokenBase, L.broken, WALL_H);
  if (wallBase) { ctx.shadow.addShadowCaster(wallBase); casters.push(wallBase); }

  // --- TETO: lajes de piso INVERTIDAS no topo (pedra de verdade, não vazio preto) ---
  const ceilBase = kitBase(P.floor!, "floor");
  if (ceilBase) {
    kitInstances(ceilBase, [...tilesA, ...tilesB], ROOM_H, Math.PI);
    ceilBase.receiveShadows = false;
  }
  // Colisor de teto: impede a câmera de escapar por cima ao dar zoom out.
  const ceilCol = MeshBuilder.CreateBox("colisor_teto", { width: HALFX * 2, height: 0.6, depth: HALFZ * 2 }, scene);
  ceilCol.position.set(0, ROOM_H + 0.3, 0);
  ceilCol.isVisible = false;
  ceilCol.isPickable = false;
  ceilCol.checkCollisions = true;
  track(ceilCol);

  for (const c of L.wallColliders) wallCollider(c.cx, c.cz, c.w, c.d);
  for (const c of L.corners) placeProp(P.wall_corner!, { x: c.x, z: c.z });
  placeProp(P.door!, { x: 2, z: -HALFZ + 0.4 });

  // --- Pilares (inteiros + quebrados) da planta - instanciados (1 draw call por tipo) ---
  for (const p of L.pillars) {
    batch(p.broken ? "pillar_broken" : "pillar", { x: p.x, z: p.z, rotY: p.rotY, collider: true }, true);
  }

  // --- Altar ao fundo (norte): estrado + degrau + braseiro (a Brasa) ---
  const daisMat = new StandardMaterial("matEstrado", scene);
  daisMat.diffuseColor = Color3.FromHexString("#363b43");
  daisMat.specularColor = Color3.Black();
  const daisScale = L.daisScale;
  const dais = MeshBuilder.CreateBox("estrado", { width: 8 * daisScale, height: 0.9, depth: 4.5 }, scene);
  dais.position.set(0, 0.45, AZ);
  dais.material = daisMat;
  dais.checkCollisions = true;
  dais.receiveShadows = true;
  dais.parent = roomRoot;
  aggregates.push(new PhysicsAggregate(dais, PhysicsShapeType.BOX, { mass: 0 }, scene));
  ctx.shadow.addShadowCaster(dais);
  casters.push(dais);
  const stepM = MeshBuilder.CreateBox("degrau", { width: 4.5, height: 0.45, depth: 1.3 }, scene);
  stepM.position.set(0, 0.225, AZ - 2.6);
  stepM.material = daisMat;
  stepM.checkCollisions = true;
  stepM.receiveShadows = true;
  stepM.parent = roomRoot;
  aggregates.push(new PhysicsAggregate(stepM, PhysicsShapeType.BOX, { mass: 0 }, scene));

  placeProp(P.torch!, { x: 0, z: AZ, y: 0.9, collider: true });
  const brazier = new Vector3(0, 0.9, AZ);
  // A BRASA do altar nasce APAGADA: só acende (frio->quente) quando a sala é limpa e a
  // Acendedora a reacende (setBrazierLit). As duas chamas laterais (offering) acompanham.
  const brazierFlame = makeFlame(new Vector3(0, 2.2, AZ), def.boss ? 2.1 : 1.6, def.boss ? 3.0 : 2.4, true);
  // Anel de caveiras do altar (sempre presente; instanciado via clusterGrime no flush).
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    batch("skull", { x: Math.cos(a) * 1.7, z: AZ + Math.sin(a) * 1.1, y: 0.9, rotY: a + 1.2, scale: 0.32 });
  }
  const offerL = makeFlame(new Vector3(-2.7, 1.05, AZ), 0.4, 0, false);
  const offerR = makeFlame(new Vector3(2.7, 1.05, AZ), 0.4, 0, false);
  // Braseiro e oferendas começam apagados (a sala nasce fria).
  brazierFlame.ignite = 0;
  offerL.ignite = 0;
  offerR.ignite = 0;

  // --- A PASSAGEM (alçapão) em frente ao altar: pisar nela (sala limpa) desce de andar.
  //     Selada enquanto há inimigos; ao limpar, o feixe de luz acende (setCleared).
  placeProp(P.trapdoor!, { x: L.exit.x, z: L.exit.z, cast: false });
  const beamMat = new StandardMaterial("feixe", scene);
  beamMat.emissiveColor = Color3.FromHexString("#ffd089");
  beamMat.diffuseColor = Color3.Black();
  beamMat.specularColor = Color3.Black();
  beamMat.alpha = 0.4;
  beamMat.disableLighting = true;
  const beam = MeshBuilder.CreateCylinder("feixe_passagem", { diameterTop: 0.5, diameterBottom: 1.7, height: 6.5, tessellation: 14 }, scene);
  beam.material = beamMat;
  beam.position.set(L.exit.x, 3.2, L.exit.z);
  beam.isPickable = false;
  beam.parent = roomRoot;
  beam.setEnabled(false);
  ctx.glow.addIncludedOnlyMesh(beam);

  // --- Tochas/luminárias de parede (emissivas): fileira baixa + fileira alta (parede dupla) ---
  for (const t of L.torches) {
    const ix = Math.abs(t.x) >= HALFX - 0.6 ? -Math.sign(t.x) * 0.25 : 0;
    const iz = Math.abs(t.z) >= HALFZ - 0.6 ? -Math.sign(t.z) * 0.25 : 0;
    placeProp(P.torch_wall!, { x: t.x, z: t.z, y: 2.4, rotY: t.rotY, cast: false });
    makeFlame(new Vector3(t.x + ix, 2.75, t.z + iz), 0.7, 0, false);
    placeProp(P.torch_wall!, { x: t.x, z: t.z, y: 6.0, rotY: t.rotY, cast: false });
    makeFlame(new Vector3(t.x + ix, 6.35, t.z + iz), 0.6, 0, false);
  }

  // --- CANDELABROS pendentes do teto (anel de metal + velas reais + luz quente que pisca) ---
  const chandMat = new StandardMaterial("matCandelabro", scene);
  chandMat.diffuseColor = Color3.FromHexString("#2a2620");
  chandMat.specularColor = Color3.FromHexString("#6b5a3a"); // leve brilho de metal
  const hangChandelier = (cxp: number, czp: number): void => {
    const ringY = ROOM_H - 1.8; // ~6.2: acima da câmera de jogo (~5.7), não atrapalha
    const chain = MeshBuilder.CreateCylinder("corrente", { diameter: 0.07, height: ROOM_H - ringY, tessellation: 6 }, scene);
    chain.position.set(cxp, (ROOM_H + ringY) / 2, czp);
    chain.material = chandMat;
    chain.isPickable = false;
    track(chain);
    const ring = MeshBuilder.CreateTorus("anel_candelabro", { diameter: 1.5, thickness: 0.12, tessellation: 18 }, scene);
    ring.position.set(cxp, ringY, czp);
    ring.material = chandMat;
    ring.isPickable = false;
    track(ring);
    ctx.shadow.addShadowCaster(ring);
    casters.push(ring);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      placeProp(P.candle_triple!, { x: cxp + Math.cos(a) * 0.66, z: czp + Math.sin(a) * 0.66, y: ringY, rotY: a, scale: 0.8, cast: false });
    }
    makeFlame(new Vector3(cxp, ringY + 0.5, czp), 1.0, 0.5, true); // luz quente pendente, suave (pisca)
  };
  // Eixo central, fora do altar (norte) e da passagem; densidade cresce com a profundidade da sala.
  hangChandelier(0, 0);
  hangChandelier(0, -(HALFZ - 6));
  if (HALFZ >= 18) hangChandelier(0, HALFZ - 9);

  // --- DRESSING por TIPO DE SALA (def.kind) ---
  // Clusters tematicos; cada tipo de sala (RoomDef.kind) liga um subconjunto. Pecas
  // repetidas vao por batch() (instanciadas no flush); pecas unicas por placeProp() (clone).
  // Reusa as coordenadas ja testadas: a variacao e QUAIS clusters aparecem, nao o layout-base.
  const seedRot = (i: number): number => rng(i) * Math.PI * 2;

  // Os clusters referenciam HALFX/HALFZ (paredes) e AZ (z do altar). Calibrados para que a
  // planta quadrada 24x24 (HALFX=HALFZ=12, AZ=9.2) fique IDENTICA a versao anterior; nas
  // demais formas os props seguem as paredes/altar reais em vez de coordenadas fixas.
  function clusterBanners(count: number): void {
    const spots: Spot[] = [
      { x: -3.8, z: HALFZ - 0.5, y: 1.4 }, { x: 3.8, z: HALFZ - 0.5, y: 1.4 },
      { x: -HALFX + 0.5, z: 2, y: 1.4, rotY: Math.PI / 2 }, { x: HALFX - 0.5, z: -6, y: 1.4, rotY: -Math.PI / 2 },
    ];
    spots.slice(0, count).forEach((s) => batch("banner", s));
    batch("wall_deco_a", { x: -4, z: HALFZ - 0.3 });
    if (count > 2) batch("wall_deco_a", { x: HALFX - 2, z: -HALFZ + 0.3 });
  }

  function clusterMess(): void {
    // Refeitorio/guarnicao: mesa, banco, cadeiras, suporte de armas, refeicao, espada.
    placeProp(P.table!, { x: -7.5, z: -3, rotY: 0.3, collider: true });
    placeProp(P.bench!, { x: -7.5, z: -4.4, rotY: 0.2, collider: true });
    batch("chair", { x: -6, z: -2.2, rotY: -1.2, collider: true }, true);
    batch("chair", { x: -8.8, z: -2, rotY: 0.6, collider: true }, true);
    placeProp(P.weapon_rack!, { x: -2, z: -HALFZ + 0.7, collider: true });
    placeProp(P.bucket!, { x: -6.6, z: -1.2, rotY: 0.4 });
    placeProp(P.plate_food_A!, { x: -7.2, z: -3.1, cast: false });
    placeProp(P.sword_shield!, { x: -3.0, z: -6.5, rotY: -0.6, cast: false });
  }

  function clusterStorage(keg: boolean): void {
    // Armazem: barris, caixas, potes (encostados na parede sul, qualquer que seja seu z).
    const zS = -(HALFZ - 4);
    batch("barrel", { x: -HALFX + 1.2, z: zS, collider: true }, true);
    batch("barrel", { x: -HALFX + 2.1, z: zS - 0.4, collider: true }, true);
    batch("barrel", { x: -HALFX + 1.6, z: zS + 0.8, y: 1.0 }, true);
    batch("crate", { x: HALFX - 1.4, z: zS + 1, rotY: 0.4, collider: true }, true);
    batch("crate", { x: HALFX - 1.5, z: zS - 0.5, rotY: -0.3, collider: true }, true);
    batch("crate", { x: HALFX - 1.4, z: zS + 0.6, y: 1.0, rotY: 0.9 }, true);
    batch("pots", { x: 7, z: 3, rotY: 0.5 });
    batch("pots", { x: -3, z: 4, rotY: 1.4 });
    if (keg) placeProp(P.keg!, { x: -HALFX + 1.1, z: zS + 2, rotY: 0.3, collider: true });
  }

  function clusterAlchemy(): void {
    // Estantes + pocoes (parede leste, na faixa entre o centro e o altar).
    const zb = Math.min(AZ - 3.7, HALFZ - 4.5);
    placeProp(P.bookcase!, { x: HALFX - 0.7, z: zb, rotY: -Math.PI / 2, collider: true });
    placeProp(P.bookcase!, { x: HALFX - 0.7, z: zb - 3, rotY: -Math.PI / 2, collider: true });
    placeProp(P.bookcase!, { x: -HALFX + 0.7, z: zb - 1.5, rotY: Math.PI / 2, collider: true });
    placeProp(P.shelf_small_candles!, { x: HALFX - 0.7, z: zb + 1.9, rotY: -Math.PI / 2, collider: true });
    placeProp(P.bottle_A_green!, { x: HALFX - 1.0, z: zb + 0.7, cast: false });
    placeProp(P.bottle_B_green!, { x: HALFX - 1.0, z: zb + 0.45, cast: false });
    placeProp(P.bottle_C_brown!, { x: HALFX - 1.0, z: zb + 0.95, cast: false });
  }

  function clusterCatacomb(full: boolean): void {
    // Caixoes e tumulos encostados na parede oeste (le a sala como catacumba).
    placeProp(P.coffin!, { x: -HALFX + 1.0, z: 1.4, rotY: Math.PI / 2, collider: true });
    placeProp(P.coffin_decorated!, { x: -HALFX + 1.0, z: -1.4, rotY: Math.PI / 2, collider: true });
    placeProp(P.gravestone!, { x: -HALFX + 0.9, z: AZ - 0.6, rotY: Math.PI / 2 });
    placeProp(P.grave_A!, { x: -HALFX + 1.6, z: AZ + 1.2, rotY: Math.PI / 2, cast: false });
    if (full) placeProp(P.gravemarker_A!, { x: -HALFX + 1.1, z: -(HALFZ - 3.8), rotY: Math.PI / 2 });
  }

  function clusterRitual(): void {
    // Candelabros sobre o estrado, relicario, placa votiva, lanterna (relativos ao altar).
    batch("candle_triple", { x: -2.3, z: AZ + 0.2, y: 0.9 });
    batch("candle_triple", { x: 2.3, z: AZ + 0.2, y: 0.9 });
    placeProp(P.skull_candle!, { x: 1.3, z: AZ - 0.7, y: 0.9, scale: 0.9, cast: false });
    placeProp(P.shrine_candles!, { x: -5.2, z: AZ + 0.2, rotY: 0.4, collider: true });
    placeProp(P.plaque_candles!, { x: 4.0, z: HALFZ - 0.3, y: 1.6, cast: false });
    placeProp(P.lantern_standing!, { x: -(HALFX - 4), z: 2.6 });
  }

  function clusterTreasure(gold: boolean): void {
    placeProp(P.chest!, { x: 3, z: AZ - 2.2, rotY: -0.5, collider: true });
    batch("coins", { x: 3.6, z: AZ - 2.9, rotY: 0.3 });
    batch("coins", { x: -2.6, z: AZ - 2.0, rotY: 1.1 });
    if (gold) {
      // Recompensa do chefe: bau dourado + pilhas de moeda + chave (lado leste do estrado).
      placeProp(P.chest_gold!, { x: 6.0, z: AZ - 1.0, rotY: -0.5, collider: true });
      placeProp(P.coin_stack_large!, { x: 6.9, z: AZ - 1.6, rotY: 0.5 });
      placeProp(P.coin_stack_medium!, { x: 5.2, z: AZ - 1.7, rotY: -0.3 });
      placeProp(P.key!, { x: 6.2, z: AZ - 2.3, rotY: 0.2 });
    }
  }

  function clusterGrime(density: number): void {
    // Caveiras, escombros e ossadas. density (0..1) escala a quantidade.
    const rubblePts: [number, number, number][] = [[-3.5, -7, 0.9], [8.5, 8.5, 1], [4, -4, 0.8], [-9.2, AZ + 0.2, 0.9]];
    rubblePts.slice(0, Math.max(2, Math.round(density * 4))).forEach(([x, z, s], i) =>
      batch("rubble", { x: x + (rng(i) - 0.5), z: z + (rng(i + 5) - 0.5), rotY: seedRot(i), scale: s })
    );
    const skullPts: [number, number, number][] = [
      [-2, 2, 0.4], [5, -1, 0.38], [-5, 1, 0.42], [1.5, 5.5, 0.36], [-4.5, -3.5, 0.4], [6.5, 5, 0.38],
    ];
    skullPts.slice(0, Math.max(2, Math.round(density * 6))).forEach(([x, z, s], i) =>
      batch("skull", { x: x + (rng(i) - 0.5), z: z + (rng(i + 5) - 0.5), rotY: seedRot(i), scale: s })
    );
    const pile = Math.round(density * 7);
    for (let i = 0; i < pile; i++)
      batch("skull", { x: -(HALFX - 2.6) + rng(i + 30) * 1.6, z: (AZ - 0.6) + rng(i + 40) * 1.6, y: rng(i + 50) * 0.25, rotY: seedRot(i), scale: 0.3 + rng(i + 10) * 0.1 });
    if (density > 0.6) {
      placeProp(P.bone_A!, { x: 5.5, z: 2.5, rotY: 0.8, cast: false });
      placeProp(P.bone_B!, { x: -4.5, z: 5.5, rotY: 2.1, cast: false });
      placeProp(P.bone_C!, { x: 8.5, z: -2.0, rotY: 1.5, cast: false });
      placeProp(P.ribcage!, { x: 6.5, z: -3.2, rotY: 1.2, cast: false });
    }
  }

  switch (def.kind) {
    case "guarda": // guarnicao: refeitorio + armazem + estandartes (a sala de referencia)
      clusterBanners(3); clusterMess(); clusterStorage(true); clusterTreasure(false);
      clusterCatacomb(false); clusterGrime(0.5);
      break;
    case "salao": // grande salao: estandartes, banquete, alquimia, ritual leve
      clusterBanners(4); clusterMess(); clusterAlchemy(); clusterRitual();
      clusterTreasure(false); clusterGrime(0.4);
      break;
    case "cisterna": // cisterna em ruinas: armazem + muitos escombros e ossadas, pouco mobiliario
      clusterBanners(1); clusterStorage(true); clusterCatacomb(false);
      clusterTreasure(false); clusterGrime(1.0);
      break;
    case "santuario": // santuario: ritual + catacumba + alquimia, reverente
      clusterBanners(2); clusterRitual(); clusterCatacomb(true); clusterAlchemy();
      clusterTreasure(false); clusterGrime(0.6);
      break;
    case "guardiao": // arena do chefe: catacumba imponente, ritual, tesouro dourado, chao limpo
      clusterBanners(4); clusterRitual(); clusterCatacomb(true);
      clusterTreasure(true); clusterGrime(0.3);
      break;
  }

  // Instancia todo o dressing repetido acumulado (1 draw call por tipo) + colisores.
  flushBatches();

  // Materiais aceitam ate 6 luzes (evita a ambiente ser descartada).
  for (const m of scene.materials) {
    const mm = m as unknown as { maxSimultaneousLights?: number };
    if (typeof mm.maxSimultaneousLights === "number") mm.maxSimultaneousLights = 6;
  }

  // Tremular das chamas (escala por `ignite`: apagada some, acesa tremula normal).
  const flicker: Observer<Scene> = scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() / 1000;
    for (const f of flames) {
      const fl = 0.85 + 0.15 * Math.sin(t * 11 + f.seed) + 0.06 * Math.sin(t * 23 + f.seed * 2);
      if (f.light) f.light.intensity = f.base * fl * f.ignite;
      const on = f.ignite > 0.02;
      if (f.mesh.isEnabled() !== on) f.mesh.setEnabled(on);
      f.mesh.scaling.y = (0.9 + 0.18 * Math.sin(t * 13 + f.seed)) * (0.4 + 0.6 * f.ignite);
    }
    if (beam.isEnabled()) {
      beam.rotation.y = t * 0.5;
      const s = 1 + 0.07 * Math.sin(t * 3);
      beam.scaling.x = s;
      beam.scaling.z = s;
    }
  });

  // Alvos de cor da virada frio->quente (a cena vive entre estes dois estados).
  const COLD_FOG = Color3.FromHexString("#1a2636");
  const WARM_FOG = Color3.FromHexString("#241a14");
  const COLD_AMB = Color3.FromHexString("#8aa6c6");
  const WARM_AMB = Color3.FromHexString("#a98f6e");
  const setBrazierLit = (t: number): void => {
    const k = t < 0 ? 0 : t > 1 ? 1 : t;
    brazierFlame.ignite = k;
    offerL.ignite = k;
    offerR.ignite = k;
    scene.fogColor = Color3.Lerp(COLD_FOG, WARM_FOG, k);
    ctx.ambient.intensity = 0.62 - 0.22 * k; // o quente passa a vir do braseiro, não do "céu"
    ctx.ambient.diffuse = Color3.Lerp(COLD_AMB, WARM_AMB, k);
    ctx.key.intensity = 1.0 - 0.3 * k;
  };
  setBrazierLit(0); // a sala nasce FRIA (braseiro apagado)

  return {
    def,
    spawn: L.spawn,
    exit: L.exit, // a passagem (alçapão): pisar nela = descer
    enemyAnchor: L.enemyAnchor,
    brazier,
    setBrazierLit,
    setCleared(open: boolean): void {
      beam.setEnabled(open);
    },
    dispose(): void {
      scene.onBeforeRenderObservable.remove(flicker);
      for (const f of flames) ctx.glow.removeIncludedOnlyMesh(f.mesh);
      for (const c of casters) ctx.shadow.removeShadowCaster(c);
      for (const a of aggregates) a.dispose();
      for (const l of lights) l.dispose();
      roomRoot.dispose(false, true);
    },
  };
}

/** Garante que as pecas do kit estao carregadas (chamar uma vez no boot). */
export async function ensureCryptPieces(scene: Scene): Promise<void> {
  await ensurePieces(scene);
}
