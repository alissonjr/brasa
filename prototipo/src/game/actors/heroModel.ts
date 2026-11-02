import { Color3, ImportMeshAsync, MeshBuilder, StandardMaterial, Texture, TransformNode } from "@babylonjs/core";
import type { AnimationGroup, BaseTexture, Material, Mesh, Scene, StandardMaterial as StdMat } from "@babylonjs/core";
import "@babylonjs/loaders/glTF"; // registra o loader glTF
import { assetUrl, createLightPool, getActorLight, outlineHierarchy, type CharacterVisual } from "@engine";
import { buildSword } from "./weapons";
import { loadAnimLibrary, PERSONAGENS_DIR, retargetClips, semContornoNosOlhos } from "./quaterniusRig";

/**
 * CAMADA JOGO (Brasa). Modelo visual da heroína: corpo Universal Base Characters + roupa
 * Modular Outfits Fantasy (Ranger, recolorida para preto fuligem, bronze e ouro de brasa) num
 * GLB único (heroina.glb, 3 malhas: pele, roupa, olhos; 23 ossos sem dedos). O capuz e as
 * ombreiras são a cor-assinatura CLARA (ouro de brasa; nos outros mantos, cinza de osso, luar,
 * aço): ~30% da silhueta vista do alto, para a Acendedora ler contra as lajes. As animações vêm
 * da biblioteca Universal Animation Library 1 e 2 (anim.glb), retargetadas por nome de osso
 * (quaterniusRig.ts). Tudo CC0; ver public/models/CREDITS.txt e tools/personagens/.
 *
 * A lâmina de weapons.ts fica na mão direita (nó do osso hand_r); na mão esquerda arde a
 * brasa da Acendedora (pequena esfera emissiva; a luz-fagulha da heroína é parentada nela por
 * acendedora.ts via emberNode). Implementa CharacterVisual: o CharacterController (engine)
 * posiciona root e chama animate(dt, speed, grounded). Carregamento assíncrono; root existe
 * de imediato.
 */

const DEFAULT_MODEL_URL = PERSONAGENS_DIR + "heroina.glb";
const TARGET_HEIGHT = 1.8; // metros
const CAPSULE_HALF = 0.9; // metade da cápsula de 1.8 m (pés ficam em root.y - 0.9)
const FACING_OFFSET = 0; // o loader já converte a mão-dupla do glTF: o corpo Quaternius olha para +Z (frente do jogo)
const OUTLINE_WORLD = 0.03; // espessura do contorno em metros de mundo (~2 px na câmera do jogo)
// Âncoras de velocidade (m/s) em que cada clipe de locomoção está "em fase" com o chão.
const ANCHOR = { walk: 1.6, run: 4.2, sprint: 8 } as const;
const BLOCK_HOLD = 0.5; // fração do clipe de bloqueio em que a guarda fica parada

/** Nomes dos clipes na biblioteca (anim.glb) para cada ação do herói. */
const CLIPES = {
  idle: "Idle_Loop", walk: "Walk_Loop", run: "Jog_Fwd_Loop", sprint: "Sprint_Loop",
  light: "Sword_Regular_A", heavy: "Sword_Regular_B", dodge: "Roll", block: "Sword_Block",
  hit: "Hit_Chest", ember: "Spell_Simple_Shoot", death: "Death01",
} as const;
type ClipeKey = keyof typeof CLIPES;

/** Ação one-shot/hold do herói, sobreposta à locomoção. */
export type HeroAction = "idle" | "light" | "heavy" | "dodge" | "block" | "hit" | "ember" | "death";

export class HeroModel implements CharacterVisual {
  readonly root: TransformNode;
  /** Nó da brasa na mão esquerda (existe depois do modelo carregar); a luz-fagulha pode ser parentada nele. */
  emberNode: TransformNode | null = null;
  private readonly scene: Scene;
  private readonly modelUrl: string;

