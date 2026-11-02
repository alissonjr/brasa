import {
  AbstractMesh, ArcRotateCamera, Color3, Color4, ColorCurves, Engine, HemisphericLight, ImageProcessingConfiguration, ImportMeshAsync, Matrix, Mesh,
  MeshBuilder, PointLight, Scene, SceneInstrumentation, StandardMaterial, TransformNode, Vector3, VertexBuffer, PBRMaterial,
} from "@babylonjs/core";
import type { AssetContainer, Material } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { createLightPool, getActorLight, loadContainer } from "@engine";
import { loadAnimLibrary, retargetClips, semContornoNosOlhos } from "../../src/game/actors/quaterniusRig";
import { HeroModel, type HeroAction } from "../../src/game/actors/heroModel";
import { buildSword, buildRoundShield, buildCapturedWeapon } from "../../src/game/actors/weapons";

/**
 * CAMADA DEV (mock). Comparação das armas capturadas: candidatos de modelo por arma, normalizados
 * (empunhadura na origem, eixo maior em +Y, como weapons.ts), sob a luz e a câmera alta do jogo.
 * Nada daqui entra no jogo. Ver docs/brasa/spec-armas-capturadas.md.
 */

// ---------- Definição das armas e candidatos ----------
const ARM = "/models/armas/";
type Rot = [number, number, number];
type Src = { k: "file"; url: string; node?: string } | { k: "proc"; make: (s: Scene) => TransformNode };
interface Cand {
  id: string; label: string; fonte: string; src: Src;
  /** Euler (rad) que leva o eixo maior da arma para +Y, com a ponta para cima. */
  rot?: Rot;
  /** Comprimento alvo (m) no eixo maior depois de girar. */
  len: number;
  /** Fração do comprimento (a partir da base) onde a mão segura. */
  grip: number;
  /** Material PBR de arquivo: força metal 0 e rugosidade 0,55 (igual ao KayKit). */
  fixMetal?: boolean;
  /** Mão: deslocamento/rotação extra em relação ao encaixe padrão da espada de bronze. */
  hold?: { pos?: Rot; rot?: Rot; scale?: number };
}
interface Arma {
  id: string; nome: string; morto: string; halo: string; cands: Cand[]; pick: number;
  /** Escala do drop no chão (o jogo usa 1,4 para ler da câmera alta). */
  chaoEscala?: number;
}
const HALF = Math.PI / 2;

