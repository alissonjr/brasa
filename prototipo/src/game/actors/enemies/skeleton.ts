import { Color3, TransformNode, Vector3 } from "@babylonjs/core";
import type { AbstractMesh, AnimationGroup, AssetContainer, Scene, StandardMaterial } from "@babylonjs/core";
import { AttackState, StateMachine, Ticker, Health, loadContainer, type Hurtbox } from "@engine";
import type { CombatTarget } from "../../combat/combatTarget";
import { type AttackTuning } from "../../combat/tuning";
import { HealthBar3D } from "../../combat/healthBar3d";

/**
 * CAMADA JOGO (Brasa). Inimigo desperto (bestiario docs/brasa/biblia-bestiario.md). Dois
 * catalogos de modelo CC0 sobre a MESMA FSM (aproxima -> telegrafa -> ativo -> recuperacao
 * + cooldown): os mortos do KayKit Skeletons e os monstros do Quaternius Ultimate Monsters.
 * Cada TIPO tem modelo, stats E um COMPORTAMENTO (nao so numeros):
 *  - melee (minion/warrior/rogue/heavy/antigo/sentinela/demonio/brutamonte): fecha distancia e golpeia.
 *  - skirmisher (espreitador): golpeia e RECUA (hit-and-run); pune ganancia.
 *  - ranged (conjurador): mantem distancia e DISPARA projetil telegrafado; forca fechar espaco.
 * A janela de acerto e o dano vem dos stats do tipo (desacoplados da animacao).
 */
type Mode = "approach" | "attacking" | "cooldown" | "dead";

export type SkeletonKind =
  | "minion" | "warrior" | "rogue" | "heavy" | "antigo" | "sentinela"
  | "demonio" | "brutamonte" | "espreitador" | "conjurador";

/** Como o inimigo se comporta na FSM (ver cabecalho). default: melee. */
type Behavior = "melee" | "skirmisher" | "ranged";

/** Projetil disparado por um inimigo ranged, lido e resolvido pelo CombatDirector. */
export interface ShotSpec {
  ox: number; oy: number; oz: number; // origem (mundo)
  dx: number; dz: number; // direcao horizontal normalizada
  speed: number;
  damage: number;
}

interface SkelStats {
  model: string;
  height: number;
  hp: number;
  moveSpeed: number;
  attackRange: number;
  approachUntil: number;
  cooldownSec: number;
  overhead: AttackTuning; // temporizacao do golpe (startup/active/recovery)
  damage: number; // dano causado no heroi
  guards: boolean; // bloqueia golpe leve frontal (escudo)
  reward: number; // Fagulha (cinza quente) que dropa ao morrer
  behavior?: Behavior; // default melee
  projectileSpeed?: number; // ranged: m/s do projetil
  faceOffset?: number; // correcao de orientacao do modelo (Quaternius vs KayKit), radianos
}