  private clips: Partial<Record<ClipeKey, AnimationGroup>> = {};
  private actionKind: HeroAction = "idle";
  private actionGroup?: AnimationGroup;
  // Pesos suavizados da locomoção (idle/walk/run/sprint somam ~1).
  private w = { idle: 1, walk: 0, run: 0, sprint: 0 };
  private loaded = false;
  private emberT = 0;
  private emberMat?: StandardMaterial;
  private emberHalo?: Mesh;
  // Manto escolhido na criação: o atlas da roupa é trocado por uma variante recolorida
  // (public/models/personagens/manto_<id>.jpg; "brasa" é o atlas embutido no glb). Aplicado ao
  // carregar e a cada começo de jogo.
  private mantleId?: string;
  private mantleTex?: Texture;
  private baseAlbedo = new Map<Material, BaseTexture | null>();

  /**
   * @param opts.modelUrl glb do herói (default: heroina.glb).
   * @param opts.name nome do TransformNode raiz (default: "heroi").
   */
  constructor(scene: Scene, opts?: { modelUrl?: string; name?: string }) {
    this.scene = scene;
    this.modelUrl = opts?.modelUrl ?? DEFAULT_MODEL_URL;
    this.root = new TransformNode(opts?.name ?? "heroi", scene);
    void this.load();
  }

  private async load(): Promise<void> {
    const [result, lib] = await Promise.all([
      ImportMeshAsync(assetUrl(this.modelUrl), this.scene, { pluginExtension: ".glb" }),
      loadAnimLibrary(this.scene),
    ]);
    const top = result.meshes.find((m) => m.name === "__root__") ?? result.meshes[0]!;

    // Encaixe: medir o modelo e ajustá-lo a ~1.8 m, pés no chão, centrado.
    const { min, max } = top.getHierarchyBoundingVectors(true);
    const height = Math.max(0.001, max.y - min.y);
    const scale = TARGET_HEIGHT / height;
    const cx = (min.x + max.x) / 2;
    const cz = (min.z + max.z) / 2;

    const fit = new TransformNode("heroi_fit", this.scene);
    fit.parent = this.root;
    fit.rotation.y = FACING_OFFSET;
    fit.scaling.setAll(scale);
    fit.position.set(-cx * scale, -CAPSULE_HALF - min.y * scale, -cz * scale);
    top.parent = fit;
    for (const g of result.animationGroups) g.stop();

    // Acessórios nos ossos: lâmina de bronze na mão direita, brasa na esquerda.
    const nos = new Map<string, TransformNode>();
    for (const n of top.getChildTransformNodes(false)) nos.set(n.name, n as TransformNode);
    this.attachProps(nos);

    semContornoNosOlhos(this.root);
    // ESTILO (Bloco 1, spec-estilo-visual-render §4.1b): contorno de tinta na heroína.
    top.computeWorldMatrix(true);
    outlineHierarchy(this.root, { worldWidth: OUTLINE_WORLD });
    // LEITURA DO ALTO: luz de aro quente só nos atores (não entra no orçamento de luzes do
    // cenário) e orçamento de luzes do PBR acima do padrão (4), para a luz de aro e a
    // fagulha nunca serem descartadas por uma tocha distante.
    for (const m of this.root.getChildMeshes(false)) {
      const mat = m.material as (Material & { maxSimultaneousLights?: number }) | null;
      if (mat && typeof mat.maxSimultaneousLights === "number") mat.maxSimultaneousLights = 8;
    }
    getActorLight(this.scene).include(this.root);

    this.setupAnimations(retargetClips(lib, top as TransformNode, this.root.name, CLIPES));
    this.loaded = true;
    this.applyMantle(); // aplica a variante de manto se já escolhida quando o modelo terminou
  }

