import {
  AbstractMesh,
  Color3,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import type { AssetContainer, Scene, ShadowGenerator } from "@babylonjs/core";
import { terrainHeightAt } from "./world";

/**
 * CAMADA JOGO. Helpers compartilhados de montagem de cena no estilo caricato:
 * material de cor chapada, instanciar modelos CC0 assentando no terreno, registrar
 * sombras, colisores (caixa / envoltória convexa) e PRNG determinístico.
 * Utilitário genérico de montagem de cena (props, vegetação, assets CC0).
 */

/**
 * Tipo de colisor por prop:
 * - "hull": envoltória convexa que segue o contorno (mais fiel, mais caro).
 * - "box": caixa AABB (barato, aproximado).
 * - "none": sem colisão (atravessável).
 */
export type ColliderKind = "hull" | "box" | "none";

export interface FlatOpts {
  emissive?: number; // 0..1 fração da própria cor somada ao emissivo (brilho de fogo/sagrado)
  spec?: boolean; // brilho especular discreto (metal/ouro)
  twoSided?: boolean; // desliga back-face culling (panos finos)
}

export function flatMaterial(scene: Scene, hex: string, opts: FlatOpts = {}): StandardMaterial {
  const m = new StandardMaterial("flat-" + hex, scene);
  const c = Color3.FromHexString(hex);
  m.diffuseColor = c;
  m.specularColor = opts.spec ? new Color3(0.18, 0.16, 0.12) : Color3.Black();
  if (opts.emissive) m.emissiveColor = c.scale(opts.emissive);
  if (opts.twoSided) m.backFaceCulling = false;
  return m;
}

/** Substitui o material de todos os meshes do container por uma cor chapada. */
export function applyFlat(scene: Scene, container: AssetContainer, hex: string, opts: FlatOpts = {}): void {
  const mat = flatMaterial(scene, hex, opts);
  for (const mesh of container.meshes) {
    if (mesh.getTotalVertices() > 0) mesh.material = mat;
  }
}

export interface PlaceOpts {
  x: number;
  z: number;
  y?: number; // se omitido, assenta no terreno via terrainHeightAt
  scale?: number;
  rotY?: number;
  collider?: ColliderKind;
}

/** Instancia um container CC0, posiciona/escala/gira, registra sombra e colisor. */
export function placeModel(
  scene: Scene,
  shadow: ShadowGenerator,
  container: AssetContainer,
  opts: PlaceOpts
): TransformNode | null {
  const entries = container.instantiateModelsToScene(undefined, false);
  const root = entries.rootNodes[0] as TransformNode | undefined;
  if (!root) return null;
  const y = opts.y ?? terrainHeightAt(opts.x, opts.z);
  root.position.set(opts.x, y, opts.z);
  root.scaling.setAll(opts.scale ?? 1);
  root.rotation = new Vector3(0, opts.rotY ?? 0, 0);
  registerShadows(shadow, root);
  refreshWorld(root);
  addCollider(scene, root, opts.collider ?? "none");
  return root;
}

/** Registra todos os meshes da hierarquia como projetores de sombra. */
export function registerShadows(shadow: ShadowGenerator, root: TransformNode): void {
  for (const node of root.getChildMeshes(false)) shadow.addShadowCaster(node);
  if (root instanceof AbstractMesh) shadow.addShadowCaster(root);
}

function refreshWorld(root: TransformNode): void {
  root.computeWorldMatrix(true);
  for (const m of root.getChildMeshes(false)) m.computeWorldMatrix(true);
}

export function addCollider(scene: Scene, root: TransformNode, kind: ColliderKind): void {
  refreshWorld(root);
  if (kind === "box") addBoxCollider(scene, root);
  else if (kind === "hull") addHullCollider(scene, root);
}

/** Colisor estático em caixa AABB ajustada ao tamanho real do prop já posicionado. */
export function addBoxCollider(scene: Scene, root: TransformNode, shrink = 0.78): void {
  const { min, max } = root.getHierarchyBoundingVectors(true);
  const size = max.subtract(min);
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) return;
  const center = min.add(max).scale(0.5);
  const box = MeshBuilder.CreateBox(
    "colisor",
    { width: size.x * shrink, height: size.y, depth: size.z * shrink },
    scene
  );
  box.position = center;
  box.isVisible = false;
  box.isPickable = false;
  new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene);
}

/** Colisor estático em envoltória convexa (segue o contorno) por mesh com geometria. */
export function addHullCollider(scene: Scene, root: TransformNode): void {
  void scene;
  for (const mesh of root.getChildMeshes(false)) {
    if (mesh.getTotalVertices() <= 0) continue;
    new PhysicsAggregate(mesh, PhysicsShapeType.CONVEX_HULL, { mass: 0 }, scene);
  }
}

/** PRNG determinístico (mesma cena a cada carregamento; estável para save). */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
