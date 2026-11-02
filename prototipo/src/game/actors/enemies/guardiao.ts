import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import type { AbstractMesh, AnimationGroup, AssetContainer, Material, Mesh, Scene } from "@babylonjs/core";
import { AttackState, StateMachine, Health, getActorLight, loadContainer, outlineHierarchy, type AttackTiming, type Hurtbox } from "@engine";
import type { CombatTarget } from "../../combat/combatTarget";
import type { ArenaControls } from "../../scenes/crypt/cryptRoom";
import { tellSound } from "../../combat/combatSound";
import { loadAnimLibrary, retargetClips, semContornoNosOlhos } from "../quaterniusRig";
import { buildSword } from "../weapons";

/**
 * CAMADA JOGO (Brasa). O GUARDIÃO: chefe único do fundo do poço (spec-chefe-guardiao). Não é
 * "mais um esqueleto": tem vida alta, ARENA própria (andar guardião), barra de chefe no HUD e
 * a GANGORRA DE LUZ como coração do encontro. Dois medidores que o jogador lê:
 *  - VIDA do Guardião (barra de chefe): cai com os golpes.
 *  - LUZ da Brasa (brasaLight 0..1, lida no MUNDO): começa MORRENDO (baixa). O herói a ergue
 *    reacendendo (Golpe de Fogo OU canalizar a Brasa central); o Guardião a apaga (sopro #4) e
 *    ela esfria sozinha com o tempo.
 *
 * A GANGORRA (spec §4.1): quanto mais a Brasa APAGA, mais forte/rápido/escuro o Guardião (tells
 * mais curtos, anda mais, encadeia mais); quanto mais ARDE, mais ele RECUA e EXPÕE a silhueta
 * (tells longos, janelas longas). Chegar a "forte" OFUSCA o Guardião: CAMBALEIO DE LUZ (parado,
 * exposto, dano dobrado), do qual ele tenta sair com o sopro de escuro (§5.5).
 *
 * TRÊS FASES por faixa de vida + luz (spec §5.4), lidas por luz/silhueta/cor:
 *  - Fase 1 "a guardiã que aguarda" (100-66%): lenta, MUITO legível. Só #1 marreta + #2 sweep.
 *  - Fase 2 "o dever que consome" (66-33%): + #3 gancho (puxa/quebra guarda), #4 sopro (AoE,
 *    apaga a Brasa, inquebrável), #5 combo (2-3 cortes). Mais rápida; o breu cresce.
 *  - Fase 3 "o escuro que reclama" (33-0%): tells ~15% mais curtos, encadeia mais; HAZARDS de
 *    chão (maré de breu + frio que morde, §5.6); luta para manter a Brasa apagada.
 *
 * Implementa CombatTarget (o herói o fere pelo mesmo pipeline). O CombatDirector o trata num
 * slot próprio (boss) e o credita ao morrer. A ARENA (cryptRoom) reage à luz e telegrafa os
 * hazards via `bindArena`; o chefe é a fonte de verdade dos medidores.
 *
 * CORPO (canon, narrativa-e-historia §0): o Guardião É a Primeira Acendedora. Mesmo corpo
 * Quaternius da heroína (guardia.glb, tools/personagens/gerar.py), manto queimado e capuz,
 * ~2,2 m, pele de carvão com FENDAS emissivas: a textura de emissão é cinza (fendas claras,
 * corpo fraco) e a COR vem daqui (applyPhaseTint): brasa laranja com a luz forte, ciano
 * espectral no breu, tinta da fase na telegrafia, flash frio no cambaleio. Mesmos clipes da
 * biblioteca (anim.glb) retargetados por osso; lâmina carbonizada na mão direita.
 */
type Mode = "approach" | "attacking" | "cooldown" | "exposto" | "dead";
type AttackKind = "overhead" | "sweep" | "pull" | "aoe" | "combo";

interface BossAttack {
  kind: AttackKind;
  timing: AttackTiming;
  damage: number;
  range: number; // alcance (melee) ou raio (aoe)
  arcCos: number; // cos do meio-ângulo do cone frontal (aoe ignora)
  knockback: number;
  hits?: number; // nº de acertos da janela ativa (combo encadeia 2-3)
  guardBreak?: boolean; // ignora a guarda frontal (overhead, pull)
}