  /** Lâmina (weapons.ts) em hand_r e brasa em hand_l. Offsets ajustados contra o osso do rig Quaternius. */
  private attachProps(nos: Map<string, TransformNode>): void {
    const handR = nos.get("hand_r");
    if (handR) {
      const sword = buildSword(this.scene);
      sword.parent = handR;
      // No osso da mão do rig UE (medido): +X local sobe pelo antebraço, +Z local é a frente da
      // palma e -X aponta para os dedos. A lâmina (+Y do weapons.ts) deita para a frente (+Z).
      sword.position.set(-0.035, 0.01, 0);
      sword.rotation.set(Math.PI / 2, 0, 0);
      sword.scaling.setAll(1);
      for (const m of sword.getChildMeshes(false)) (m as Mesh).metadata = { ...(m.metadata ?? {}), noOutline: true };
    }
    const handL = nos.get("hand_l");
    if (handL) {
      const holder = new TransformNode("brasa_mao", this.scene);
      holder.parent = handL;
      holder.position.set(0.09, 0.0, 0.0);
      const mat = new StandardMaterial("brasa_mao_mat", this.scene);
      mat.disableLighting = true;
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mat.emissiveColor = Color3.FromHexString("#ffa63d");
      const orb = MeshBuilder.CreateSphere("brasa_mao_orb", { diameter: 0.16, segments: 8 }, this.scene);
      orb.material = mat;
      orb.parent = holder;
      orb.isPickable = false;
      orb.metadata = { noOutline: true };
      this.scene.getGlowLayerByName("glow")?.addIncludedOnlyMesh(orb); // a brasa da mão ganha halo
      // Halo da brasa: a mesma poça de luz do engine (createLightPool), pequena, deitada na altura da mão.
      // Da câmera alta é o que denuncia a Acendedora na multidão: um disco quente que anda com ela.
      const halo = createLightPool(this.scene, { radius: 0.6, color: "#ffb04a", alpha: 0.55, y: 1 });
      halo.name = "brasa_mao_halo";
      this.emberHalo = halo;
      this.emberMat = mat;
      this.emberNode = holder;
    }
  }

  /**
   * Define o manto (id da escolha: brasa/cinza/noite/ferro). Troca o atlas de albedo da roupa
   * pela variante recolorida correspondente (mesmo layout/UV), preservando a sombra. Pode ser
   * chamada antes do modelo carregar (fica pendente).
   */
  setMantle(id: string): void {
    this.mantleId = id;
    if (this.loaded) this.applyMantle();
  }

  private applyMantle(): void {
    if (!this.mantleId) return;
    const old = this.mantleTex;
    let tex: Texture | undefined;
    if (this.mantleId !== "brasa") {
      // invertY=false: casa com a convenção do atlas carregado pelo loader glTF.
      tex = new Texture(assetUrl(`${PERSONAGENS_DIR}manto_${this.mantleId}.jpg`), this.scene, false, false);
      tex.name = `manto_${this.mantleId}`;
    }
    for (const m of this.root.getChildMeshes(false)) {
      if (!/roupa/i.test(m.name)) continue;
      const mat = m.material as (Material & { albedoTexture?: BaseTexture | null }) | null;
      if (!mat || !("albedoTexture" in mat)) continue;
      if (!this.baseAlbedo.has(mat)) this.baseAlbedo.set(mat, mat.albedoTexture ?? null);
      mat.albedoTexture = tex ?? this.baseAlbedo.get(mat) ?? null;
    }
    this.mantleTex = tex;
    if (old && old !== tex) old.dispose(); // libera a variante anterior ao trocar
  }

  private setupAnimations(clips: Partial<Record<ClipeKey, AnimationGroup>>): void {
    this.clips = clips;
    for (const k of ["idle", "walk", "run", "sprint"] as const) {
      const g = clips[k];
      if (!g) continue;
      g.start(true);
      g.weight = k === "idle" ? 1 : 0;
    }
  }

