import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import type { AnimationGroup, AssetContainer, Mesh, Scene } from "@babylonjs/core";
import { AttackState, StateMachine, Health, loadContainer, type AttackTiming, type Hurtbox } from "@engine";
import type { CombatTarget } from "../../combat/combatTarget";

/**
 * CAMADA JOGO (Brasa). O GUARDIÃO: chefe do fundo do poço (spec-chefe-guardiao). Não é
 * "mais um esqueleto": tem vida alta, ARENA própria (andar guardião), barra de chefe no HUD
 * e TRÊS FASES espelhadas no tema da LUZ, por faixa de vida:
 *  - Fase 1 (fria, 100-66%): lento e MUITO legível. Marreta descendente + varredura.
 *  - Fase 2 (tiço, 66-33%): + Sopro de escuro (AoE telegrafado por anel no chão). Mais rápido.
 *  - Fase 3 (quente, 33-0%): agressivo, janelas menores, encadeia golpes.
 * Telegrafia por emissivo pulsante na antecipação (o brilho avisa antes do golpe).
 * Implementa CombatTarget (o herói o fere pelo mesmo pipeline). O CombatDirector o trata
 * num slot próprio (boss), conta sua vida como "inimigo vivo" e encena o desfecho ao matá-lo.
 */
type Mode = "approach" | "attacking" | "cooldown" | "dead";
type AttackKind = "overhead" | "sweep" | "aoe";

interface BossAttack {
  kind: AttackKind;
  timing: AttackTiming;
  damage: number;
  range: number; // alcance (overhead/sweep) ou raio (aoe)
  arcCos: number; // cos do meio-ângulo do cone frontal (aoe ignora)
  knockback: number;
}

const MODEL = "/models/quaternius_monsters/mushroomking.glb";
const HEIGHT = 3.2;
const MAX_HP = 600;
const MOVE_BASE = 1.7;
const FACE_OFFSET = Math.PI; // Quaternius olha -Z

// Tintas emissivas por fase (fria -> tiço -> quente). spec-vfx-e-shaders.
const PHASE_TINT = [Color3.FromHexString("#2a6a78"), Color3.FromHexString("#6a2a1c"), Color3.FromHexString("#b5431c")];

// Movesets por fase (timings em segundos; antecipação LONGA e legível, maior que a dos comuns).
function attacksFor(phase: number): BossAttack[] {
  const overhead: BossAttack = {
    kind: "overhead", timing: { startup: phase >= 3 ? 0.55 : 0.8, active: 0.16, recovery: phase >= 3 ? 0.55 : 0.8 },
    damage: 26, range: 3.6, arcCos: 0.4, knockback: 5,
  };
  const sweep: BossAttack = {
    kind: "sweep", timing: { startup: phase >= 3 ? 0.5 : 0.7, active: 0.18, recovery: 0.7 },
    damage: 22, range: 3.8, arcCos: -0.2, knockback: 6, // arco largo (~230°)
  };
  const aoe: BossAttack = {
    kind: "aoe", timing: { startup: 1.0, active: 0.2, recovery: 0.9 },
    damage: 30, range: 5.2, arcCos: -1, knockback: 8, // raio total
  };
  if (phase <= 1) return [overhead, sweep];
  if (phase === 2) return [overhead, sweep, aoe];
  return [overhead, sweep, aoe, overhead]; // fase 3: mais ataque
}

let cache: Promise<AssetContainer> | null = null;

export class Guardiao implements CombatTarget {
  readonly health = new Health(MAX_HP);
  private readonly scene: Scene;
  private rootNode: TransformNode | null = null;
  private mats: StandardMaterial[] = [];
  private animGroups: AnimationGroup[] = [];
  private anims: Record<string, AnimationGroup | undefined> = {};
  private currentAnim: AnimationGroup | null = null;

  private readonly sm = new StateMachine<Mode>("approach");
  private readonly attack = new AttackState();
  private cur: BossAttack | null = null;
  private phase = 1;
  private readonly base: Vector3;
  private readonly attackDir = new Vector3(0, 0, 1);
  private readonly center_ = new Vector3();
  private hitHeroThisSwing = false;
  private struck = false;
  private aoeRing: Mesh | null = null;
  private loaded = false;
  private disposed = false;
  private cooldownSec = 0.8;
  // W3: gangorra de luz. brasaLight 0..1 (começa MORRENDO = baixa). Quanto mais escuro, mais
  // rápido/perigoso o Guardião. O Golpe de Fogo do herói REACENDE (sobe a luz e o CAMBALEIA);
  // o Sopro de escuro APAGA. Cambaleio = parado, exposto, leva dano dobrado.
  private brasaLight = 0.35;
  private staggerTimer = 0;

  constructor(scene: Scene, spawn: Vector3) {
    this.scene = scene;
    this.base = spawn.clone();
    void this.load(spawn);
  }