const STATS: Record<SkeletonKind, SkelStats> = {
  minion: {
    model: "/models/Skeleton_Minion.glb", height: 1.55, hp: 30, moveSpeed: 3.2, attackRange: 2.0, approachUntil: 1.8, cooldownSec: 0.35,
    overhead: { startup: 0.35, active: 0.1, recovery: 0.45, damage: 8, knockback: 0, hitStopFrames: 4 }, damage: 8, guards: false, reward: 3,
  },
  warrior: {
    model: "/models/Skeleton_Warrior.glb", height: 1.85, hp: 60, moveSpeed: 2.4, attackRange: 2.2, approachUntil: 2.0, cooldownSec: 0.5,
    overhead: { startup: 0.6, active: 0.12, recovery: 0.75, damage: 16, knockback: 0, hitStopFrames: 6 }, damage: 16, guards: false, reward: 4,
  },
  rogue: {
    model: "/models/Skeleton_Rogue.glb", height: 1.78, hp: 42, moveSpeed: 3.7, attackRange: 2.0, approachUntil: 1.8, cooldownSec: 0.3,
    overhead: { startup: 0.32, active: 0.08, recovery: 0.42, damage: 11, knockback: 1, hitStopFrames: 5 }, damage: 11, guards: false, reward: 4,
  },
  heavy: {
    model: "/models/Skeleton_Warrior.glb", height: 2.45, hp: 130, moveSpeed: 1.5, attackRange: 2.7, approachUntil: 2.3, cooldownSec: 0.85,
    overhead: { startup: 0.95, active: 0.15, recovery: 0.85, damage: 28, knockback: 3, hitStopFrames: 10 }, damage: 28, guards: true, reward: 8,
  },
  // Antigo: morto de profundidade, mais vida e golpe forte. Bestiário §3. (Repontado para
  // orc_skull do Quaternius: Skeleton_Mage.glb nunca existiu em disco e o tipo falhava ao carregar.)
  antigo: {
    model: "/models/quaternius_monsters/orc_skull.glb", height: 2.0, hp: 95, moveSpeed: 2.2, attackRange: 2.4, approachUntil: 2.1, cooldownSec: 0.6,
    overhead: { startup: 0.7, active: 0.13, recovery: 0.8, damage: 21, knockback: 2, hitStopFrames: 8 }, damage: 21, guards: false, reward: 9, faceOffset: Math.PI,
  },
  // Sentinela: elite pré-chefe, enorme, tanque, bloqueia; drop alto. Bestiário §3.
  sentinela: {
    model: "/models/Skeleton_Warrior.glb", height: 2.7, hp: 200, moveSpeed: 1.7, attackRange: 2.9, approachUntil: 2.5, cooldownSec: 0.8,
    overhead: { startup: 0.85, active: 0.15, recovery: 0.85, damage: 32, knockback: 4, hitStopFrames: 12 }, damage: 32, guards: true, reward: 20,
  },

  // --- Monstros Quaternius (Ultimate Monsters, CC0): variedade de silhueta + COMPORTAMENTO ---
  // Demonio: melee agressivo de meia-distancia, rapido, dano medio (pressao constante).
  demonio: {
    model: "/models/quaternius_monsters/demon.glb", height: 1.95, hp: 70, moveSpeed: 3.0, attackRange: 2.1, approachUntil: 1.9, cooldownSec: 0.45,
    overhead: { startup: 0.4, active: 0.1, recovery: 0.5, damage: 16, knockback: 2, hitStopFrames: 6 }, damage: 16, guards: false, reward: 6,
    behavior: "melee", faceOffset: Math.PI,
  },
  // Brutamonte: tanque lento e ENORME, golpe pesado lento de ler, bloqueia leve frontal.
  brutamonte: {
    model: "/models/quaternius_monsters/yeti.glb", height: 2.5, hp: 150, moveSpeed: 1.6, attackRange: 2.8, approachUntil: 2.4, cooldownSec: 0.8,
    overhead: { startup: 0.9, active: 0.15, recovery: 0.8, damage: 30, knockback: 4, hitStopFrames: 11 }, damage: 30, guards: true, reward: 12,
    behavior: "melee", faceOffset: Math.PI,
  },
  // Espreitador: veloz, golpeia e RECUA (hit-and-run). Pune quem persegue cegamente.
  espreitador: {
    model: "/models/quaternius_monsters/ninja.glb", height: 1.8, hp: 40, moveSpeed: 4.2, attackRange: 2.0, approachUntil: 1.7, cooldownSec: 0.55,
    overhead: { startup: 0.28, active: 0.08, recovery: 0.35, damage: 12, knockback: 1, hitStopFrames: 5 }, damage: 12, guards: false, reward: 6,
    behavior: "skirmisher", faceOffset: Math.PI,
  },
  // Conjurador: mantem distancia e DISPARA um projetil de fogo telegrafado. Forca fechar espaco.
  conjurador: {
    model: "/models/quaternius_monsters/mushroomking.glb", height: 2.1, hp: 70, moveSpeed: 1.8, attackRange: 9, approachUntil: 8, cooldownSec: 1.1,
    overhead: { startup: 0.7, active: 0.12, recovery: 0.6, damage: 14, knockback: 1, hitStopFrames: 6 }, damage: 14, guards: false, reward: 10,
    behavior: "ranged", projectileSpeed: 9, faceOffset: Math.PI,
  },
};

const FLASH_SEC = 0.07;
const RESPAWN_SEC = 2.2;
const FLASH = Color3.FromHexString("#ffd2a0");

// Cache de container POR MODELO (cada tipo tem um glb; instancias clonam).
const cache = new Map<string, Promise<AssetContainer>>();
function loadModel(scene: Scene, url: string): Promise<AssetContainer> {
  let p = cache.get(url);
  if (!p) {
    p = loadContainer(scene, url);
    cache.set(url, p);
  }
  return p;
}