  /**
   * Define a ação dominante (sobre a locomoção). Chamada a cada frame pelo ator: ao
   * iniciar uma ação nova, zera a locomoção e dispara o clipe (loop só no bloqueio);
   * ao voltar a "idle", a locomoção retoma. A janela de acerto continua no combate.
   */
  setAction(kind: HeroAction): void {
    if (!this.loaded || kind === this.actionKind) return;
    this.actionKind = kind;
    this.actionGroup?.stop();
    this.actionGroup = undefined;
    if (kind === "idle") return;
    const g = this.clips[kind];
    if (!g) {
      this.actionKind = "idle";
      return;
    }
    for (const k of ["idle", "walk", "run", "sprint"] as const) { const lg = this.clips[k]; if (lg) lg.weight = 0; }
    // Velocidade de cada clipe ajustada à temporização do combate (tuning.ts).
    const speed = kind === "light" ? 1.0 : kind === "heavy" ? 0.7 : kind === "dodge" ? 2.5 : kind === "ember" ? 0.7 : kind === "block" ? 1.6 : 1.0;
    g.reset();
    if (kind === "block") {
      // Sobe a guarda e SEGURA a pose (não repete o clipe inteiro).
      g.start(false, speed, g.from, g.from + (g.to - g.from) * BLOCK_HOLD);
    } else {
      g.start(false, speed, g.from, g.to);
    }
    g.weight = 1;
    this.actionGroup = g;
  }

  // --- CharacterVisual ---

  animate(dt: number, speed: number, grounded: boolean): void {
    if (!this.loaded || dt <= 0) return;
    this.flickerEmber(dt);
    if (this.actionKind !== "idle") {
      // A ação domina; mantém a locomoção zerada para não vazar pose.
      for (const k of ["idle", "walk", "run", "sprint"] as const) { const lg = this.clips[k]; if (lg) lg.weight = 0; }
      return;
    }
    this.blendLocomotion(dt, grounded ? speed : 0);
  }

  /** A brasa da mão pulsa de leve (e a luz-fagulha, que é filha dela, acompanha a posição). */
  private flickerEmber(dt: number): void {
    this.emberT += dt;
    const f = 0.9 + 0.1 * Math.sin(this.emberT * 9) + 0.05 * Math.sin(this.emberT * 23.7);
    if (this.emberMat) this.emberMat.emissiveColor.set(1 * f, 0.62 * f, 0.24 * f);
    if (this.emberHalo && this.emberNode) {
      const p = this.emberNode.getAbsolutePosition();
      this.emberHalo.position.set(p.x, p.y, p.z);
      (this.emberHalo.material as StdMat).alpha = 0.5 * f;
    }
  }

  /** Mescla idle/andar/correr/sprint por velocidade (pesos somando ~1) e ajusta o ritmo de cada passada. */
  private blendLocomotion(dt: number, speed: number): void {
    const t = { idle: 0, walk: 0, run: 0, sprint: 0 };
    if (speed < 0.2) {
      t.idle = 1;
    } else if (speed <= ANCHOR.walk) {
      const k = speed / ANCHOR.walk;
      t.idle = 1 - k; t.walk = k;
    } else if (speed <= ANCHOR.run) {
      const k = (speed - ANCHOR.walk) / (ANCHOR.run - ANCHOR.walk);
      t.walk = 1 - k; t.run = k;
    } else {
      const k = clamp((speed - ANCHOR.run) / (ANCHOR.sprint - ANCHOR.run), 0, 1);
      t.run = 1 - k; t.sprint = k;
    }
    const k = 1 - Math.exp(-12 * dt);
    for (const n of ["idle", "walk", "run", "sprint"] as const) {
      this.w[n] += (t[n] - this.w[n]) * k;
      const g = this.clips[n];
      if (!g) continue;
      g.weight = this.w[n];
      if (n !== "idle") g.speedRatio = clamp(speed / ANCHOR[n], 0.7, 1.4);
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
