import { Color3, Engine, ImportMeshAsync, MeshBuilder, StandardMaterial, Texture, TrailMesh, TransformNode } from "@babylonjs/core";
import type { AnimationGroup, BaseTexture, Material, Mesh, Scene, StandardMaterial as StdMat } from "@babylonjs/core";
import "@babylonjs/loaders/glTF"; // registra o loader glTF
import { assetUrl, createLightPool, outlineHierarchy, type CharacterVisual } from "@engine";
import { buildSword } from "./weapons";
import { loadAnimLibrary, PERSONAGENS_DIR, retargetClips, semContornoNosOlhos } from "./quaterniusRig";
import type { ClipSync } from "../combat/heroCombat";

/**
 * CAMADA JOGO (Brasa). Modelo visual da heroína: corpo Universal Base Characters + roupa
 * Modular Outfits Fantasy (Ranger, recolorida para preto fuligem, bronze e ouro de brasa) num
 * GLB único (heroina.glb, 3 malhas: pele, roupa, olhos; 23 ossos sem dedos). As animações vêm
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
const BLOCK_HOLD = 0.33; // fração do clipe de bloqueio em que a guarda fica parada
const BLOCK_RATE = 2.2; // velocidade da subida da guarda (a guarda fecha em ~110 ms)

/**
 * SINCRONIA CLIPE x MECÂNICA (feel, 2026-11). Quadros do clipe (60 fps) no começo e no fim de cada
 * fase da mecânica (tuning.ts). O clipe é posicionado por estas âncoras todo quadro, então: (1) o
 * instante de contato da lâmina cai no começo da janela ativa; (2) o clipe congela junto com o hit
 * stop; (3) o rabo parado do clipe é cortado e a pose volta ao idle por mistura (`fade` = fração da
 * recuperação em que a mistura de saída começa). Medido nos clipes:
 *  - Sword_Regular_A (leve): armar 0-10 (braço abre à direita), golpe 10-17 (cruza a frente em ~14,8), resto parado.
 *  - Sword_Regular_B (pesado): armar 0-12, golpe 12-17 (cruza a frente em ~15), resto parado.
 */