// ---------- Procedurais (mock): no máximo 2 malhas por arma (fundidas por material) ----------
function flat(scene: Scene, name: string, hex: string, emissive = "#000000"): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.emissiveColor = Color3.FromHexString(emissive);
  m.specularColor = Color3.Black();
  return m;
}
function mergeBy(scene: Scene, root: TransformNode, groups: Mesh[][], names: string[]): void {
  groups.forEach((g, i) => {
    if (g.length === 0) return;
    for (const m of g) m.removeVerticesData(VertexBuffer.UVKind);
    const merged = Mesh.MergeMeshes(g, true, true, undefined, false, false);
    if (merged) { merged.name = names[i]!; merged.parent = root; merged.isPickable = false; }
  });
  void scene;
}
function procLanca(scene: Scene): TransformNode {
  const root = new TransformNode("lanca", scene);
  const wood = flat(scene, "lancaMad", "#6a4526", "#1c1209");
  const iron = flat(scene, "lancaFerro", "#9aa4b0", "#22262c");
  const shaft = MeshBuilder.CreateCylinder("haste", { height: 1.7, diameter: 0.05, tessellation: 6 }, scene);
  shaft.position.y = 0.85; shaft.material = wood;
  const head = MeshBuilder.CreateCylinder("ponta", { height: 0.5, diameterTop: 0, diameterBottom: 0.2, tessellation: 4 }, scene);
  head.position.y = 1.93; head.scaling.z = 0.3; head.material = iron;
  const collar = MeshBuilder.CreateCylinder("colar", { height: 0.1, diameter: 0.075, tessellation: 6 }, scene);
  collar.position.y = 1.7; collar.material = iron;
  const butt = MeshBuilder.CreateCylinder("conto", { height: 0.1, diameterTop: 0.05, diameterBottom: 0.02, tessellation: 6 }, scene);
  butt.position.y = -0.04; butt.material = iron;
  mergeBy(scene, root, [[shaft], [head, collar, butt]], ["lancaMadeira", "lancaFerro"]);
  return root;
}
function procArco(scene: Scene): TransformNode {
  const root = new TransformNode("arco", scene);
  const wood = flat(scene, "arcoMad", "#5c4632", "#1c1209");
  const cord = flat(scene, "arcoCorda", "#d8cfb8", "#2a2620");
  const pts: Vector3[] = [];
  for (let i = 0; i <= 8; i++) { const t = (i / 8 - 0.5) * 2; pts.push(new Vector3(0, 0.7 + t * 0.65, -0.18 * (1 - t * t))); }
  const limb = MeshBuilder.CreateTube("arcoVara", { path: pts, radius: 0.028, tessellation: 5 }, scene);
  limb.material = wood;
  const string = MeshBuilder.CreateCylinder("corda", { height: 1.3, diameter: 0.01, tessellation: 3 }, scene);
  string.position.y = 0.7; string.material = cord;
  mergeBy(scene, root, [[limb], [string]], ["arcoMadeira", "arcoCorda"]);
  return root;
}
function procClavaFundida(scene: Scene): TransformNode {
  const root = new TransformNode("clavaFundida", scene);
  const wood = flat(scene, "clMad", "#5a3a22", "#140d07");
  const iron = flat(scene, "clFer", "#6b7380", "#14161a");
  const handle = MeshBuilder.CreateCylinder("cabo", { height: 0.7, diameterTop: 0.07, diameterBottom: 0.05, tessellation: 7 }, scene);
  handle.position.y = 0.35; handle.material = wood;
  const head = MeshBuilder.CreateCylinder("cab", { height: 0.55, diameterTop: 0.46, diameterBottom: 0.18, tessellation: 7 }, scene);
  head.position.y = 0.88; head.material = wood;
  const woodParts: Mesh[] = [handle, head];
  const ironParts: Mesh[] = [];
  const band = MeshBuilder.CreateTorus("aro", { diameter: 0.3, thickness: 0.04, tessellation: 10 }, scene);
  band.position.y = 0.98; band.scaling.set(1.5, 1, 1.5); band.material = iron; ironParts.push(band);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const stud = MeshBuilder.CreateCylinder("tacha", { height: 0.09, diameterTop: 0, diameterBottom: 0.05, tessellation: 5 }, scene);
    stud.material = iron;
    stud.position.set(Math.cos(a) * 0.2, 0.82 + (i % 2) * 0.1, Math.sin(a) * 0.2);
    stud.rotation.z = -Math.cos(a) * 1.2; stud.rotation.x = Math.sin(a) * 1.2;
    ironParts.push(stud);
  }
  mergeBy(scene, root, [woodParts, ironParts], ["clavaMadeira", "clavaFerro"]);
  return root;
}
function procLaminaPrimeira(scene: Scene): TransformNode {
  const sword = buildSword(scene);
  sword.scaling.setAll(1.7);
  for (const m of sword.getChildMeshes(false)) {
    const mat = m.material as StandardMaterial | null;
    if (mat && mat.name === "bronze") { mat.diffuseColor = Color3.FromHexString("#1d1815"); mat.emissiveColor = Color3.FromHexString("#4a1c06"); }
  }
  return sword;
}

