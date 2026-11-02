import { Color3, Engine, ImportMeshAsync, MeshBuilder, StandardMaterial, Texture, TrailMesh, TransformNode } from "@babylonjs/core";
import type { AnimationGroup, BaseTexture, Material, Mesh, Scene, StandardMaterial as StdMat } from "@babylonjs/core";
import "@babylonjs/loaders/glTF"; // registra o loader glTF
import { assetUrl, createLightPool, getActorLight, outlineHierarchy, type CharacterVisual } from "@engine";
import { buildSword } from "./weapons";
import { loadAnimLibrary, PERSONAGENS_DIR, retargetClips, semContornoNosOlhos } from "./quaterniusRig";
import type { ClipSync, DrinkInfo } from "../combat/heroCombat";
import { DrinkPose } from "./drinkPose";
import { landThud } from "../combat/combatSound";

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
  jumpStart: "Jump_Start", jumpLoop: "Jump_Loop", jumpLand: "Jump_Land",
} as const;
type ClipeKey = keyof typeof CLIPES;
type LocoKey = "idle" | "walk" | "run" | "sprint";
type BaseKey = LocoKey | "jumpStart" | "jumpLoop" | "jumpLand";
const LOCO_KEYS: readonly LocoKey[] = ["idle", "walk", "run", "sprint"];
const BASE_KEYS: readonly BaseKey[] = ["idle", "walk", "run", "sprint", "jumpStart", "jumpLoop", "jumpLand"];

/**
 * SALTO (2026-11). A pose do ar é guiada pela FÍSICA (velocidade vertical e toque no chão), não por
 * relógio: o Jump_Start (1,33 s) não cabe nos 0,42 s de subida (g=18, h=1,6). Quadros a 60 fps.
 *  - Jump_Start: quadro 3 (a perna já cruzou o agachamento) até o 64 no ápice; o agachamento do começo do clipe
 *    (quadros 0-10) vira os ~50 ms em que o corpo ainda está no chão, sem atrasar o impulso da física.
 *  - Jump_Loop: pernas esticadas. Entra quando a subida acaba e no começo de uma queda sem salto.
 *  - Jump_Land: quadro 0 (pernas à frente do toque) é segurado no fim da queda; no toque o clipe cai até o quadro
 *    `landDip` (agachamento) em ~70 ms e solta até `landTo`. Nunca toca o resto (quadros 38-74 são só levantar).
 * Só entram no máximo DUAS animações com peso na mistura (ver o comentário de `locoDom`).
 */
const SALTO = {
  jumpVy: 2.5, // m/s: subida mínima no primeiro quadro no ar para ser salto (e não queda de degrau/rampa)
  fallGrace: 0.14, // s no ar sem salto antes da pose de queda (degraus e rampas piscam no ar por um quadro)
  minDrop: 0.3, // m: queda menor que isso não faz som nem agacha forte
  enterSec: 0.07, // entrada da pose de ar a partir da locomoção
  startFrom: 3, startTo: 64, // Jump_Start
  landDip: 14, landTo: 38, landDipSec: 0.07, // Jump_Land
  landUp: 0.05, landHold: 0.04, // ataque e sustentação do peso da aterrissagem (s)
  dustDrop: 2.2, // m: de quanta queda em diante há poeira
  stunDrop: 3.0, // m: de quanta queda em diante há perda de controle (0,10 a 0,15 s)
  leanRun: 0.14, leanFall: 0.08, leanRise: 0.05, leanLand: 0.12, // rad de inclinação do tronco
  minW: 0.004,
} as const;

/** Aterrissagem: dispara no quadro em que o chão é tocado. `y` é a altura dos pés; `height` é a queda (m). */
export interface LandEvent {
  height: number; intensity: number; speed: number;
  x: number; y: number; z: number;
  /** Quantas fagulhas de poeira (0 = nenhuma). */
  dust: number;
  /** Segundos de perda de controle da locomoção (0 = nenhuma). Só a locomoção: golpe, esquiva e bloqueio seguem livres. */
  stun: number;
}