  get reward(): number {
    return 60;
  }
  get attackDamage(): number {
    return this.cur?.damage ?? 24;
  }
  /** Fração de vida (barra de chefe). */
  get fraction(): number {
    return this.health.fraction;
  }
  get currentPhase(): number {
    return this.phase;
  }
  /** Luz da Brasa na arena (0..1); o HUD/iluminação podem ler para escurecer a cena. */
  get brasaLightFraction(): number {
    return this.brasaLight;
  }
  /** Está cambaleando (exposto após reacender): parado e vulnerável. */
  get staggered(): boolean {
    return this.staggerTimer > 0;
  }

  /**
   * REACENDER (W3): o Golpe de Fogo do herói reacende a Brasa. Sobe a luz um estágio, faz o
   * Guardião CAMBALEAR (parado ~0,8 s, dano dobrado) e o interrompe. Chamado pelo CombatDirector
   * quando o ember atinge o chefe. Liga o recurso temático (Fagulha) à mecânica do chefe.
   */
  reignite(): void {
    if (!this.health.alive) return;
    this.brasaLight = Math.min(1, this.brasaLight + 0.34);
    this.staggerTimer = 0.8;
    if (this.aoeRing) this.aoeRing.setEnabled(false);
    // flash frio-claro de ofuscação
    for (const m of this.mats) m.emissiveColor.set(0.7, 0.85, 1.0);
    this.setAnim(this.anims.hit, false);
    this.sm.to("cooldown"); // interrompe o que estava fazendo
  }

  private async load(spawn: Vector3): Promise<void> {
    if (!cache) cache = loadContainer(this.scene, MODEL);
    const container = await cache;
    if (this.disposed) return;
    const entries = container.instantiateModelsToScene(undefined, false);
    const model = entries.rootNodes[0] as TransformNode | undefined;
    if (!model) return;
    this.animGroups = entries.animationGroups;

    const root = new TransformNode("guardiao", this.scene);
    this.rootNode = root;
    root.position.copyFrom(spawn);
    model.parent = root;
    model.rotationQuaternion = null;
    model.position.setAll(0);
    model.scaling.setAll(1);
    model.computeWorldMatrix(true);
    let b = model.getHierarchyBoundingVectors(true);
    const scale = HEIGHT / Math.max(0.001, b.max.y - b.min.y);
    model.scaling.setAll(scale);
    model.computeWorldMatrix(true);
    b = model.getHierarchyBoundingVectors(true);
    model.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);

    for (const m of model.getChildMeshes(false)) {
      m.isPickable = false;
      const mat = m.material as StandardMaterial | null;
      if (mat && "emissiveColor" in mat && !this.mats.includes(mat)) this.mats.push(mat);
    }

    const find = (re: RegExp): AnimationGroup | undefined => this.animGroups.find((g) => re.test(g.name));
    for (const g of this.animGroups) g.stop();
    this.anims = {
      idle: find(/^Idle$/i) ?? find(/idle/i),
      walk: find(/^Walk$/i) ?? find(/walk/i),
      attack: find(/^Punch$/i) ?? find(/attack/i),
      hit: find(/hitreact/i) ?? find(/hit/i),
      death: find(/death/i),
    };

    // Anel de telegrafia do AoE (disco emissivo no chão; some quando não há AoE).
    const ring = MeshBuilder.CreateDisc("guardiao_aoe", { radius: 1, tessellation: 32 }, this.scene);
    ring.rotation.x = Math.PI / 2;
    ring.position.copyFrom(spawn);
    ring.position.y = 0.06;
    ring.isPickable = false;
    ring.parent = root;
    ring.setEnabled(false);
    const rm = new StandardMaterial("aoeMat", this.scene);
    rm.emissiveColor = Color3.FromHexString("#c8401c");
    rm.diffuseColor = Color3.Black();
    rm.specularColor = Color3.Black();
    rm.disableLighting = true;
    rm.alpha = 0.4;
    ring.material = rm;
    this.aoeRing = ring;

    this.applyPhaseTint(0);
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

  private applyPhaseTint(telegraph: number): void {
    // emissivo = tinta da fase * (base + telegrafia). telegraph 0..1 (sobe na antecipação).
    const tint = PHASE_TINT[this.phase - 1]!;
    const k = 0.12 + 0.9 * telegraph;
    for (const m of this.mats) m.emissiveColor.set(tint.r * k, tint.g * k, tint.b * k);
  }

  get hurtbox(): Hurtbox {
    const p = this.rootNode?.position ?? this.base;
    this.center_.copyFrom(p);
    this.center_.y += HEIGHT * 0.5;
    return { center: this.center_, radius: 1.1 };
  }

  takeHit(damage: number, dir: Vector3, knockback: number): { guarded: boolean } {
    if (!this.health.alive || !this.rootNode) return { guarded: false };
    const dmg = this.staggered ? damage * 2 : damage; // cambaleio: vulnerável (dano dobrado)
    const { died } = this.health.damage(dmg);
    // leve recuo (chefe é pesado: knockback reduzido)
    this.rootNode.position.x += dir.x * knockback * 0.05;
    this.rootNode.position.z += dir.z * knockback * 0.05;
    if (died) {
      this.sm.to("dead");
      this.setAnim(this.anims.death, false);
      if (this.aoeRing) this.aoeRing.setEnabled(false);
    }
    return { guarded: false };
  }