export class Skeleton implements CombatTarget {
  readonly health: Health;
  private readonly stats: SkelStats;

  private readonly scene: Scene;
  private rootNode: TransformNode | null = null;
  private mats: StandardMaterial[] = [];
  private matEmissive0: Color3[] = [];

  private readonly sm = new StateMachine<Mode>("approach");
  private readonly ai = new Ticker(0.12);
  private readonly attack = new AttackState();
  private hpBar: HealthBar3D | null = null;

  private anims: Record<string, AnimationGroup | undefined> = {};
  private animGroups: AnimationGroup[] = [];
  private currentAnim: AnimationGroup | null = null;
  private disposed = false;

  private readonly base: Vector3;
  private readonly attackDir = new Vector3(0, 0, 1);
  private readonly knock = new Vector3();
  private readonly center_ = new Vector3();
  private hitHeroThisSwing = false;
  private shot: ShotSpec | null = null;
  private flash = 0;
  private squash = 0;
  private respawn = 0;
  private deadElapsed = 0; // tempo desde a morte (para a dissolução em morte permanente)
  private torsoY = 0.9;
  private loaded = false;
  private readonly respawns: boolean;

  /** opts.kind: tipo do morto (default warrior). opts.respawns: renasce (treino) ou fica caido (descida). */
  constructor(scene: Scene, spawn: Vector3, opts?: { kind?: SkeletonKind; respawns?: boolean }) {
    this.scene = scene;
    this.base = spawn.clone();
    this.stats = STATS[opts?.kind ?? "warrior"];
    this.health = new Health(this.stats.hp);
    this.respawns = opts?.respawns ?? true;
    void this.load(spawn);
  }

  /** Dano que este morto causa no heroi ao conectar o golpe (lido pelo CombatDirector). */
  get attackDamage(): number {
    return this.stats.damage;
  }

  /** Fagulha (cinza quente) que este morto credita ao ser derrotado. */
  get reward(): number {
    return this.stats.reward;
  }

  /** Projetil disparado neste frame (inimigo ranged), consumido pelo CombatDirector. null = nada. */
  takeShot(): ShotSpec | null {
    const s = this.shot;
    this.shot = null;
    return s;
  }

  dispose(): void {
    this.disposed = true;
    for (const g of this.animGroups) g.dispose();
    this.animGroups = [];
    this.hpBar?.dispose();
    this.hpBar = null;
    this.rootNode?.dispose(false, true);
    this.rootNode = null;
  }

  private async load(spawn: Vector3): Promise<void> {
    const container = await loadModel(this.scene, this.stats.model);
    const entries = container.instantiateModelsToScene(undefined, false);
    const model = entries.rootNodes[0] as TransformNode | undefined;
    if (!model || this.disposed) {
      for (const g of entries.animationGroups) g.dispose();
      model?.dispose(false, true);
      return;
    }
    this.animGroups = entries.animationGroups;

    const rootNode = new TransformNode("skeleton", this.scene);
    this.rootNode = rootNode;
    rootNode.position.copyFrom(spawn);

    model.parent = rootNode;
    model.rotationQuaternion = null;
    model.position.setAll(0);
    model.rotation.setAll(0);
    model.scaling.setAll(1);
    model.computeWorldMatrix(true);
    let b = model.getHierarchyBoundingVectors(true);
    const scale = this.stats.height / Math.max(0.001, b.max.y - b.min.y);
    model.scaling.setAll(scale);
    model.computeWorldMatrix(true);
    b = model.getHierarchyBoundingVectors(true);
    model.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    this.torsoY = this.stats.height * 0.5;

    const meshes = model.getChildMeshes(false) as AbstractMesh[];
    for (const m of meshes) {
      m.isPickable = false;
      const mat = m.material as StandardMaterial | null;
      if (mat && "emissiveColor" in mat && !this.mats.includes(mat)) {
        this.mats.push(mat);
        this.matEmissive0.push(mat.emissiveColor?.clone?.() ?? Color3.Black());
      }
    }

    const find = (re: RegExp): AnimationGroup | undefined => entries.animationGroups.find((g) => re.test(g.name));
    for (const g of entries.animationGroups) g.stop();
    this.anims = {
      idle: find(/^Idle$/i) ?? find(/idle/i),
      walk: find(/^Walking_A$/i) ?? find(/walk/i),
      attack: find(/1H_Melee_Attack_Slice_Diagonal/i) ?? find(/1H_Melee_Attack_Chop/i) ?? find(/melee_attack/i) ?? find(/^Punch$/i),
      hit: find(/^Hit_A$/i) ?? find(/hit/i),
      death: find(/^Death_A$/i) ?? find(/death/i),
      awaken: find(/Skeletons_Awaken_Standing/i) ?? find(/awaken/i),
    };

    this.hpBar = new HealthBar3D(this.scene, rootNode, this.stats.height * 1.08);
    this.loaded = true;
    this.setAnim(this.anims.idle, true);
  }