/** Ação one-shot/hold do herói, sobreposta à locomoção. */
export type HeroAction = "idle" | "light" | "heavy" | "dodge" | "block" | "hit" | "ember" | "death" | "drink";

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
  private drinkPose?: DrinkPose; // o gole: pose do braço livre por IK, por cima da locomoção (ver drinkPose.ts)
  // O Babylon erra a mistura de 3+ animações no mesmo osso (a pose vira a de repouso): durante
  // qualquer mistura com ação só entram no máximo DUAS animações ativas (ação + ação anterior, ou
  // ação + UM clipe de locomoção `locoDom`, escolhido pela velocidade no começo da ação).
  // Pode ser um clipe de salto quando a ação começa no ar (a pose do ar segue sendo guiada pela física).
  private locoDom: BaseKey = "idle";
  private lastSpeed = 0;
  private prevGroup?: AnimationGroup; // ação anterior em mistura de saída
  private prevW = 0;
  // Pesos suavizados da locomoção (idle/walk/run/sprint somam ~1).
  private w = { idle: 1, walk: 0, run: 0, sprint: 0 };
  // Salto: estado do ar, calculado por quadro a partir da posição (ver trackAir).
  private lean?: TransformNode; // pivô do tronco na cintura (origem do root): inclinação do corpo no ar
  private leanX = 0;
  private airMode: "ground" | "jump" | "fall" = "ground";
  private suppressAir = true; // teleporte e spawn caem uns centímetros: sem pose de queda, som nem poeira
  private wasGrounded = true;
  private prevY = Number.NaN;
  private vy = 0;
  private airT = 0;
  private maxY = 0;
  private v0 = 7;
  private airIn = 1; // 0..1: entrada da pose de ar (mistura com `entryDom`)
  private entryDom: LocoKey = "idle";
  private landT = -1; // s desde o toque (>= 0 enquanto o peso do Jump_Land vive)
  private landDur = 0;
  private landW0 = 0;
  private landPeak = 0;
  private landW = 0;
  private lastA3 = 0; // peso do Land segurado no último quadro de ar (a aterrissagem parte daí, sem salto de pose)
  private exitDom: LocoKey = "idle";
  private readonly landListeners: ((e: LandEvent) => void)[] = [];
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

    // Pivô de inclinação na origem do root (centro da cápsula, na altura da cintura): o corpo se inclina
    // ao redor dos quadris, não dos pés. Sem malha, sem draw call.
    const lean = new TransformNode("heroi_lean", this.scene);
    lean.parent = this.root;
    this.lean = lean;
    const fit = new TransformNode("heroi_fit", this.scene);
    fit.parent = lean;
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
    outlineHierarchy(this.root, { worldWidth: OUTLINE_WORLD, depthGuard: true }); // guarda de profundidade: a poca de luz dela nao tinge o corpo (ver outline.ts)
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
    const swordMats: Material[] = [];
    if (handR) {
      const sword = buildSword(this.scene);
      for (const m of sword.getChildMeshes(false)) if (m.material) swordMats.push(m.material);
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
    this.drinkPose = new DrinkPose(this.scene, this.root, nos, { emberOrb: this.emberNode?.getChildMeshes(true)[0] ?? null, swordMats });
  }

  /**
   * O gole do quadro (de HeroCombat.drinkInfo; null fora dele): o braço livre leva o frasco à boca por cima
   * da locomoção (as pernas seguem andando). Chamada todo quadro pelo ator; não gasta animação da mistura.
   */
  setDrink(info: DrinkInfo | null): void {
    this.drinkPose?.setState(info);
  }

  /** Elixir de Fúria ativo: a lâmina esquenta. */
  setFury(on: boolean): void {
    this.drinkPose?.setFury(on);
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
    // Só o idle parte tocando: os demais clipes da camada-base começam (e param) por peso, em setBase.
    this.setBase("idle", 1);
  }

  /** Aviso de aterrissagem (som e poeira já saem daqui; o diretor de combate liga a poeira, a heroína liga a perda de controle). */
  onLand(fn: (e: LandEvent) => void): void {
    this.landListeners.push(fn);
  }

  /** Teleporte/spawn: a queda dos primeiros centímetros não é aterrissagem. */
  resetAir(): void {
    this.suppressAir = true;
    this.airMode = "ground";
    this.landT = -1;
    this.prevY = Number.NaN;
    this.wasGrounded = false;
  }

  /**
   * Define a ação dominante (sobre a locomoção). Chamada a cada frame pelo ator. Ação nova (ou
   * `sync.seq` novo, ex.: 2o elo de uma cadeia leve) reinicia o clipe e mistura a entrada; ao
   * voltar a "idle", a ação sai por mistura. Com `sync`, o clipe é posicionado pela mecânica
   * (ver PLANO) em vez de rodar num relógio próprio; `timeScale` (0 = hit stop, <1 = cauda do hit stop) desacelera o clipe junto.
   */
  setAction(kind: HeroAction, sync: ClipSync | null = null, timeScale = 1): void {
    if (!this.loaded) return;
    if (kind === "drink") kind = "idle"; // o gole não é clipe: a locomoção segue e DrinkPose sobrescreve o braço
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
    if (!old && !this.prevGroup) {
      // Vindo da locomoção (ou do ar): congela a mistura num único clipe (o da velocidade atual, ou a pose de ar).
      // Ação logo no toque: a base fica no agachamento da aterrissagem (sem estalo de pose) até a mistura da ação cobri-la.
      this.locoDom = this.landT >= 0 && this.airMode === "ground" ? "jumpLand" : this.domNow(this.lastSpeed);
    }
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
      this.parkBase();
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
      this.parkBase();
      return;
    }
    this.lastSpeed = speed;
    this.trackAir(dt, speed, grounded);
    // Pesos: ação corrente (entrada x fade planejado) + ação anterior saindo OU um clipe de locomoção.
    const g = this.actionGroup;
    const plan = this.sync ? PLANO[this.sync.kind] : undefined;
    const inSec = plan ? plan.blendIn : this.actionKind === "block" ? 0.05 : 0.03;
    this.wIn = Math.min(1, this.wIn + dt / inSec);
    const wa = g ? Math.min(this.wIn, this.wFade) : 0;
    let wo = 0;
    if (this.prevGroup) {
      if (g) {
        // Ação -> ação: a anterior cede exatamente o que a nova ainda não ocupou.
        wo = 1 - wa;
        if (this.wIn >= 1) { this.prevGroup.stop(); this.prevGroup = undefined; wo = 0; }
      } else {
        this.prevW = Math.max(0, this.prevW - dt / FADE_OUT_SEC);
        wo = this.prevW;
        if (wo <= 0) { this.prevGroup.stop(); this.prevGroup = undefined; }
      }
      if (this.prevGroup) this.prevGroup.weight = wo;
    }
    if (g) g.weight = wa;
    const scale = Math.max(0, 1 - wa - wo);
    if (g || this.prevGroup) {
      // Sob uma ação a camada-base é UM clipe só (locoDom): trocado por física (ar/chão), nunca misturado.
      this.rebaseDom(speed);
      if (this.airMode !== "ground") this.airIn = 1; // a base já é a pose de ar: quando a ação acabar não reentra por mistura
      for (const n of BASE_KEYS) this.setBase(n, n === this.locoDom ? scale : 0);
      for (const n of LOCO_KEYS) this.w[n] = n === this.locoDom ? 1 : 0;
      this.driveAir();
      this.updateLean(dt, speed, true);
      return;
    }
    this.blendBase(dt, speed);
    this.driveAir();
    this.updateLean(dt, speed, false);
  }

  // --- SALTO: estado do ar, pesos da camada-base e inclinação ---

  private speedDom(sp: number): LocoKey {
    return sp < 0.2 ? "idle" : sp <= (ANCHOR.walk + ANCHOR.run) / 2 ? "walk" : sp <= (ANCHOR.run + ANCHOR.sprint) / 2 ? "run" : "sprint";
  }

  private get hasAirClips(): boolean {
    return !!(this.clips.jumpLoop && this.clips.jumpStart && this.clips.jumpLand);
  }

  /** Clipe-base dominante agora: a pose do ar (se está no ar) ou a locomoção da velocidade atual. */
  private domNow(speed: number): BaseKey {
    if (this.airMode === "ground") return this.speedDom(speed);
    return this.airMode === "jump" && this.vy > 0.25 ? "jumpStart" : "jumpLoop";
  }

  /** Sob uma ação, troca o clipe-base só quando a física mudou de regime (decolou ou pousou); no chão o dominante fica congelado. */
  private rebaseDom(speed: number): void {
    if (this.locoDom === "jumpLand" && this.landT >= 0 && this.airMode === "ground") return;
    const inAir = this.locoDom === "jumpStart" || this.locoDom === "jumpLoop" || this.locoDom === "jumpLand";
    if (this.airMode !== "ground" || inAir) this.locoDom = this.domNow(speed);
  }

  /** Para um clipe da camada-base com peso 0 de vez: um grupo parado nem entra na mistura (o Babylon erra a 0/0 de 3+). */
  private setBase(key: BaseKey, w: number): void {
    const g = this.clips[key];
    if (!g) return;
    if (w < SALTO.minW) {
      if (g.isStarted) g.stop();
      return;
    }
    if (!g.isStarted) {
      const driven = key === "jumpStart" || key === "jumpLand";
      g.start(true, driven ? FROZEN_SPEED : 1, g.from, g.to);
      if (driven) g.goToFrame(g.from + (key === "jumpStart" ? SALTO.startFrom : 0));
    }
    g.weight = Math.min(1, w);
  }

  private parkBase(): void {
    for (const k of BASE_KEYS) this.setBase(k, 0);
  }

  /**
   * Física do ar a cada quadro (pela posição do root, que o controlador já moveu): velocidade vertical, decolagem
   * (salto ou queda), pico e TOQUE NO CHÃO. A aterrissagem dispara no quadro em que `grounded` volta a ser true,
   * com intensidade pela altura da queda (pico menos altura do toque).
   */
  private trackAir(dt: number, speed: number, grounded: boolean): void {
    const y = this.root.position.y;
    const jump = Math.abs(y - this.prevY);
    if (Number.isNaN(this.prevY) || jump > 4) {
      // primeiro quadro ou teleporte: recomeça do zero
      this.vy = 0;
      this.prevY = y;
      this.wasGrounded = grounded;
      this.airMode = "ground";
      this.landT = -1;
      this.maxY = y;
      return;
    }
    const prevVy = this.vy;
    this.vy = (y - this.prevY) / dt;
    this.prevY = y;
    // O controlador só marca "no chão" no quadro SEGUINTE ao pouso (o apoio é medido antes de integrar): o toque
    // de verdade é a queda rápida que para de repente. Dispara aqui, no quadro em que o corpo para.
    if (!grounded && this.airMode !== "ground" && prevVy < -2 && this.vy > prevVy * 0.25) grounded = true;
    if (grounded) {
      this.suppressAir = false;
      if (!this.wasGrounded && this.airMode !== "ground") this.touchDown(speed, y);
      this.airMode = "ground";
      this.airT = 0;
    } else if (!this.suppressAir) {
      if (this.wasGrounded) {
        // decolagem: com subida firme é salto (Jump_Start); sem ela, só vira queda depois da carência
        this.airT = 0;
        this.maxY = y;
        this.v0 = Math.max(4, this.vy);
        if (this.vy > SALTO.jumpVy && this.vy < 14) this.enterAir("jump");
      } else {
        this.airT += dt;
        if (y > this.maxY) this.maxY = y;
        if (this.airMode === "jump" && this.airT < 0.1) this.v0 = Math.max(this.v0, this.vy);
        if (this.airMode === "ground" && this.airT > SALTO.fallGrace) this.enterAir("fall");
      }
    }
    this.wasGrounded = grounded;
    if (this.landT >= 0) {
      this.landT += dt;
      if (this.landT >= this.landDur) { this.landT = -1; this.landW = 0; }
    }
  }

  private enterAir(mode: "jump" | "fall"): void {
    // a locomoção colapsa no clipe dominante (um só) antes de cruzar para a pose de ar
    let best: LocoKey = "idle";
    for (const n of LOCO_KEYS) if (this.w[n] > this.w[best]) best = n;
    this.entryDom = best;
    for (const n of LOCO_KEYS) this.w[n] = n === best ? 1 : 0;
    this.airMode = mode;
    this.lastA3 = 0;
    this.airIn = 0;
    this.landT = -1;
  }

  private touchDown(speed: number, y: number): void {
    const h = Math.max(0, this.maxY - y);
    const heavy = h >= SALTO.minDrop;
    // intensidade pela queda: curta quase nada, 1,6 m (salto) média, 3,5 m ou mais cheia
    const i = heavy ? 0.15 + 0.85 * Math.pow(clamp((h - SALTO.minDrop) / 3.2, 0, 1), 0.8) : 0.15;
    const run = clamp(speed / 6, 0, 1); // correndo, a absorção aparece menos (o impulso continua)
    this.landW0 = this.hasAirClips ? this.lastA3 : 0;
    this.landPeak = Math.max(i * (1 - 0.4 * run), this.landW0 * 0.9);
    const release = (0.14 + 0.2 * i) * (1 - 0.35 * run);
    this.landDur = SALTO.landUp + SALTO.landHold + release;
    this.landT = this.hasAirClips && !this.actionGroup && !this.prevGroup ? 0 : -1; // sob uma ação não agacha (som e poeira saem igual)
    this.landW = this.landW0;
    this.exitDom = this.speedDom(speed);
    if (heavy) {
      landThud(i);
      const stun = h >= SALTO.stunDrop ? 0.1 + 0.05 * clamp((h - SALTO.stunDrop) / 3, 0, 1) : 0;
      const ev: LandEvent = {
        height: h, intensity: i, speed,
        x: this.root.position.x, y: y - CAPSULE_HALF, z: this.root.position.z,
        dust: h >= SALTO.dustDrop ? Math.round(6 + 10 * i) : 0, stun,
      };
      for (const fn of this.landListeners) fn(ev);
    }
  }

  /** Pesos da pose de ar pela velocidade vertical: subida (Start), queda (Loop) e, no fim da queda, o Land segurado no quadro 0. */
  private airMix(): { a1: number; a2: number; a3: number } {
    const vy = this.vy;
    const b = this.airMode === "fall" ? 1 : smooth(clamp((1.5 - vy) / 2.5, 0, 1));
    const a3 = 0.8 * smooth(clamp((-vy - 3.5) / 4, 0, 1));
    return { a1: (1 - b) * (1 - a3), a2: b * (1 - a3), a3 };
  }

  /** Peso do Jump_Land depois do toque: ataque curto, sustenta e solta. */
  private landEnvelope(t: number): number {
    const up = SALTO.landUp, hold = SALTO.landHold;
    if (t < up) return this.landW0 + (this.landPeak - this.landW0) * smooth(t / up);
    if (t < up + hold) return this.landPeak;
    return this.landPeak * (1 - smooth((t - up - hold) / Math.max(1e-3, this.landDur - up - hold)));
  }

  /** Camada-base quando NÃO há ação: aterrissagem, ar ou locomoção no chão. Sempre no máximo dois clipes com peso. */
  private blendBase(dt: number, speed: number): void {
    if (!this.hasAirClips) {
      this.blendLocomotion(dt, this.airMode === "ground" ? speed : 0);
      return;
    }
    if (this.landT >= 0) {
      this.landW = this.landEnvelope(this.landT);
      for (const n of LOCO_KEYS) { this.setBase(n, n === this.exitDom ? 1 - this.landW : 0); this.w[n] = n === this.exitDom ? 1 : 0; }
      this.setBase("jumpStart", 0);
      this.setBase("jumpLoop", 0);
      this.setBase("jumpLand", this.landW);
      this.stepRatio(this.exitDom, speed);
      return;
    }
    if (this.airMode !== "ground") {
      this.airIn = Math.min(1, this.airIn + dt / SALTO.enterSec);
      const k = this.airIn;
      const m = this.airMix();
      this.lastA3 = m.a3;
      for (const n of LOCO_KEYS) this.setBase(n, n === this.entryDom ? 1 - k : 0);
      this.setBase("jumpStart", m.a1 * k);
      this.setBase("jumpLoop", m.a2 * k);
      this.setBase("jumpLand", m.a3 * k);
      return;
    }
    for (const k of ["jumpStart", "jumpLoop", "jumpLand"] as const) this.setBase(k, 0);
    this.blendLocomotion(dt, speed);
  }

  private stepRatio(n: LocoKey, speed: number): void {
    const g = this.clips[n];
    if (g && n !== "idle") g.speedRatio = clamp(speed / ANCHOR[n], 0.7, 1.4);
  }

  /** Quadros dos clipes guiados pela física: Start pela subida restante, Land pelo tempo desde o toque. */
  private driveAir(): void {
    const st = this.clips.jumpStart;
    if (st && st.isStarted) {
      const u = clamp(1 - this.vy / this.v0, 0, 1);
      st.goToFrame(st.from + SALTO.startFrom + (SALTO.startTo - SALTO.startFrom) * (1 - Math.pow(1 - u, 1.6)));
    }
    const ld = this.clips.jumpLand;
    if (ld && ld.isStarted) {
      const t = this.landT;
      const f = t < 0 ? 0 : t < SALTO.landDipSec
        ? SALTO.landDip * smooth(t / SALTO.landDipSec)
        : SALTO.landDip + (SALTO.landTo - SALTO.landDip) * clamp((t - SALTO.landDipSec) / Math.max(1e-3, this.landDur - SALTO.landDipSec), 0, 1);
      ld.goToFrame(ld.from + f);
    }
  }

  /** Inclinação do tronco: para frente com a velocidade horizontal no ar, esticando na queda; um mergulho curto ao absorver. */
  private updateLean(dt: number, speed: number, acting: boolean): void {
    let target = 0;
    if (this.airMode !== "ground") {
      const vy = this.vy;
      target = SALTO.leanRun * clamp(speed / 6, 0, 1) + (vy < 0 ? SALTO.leanFall * clamp(-vy / 9, 0, 1) : -SALTO.leanRise * clamp(vy / 8, 0, 1));
    } else if (this.landT >= 0) {
      target = SALTO.leanLand * this.landW;
    }
    if (acting) target *= 0.5; // golpe/esquiva no ar: a inclinação não estraga a mira
    this.leanX += (target - this.leanX) * (1 - Math.exp(-10 * dt));
    if (this.lean) this.lean.rotation.x = this.leanX;
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

  /** Mescla idle/andar/correr/sprint por velocidade (pesos somando 1) e ajusta o ritmo de cada passada. */
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
    let sum = 0;
    for (const n of LOCO_KEYS) {
      this.w[n] += (t[n] - this.w[n]) * k;
      if (t[n] === 0 && this.w[n] < SALTO.minW) this.w[n] = 0;
      sum += this.w[n];
    }
    for (const n of LOCO_KEYS) {
      this.w[n] = sum > 0 ? this.w[n] / sum : n === "idle" ? 1 : 0;
      this.setBase(n, this.w[n]);
      this.stepRatio(n, speed);
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smooth(v: number): number {
  return v * v * (3 - 2 * v);
}
