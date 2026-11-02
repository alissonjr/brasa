import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine, HemisphericLight, ImportMeshAsync,
  MeshBuilder, PointLight, Scene, StandardMaterial, TransformNode, Vector3,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { outlineHierarchy } from "@engine";
import { loadAnimLibrary, retargetClips, semContornoNosOlhos } from "../game/actors/quaterniusRig";
import { gradeMonsterMaterials } from "../game/actors/actorGrade";
import { HeroModel, type HeroAction } from "../game/actors/heroModel";

/**
 * CAMADA DEV. Bestiario: todos os personagens lado a lado sob a luz do jogo, para avaliar
 * coerencia de estilo (escala, paleta, contorno) sem precisar jogar ate cada inimigo.
 * Abre em /bestiario.html. Parametros: ?pose=0..N (rotacao), ?cam=perto|alta.
 */
interface Cast { nome: string; model: string; height: number; face: number; humanoide?: boolean; heroi?: boolean; morto?: string; exp?: number; }
const TODOS: Cast[] = [
  { nome: "Acendedora", model: "/models/personagens/heroina.glb", height: 1.8, face: Math.PI, humanoide: true, heroi: true },
  { nome: "Minion", model: "/models/personagens/morto_aldeao.glb", height: 1.8, face: Math.PI, humanoide: true, morto: "idle" },
  { nome: "Guerreiro", model: "/models/personagens/morto_guerreiro.glb", height: 1.85, face: Math.PI, humanoide: true, morto: "idle" },
  { nome: "Ladino", model: "/models/personagens/morto_ladino.glb", height: 1.78, face: Math.PI, humanoide: true, morto: "idle" },
  { nome: "Pesado", model: "/models/personagens/morto_guerreiro.glb", height: 2.45, face: Math.PI, humanoide: true, morto: "idle" },
  { nome: "Antigo", model: "/models/quaternius_monsters/orc_skull.glb", height: 2.0, face: Math.PI },
  { nome: "Demonio", model: "/models/quaternius_monsters/demon.glb", height: 1.95, face: Math.PI },
  { nome: "Brutamonte", model: "/models/quaternius_monsters/yeti.glb", height: 2.5, face: Math.PI, exp: 0.7 },
  { nome: "Espreitador", model: "/models/quaternius_monsters/ninja.glb", height: 1.8, face: Math.PI },
  { nome: "Conjurador", model: "/models/personagens/morto_conjurador.glb", height: 1.95, face: Math.PI, humanoide: true, morto: "idle" },
  { nome: "Guardiao", model: "/models/quaternius_monsters/mushroomking.glb", height: 3.4, face: 0 },
];
const GAP = 3.1;
const q = new URLSearchParams(location.search);
// ?pick=0,1,2 mostra so esses (indices de TODOS); ?pose=N gira (N * 45 graus)
const ELENCO = q.get("pick") ? q.get("pick")!.split(",").map((i) => TODOS[Number(i)]!) : TODOS;

const canvas = document.getElementById("c") as HTMLCanvasElement;
const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true });
const scene = new Scene(engine);
// ?maxvu=200 simula um GPU com poucas uniformes de vertice (testa o recuo do contorno, outline.ts)
if (q.get("maxvu")) engine.getCaps().maxVertexUniformVectors = Number(q.get("maxvu"));
scene.clearColor = new Color4(0.02, 0.03, 0.05, 1);

const total = (ELENCO.length - 1) * GAP;
const cam = new ArcRotateCamera("cam", -Math.PI / 2, q.get("cam") === "alta" ? 0.9 : 1.32, Math.max(7, total * 0.9 + 8) * (q.get("cam") === "alta" ? 1.2 : 1), new Vector3(0, 1.0, 0), scene);
cam.fov = 0.55;
if (q.get("cam") === "meio") { cam.radius = 5.2; cam.beta = 1.3; cam.target.set(-total / 2, 0.95, 0); }
if (q.get("cam") === "cara") { cam.radius = 2.4; cam.beta = 1.45; cam.target.set(-total / 2 + Number(q.get("foco") ?? 0) * GAP, 1.55, 0); }
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
    if (c.heroi) {
      // O herói de verdade (HeroModel): mostra a lâmina, a brasa e as ações do jogo. ?acao=light|heavy|dodge|block|hit|ember e ?frac=0..1
      const hm = new HeroModel(scene, { name: "heroi_dev" });
      hm.root.position.set(-total / 2 + i * GAP, 0.9, 0);
      hm.root.rotation.y = Number(q.get("rot") ?? Math.PI);
      (window as unknown as { __hm: HeroModel }).__hm = hm;
      const dev = hm as unknown as { loaded: boolean; actionGroup?: { goToFrame(f: number): void; pause(): void; from: number; to: number } };
      while (!dev.loaded) await new Promise((r) => setTimeout(r, 100));
      if (q.get("acao")) {
        hm.setAction(q.get("acao") as HeroAction);
        const f = q.get("frac");
        if (f && dev.actionGroup) {
          dev.actionGroup.goToFrame(dev.actionGroup.from + (dev.actionGroup.to - dev.actionGroup.from) * Number(f));
          dev.actionGroup.pause();
        }
      }
      continue;
    }
    const r = await ImportMeshAsync(c.model, scene, { pluginExtension: ".glb" });
    const top = r.meshes[0]!;
    const holder = new TransformNode("h" + i, scene);
    // fit separado: o __root__ do loader guarda a conversao de mao-dupla; nao pode ser zerado
    const fit = new TransformNode("fit" + i, scene);
    fit.parent = holder;
    top.parent = fit;
    top.computeWorldMatrix(true);
    let b = top.getHierarchyBoundingVectors(true);
    const s = c.height / Math.max(0.001, b.max.y - b.min.y);
    fit.scaling.setAll(s);
    fit.computeWorldMatrix(true);
    top.computeWorldMatrix(true);
    b = top.getHierarchyBoundingVectors(true);
    fit.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    holder.position.set(-total / 2 + i * GAP, 0, 0);
    holder.rotation.y = c.face + (Number(q.get("pose") ?? 0) * Math.PI) / 4;
    semContornoNosOlhos(holder);
    if (q.get("sem") !== "contorno") outlineHierarchy(holder, { width: c.height * 0.018 });
    for (const g of r.animationGroups) g.stop();
    if (c.humanoide) {
      const lib = await loadAnimLibrary(scene);
      const nome = q.get("clip") ?? (c.morto ? "Zombie_Idle_Loop" : "Idle_Loop");
      const g = retargetClips(lib, top as TransformNode, "b" + i, { x: nome }).x;
      if (g) {
        g.start(true);
        if (q.get("frac")) { g.goToFrame(g.from + (g.to - g.from) * Number(q.get("frac"))); g.pause(); }
      }
    } else {
      // monstros nao humanoides: mesma tinta de paleta do jogo (skeleton.ts)
      gradeMonsterMaterials(holder.getChildMeshes(false).map((m) => m.material!).filter(Boolean), c.exp ?? 1);
      (r.animationGroups.find((g) => /^Idle$/i.test(g.name)) ?? r.animationGroups.find((g) => /idle/i.test(g.name)))?.play(true);
    }
  }
  (window as unknown as { __pronto: boolean }).__pronto = true;
})();
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