  /** Avança o chefe; retorna true no frame em que conecta um golpe no herói. */
  update(combatDt: number, heroPos: Vector3): boolean {
    if (!this.loaded || !this.rootNode || combatDt <= 0) return false;
    // Fase por faixa de vida (100-66 / 66-33 / 33-0).
    const f = this.health.fraction;
    const newPhase = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
    if (newPhase !== this.phase) this.phase = newPhase;

    // Cambaleio (exposto): congela o Guardião, mantém o flash frio e conta o tempo.
    if (this.staggerTimer > 0) {
      this.staggerTimer = Math.max(0, this.staggerTimer - combatDt);
      if (this.staggerTimer === 0) this.applyPhaseTint(0); // volta ao emissivo da fase
      return false;
    }

    this.sm.advance(combatDt);
    if (this.sm.is("dead")) return false;

    const root = this.rootNode;
    const dx = heroPos.x - root.position.x;
    const dz = heroPos.z - root.position.z;
    const dist = Math.hypot(dx, dz) || 1e-3;
    this.struck = false;

    if (this.sm.is("attacking") && this.cur) {
      root.rotation.y = Math.atan2(this.attackDir.x, this.attackDir.z) + FACE_OFFSET;
      const wasBusy = this.attack.isBusy;
      const inStartup = this.attack.current === "startup";
      this.applyPhaseTint(inStartup ? this.attack.phaseProgress : 0);
      // Anel do AoE cresce na antecipação.
      if (this.cur.kind === "aoe" && this.aoeRing) {
        this.aoeRing.setEnabled(true);
        const g = inStartup ? this.attack.phaseProgress : 1;
        this.aoeRing.scaling.setAll(this.cur.range * g);
      }
      this.attack.advance(combatDt);
      if (this.attack.isActive && !this.hitHeroThisSwing) {
        let hit = false;
        if (this.cur.kind === "aoe") hit = dist <= this.cur.range;
        else hit = dist <= this.cur.range && (dx / dist) * this.attackDir.x + (dz / dist) * this.attackDir.z > this.cur.arcCos;
        if (hit) {
          this.struck = true;
          this.hitHeroThisSwing = true;
        }
      }
      if (wasBusy && !this.attack.isBusy) {
        if (this.aoeRing) this.aoeRing.setEnabled(false);
        // Sopro de escuro consumado: APAGA a Brasa um estágio (gangorra).
        if (this.cur.kind === "aoe") this.brasaLight = Math.max(0, this.brasaLight - 0.34);
        this.applyPhaseTint(0);
        this.sm.to("cooldown");
        this.setAnim(this.anims.idle, true);
      }
    } else if (this.sm.is("cooldown")) {
      root.rotation.y = Math.atan2(dx, dz) + FACE_OFFSET;
      // janela de punição: encurta com a fase (mais agressivo no quente)
      this.cooldownSec = this.phase >= 3 ? 0.5 : this.phase === 2 ? 0.7 : 0.9;
      if (this.sm.time >= this.cooldownSec) this.sm.to("approach");
    } else {
      // approach: encara e fecha distância; ao chegar perto, escolhe um golpe da fase.
      root.rotation.y = Math.atan2(dx, dz) + FACE_OFFSET;
      const reach = 3.2;
      if (dist > reach) {
        const step = MOVE_BASE * (this.phase >= 3 ? 1.3 : 1) * combatDt;
        root.position.x += (dx / dist) * step;
        root.position.z += (dz / dist) * step;
        this.setAnim(this.anims.walk, true);
      } else {
        this.startAttack(dx / dist, dz / dist);
      }
    }
    return this.struck;
  }

  private startAttack(dirX: number, dirZ: number): void {
    const opts = attacksFor(this.phase);
    // Sorteio simples por fase (varia o golpe sem depender de Math.random determinístico).
    const pick = opts[Math.floor((performance.now() / 137) % opts.length)] ?? opts[0]!;
    this.cur = pick;
    this.attackDir.set(dirX, 0, dirZ);
    this.hitHeroThisSwing = false;
    // Gangorra de luz: quanto mais escuro (brasaLight baixa), mais CURTO o tell (perigoso).
    // light=1 -> antecipação cheia (legível); light=0 -> ~70% (rápido). Soma-se à fase.
    const tellMul = 0.7 + 0.3 * this.brasaLight;
    const timing: AttackTiming = {
      startup: pick.timing.startup * tellMul,
      active: pick.timing.active,
      recovery: pick.timing.recovery,
    };
    this.attack.start(timing);
    this.sm.to("attacking");
    this.setAnim(this.anims.attack, false);
  }

  dispose(): void {
    this.disposed = true;
    for (const g of this.animGroups) g.dispose();
    this.animGroups = [];
    this.aoeRing?.dispose();
    this.rootNode?.dispose(false, true);
    this.rootNode = null;
  }
}