const ARMAS: Arma[] = [
  { id: "lanca", nome: "Lança da Guarda", morto: "Guarda", halo: "#f2c46d", pick: 2, cands: [
    { id: "oga-spear", label: "Spear (OGA, Tedium)", fonte: "oga", src: { k: "file", url: ARM + "oga-melee-weapons/melee_weapons_convertido.glb", node: "Spear" }, len: 2.0, grip: 0.3, fixMetal: true },
    { id: "oga-halberd", label: "Halberd (OGA, Tedium)", fonte: "oga", src: { k: "file", url: ARM + "oga-melee-weapons/melee_weapons_convertido.glb", node: "Halberd" }, len: 2.1, grip: 0.3, fixMetal: true },
    { id: "proc-lanca", label: "Procedural (código)", fonte: "proc", src: { k: "proc", make: procLanca }, len: 2.0, grip: 0.3, hold: { rot: [Math.PI, 0, 0] } },
  ] },
  { id: "adaga", nome: "Adaga do Rol", morto: "Ladino e Espreitador", halo: "#8fd6e6", pick: 0, cands: [
    { id: "kk-dagger", label: "dagger (KayKit Adventurers)", fonte: "kaykit", src: { k: "file", url: ARM + "kaykit-adventurers/dagger.gltf" }, len: 0.6, grip: 0.12 },
    { id: "q-dagger", label: "Dagger (Quaternius RPG Items)", fonte: "quaternius", src: { k: "file", url: ARM + "quaternius-ultimate-rpg-items/Dagger.glb" }, len: 0.6, grip: 0.12 },
    { id: "oga-dagger", label: "Dagger (OGA, Tedium)", fonte: "oga", src: { k: "file", url: ARM + "oga-melee-weapons/melee_weapons_convertido.glb", node: "Dagger" }, len: 0.6, grip: 0.12, fixMetal: true },
  ] },
  { id: "besta", nome: "Besta da Guarda", morto: "Arqueiro", halo: "#ff8a2c", pick: 1, cands: [
    { id: "kk-crossbow", label: "crossbow_1handed (KayKit Adventurers)", fonte: "kaykit", src: { k: "file", url: ARM + "kaykit-adventurers/crossbow_1handed.gltf" }, rot: [-HALF, 0, 0], len: 0.8, grip: 0.4 },
    { id: "sk-crossbow", label: "Skeleton_Crossbow (KayKit Skeletons)", fonte: "kaykit", src: { k: "file", url: ARM + "kaykit-skeletons/Skeleton_Crossbow.gltf" }, rot: [-HALF, 0, 0], len: 0.85, grip: 0.4 },
    { id: "q-bow", label: "Bow_Wooden (Quaternius RPG Items)", fonte: "quaternius", src: { k: "file", url: ARM + "quaternius-ultimate-rpg-items/Bow_Wooden.glb" }, len: 1.0, grip: 0.5 },
    { id: "proc-arco", label: "Arco procedural (código)", fonte: "proc", src: { k: "proc", make: procArco }, len: 1.4, grip: 0.5 },
  ] },
  { id: "cajado", nome: "Cajado de Cinza", morto: "Conjurador", halo: "#ff8a2c", pick: 0, cands: [
    { id: "sk-staff", label: "Skeleton_Staff (KayKit Skeletons)", fonte: "kaykit", src: { k: "file", url: ARM + "kaykit-skeletons/Skeleton_Staff.gltf" }, len: 1.75, grip: 0.35, hold: { rot: [Math.PI, 0, 0] } },
    { id: "kk-staff", label: "staff (KayKit Adventurers)", fonte: "kaykit", src: { k: "file", url: ARM + "kaykit-adventurers/staff.gltf" }, len: 1.75, grip: 0.35 },
    { id: "oga-staff", label: "Staff (OGA, Tedium)", fonte: "oga", src: { k: "file", url: ARM + "oga-melee-weapons/melee_weapons_convertido.glb", node: "Staff" }, len: 1.75, grip: 0.35, fixMetal: true },
    { id: "proc-cajado", label: "Atual do jogo (procedural)", fonte: "proc", src: { k: "proc", make: (s) => buildCapturedWeapon(s, "cajado") }, len: 1.5, grip: 0.3 },
  ] },
  { id: "clava", nome: "Clava do Bruto", morto: "Brutamonte", halo: "#f2c46d", pick: 3, cands: [
    { id: "oga-club", label: "Club (OGA, Tedium)", fonte: "oga", src: { k: "file", url: ARM + "oga-melee-weapons/melee_weapons_convertido.glb", node: "Club" }, len: 1.1, grip: 0.2, fixMetal: true },
    { id: "oga-mace", label: "Mace (OGA, Tedium)", fonte: "oga", src: { k: "file", url: ARM + "oga-melee-weapons/melee_weapons_convertido.glb", node: "Mace" }, len: 1.0, grip: 0.2, fixMetal: true },
    { id: "proc-clava-atual", label: "Atual do jogo (9 malhas)", fonte: "proc", src: { k: "proc", make: (s) => buildCapturedWeapon(s, "clava") }, len: 1.15, grip: 0.2 },
    { id: "proc-clava", label: "Atual fundida (2 malhas)", fonte: "proc", src: { k: "proc", make: procClavaFundida }, len: 1.15, grip: 0.2 },
    { id: "q-hammer", label: "Hammer_Double (Quaternius RPG Items)", fonte: "quaternius", src: { k: "file", url: ARM + "quaternius-ultimate-rpg-items/Hammer_Double.glb" }, len: 1.1, grip: 0.2 },
  ] },
  { id: "machado", nome: "Machado do Antigo", morto: "Antigo", halo: "#f2c46d", pick: 1, cands: [
    { id: "kk-axe2", label: "axe_2handed (KayKit Adventurers)", fonte: "kaykit", src: { k: "file", url: ARM + "kaykit-adventurers/axe_2handed.gltf" }, len: 1.2, grip: 0.25 },
    { id: "sk-axe", label: "Skeleton_Axe (KayKit Skeletons)", fonte: "kaykit", src: { k: "file", url: ARM + "kaykit-skeletons/Skeleton_Axe.gltf" }, len: 1.1, grip: 0.25 },
    { id: "oga-gaxe", label: "Great Axe (OGA, Tedium)", fonte: "oga", src: { k: "file", url: ARM + "oga-melee-weapons/melee_weapons_convertido.glb", node: "Great Axe" }, len: 1.2, grip: 0.25, fixMetal: true },
    { id: "q-axe", label: "Axe_Double (Quaternius RPG Items)", fonte: "quaternius", src: { k: "file", url: ARM + "quaternius-ultimate-rpg-items/Axe_Double.glb" }, len: 1.2, grip: 0.25 },
  ] },
  { id: "escudo", nome: "Escudo da Sentinela", morto: "Sentinela e Pesado", halo: "#8fd6e6", pick: 0, cands: [
    { id: "sk-shield", label: "Skeleton_Shield_Large_A (KayKit Skeletons)", fonte: "kaykit", src: { k: "file", url: ARM + "kaykit-skeletons/Skeleton_Shield_Large_A.gltf" }, len: 0.95, grip: 0.5, hold: { rot: [0, HALF, 0] } },
    { id: "kk-spikes", label: "shield_spikes (KayKit Adventurers)", fonte: "kaykit", src: { k: "file", url: ARM + "kaykit-adventurers/shield_spikes.gltf" }, len: 0.85, grip: 0.5 },
    { id: "kk-round", label: "shield_round (KayKit Adventurers)", fonte: "kaykit", src: { k: "file", url: ARM + "kaykit-adventurers/shield_round.gltf" }, len: 0.8, grip: 0.5 },
    { id: "proc-escudo", label: "Escudo do herói (procedural atual)", fonte: "proc", src: { k: "proc", make: buildRoundShield }, len: 0.6, grip: 0.5 },
  ] },
  { id: "reliquia", nome: "Lâmina da Primeira", morto: "Guardião", halo: "#ffd27a", pick: 0, cands: [
    { id: "proc-primeira", label: "Espada de bronze carbonizada (procedural)", fonte: "proc", src: { k: "proc", make: procLaminaPrimeira }, len: 0.85, grip: 0.12 },
  ] },
];