const MODEL = "/models/personagens/guardia.glb";
const HEIGHT = 2.2; // a Primeira Acendedora: mais alta que Cinza (1,8), não um gigante
const MAX_HP = 340; // spec §2: vida medida em SEGUNDOS (~75-110 s), não esponja
const MOVE_BASE = 1.6; // lento, pesado, solene (não corre); o escuro o acelera
const FACE_OFFSET = 0; // corpo Quaternius (loader já converte a mão-dupla): olha para +Z
const OUTLINE_WORLD = 0.04; // contorno de tinta grosso (é o chefe; silhueta domina a leitura)
const EMBER = new Color3(1.0, 0.48, 0.14); // brasa nas fendas (luz forte)
type EmissiveMat = Material & { emissiveColor: Color3 };

// Limiares da LUZ da Brasa (3 estágios, §4): quase morta / bruxulejando / forte.
const LIGHT_FORTE = 0.8; // >= forte: OFUSCA o Guardião (cambaleio de luz, §5.5)
const LIGHT_STEP = 0.34; // um estágio (reacender sobe; sopro de escuro desce)
const LIGHT_DECAY = 0.018; // /s: a Brasa esfria sozinha (manter acesa é trabalho contínuo, §4.2)

// Tintas emissivas por fase (fria -> tiço -> quente). spec-vfx-e-shaders / direcao-de-arte §5.
const PHASE_TINT = [Color3.FromHexString("#2a6a78"), Color3.FromHexString("#6a2a1c"), Color3.FromHexString("#b5431c")];
const EYE_COLD = new Color3(0.37, 0.72, 0.79); // olhos/runas ciano-espectrais no escuro (#5FB7C9)
const STAGGER_FLASH = new Color3(0.7, 0.85, 1.0); // flash frio de "cega" no cambaleio

// Movesets por fase (timings em segundos; antecipação LONGA e legível, §5.1/§5.3). Fase 3
// encurta ~15% (aplicado no startAttack). Os danos seguem a tabela §5.3.
function attacksFor(phase: number): BossAttack[] {
  const overhead: BossAttack = {
    kind: "overhead", timing: { startup: 1.0, active: 0.2, recovery: 0.9 },
    damage: 28, range: 3.6, arcCos: 0.4, knockback: 5, guardBreak: true, // #1: força esquiva
  };
  const sweep: BossAttack = {
    kind: "sweep", timing: { startup: 0.6, active: 0.25, recovery: 0.6 },
    damage: 17, range: 3.8, arcCos: -0.2, knockback: 6, // #2: arco largo (~230°), drena guarda
  };
  const pull: BossAttack = {
    kind: "pull", timing: { startup: 0.5, active: 0.16, recovery: 0.7 },
    damage: 12, range: 4.2, arcCos: 0.5, knockback: -4, guardBreak: true, // #3: gancho (puxa, abre guarda)
  };
  const aoe: BossAttack = {
    kind: "aoe", timing: { startup: 0.9, active: 0.2, recovery: 1.0 },
    damage: 10, range: 5.2, arcCos: -1, knockback: 8, // #4: sopro de escuro (raio total, apaga a Brasa)
  };
  const combo: BossAttack = {
    kind: "combo", timing: { startup: 0.6, active: 0.5, recovery: 0.7 },
    damage: 14, range: 3.6, arcCos: 0.2, knockback: 4, hits: phase >= 3 ? 3 : 2, // #5: 2-3 cortes
  };
  if (phase <= 1) return [overhead, sweep]; // ensina a gangorra com só dois golpes
  if (phase === 2) return [overhead, sweep, pull, aoe, combo];
  return [overhead, sweep, pull, aoe, combo, overhead, combo]; // fase 3: encadeia mais
}