  private setAnim(group: AnimationGroup | undefined, loop: boolean): void {
    if (!group || group === this.currentAnim) return;
    this.currentAnim?.stop();
    group.reset();
    group.play(loop);
    this.currentAnim = group;
  }

  get hurtbox(): Hurtbox {
    const p = this.rootNode?.position ?? this.base;
    this.center_.copyFrom(p);
    this.center_.y += this.torsoY;
    return { center: this.center_, radius: this.stats.height > 2 ? 0.8 : 0.6 };
  }

  /** O heroi o acerta. Tipos com escudo (heavy) amortecem o golpe LEVE frontal; pesado/flanco passam. */
  takeHit(damage: number, dir: Vector3, knockback: number, guardBreak = false): { guarded: boolean } {
    if (!this.health.alive || !this.rootNode) return { guarded: false };
    const guarding = this.stats.guards && this.sm.is("approach");
    const fy = this.rootNode.rotation.y;
    const frontal = dir.x * Math.sin(fy) + dir.z * Math.cos(fy) < -0.3;
    const blocked = guarding && frontal && !guardBreak;
    const dmg = blocked ? damage * 0.35 : damage;

    const { died } = this.health.damage(dmg);
    this.flash = FLASH_SEC;
    this.squash = 1;
    this.knock.set(dir.x * knockback * (blocked ? 0.3 : 1), 0, dir.z * knockback * (blocked ? 0.3 : 1));
    this.hpBar?.set(this.health.fraction);
    if (died) {
      this.respawn = this.respawns ? RESPAWN_SEC : -1;
      this.deadElapsed = 0;
      this.sm.to("dead");
      this.setAnim(this.anims.death, false);
    } else if (!blocked && this.sm.is("approach")) {
      this.setAnim(this.anims.hit, false);
    }
    return { guarded: blocked };
  }

  update(combatDt: number, heroPos: Vector3): boolean {
    if (!this.loaded || !this.rootNode) return false;
    this.hpBar?.update(combatDt);
    if (combatDt <= 0) return false;

    this.decayReactions(combatDt);
    this.sm.advance(combatDt);

    if (this.sm.is("dead")) {
      this.updateDead(combatDt);
      return false;
    }

    const root = this.rootNode;
    const dx = heroPos.x - root.position.x;
    const dz = heroPos.z - root.position.z;
    const dist = Math.hypot(dx, dz) || 1e-3;

    const fo = this.stats.faceOffset ?? 0;
    const beh = this.stats.behavior ?? "melee";

    let struck = false;
    if (this.sm.is("attacking")) {
      root.rotation.y = Math.atan2(this.attackDir.x, this.attackDir.z) + fo;
      const wasBusy = this.attack.isBusy;
      this.attack.advance(combatDt);
      if (this.attack.isActive && !this.hitHeroThisSwing) {
        if (beh === "ranged") {
          // Dispara UM projetil, mirando o heroi no instante do disparo (o feixe e resolvido
          // pelo CombatDirector, que aplica i-frames/bloqueio como qualquer golpe).
          this.hitHeroThisSwing = true;
          this.shot = {
            ox: root.position.x, oy: root.position.y + this.torsoY, oz: root.position.z,
            dx: dx / dist, dz: dz / dist,
            speed: this.stats.projectileSpeed ?? 9, damage: this.stats.damage,
          };
        } else if (dist <= this.stats.attackRange) {
          const inCone = (dx / dist) * this.attackDir.x + (dz / dist) * this.attackDir.z > 0.5;
          if (inCone) {
            struck = true;
            this.hitHeroThisSwing = true;
          }
        }
      }
      if (wasBusy && !this.attack.isBusy) {
        this.sm.to("cooldown");
        this.setAnim(this.anims.idle, true);
      }
    } else if (this.sm.is("cooldown")) {
      root.rotation.y = Math.atan2(dx, dz) + fo;
      // Hit-and-run (skirmisher) ou manter distancia (ranged perto demais): RECUA no cooldown.
      const retreat = beh === "skirmisher" || (beh === "ranged" && dist < this.stats.approachUntil * 0.7);
      if (retreat) {
        const step = this.stats.moveSpeed * combatDt;
        root.position.x -= (dx / dist) * step;
        root.position.z -= (dz / dist) * step;
        this.setAnim(this.anims.walk, true);
      } else {
        this.setAnim(this.anims.idle, true);
      }
      if (this.sm.time >= this.stats.cooldownSec) this.sm.to("approach");
    } else {
      root.rotation.y = Math.atan2(dx, dz) + fo;
      if (dist > this.stats.approachUntil) {
        const step = this.stats.moveSpeed * combatDt;
        root.position.x += (dx / dist) * step;
        root.position.z += (dz / dist) * step;
        this.setAnim(this.anims.walk, true);
      } else if (this.ai.tick(combatDt)) {
        this.startOverhead(dx / dist, dz / dist);
      } else if (this.currentAnim !== this.anims.attack && this.currentAnim !== this.anims.hit) {
        this.setAnim(this.anims.idle, true);
      }
    }
    return struck;
  }