// ---------- Cena, câmera e luz (copiadas do jogo) ----------
const q = new URLSearchParams(location.search);
const vista = q.get("vista") ?? "chao";
const canvas = document.getElementById("c") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true });
const scene = new Scene(engine);
scene.clearColor = Color4.FromHexString("#0E1A2BFF");
const ip = scene.imageProcessingConfiguration;
ip.toneMappingEnabled = false; ip.exposure = 1.05; ip.contrast = 1.2; ip.vignetteEnabled = true; ip.vignetteWeight = 2.1;
ip.vignetteStretch = 0; ip.vignetteColor = new Color4(0, 0, 0, 0); ip.vignetteBlendMode = ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
const cc = new ColorCurves();
cc.shadowsHue = 214; cc.shadowsDensity = 22; cc.shadowsSaturation = 6; cc.highlightsHue = 34; cc.highlightsDensity = 42; cc.highlightsSaturation = 28; cc.globalSaturation = 8;
ip.colorCurves = cc; ip.colorCurvesEnabled = true;

// Câmera alta do jogo: alpha -PI/2 - PI/5, beta 0,82, raio 15, fov 0,62 (thirdPersonCamera.ts).
const cam = new ArcRotateCamera("cam", -HALF - Math.PI / 5, 0.82, 15, new Vector3(0, 0.95, 0), scene);
cam.fov = 0.62; cam.minZ = 0.3; cam.maxZ = 140;
cam.attachControl(canvas, true);

const amb = new HemisphericLight("amb", new Vector3(0, 1, 0), scene);
amb.intensity = 0.4; amb.diffuse = Color3.FromHexString("#6f86ad"); amb.groundColor = Color3.FromHexString("#0c1119");
const actors = getActorLight(scene); // a luz de aro dos atores do jogo (getActorLight)
const spark = new PointLight("spark", new Vector3(0, 1.4, 0.5), scene);
spark.diffuse = Color3.FromHexString("#ffa63d"); spark.specular = Color3.Black(); spark.intensity = 1.0; spark.range = 9;

const floorMat = flat(scene, "piso", "#2a3346");
floorMat.specularColor = Color3.Black();
floorMat.emissiveColor = Color3.FromHexString("#1a2230");
const floor = MeshBuilder.CreateGround("piso", { width: 60, height: 40 }, scene);
floor.material = floorMat;
floor.position.y = 0;

const inst = new SceneInstrumentation(scene);
inst.captureFrameTime = true; inst.captureRenderTime = true;
const g = window as unknown as Record<string, unknown>;
g.__scene = scene;

// ---------- Carga e normalização ----------
interface Built { node: TransformNode; meshes: AbstractMesh[]; tris: number; draws: number; kb: number }
const fileCache = new Map<string, Promise<AssetContainer>>();
async function inst3(url: string): Promise<TransformNode[]> {
  let p = fileCache.get(url);
  if (!p) { p = loadContainer(scene, url); fileCache.set(url, p); }
  const container = await p;
  return container.instantiateModelsToScene((s) => s, false, { doNotInstantiate: true }).rootNodes as TransformNode[];
}
const kbCache = new Map<string, number>();
async function fileKb(url: string): Promise<number> {
  if (kbCache.has(url)) return kbCache.get(url)!;
  let total = 0;
  try {
    const r = await fetch(url); const buf = await r.arrayBuffer(); total += buf.byteLength;
    if (url.endsWith(".gltf")) {
      const j = JSON.parse(new TextDecoder().decode(buf)) as { buffers?: { uri: string }[]; images?: { uri: string }[] };
      const base = url.slice(0, url.lastIndexOf("/") + 1);
      for (const b of [...(j.buffers ?? []), ...(j.images ?? [])]) { if (b.uri && !b.uri.startsWith("data:")) total += (await (await fetch(base + b.uri)).arrayBuffer()).byteLength; }
    }
  } catch { /* sem tamanho */ }
  const kb = Math.round((total / 1024) * 10) / 10;
  kbCache.set(url, kb);
  return kb;
}

