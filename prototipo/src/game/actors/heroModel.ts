import { ImportMeshAsync, TransformNode } from "@babylonjs/core";
import type { AnimationGroup, Scene } from "@babylonjs/core";
import "@babylonjs/loaders/glTF"; // registra o loader glTF
import type { CharacterVisual } from "@engine";

/**
 * CAMADA JOGO (Brasa). Modelo visual do herói: um KayKit Adventurer (CC0) rigado, com
 * a roupa skinned ao esqueleto (deforma com o corpo, parece tecido de verdade; ver
 * docs/tecnica-deformacao-de-tecidos.md). Os personagens de Brasa compartilham o mesmo
 * esqueleto e a mesma biblioteca de animação KayKit (Idle/Walking/Running embutidos).
 *
 * Genérico por construção: a Acendedora passa o glb dela (Mage.glb) via opts.modelUrl;
 * sem URL, cai no default abaixo. Implementa CharacterVisual: o CharacterController
 * (engine) posiciona root e chama animate(dt, speed, grounded). Carregamento assíncrono;
 * root existe de imediato.
 */

// Default: KayKit Mage (Adventurers, CC0), autossuficiente em animação. Se faltar, cai
// no placeholder (a própria biblioteca de animação serve de manequim).
const DEFAULT_MODEL_URL = "/models/Mage.glb";
const PLACEHOLDER_URL = "/models/AnimationLibrary_Godot_Standard.gltf";
const TARGET_HEIGHT = 1.8; // metros
const CAPSULE_HALF = 0.9; // metade da cápsula de 1.8 m (pés ficam em root.y - 0.9)
const FACING_OFFSET = 0; // ajustar para Math.PI se o modelo andar de costas
const WALK_SPEED = 4;
const RUN_SPEED = 8;

/** Ação one-shot/hold do herói, sobreposta à locomoção. */
export type HeroAction = "idle" | "light" | "heavy" | "dodge" | "block" | "hit" | "ember";

export class HeroModel implements CharacterVisual {
  readonly root: TransformNode;
  private readonly scene: Scene;
  private readonly modelUrl: string;

  private idle?: AnimationGroup;
  private walk?: AnimationGroup;
  private run?: AnimationGroup;
  // Camada de ação (ataque/esquiva/bloqueio): clipes embutidos do KayKit Adventurer.
  private attackA?: AnimationGroup;
  private attackB?: AnimationGroup;
  private dodgeG?: AnimationGroup;
  private blockG?: AnimationGroup;
  private hitG?: AnimationGroup;
  private emberG?: AnimationGroup;
  private actionKind: HeroAction = "idle";
  private actionGroup?: AnimationGroup;
  private wIdle = 1;
  private wWalk = 0;
  private wRun = 0;
  private loaded = false;

  /**
   * @param opts.modelUrl glb do herói (default: KayKit Mage). A Acendedora passa o
   *   modelo dela aqui.
   * @param opts.name nome do TransformNode raiz (default: "heroi").
   */
  constructor(scene: Scene, opts?: { modelUrl?: string; name?: string }) {
    this.scene = scene;
    this.modelUrl = opts?.modelUrl ?? DEFAULT_MODEL_URL;
    this.root = new TransformNode(opts?.name ?? "heroi", scene);
    void this.load();
  }

  private async load(): Promise<void> {
    // Usa o modelo pedido se existir; senão, o placeholder (biblioteca de animação).
    let result;
    try {
      result = await ImportMeshAsync(this.modelUrl, this.scene, { pluginExtension: ".glb" });
    } catch {
      result = await ImportMeshAsync(PLACEHOLDER_URL, this.scene);
    }
    const top = result.meshes.find((m) => m.name === "__root__") ?? result.meshes[0];

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

    this.setupAnimations(result.animationGroups);
    this.loaded = true;
  }

  private setupAnimations(groups: AnimationGroup[]): void {
    // Casa por padrão de nome (funciona com Quaternius, KayKit, Mixamo renomeado, etc.).
    const find = (re: RegExp) => groups.find((g) => re.test(g.name));
    for (const g of groups) g.stop();

    this.idle = find(/idle/i);
    this.walk = find(/walk/i);
    this.run = find(/sprint|running|jog|(^|[^a-z])run/i);

    // Ações: ataque leve (golpe diagonal), pesado (chop a 2 mãos), esquiva, bloqueio, dano.
    this.attackA = find(/1H_Melee_Attack_Slice_Diagonal/i) ?? find(/1H_Melee_Attack/i) ?? find(/Spellcast_Shoot/i);
    this.attackB = find(/2H_Melee_Attack_Chop/i) ?? find(/1H_Melee_Attack_Stab/i) ?? this.attackA;
    this.dodgeG = find(/Dodge_Forward/i) ?? find(/dodge/i);
    this.blockG = find(/^Blocking$/i) ?? find(/block/i);
    this.hitG = find(/^Hit_A$/i) ?? find(/hit/i);
    this.emberG = find(/Spellcast_Shoot/i) ?? find(/Spellcasting/i) ?? find(/Throw/i) ?? this.attackA;

    for (const g of [this.idle, this.walk, this.run]) {
      if (!g) continue;
      g.play(true);
      g.weight = 0;
    }
    if (this.idle) this.idle.weight = 1;
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
    const g =
      kind === "light" ? this.attackA :
      kind === "heavy" ? this.attackB :
      kind === "dodge" ? this.dodgeG :
      kind === "block" ? this.blockG :
      kind === "ember" ? this.emberG : this.hitG;
    if (!g) {
      this.actionKind = "idle";
      return;
    }
    for (const lg of [this.idle, this.walk, this.run]) if (lg) lg.weight = 0;
    g.reset();
    g.play(kind === "block");
    g.weight = 1;
    g.speedRatio = kind === "light" ? 1.45 : kind === "dodge" ? 1.3 : 1.0;
    this.actionGroup = g;
  }

  // --- CharacterVisual ---

  animate(dt: number, speed: number, grounded: boolean): void {
    if (!this.loaded || dt <= 0) return;
    if (this.actionKind !== "idle") {
      // A ação domina; mantém a locomoção zerada para não vazar pose.
      if (this.idle) this.idle.weight = 0;
      if (this.walk) this.walk.weight = 0;
      if (this.run) this.run.weight = 0;
      return;
    }
    this.blendLocomotion(dt, grounded ? speed : 0);
  }

  /** Mescla idle/andar/correr por velocidade (pesos somando ~1). */
  private blendLocomotion(dt: number, speed: number): void {
    let ti = 0;
    let tw = 0;
    let tr = 0;
    if (speed < 0.2) {
      ti = 1;
    } else if (speed <= WALK_SPEED) {
      const t = speed / WALK_SPEED;
      ti = 1 - t;
      tw = t;
    } else {
      const t = clamp((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
      tw = 1 - t;
      tr = t;
    }
    const k = 1 - Math.exp(-12 * dt);
    this.wIdle += (ti - this.wIdle) * k;
    this.wWalk += (tw - this.wWalk) * k;
    this.wRun += (tr - this.wRun) * k;
    if (this.idle) this.idle.weight = this.wIdle;
    if (this.walk) this.walk.weight = this.wWalk;
    if (this.run) this.run.weight = this.wRun;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