  private startOverhead(dirX: number, dirZ: number): void {
    this.attackDir.set(dirX, 0, dirZ);
    this.hitHeroThisSwing = false;
    this.attack.start(this.stats.overhead);
    this.sm.to("attacking");
    this.setAnim(this.anims.attack, false);
  }

  private decayReactions(dt: number): void {
    const root = this.rootNode!;
    if (this.knock.lengthSquared() > 1e-4) {
      root.position.addInPlace(this.knock.scale(dt));
      this.knock.scaleInPlace(Math.exp(-dt / 0.09));
      if (this.knock.lengthSquared() < 1e-4) this.knock.setAll(0);
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      const t = this.flash / FLASH_SEC;
      for (let i = 0; i < this.mats.length; i++) {
        const e0 = this.matEmissive0[i]!;
        this.mats[i]!.emissiveColor.set(e0.r + FLASH.r * t, e0.g + FLASH.g * t, e0.b + FLASH.b * t);
      }
    }
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt * 5);
      const s = this.squash;
      root.scaling.set(1 + 0.08 * s, 1 - 0.12 * s, 1 + 0.08 * s);
    } else if (!this.sm.is("dead")) {
      root.scaling.set(1, 1, 1);
    }
  }

  private updateDead(dt: number): void {
    if (this.respawn < 0) {
      // Morte PERMANENTE (descida): deixa a queda tocar ~0,6s e então DISSOLVE (afunda +
      // some por visibility, que é por-malha, sem afetar irmãos que compartilham material).
      this.deadElapsed += dt;
      const t = (this.deadElapsed - 0.6) / 0.9;
      if (t > 0) {
        const root = this.rootNode!;
        const k = t > 1 ? 1 : t;
        root.position.y = this.base.y - 0.7 * k;
        const vis = 1 - k;
        for (const m of root.getChildMeshes(false)) (m as AbstractMesh).visibility = vis;
      }
      return;
    }
    const root = this.rootNode!;
    this.respawn = Math.max(0, this.respawn - dt);
    const k = this.respawn / RESPAWN_SEC;
    root.scaling.set(Math.max(0.05, k), Math.max(0.05, k), Math.max(0.05, k));
    if (this.respawn === 0) this.revive();
  }

  private revive(): void {
    const root = this.rootNode!;
    this.health.reset();
    root.position.copyFrom(this.base);
    root.scaling.set(1, 1, 1);
    for (let i = 0; i < this.mats.length; i++) this.mats[i]!.emissiveColor.copyFrom(this.matEmissive0[i]!);
    this.knock.setAll(0);
    this.flash = 0;
    this.squash = 0;
    this.hpBar?.set(1);
    this.sm.to("approach");
    this.currentAnim = null;
    this.setAnim(this.anims.awaken ?? this.anims.idle, false);
  }
}