function allMeshes(n: TransformNode): AbstractMesh[] { return n.getChildMeshes(false).filter((m) => m.getTotalVertices() > 0); }

async function build(c: Cand): Promise<Built> {
  let inner: TransformNode;
  let kb = 0;
  if (c.src.k === "proc") {
    inner = c.src.make(scene);
  } else {
    const roots = await inst3(c.src.url);
    kb = await fileKb(c.src.url);
    const top = roots[0]!;
    if (c.src.node) {
      const nodeName = c.src.node;
      const f = top.getChildren((n) => n.name === nodeName, false)[0] as TransformNode | undefined;
      if (!f) throw new Error("nó não achado: " + nodeName);
      f.position.set(0, 0, 0); // tira o deslocamento em fila da folha de armas
      for (const m of top.getChildMeshes(false)) { if (m !== (f as unknown as AbstractMesh) && !m.isDescendantOf(f)) m.dispose(); }
    }
    inner = top;
    if (c.fixMetal) {
      for (const m of allMeshes(inner)) { const mat = m.material as PBRMaterial | null; if (mat && "metallic" in mat) { mat.metallic = 0; mat.roughness = 0.55; } }
    }
  }
  // Normaliza: gira (rot), mede, escala para `len` e põe a empunhadura na origem.
  const wrap = new TransformNode("w_" + c.id, scene);
  inner.parent = wrap;
  wrap.rotation.set(...(c.rot ?? [0, 0, 0]));
  wrap.computeWorldMatrix(true);
  let mn = new Vector3(1e9, 1e9, 1e9), mx = new Vector3(-1e9, -1e9, -1e9);
  for (const m of allMeshes(wrap)) {
    m.computeWorldMatrix(true);
    const b = m.getBoundingInfo().boundingBox;
    mn = Vector3.Minimize(mn, b.minimumWorld); mx = Vector3.Maximize(mx, b.maximumWorld);
  }
  const h = Math.max(1e-6, mx.y - mn.y);
  const s = c.len / h;
  console.log('dbg ' + c.id + ' size=' + mx.subtract(mn).asArray().map((v) => v.toFixed(3)).join('x') + ' s=' + s.toFixed(3));
  const holder = new TransformNode("h_" + c.id, scene);
  wrap.parent = holder;
  wrap.position.set(-((mn.x + mx.x) / 2), -(mn.y + c.grip * h), -((mn.z + mx.z) / 2));
  holder.scaling.setAll(s);
  const meshes = allMeshes(holder);
  let tris = 0, draws = 0;
  for (const m of meshes) {
    tris += (m.getTotalIndices() / 3) | 0;
    draws += (m as Mesh).subMeshes?.length ?? 1;
    m.isPickable = false; m.metadata = { ...(m.metadata ?? {}), noOutline: true };
  }
  actors.include(holder);
  holder.setEnabled(false);
  return { node: holder, meshes, tris, draws, kb };
}

function setVisible(n: TransformNode, v: boolean): void { n.setEnabled(v); }

// ---------- Rótulos HTML ----------
const labelsEl = document.getElementById("labels")!;
interface Lab { el: HTMLElement; at: TransformNode | Vector3; dy: number }
const labs: Lab[] = [];
function addLabel(html: string, at: TransformNode | Vector3, dy = 0): void {
  const el = document.createElement("div"); el.className = "lab"; el.innerHTML = html; labelsEl.appendChild(el);
  labs.push({ el, at, dy });
}
function updateLabels(): void {
  const w = engine.getRenderWidth(), h = engine.getRenderHeight();
  const tm = scene.getTransformMatrix();
  const vp = cam.viewport.toGlobal(w, h);
  for (const l of labs) {
    const p = l.at instanceof Vector3 ? l.at : l.at.getAbsolutePosition();
    const s = Vector3.Project(p.add(new Vector3(0, l.dy, 0)), Matrix.IdentityReadOnly, tm, vp);
    l.el.style.left = (s.x * (canvas.clientWidth / w)) + "px";
    l.el.style.top = (s.y * (canvas.clientHeight / h)) + "px";
  }
}

