import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight, ImportMeshAsync,
  MeshBuilder, PointLight, Scene, StandardMaterial, Texture, TransformNode, Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { outlineHierarchy } from "@engine";

/**
 * CAMADA DEV. Bestiario: todos os personagens lado a lado sob a luz do jogo, para avaliar
 * coerencia de estilo (escala, paleta, contorno) sem precisar jogar ate cada inimigo.
 * Abre em /bestiario.html. Parametros: ?pose=0..N (rotacao), ?cam=perto|alta.
 */
interface Cast { nome: string; model: string; height: number; face: number; }
const ELENCO: Cast[] = [
  { nome: "Acendedora", model: "/models/Rogue_Hooded.glb", height: 1.8, face: 0 },
  { nome: "Minion", model: "/models/Skeleton_Minion.glb", height: 1.55, face: 0 },
  { nome: "Guerreiro", model: "/models/Skeleton_Warrior.glb", height: 1.85, face: 0 },
  { nome: "Ladino", model: "/models/Skeleton_Rogue.glb", height: 1.78, face: 0 },
  { nome: "Pesado", model: "/models/Skeleton_Warrior.glb", height: 2.45, face: 0 },
  { nome: "Antigo", model: "/models/quaternius_monsters/orc_skull.glb", height: 2.0, face: Math.PI },
  { nome: "Demonio", model: "/models/quaternius_monsters/demon.glb", height: 1.95, face: Math.PI },
  { nome: "Brutamonte", model: "/models/quaternius_monsters/yeti.glb", height: 2.5, face: Math.PI },
  { nome: "Espreitador", model: "/models/quaternius_monsters/ninja.glb", height: 1.8, face: Math.PI },
  { nome: "Conjurador", model: "/models/quaternius_monsters/mushroomking.glb", height: 2.1, face: 0 },
];
const GAP = 3.1;

const q = new URLSearchParams(location.search);
const canvas = document.getElementById("c") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.02, 0.03, 0.05, 1);

const total = (ELENCO.length - 1) * GAP;
const cam = new ArcRotateCamera("cam", -Math.PI / 2, q.get("cam") === "alta" ? 0.9 : 1.32, q.get("cam") === "alta" ? 26 : 22, new Vector3(0, 1.0, 0), scene);
cam.fov = 0.55;
const amb = new HemisphericLight("amb", new Vector3(0, 1, 0), scene);
amb.intensity = 0.4; amb.diffuse = Color3.FromHexString("#6f86ad"); amb.groundColor = Color3.FromHexString("#0c1119");
const key = new DirectionalLight("key", new Vector3(-0.5, -0.85, -0.4), scene);
key.intensity = 0.55; key.diffuse = Color3.FromHexString("#8fa3c4");
const warm = new PointLight("warm", new Vector3(0, 4, 6), scene);
warm.diffuse = Color3.FromHexString("#ffa63d"); warm.intensity = 0.9; warm.range = 40;

const floor = MeshBuilder.CreateGround("piso", { width: total + 12, height: 10 }, scene);
const fm = new StandardMaterial("fm", scene);
fm.diffuseColor = Color3.FromHexString("#2a3346"); fm.specularColor = Color3.Black();
floor.material = fm;

(window as unknown as { __scene: Scene }).__scene = scene;
(async () => {
  const names = document.getElementById("nomes")!;
  names.innerHTML = ELENCO.map((c) => `<span style="width:${GAP * 52}px;text-align:center">${c.nome}</span>`).join("");
  names.style.display = "none";
  for (let i = 0; i < ELENCO.length; i++) {
    const c = ELENCO[i]!;
    const r = await ImportMeshAsync(c.model, scene, { pluginExtension: ".glb" });
    const top = r.meshes[0]!;
    const holder = new TransformNode("h" + i, scene);
    top.parent = holder;
    top.computeWorldMatrix(true);
    let b = top.getHierarchyBoundingVectors(true);
    const s = c.height / Math.max(0.001, b.max.y - b.min.y);
    top.scaling.setAll(s);
    top.computeWorldMatrix(true);
    b = top.getHierarchyBoundingVectors(true);
    top.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    holder.position.set(-total / 2 + i * GAP, 0, 0);
    holder.rotation.y = c.face + (Number(q.get("pose") ?? 0) * Math.PI) / 4;
    outlineHierarchy(holder, { width: c.height * 0.018 });
    for (const g of r.animationGroups) g.stop();
    (r.animationGroups.find((g) => /^Idle$/i.test(g.name)) ?? r.animationGroups.find((g) => /idle/i.test(g.name)))?.play(true);
    if (i === 0) {
      const tex = new Texture("/models/rogue_brasa.png", scene, false, false);
      for (const m of holder.getChildMeshes(false)) {
        const mat = m.material as { albedoTexture?: unknown } | null;
        if (mat && "albedoTexture" in mat) mat.albedoTexture = tex;
      }
    }
  }
  (window as unknown as { __pronto: boolean }).__pronto = true;
})();
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