type Seg = readonly [number, number];
interface Plano { startup?: Seg; active?: Seg; recovery?: Seg; dodge?: Seg; fade: number; blendIn: number }
const PLANO: Record<ClipSync["kind"], Plano> = {
  light: { startup: [0, 13.5], active: [13.5, 17.5], recovery: [17.5, 24], fade: 0.35, blendIn: 0.04 },
  finisher: { startup: [0, 13.5], active: [13.5, 17.5], recovery: [17.5, 24.5], fade: 0.45, blendIn: 0.04 },
  heavy: { startup: [0, 13.5], active: [13.5, 17.5], recovery: [17.5, 28], fade: 0.45, blendIn: 0.06 },
  ember: { startup: [0, 10], active: [10, 16], recovery: [16, 28], fade: 0.5, blendIn: 0.06 },
  dodge: { dodge: [0, 72], fade: 0.78, blendIn: 0.03 },
};
const CLIP_OF: Record<ClipSync["kind"], ClipeKey> = { light: "light", finisher: "light", heavy: "heavy", ember: "ember", dodge: "dodge" };
const FADE_OUT_SEC = 0.1; // mistura de volta à locomoção quando a ação acaba sem fade planejado
const FROZEN_SPEED = 1e-4; // clipe "parado" (hit stop): speedRatio 0 faria o Babylon voltar ao quadro 0

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
  private actionSeq = -1;
  private actionT = 0; // segundos desde o começo da ação corrente (ações sem sincronia de mecânica)
  private sync: ClipSync | null = null;
  private wIn = 1; // rampa de entrada da ação corrente (0..1)
  private wFade = 1; // fade de saída planejado da ação corrente (1..0)
  private trail?: TrailMesh; // rastro da lâmina (só ligado no giro do golpe)
  private trailOn = false;
  private prevGroup?: AnimationGroup; // ação anterior em mistura de saída
  private prevW = 0;
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
      // Rastro leve da lâmina: fita quente atrás da ponta, ligada só no giro do golpe (setTrail).
      const tip = new TransformNode("sword_tip", this.scene);
      tip.parent = sword;
      tip.position.set(0, 0.5, 0);
      const trail = new TrailMesh("sword_trail", tip, this.scene, 0.1, 9, false);
      const tm = new StandardMaterial("sword_trail_mat", this.scene);
      tm.disableLighting = true;
      tm.diffuseColor = Color3.Black();
      tm.specularColor = Color3.Black();
      tm.emissiveColor = Color3.FromHexString("#ffb86a");
      tm.alpha = 0.5;
      tm.backFaceCulling = false;
      tm.alphaMode = Engine.ALPHA_ADD;
      trail.material = tm;
      trail.isPickable = false;
      trail.metadata = { noOutline: true };
      trail.setEnabled(false);
      this.trail = trail;
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
   * Define a ação dominante (sobre a locomoção). Chamada a cada frame pelo ator. Ação nova (ou
   * `sync.seq` novo, ex.: 2o elo de uma cadeia leve) reinicia o clipe e mistura a entrada; ao
   * voltar a "idle", a ação sai por mistura. Com `sync`, o clipe é posicionado pela mecânica
   * (ver PLANO) em vez de rodar num relógio próprio; `timeScale` (0 = hit stop, <1 = cauda do hit stop) desacelera o clipe junto.
   */
  setAction(kind: HeroAction, sync: ClipSync | null = null, timeScale = 1): void {
    if (!this.loaded) return;
    const seq = sync ? sync.seq : -1;
    if (kind !== this.actionKind || seq !== this.actionSeq) this.beginAction(kind, sync);
    this.sync = sync;
    this.setTrail(!!sync && (sync.kind === "light" || sync.kind === "finisher" || sync.kind === "heavy") &&
      (sync.phase === "active" || (sync.phase === "startup" && sync.progress > 0.6) || (sync.phase === "recovery" && sync.progress < 0.3)));
    const g = this.actionGroup;
    if (!g) return;
    if (sync) {
      const plano = PLANO[sync.kind];
      const seg = plano[sync.phase];
      if (!seg) return;
      const target = seg[0] + (seg[1] - seg[0]) * clamp(sync.progress, 0, 1);
      this.driveClip(g, target, (timeScale * (seg[1] - seg[0])) / Math.max(sync.sec, 1e-3));
      // Mistura de saída planejada: no fim da recuperação (ou da esquiva) o clipe cede à locomoção.
      const p = sync.phase === "recovery" || sync.phase === "dodge" ? sync.progress : 0;
      this.wFade = p > plano.fade ? Math.max(0, 1 - (p - plano.fade) / (1 - plano.fade)) : 1;
    } else if (kind === "block") {
      this.driveClip(g, Math.min(g.from + (g.to - g.from) * BLOCK_HOLD, g.from + this.actionT * 60 * BLOCK_RATE), timeScale * 60 * BLOCK_RATE);
    } else if (kind === "hit") {
      this.driveClip(g, Math.min(g.to - 0.5, g.from + this.actionT * 60), timeScale * 60);
    }
  }

  private setTrail(on: boolean): void {
    const t = this.trail;
    if (!t || on === this.trailOn) return;
    this.trailOn = on;
    if (on) {
      t.reset();
      t.start();
      t.setEnabled(true);
    } else {
      t.stop();
      t.setEnabled(false);
    }
  }

  private beginAction(kind: HeroAction, sync: ClipSync | null): void {
    const old = this.actionGroup;
    const oldW = this.loaded ? Math.min(this.wIn, this.wFade) : 0;
    this.actionKind = kind;
    this.actionSeq = sync ? sync.seq : -1;
    this.actionT = 0;
    this.wFade = 1;
    const key: ClipeKey | undefined = kind === "idle" ? undefined : sync ? CLIP_OF[sync.kind] : (kind as ClipeKey);
    const g = key ? this.clips[key] : undefined;
    if (!g && kind !== "idle") this.actionKind = "idle";
    // Grupo anterior: se for outro grupo, vira "saindo"; se for o mesmo (cadeia leve-leve), só reinicia.
    if (this.prevGroup && this.prevGroup !== g && this.prevGroup !== old) this.prevGroup.stop();
    if (old && old !== g) {
      this.prevGroup?.stop();
      this.prevGroup = old;
      this.prevW = oldW;
      old.speedRatio = FROZEN_SPEED;
    } else if (!old || old === g) {
      if (this.prevGroup === g) { this.prevGroup = undefined; this.prevW = 0; }
    }
    this.actionGroup = g;
    if (!g) return;
    // A rampa de entrada parte do peso atual (sem salto) e sobe em plano.blendIn.
    this.wIn = old === g ? oldW : 0;
    if (kind === "death") {
      for (const k of ["idle", "walk", "run", "sprint"] as const) { const lg = this.clips[k]; if (lg) lg.weight = 0; }
      this.wIn = 1;
      g.reset();
      g.start(false, 1, g.from, g.to);
      g.weight = 1;
      return;
    }
    g.reset();
    // loop=true so como seguro: o clipe é dirigido por quadro e nunca pode "acabar" (um clipe
    // terminado sai da mistura e o Babylon preencheria o peso que falta com a pose de repouso).
    g.start(true, FROZEN_SPEED, g.from, g.to);
    g.goToFrame(sync ? (PLANO[sync.kind][sync.phase]?.[0] ?? g.from) : g.from);
    g.weight = 1;
  }

  /** Leva o clipe ao quadro `target` na taxa `rate` (quadros/s); desvio grande vira salto. */
  private driveClip(g: AnimationGroup, target: number, rate: number): void {
    const an = g.animatables[0];
    const cur = an ? an.masterFrame : target;
    if (Math.abs(cur - target) > 1.5) g.goToFrame(target);
    const sr = rate > 0 ? rate / 60 : FROZEN_SPEED;
    if (Math.abs(g.speedRatio - sr) > 1e-3) g.speedRatio = sr;
  }

  // --- CharacterVisual ---

  animate(dt: number, speed: number, grounded: boolean): void {
    if (!this.loaded || dt <= 0) return;
    this.flickerEmber(dt);
    this.actionT += dt;
    if (this.actionKind === "death") {
      for (const k of ["idle", "walk", "run", "sprint"] as const) { const lg = this.clips[k]; if (lg) lg.weight = 0; }
      return;
    }
    // Pesos: ação corrente (entrada x fade planejado) + ação anterior saindo + locomoção = 1.
    const g = this.actionGroup;
    const plan = this.sync ? PLANO[this.sync.kind] : undefined;
    const inSec = plan ? plan.blendIn : this.actionKind === "block" ? 0.05 : 0.03;
    this.wIn = Math.min(1, this.wIn + dt / inSec);
    const wa = g ? Math.min(this.wIn, this.wFade) : 0;
    let wo = 0;
    if (this.prevGroup) {
      this.prevW = Math.max(0, this.prevW - dt / FADE_OUT_SEC);
      wo = Math.min(this.prevW, 1 - wa);
      if (this.prevW <= 0) { this.prevGroup.stop(); this.prevGroup = undefined; wo = 0; }
      else this.prevGroup.weight = wo;
    }
    if (g) g.weight = wa;
    this.blendLocomotion(dt, grounded ? speed : 0, Math.max(0, 1 - wa - wo));
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
  private blendLocomotion(dt: number, speed: number, scale = 1): void {
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
      g.weight = this.w[n] * scale;
      if (n !== "idle") g.speedRatio = clamp(speed / ANCHOR[n], 0.7, 1.4);
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