// ---------- Barra de navegação ----------
const VISTAS: [string, string][] = [["catalogo", "Candidatos"], ["chao", "No chão"], ["perto", "Chão de perto"], ["maos", "Nas mãos"], ["mao", "Mão de perto"], ["mortos", "Nos mortos"]];
const bar = document.getElementById("bar")!;
bar.innerHTML = VISTAS.map(([v, n]) => `<a href="?vista=${v}" class="${v === vista ? "on" : ""}">${n}</a>`).join("") +
  ARMAS.map((a) => `<a href="?vista=${vista === "mao" || vista === "perto" ? vista : "mao"}&arma=${a.id}">${a.nome}</a>`).join("");

// ---------- Vistas ----------
function frame(target: Vector3, alpha: number, beta: number, radius: number, fov: number): void {
  cam.setTarget(target.clone());
  cam.alpha = alpha; cam.beta = beta; cam.radius = radius; cam.fov = fov;
}
const GAME_ALPHA = -HALF - Math.PI / 5;
const stats: Record<string, { tris: number; draws: number; kb: number }> = {};
const built = new Map<string, Built>();
async function getBuilt(c: Cand): Promise<Built> {
  let b = built.get(c.id);
  if (!b) { b = await build(c); built.set(c.id, b); }
  return b;
}
function cloneOf(b: Built, name: string): TransformNode {
  // Cópias reais (não instâncias) para poder girar e reposicionar à vontade.
  const n = b.node.clone(name, null, false) as TransformNode;
  n.setEnabled(true);
  for (const m of n.getChildMeshes(false)) m.setEnabled(true);
  actors.include(n);
  return n;
}

function placeGround(arma: Arma, b: Built, x: number, z: number, withHalo = true): TransformNode {
  const root = new TransformNode("chao_" + arma.id, scene);
  root.position.set(x, 0, z);
  const w = cloneOf(b, "g_" + arma.id);
  w.parent = root;
  const sc = arma.chaoEscala ?? 1.4;
  w.scaling.scaleInPlace(sc);
  // Deitada, como no jogo (rotation.x = PI/2): o eixo maior vai para o chão; um pouco acima do piso.
  w.rotation.set(HALF, 0, 0);
  w.rotation.y = 2.2 + 0.35 * Math.sin(x * 3.1 + z * 1.7); // quase paralela à tela, com a variação aleatória do jogo
  w.position.y = 0.14 * sc;
  if (arma.id === "escudo") { w.rotation.set(HALF - 0.12, 0, 0); w.position.y = 0.2; }
  // Centra a arma no halo (a empunhadura fica na origem do modelo; no chão o que importa é o centro).
  root.computeWorldMatrix(true); w.computeWorldMatrix(true);
  const bb = w.getHierarchyBoundingVectors(true);
  w.position.x -= (bb.min.x + bb.max.x) / 2 - x;
  w.position.z -= (bb.min.z + bb.max.z) / 2 - z;
  if (withHalo) {
    const halo = createLightPool(scene, { radius: 1.1, color: arma.halo, alpha: 0.55, y: 0.02 });
    halo.parent = root;
  }
  return root;
}

function findHand(hm: HeroModel | TransformNode, bone = "hand_r"): TransformNode | undefined {
  const root = (hm as HeroModel).root ?? (hm as TransformNode);
  return root.getChildTransformNodes(false).find((n) => n.name === bone || n.name === "Clone of " + bone);
}

function holdOnHand(hand: TransformNode, arma: Arma, c: Cand, b: Built): TransformNode {
  // O encaixe da espada de bronze (heroModel.attachProps): pos (-0.035, 0.01, 0), rot (PI/2, 0, 0), escala 1.
  const w = cloneOf(b, "m_" + arma.id);
  const hold = c.hold ?? {};
  w.parent = hand;
  const qr = q.get("hold")?.split(",").map(Number) as Rot | undefined;
  const qp = q.get("hpos")?.split(",").map(Number) as Rot | undefined;
  const p = qp ?? hold.pos ?? [-0.035, 0.01, 0];
  w.position.set(...p);
  w.rotation.set(...(qr ?? hold.rot ?? [HALF, 0, 0]));
  hand.computeWorldMatrix(true);
  const hs = new Vector3(); hand.getWorldMatrix().decompose(hs);
  (window as unknown as Record<string, unknown>).__handScale = hs.x;
  w.scaling.scaleInPlace((hold.scale ?? 1) / (hs.x || 1));
  return w;
}