let cache: Promise<AssetContainer> | null = null;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampN = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export class Guardiao implements CombatTarget {
  readonly health = new Health(MAX_HP);
  private readonly scene: Scene;
  private rootNode: TransformNode | null = null;
  private mats: EmissiveMat[] = [];
  private animGroups: AnimationGroup[] = [];
  private skeletons: { dispose(): void }[] = [];
  private glowMeshes: AbstractMesh[] = [];
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
  private comboHitsLeft = 0; // acertos restantes do combo (cada ciclo ativo dá 1)
  private comboNextHitT = 0; // contagem regressiva para o próximo corte do combo (dentro do ativo)
  private struck = false;
  private aoeRing: Mesh | null = null;
  private loaded = false;
  private disposed = false;
  private cooldownSec = 0.9;
  // Gangorra de luz. brasaLight 0..1 (começa MORRENDO = baixa). Reacender sobe; sopro/decaimento
  // descem. Chegar a "forte" OFUSCA -> cambaleio de luz (staggerTimer). No cambaleio: dano dobrado.
  private brasaLight = 0.35;
  private staggerTimer = 0;
  // Hazards (fase 3): ligados via arena. frostTimer espaça as zonas de gelo; mareOn rastreia
  // a maré de breu para alternar (não empilhar com combo pesado, §5.6).
  private arena: ArenaControls | null = null;
  private frostTimer = 0;
  private mareOn = false;

  constructor(scene: Scene, spawn: Vector3) {
    this.scene = scene;
    this.base = spawn.clone();
    void this.load(spawn);
  }

  /**
   * Liga a arena do chefe (cryptRoom `room.arena`): o Guardião passa a DIRIGIR a leitura de
   * luz no mundo (escurece/esquenta a câmara conforme a Brasa) e os hazards da fase 3. Chamado
   * pelo coordenador logo após `combat.addBoss(...)`. Sem arena, o chefe funciona igual (só não
   * há leitura de luz no cenário nem hazards de chão).
   */
  bindArena(arena: ArenaControls | null | undefined): void {
    this.arena = arena ?? null;
    this.arena?.setBrasaLight(this.brasaLight);
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
  /** Luz da Brasa na arena (0..1); leitura de fase no mundo. 3 estágios: <0,33 quase morta,
   *  <0,66 bruxulejando, >=0,8 forte. O HUD/cenário podem ler para escurecer a cena. */
  get brasaLightFraction(): number {
    return this.brasaLight;
  }
  /** Está cambaleando (CAMBALEIO DE LUZ / parry): parado, exposto, leva dano dobrado. */
  get staggered(): boolean {
    return this.staggerTimer > 0;
  }

  /** O golpe em curso é INQUEBRÁVEL? O Sopro de escuro (AoE) ignora bloqueio e não se apara. */
  get attackUnblockable(): boolean {
    return this.sm.is("attacking") && this.cur?.kind === "aoe";
  }

  /** Cambaleia o chefe de fora (PARRY do herói em overhead/sweep): interrompe e o expõe (dano dobrado). */
  stagger(seconds = 0.8): void {
    if (!this.health.alive) return;
    this.enterStagger(Math.max(this.staggerTimer, seconds));
  }

  /**
   * REACENDER pelo Golpe de Fogo (ember): sobe a luz um estágio e CAMBALEIA o Guardião. Chamado
   * pelo CombatDirector quando o ember atinge o chefe. Liga o recurso temático (Fagulha) à luta.
   */
  reignite(): void {
    this.raiseBrasa(LIGHT_STEP);
  }

  /**
   * REACENDER pela CANALIZAÇÃO da Brasa central (o verbo de luz, §4.2): o herói canaliza a
   * fagulha na Brasa por ~1,2-1,6 s, parado e vulnerável, e sobe um estágio inteiro. Mais forte
   * que o ember (recompensa a janela de risco). O coordenador chama ao COMPLETAR a canalização.
   */
  reigniteFromBrazier(): void {
    this.raiseBrasa(LIGHT_STEP + 0.06);
  }

  /** Sobe a Brasa de luz (reacender) e dispara o cambaleio de luz se cruzar para "forte". */
  private raiseBrasa(by: number): void {
    if (!this.health.alive) return;
    const before = this.brasaLight;
    this.brasaLight = Math.min(1, this.brasaLight + by);
    // Borda de subida para "forte": OFUSCA -> cambaleio de luz (§5.5). Reacender abaixo do
    // limiar não cambaleia sozinho, mas o ember sempre dá um tranco curto (leitura do acerto).
    if (this.brasaLight >= LIGHT_FORTE && before < LIGHT_FORTE) this.enterStagger(0.9);
    else this.enterStagger(Math.max(this.staggerTimer, 0.6));
  }

  /** Entra no modo exposto: parado, flash frio, interrompe o golpe; o tempo conta no update. */
  private enterStagger(seconds: number): void {
    this.staggerTimer = seconds;
    this.attack.cancel();
    this.cur = null;
    this.comboHitsLeft = 0;
    if (this.aoeRing) this.aoeRing.setEnabled(false);
    for (const m of this.mats) m.emissiveColor.copyFrom(STAGGER_FLASH);
    this.setAnim(this.anims.hit, false);
    this.sm.to("exposto");
  }

  private async load(spawn: Vector3): Promise<void> {
    if (!cache) cache = loadContainer(this.scene, MODEL);
    const container = await cache;
    if (this.disposed) return;
    const entries = container.instantiateModelsToScene(undefined, true); // materiais por instancia (flash/estado nao vazam)
    this.skeletons = entries.skeletons;
    const model = entries.rootNodes[0] as TransformNode | undefined;
    if (!model) return;
    for (const g of entries.animationGroups) g.dispose(); // o glb nao traz clipes (vem da biblioteca)

    const root = new TransformNode("guardiao", this.scene);
    this.rootNode = root;
    // Encaixe como nos mortos humanoides (skeleton.ts): o __root__ do loader guarda a conversao
    // de mao-dupla; escala e aterramento vao num no proprio, medidos com o root na origem.
    const fit = new TransformNode("guardiao_fit", this.scene);
    fit.parent = root;
    model.parent = fit;
    model.computeWorldMatrix(true);
    let b = model.getHierarchyBoundingVectors(true);
    const scale = HEIGHT / Math.max(0.001, b.max.y - b.min.y);
    fit.scaling.setAll(scale);
    fit.computeWorldMatrix(true);
    model.computeWorldMatrix(true);
    b = model.getHierarchyBoundingVectors(true);
    fit.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    root.position.copyFrom(spawn);

    const glow = this.scene.getGlowLayerByName("glow");
    for (const m of model.getChildMeshes(false)) {
      m.isPickable = false;
      const mat = m.material as (Material & { emissiveColor?: Color3; maxSimultaneousLights?: number }) | null;
      if (!mat) continue;
      if (typeof mat.maxSimultaneousLights === "number") mat.maxSimultaneousLights = 8;
      if (mat.emissiveColor && !this.mats.includes(mat as EmissiveMat)) this.mats.push(mat as EmissiveMat);
      // As fendas de carvao (e os olhos) ardem no glow: a textura de emissao e quem recorta.
      glow?.addIncludedOnlyMesh(m as Mesh);
      this.glowMeshes.push(m);
    }
    semContornoNosOlhos(model);
    // ESTILO (Bloco 1, §4.1b): contorno de tinta grosso em metros de mundo (acompanha o esqueleto).
    outlineHierarchy(model, { worldWidth: OUTLINE_WORLD });
    getActorLight(this.scene).include(model); // luz de aro dos atores (leitura do alto)
    this.attachBlade(model);

    // Clipes da biblioteca compartilhada, um por golpe (a FSM escolhe pelo `kind`).
    const lib = await loadAnimLibrary(this.scene);
    if (this.disposed) { this.dispose(); return; }
    const g = retargetClips(lib, model, "guardiao" + root.uniqueId, {
      idle: "Sword_Idle", walk: "Walk_Loop", overhead: "Sword_Regular_B", sweep: "Sword_Regular_A", pull: "Melee_Hook",
      aoe: "Spell_Simple_Shoot", combo: "Sword_Regular_A", hit: "Hit_Chest", death: "Death01",
    });
    this.anims = g;
    this.animGroups = Object.values(g).filter((x): x is AnimationGroup => !!x);
    if (g.walk) g.walk.speedRatio = MOVE_BASE / 1.2;

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

  /** Lâmina carbonizada (weapons.ts recolorida) na mão direita: grande, escura, com o fio em brasa. */
  private attachBlade(model: TransformNode): void {
    const hand = model.getChildTransformNodes(false).find((n) => n.name.replace(/^Clone of /, "") === "hand_r");
    if (!hand) return;
    const sword = buildSword(this.scene);
    sword.parent = hand;
    sword.position.set(-0.035, 0.01, 0); // mesmo encaixe do osso da mão da heroína (heroModel.ts)
    sword.rotation.set(Math.PI / 2, 0, 0);
    sword.scaling.setAll(1.6); // x escala do encaixe (~1,2): lâmina de ~0,9 m
    for (const m of sword.getChildMeshes(false)) {
      (m as Mesh).metadata = { ...(m.metadata ?? {}), noOutline: true };
      const mat = m.material as StandardMaterial | null;
      if (!mat) continue;
      mat.diffuseColor = Color3.FromHexString(/grip/i.test(mat.name) ? "#17110e" : "#2a2320");
      mat.emissiveColor = Color3.FromHexString(/grip/i.test(mat.name) ? "#000000" : "#4a1606");
    }
  }

  private setAnim(group: AnimationGroup | undefined, loop: boolean): void {
    if (!group || group === this.currentAnim) return;
    this.currentAnim?.stop();
    group.reset();
    group.play(loop);
    this.currentAnim = group;
  }

  private applyPhaseTint(telegraph: number): void {
    // Fendas de carvão e olhos (textura de emissão em cinza): a COR vem daqui. A GANGORRA lê
    // no corpo: com a Brasa forte as fendas ardem laranja; apagando, esfriam para o ciano
    // espectral (§4.1). A transição é curta (0,3..0,7) para não virar um cinza morno no meio.
    // A telegrafia soma a tinta da fase (fria -> tição -> quente) e clareia o corpo inteiro.
    const tint = PHASE_TINT[this.phase - 1]!;
    const t = clamp01((this.brasaLight - 0.3) / 0.4);
    const w = t * t * (3 - 2 * t);
    const k = 0.95 * telegraph;
    const base = 0.8; // brilho de repouso das fendas (o corpo de carvao recebe ~10% disso pela textura)
    const r = (EMBER.r * w + EYE_COLD.r * (1 - w)) * base + tint.r * k;
    const g = (EMBER.g * w + EYE_COLD.g * (1 - w)) * base + tint.g * k;
    const b = (EMBER.b * w + EYE_COLD.b * (1 - w)) * base + tint.b * k;
    for (const m of this.mats) m.emissiveColor.set(r, g, b);
  }

  get hurtbox(): Hurtbox {
    const p = this.rootNode?.position ?? this.base;
    this.center_.copyFrom(p);
    this.center_.y += HEIGHT * 0.48; // ~1,05: altura de golpe do herói (tronco)
    return { center: this.center_, radius: 1.3 }; // chefe: alvo generoso (corpo humanoide de 2,2 m), golpe confiável
  }

  takeHit(damage: number, dir: Vector3, knockback: number): { guarded: boolean } {
    if (!this.health.alive || !this.rootNode) return { guarded: false };
    const dmg = this.staggered ? damage * 2 : damage; // cambaleio de luz: vulnerável (dano dobrado)
    const { died } = this.health.damage(dmg);
    // leve recuo (chefe é pesado: knockback reduzido)
    this.rootNode.position.x += dir.x * knockback * 0.05;
    this.rootNode.position.z += dir.z * knockback * 0.05;
    if (died) {
      this.sm.to("dead");
      this.setAnim(this.anims.death, false);
      if (this.aoeRing) this.aoeRing.setEnabled(false);
      this.arena?.setMareDeBreu(false);
    }
    return { guarded: false };
  }

  /** Avança o chefe; retorna true no frame em que conecta um golpe no herói. */
  update(combatDt: number, heroPos: Vector3): boolean {
    if (!this.loaded || !this.rootNode || combatDt <= 0) return false;
    // Fase por faixa de vida (100-66 / 66-33 / 33-0). Vida NÃO sobe entre fases (§5.4).
    const f = this.health.fraction;
    const newPhase = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
    if (newPhase !== this.phase) this.phase = newPhase;

    // Decaimento da Brasa: esfria sozinha (mais rápido no quente/fase tardia). Manter acesa é
    // trabalho contínuo (§4.2). No cambaleio o decaimento pausa (a luz "segura" o ofuscamento).
    if (this.staggerTimer <= 0) {
      const decay = LIGHT_DECAY * (1 + 0.5 * (this.phase - 1));
      this.brasaLight = Math.max(0, this.brasaLight - decay * combatDt);
    }

    // Gangorra de luz refletida no MUNDO: a arena escurece/esquenta com a Brasa; a maré de breu
    // liga na fase 3; as zonas de gelo entram fora dos golpes pesados (não empilhar, §5.6).
    if (this.arena) {
      this.arena.setBrasaLight(this.brasaLight);
      const wantMare = this.phase >= 3 && this.health.alive;
      if (wantMare !== this.mareOn) {
        this.mareOn = wantMare;
        this.arena.setMareDeBreu(wantMare);
      }
      this.updateFrost(combatDt, heroPos);
    }

    // CAMBALEIO DE LUZ / parry (exposto): congela o Guardião, mantém o flash frio, conta o tempo.
    if (this.staggerTimer > 0) {
      this.staggerTimer = Math.max(0, this.staggerTimer - combatDt);
      if (this.staggerTimer === 0) {
        this.applyPhaseTint(0); // volta ao emissivo da fase
        // Sai do cambaleio para a recuperação: o jogador ainda tem a janela; o chefe então
        // volta a rondar e (na fase do sopro) tende a usá-lo para reapagar a Brasa (§5.5).
        this.sm.to("cooldown");
      }
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
      const wasActive = this.attack.isActive;
      this.attack.advance(combatDt);
      // Combo (§5.3 #5): uma única janela ativa longa que conta como vários cortes. Reabrimos a
      // chance de acerto em intervalos iguais dentro da janela ativa (1 por corte). Os demais
      // golpes acertam uma vez só. justActive reinicia a contagem ao entrar em ativo.
      if (this.attack.isActive && !wasActive) {
        this.hitHeroThisSwing = false;
        this.comboNextHitT = 0;
      }
      if (this.cur.kind === "combo" && this.attack.isActive) {
        this.comboNextHitT -= combatDt;
        if (this.comboNextHitT <= 0 && this.comboHitsLeft > 0) {
          this.hitHeroThisSwing = false; // libera o próximo corte
          this.comboNextHitT = this.cur.timing.active / Math.max(1, this.cur.hits ?? 1);
        }
      }
      if (this.attack.isActive && !this.hitHeroThisSwing) {
        let hit = false;
        if (this.cur.kind === "aoe") hit = dist <= this.cur.range;
        else hit = dist <= this.cur.range && (dx / dist) * this.attackDir.x + (dz / dist) * this.attackDir.z > this.cur.arcCos;
        if (hit) {
          this.struck = true;
          this.hitHeroThisSwing = true;
          if (this.cur.kind === "combo") this.comboHitsLeft = Math.max(0, this.comboHitsLeft - 1);
        }
      }
      if (wasBusy && !this.attack.isBusy) {
        if (this.aoeRing) this.aoeRing.setEnabled(false);
        // Sopro de escuro consumado: APAGA a Brasa um estágio (gangorra). Pune a canalização.
        if (this.cur.kind === "aoe") this.brasaLight = Math.max(0, this.brasaLight - LIGHT_STEP);
        this.applyPhaseTint(0);
        this.comboHitsLeft = 0;
        this.sm.to("cooldown");
        this.setAnim(this.anims.idle, true);
      }
    } else if (this.sm.is("cooldown")) {
      root.rotation.y = Math.atan2(dx, dz) + FACE_OFFSET;
      // Janela de punição: encurta com a fase E com o escuro (a luz alonga = mais segura, §5.1).
      const base = this.phase >= 3 ? 0.55 : this.phase === 2 ? 0.72 : 0.9;
      this.cooldownSec = base * (0.8 + 0.4 * this.brasaLight);
      if (this.sm.time >= this.cooldownSec) this.sm.to("approach");
    } else {
      // approach: encara e fecha distância; ao chegar perto, escolhe um golpe da fase.
      root.rotation.y = Math.atan2(dx, dz) + FACE_OFFSET;
      const reach = 3.2;
      if (dist > reach) {
        // Velocidade: lento na luz (recua/expõe), mais rápido no escuro (perigoso, §4.1).
        const darkBoost = 1 + 0.55 * (1 - this.brasaLight);
        const step = MOVE_BASE * darkBoost * (this.phase >= 3 ? 1.2 : 1) * combatDt;
        root.position.x += (dx / dist) * step;
        root.position.z += (dz / dist) * step;
        this.applyPhaseTint(0); // mantém olhos ciano enquanto anda
        this.setAnim(this.anims.walk, true);
      } else {
        this.startAttack(dx / dist, dz / dist);
      }
    }
    return this.struck;
  }

  /** Hazard de frio (§5.6, fase 3): planta zonas de gelo telegrafadas e pune quem fica parado. */
  private updateFrost(combatDt: number, heroPos: Vector3): void {
    if (!this.arena || this.phase < 3 || !this.health.alive) return;
    // Não empilhar hazard + combo pesado (§5.6): só semeia zona fora de um golpe pesado.
    const heavyNow = this.sm.is("attacking") && (this.cur?.kind === "aoe" || this.cur?.kind === "combo" || this.cur?.kind === "overhead");
    this.frostTimer -= combatDt;
    if (this.frostTimer <= 0 && !heavyNow) {
      this.frostTimer = 3.2; // espaçamento entre zonas (legível, não spam)
      // Telegrafa uma zona perto do herói (o frio "morde" quem fica parado): offset aleatório.
      const ox = Math.sin(performance.now() * 0.0013) * 2.4;
      const oz = Math.cos(performance.now() * 0.0017) * 2.4;
      this.arena.spawnFrostZone(heroPos.x + ox, heroPos.z + oz, 1.8, 0.6, 1.6);
    }
    // Punir quem está parado numa zona ATIVA: empurra a Brasa um pouco para baixo (o escuro
    // reclama) e marca um acerto leve. O dano em si é resolvido pelo loop de struck do update.
    if (this.arena.inActiveFrost(heroPos.x, heroPos.z)) {
      this.brasaLight = Math.max(0, this.brasaLight - 0.02 * combatDt);
    }
  }

  private startAttack(dirX: number, dirZ: number): void {
    const opts = attacksFor(this.phase);
    // Sorteio simples por fase (varia o golpe sem depender de Math.random determinístico).
    const pick = opts[Math.floor((performance.now() / 137) % opts.length)] ?? opts[0]!;
    this.cur = pick;
    this.attackDir.set(dirX, 0, dirZ);
    this.hitHeroThisSwing = false;
    this.comboHitsLeft = pick.hits ?? 0;
    // Gangorra de luz: quanto mais escuro (brasaLight baixa), mais CURTO o tell (perigoso).
    // light=1 -> antecipação cheia (legível); light=0 -> ~70% (rápido). Soma-se à fase: a fase 3
    // encurta mais ~15% (§5.4).
    const tellMul = (0.7 + 0.3 * this.brasaLight) * (this.phase >= 3 ? 0.85 : 1);
    const timing: AttackTiming = {
      startup: pick.timing.startup * tellMul,
      active: pick.timing.active,
      recovery: pick.timing.recovery,
    };
    this.attack.start(timing);
    this.sm.to("attacking");
    // Clipe do golpe (um por kind) no ritmo do tell: dura o que o tuning manda.
    const clip = this.anims[pick.kind] ?? this.anims.idle;
    if (clip) clip.speedRatio = clampN(((clip.to - clip.from) / 60) / (timing.startup + timing.active + timing.recovery), 0.5, 3);
    this.setAnim(clip, false);
    // Assinatura sonora por golpe (audível no breu, §6/§7): sopro = inquebrável (grave de
    // perigo); gancho = agudo curto; combo = pesado; overhead/sweep = grave dissonante do chefe.
    tellSound(pick.kind === "aoe" ? "unblock" : pick.kind === "pull" ? "swift" : pick.kind === "combo" ? "heavy" : "boss");
  }

  dispose(): void {
    this.disposed = true;
    this.arena?.setMareDeBreu(false);
    this.arena = null;
    for (const g of this.animGroups) g.dispose();
    this.animGroups = [];
    const glow = this.scene.getGlowLayerByName("glow");
    for (const m of this.glowMeshes) glow?.removeIncludedOnlyMesh(m as Mesh);
    this.glowMeshes = [];
    this.aoeRing?.dispose();
    // Nao derruba os materiais/texturas do container em cache; libera o esqueleto desta instancia.
    for (const m of this.mats) m.dispose(false, false);
    this.mats = [];
    this.rootNode?.dispose(false, false);
    for (const sk of this.skeletons) sk.dispose();
    this.skeletons = [];
    this.rootNode = null;
  }
}