async function heroHolding(arma: Arma, x: number, z: number, frac: number | null, action: HeroAction, yaw: number): Promise<HeroModel> {
  const hm = new HeroModel(scene, { name: "heroi_" + arma.id });
  hm.root.position.set(x, 0.9, z);
  hm.root.rotation.y = Number(q.get("rot") ?? yaw);
  const dev = hm as unknown as { loaded: boolean; actionGroup?: { goToFrame(f: number): void; pause(): void; from: number; to: number } };
  while (!dev.loaded) await new Promise((r) => setTimeout(r, 80));
  const hand = findHand(hm);
  if (hand) {
    for (const ch of hand.getChildren((n) => n.name === "sword", false)) (ch as TransformNode).setEnabled(false);
    for (const ch of hand.getChildTransformNodes(false)) if (ch.name === "sword_tip") ch.setEnabled(false);
    const c = arma.cands[arma.pick]!;
    holdOnHand(hand, arma, c, await getBuilt(c));
  }
  if (action !== "idle" || frac !== null) {
    hm.setAction(action);
    if (frac !== null && dev.actionGroup) { dev.actionGroup.goToFrame(dev.actionGroup.from + (dev.actionGroup.to - dev.actionGroup.from) * frac); dev.actionGroup.pause(); }
  }
  return hm;
}

async function main(): Promise<void> {
  const pagina = Number(q.get("pagina") ?? 1);
  if (vista === "catalogo") {
    // Linhas = armas; colunas = candidatos. Vista frontal quase ortográfica (compara silhuetas e tamanhos).
    const per = 2;
    const lista = ARMAS.slice((pagina - 1) * per, pagina * per);
    frame(new Vector3(0, 0, 0), -HALF, HALF, Number(q.get("raio") ?? 18.5), 0.46);
    floor.setEnabled(false);
    lista.forEach((arma, ri) => { void (async () => {
      const y = ((per - 1) / 2 - ri) * 4.0 + 0.5;
      for (let ci = 0; ci < arma.cands.length; ci++) {
        const c = arma.cands[ci]!;
        const b = await getBuilt(c);
        stats[c.id] = { tris: b.tris, draws: b.draws, kb: b.kb };
        const x = -5.0 + ci * 2.55;
        const n = cloneOf(b, "cat_" + c.id);
        n.position.set(x, y, 0);
        n.rotation.y = 0.5;
        addLabel(`<b>${arma.nome}</b> ${ci === arma.pick ? "(escolhida)" : ""}<small>${c.label}<br>${b.tris} tris, ${b.draws} chamada(s), ${b.kb ? b.kb + " KB" : "código"}</small>`, new Vector3(x, y - 1.15, 0), 0);
      }
    })(); });
  } else if (vista === "chao" || vista === "perto") {
    const cols = 4, gap = 3.2;
    const focus = q.get("arma");
    const lista = focus ? ARMAS.filter((a) => a.id === focus) : ARMAS;
    if (vista === "chao") frame(new Vector3(0, 0.3, 0), GAME_ALPHA, 0.82, Number(q.get("raio") ?? 15), 0.62);
    else frame(new Vector3(0, 0.25, 0), Number(q.get("alfa") ?? -HALF - 0.55), Number(q.get("beta") ?? 1.0), Number(q.get("raio") ?? 3.6), 0.5);
    for (let i = 0; i < lista.length; i++) {
      const arma = lista[i]!;
      const c = arma.cands[arma.pick]!;
      const b = await getBuilt(c);
      stats[arma.id] = { tris: b.tris, draws: b.draws, kb: b.kb };
      const col = focus ? 0 : i % cols, row = focus ? 0 : Math.floor(i / cols);
      const x = focus ? 0 : (col - (Math.min(cols, lista.length) - 1) / 2) * gap, z = focus ? 0 : (row - 0.5) * -3.4 + 1.2;
      const r = placeGround(arma, b, x, z);
      addLabel(`${arma.nome}<small>${arma.morto}</small>`, r, 0.0);
    }
    if (!focus) {
      const hm = new HeroModel(scene, { name: "heroi_ref" });
      hm.root.position.set(-6.4, 0.9, -1.0); hm.root.rotation.y = Math.PI - 0.5;
      spark.position.set(-6.4, 1.4, -0.4);
    }
  } else if (vista === "maos" || vista === "mao") {
    const focus = q.get("arma");
    const lista = focus ? ARMAS.filter((a) => a.id === focus) : ARMAS.slice((pagina - 1) * 4, pagina * 4);
    const frac = q.get("quadro") !== null ? Number(q.get("quadro")) : null;
    const action = (q.get("acao") as HeroAction | null) ?? (frac !== null ? "light" : "idle");
    const gap = vista === "mao" ? 0 : 2.6;
    if (vista === "maos") frame(new Vector3(0, 0.9, 0), GAME_ALPHA, 0.82, Number(q.get("raio") ?? 15), 0.62);
    else frame(new Vector3(0, 0.95, 0.2), Number(q.get("alfa") ?? -HALF - 0.45), Number(q.get("beta") ?? 1.15), Number(q.get("raio") ?? 3.0), 0.5);
    for (let i = 0; i < lista.length; i++) {
      const arma = lista[i]!;
      const d = vista === "mao" ? 0 : (i - (lista.length - 1) / 2) * gap;
      const x = d * 0.81, z = d * -0.59; // ao longo da horizontal da tela da câmera alta
      await heroHolding(arma, x, z, frac, action, vista === "mao" ? Math.PI - 0.7 : 0.1);
      const b = await getBuilt(arma.cands[arma.pick]!);
      stats[arma.id] = { tris: b.tris, draws: b.draws, kb: b.kb };
      if (vista === "maos") addLabel(`${arma.nome}`, new Vector3(x, 0, z), -0.1);
    }
    spark.position.set(0, 1.4, 0.8);
  } else if (vista === "mortos") {
    const lib = await loadAnimLibrary(scene);
    const ELENCO: { arma: string; model: string; h: number; nome: string }[] = [
      { arma: "lanca", model: "morto_guerreiro", h: 1.85, nome: "Guarda" },
      { arma: "adaga", model: "morto_ladino", h: 1.78, nome: "Ladino" },
      { arma: "besta", model: "morto_ladino", h: 1.78, nome: "Arqueiro" },
      { arma: "cajado", model: "morto_conjurador", h: 1.95, nome: "Conjurador" },
      { arma: "machado", model: "morto_antigo", h: 2.3, nome: "Antigo" },
      { arma: "escudo", model: "morto_sentinela", h: 2.5, nome: "Sentinela" },
    ];
    frame(new Vector3(0, 1.0, 0), GAME_ALPHA, 0.9, Number(q.get("raio") ?? 15), 0.62);
    for (let i = 0; i < ELENCO.length; i++) {
      const e = ELENCO[i]!;
      const arma = ARMAS.find((a) => a.id === e.arma)!;
      const r = await ImportMeshAsync(`/models/personagens/${e.model}.glb`, scene, { pluginExtension: ".glb" });
      const top = r.meshes[0]!;
      const holder = new TransformNode("m" + i, scene);
      const fit = new TransformNode("fit" + i, scene);
      fit.parent = holder; top.parent = fit; top.computeWorldMatrix(true);
      let bb = top.getHierarchyBoundingVectors(true);
      const sc = e.h / Math.max(0.001, bb.max.y - bb.min.y);
      fit.scaling.setAll(sc); fit.computeWorldMatrix(true); top.computeWorldMatrix(true);
      bb = top.getHierarchyBoundingVectors(true);
      fit.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
      const dd = (i - (ELENCO.length - 1) / 2) * 2.5;
      holder.position.set(dd * 0.81, 0, dd * -0.59);
      holder.rotation.y = Math.PI - 0.55;
      semContornoNosOlhos(holder);
      for (const gp of r.animationGroups) gp.stop();
      actors.include(holder);
      const clip = retargetClips(lib, top as TransformNode, "mt" + i, { x: "Zombie_Idle_Loop" }).x;
      if (clip) { clip.start(true); clip.goToFrame(clip.from + (clip.to - clip.from) * 0.3); }
      const hand = r.transformNodes.find((n) => n.name === "hand_r" || n.name === "Clone of hand_r");
      if (hand) {
        const c = arma.cands[arma.pick]!;
        const b = await getBuilt(c);
        const w = cloneOf(b, "morto_" + arma.id);
        w.parent = hand;
        w.position.set(...(c.hold?.pos ?? [-0.035, 0.01, 0])); w.rotation.set(...(c.hold?.rot ?? [HALF, 0, 0]));
        // O morto é maior que a heroína (fit): compensa a escala do osso para a arma manter o tamanho real.
        hand.computeWorldMatrix(true);
        const hs = new Vector3(); hand.getWorldMatrix().decompose(hs);
        w.scaling.scaleInPlace(1 / (hs.x || 1));
      }
      addLabel(`${e.nome}<small>larga: ${arma.nome}</small>`, new Vector3(holder.position.x, 0, holder.position.z), -0.0);
    }
    spark.position.set(0, 1.6, 2.5);
  }

  (g as { __pronto?: boolean }).__pronto = true;
  const tick = (): void => {
    const lines = Object.entries(stats).map(([k, v]) => `${k}: ${v.tris} tris, ${v.draws} chamada(s) de desenho, ${v.kb || "código"} ${v.kb ? "KB" : ""}`);
    (g as { __stats?: unknown }).__stats = stats;
    document.getElementById("stats")!.textContent = `FPS ${engine.getFps().toFixed(0)} | chamadas/quadro ${inst.drawCallsCounter.current} | ` + (lines.length ? lines.slice(0, 3).join(" | ") + (lines.length > 3 ? " ..." : "") : "carregando");
  };
  setInterval(tick, 500);
}

engine.runRenderLoop(() => { scene.render(); updateLabels(); });
window.addEventListener("resize", () => engine.resize());
main().catch((e) => { console.error(e); document.title = "ERRO " + e; (g as { __erro?: string }).__erro = String(e); });
void setVisible; void ([] as Material[]);
