import { Color3, TransformNode, Vector3 } from "@babylonjs/core";
import type { AbstractMesh, AnimationGroup, AssetContainer, Material, Scene, Skeleton as Skeleton_ } from "@babylonjs/core";
import { AttackState, StateMachine, Ticker, Health, loadContainer, outlineHierarchy, getContactShadows, type ContactShadowHandle, type Hurtbox } from "@engine";
import { gradeMonsterMaterials } from "../actorGrade";
import { loadAnimLibrary, retargetClips, semContornoNosOlhos } from "../quaterniusRig";
import type { CombatTarget } from "../../combat/combatTarget";
import { type AttackTuning } from "../../combat/tuning";
import { HealthBar3D } from "../../combat/healthBar3d";
import { tellSound, type TellProfile } from "../../combat/combatSound";

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
  | "demonio" | "brutamonte" | "espreitador" | "conjurador" | "arqueiro";

/** Como o inimigo se comporta na FSM (ver cabecalho). default: melee. */
type Behavior = "melee" | "skirmisher" | "ranged";

/** Projetil disparado por um inimigo ranged, lido e resolvido pelo CombatDirector. */
export interface ShotSpec {
  ox: number; oy: number; oz: number; // origem (mundo)
  dx: number; dz: number; // direcao horizontal normalizada
  speed: number;
  damage: number;
}

/**
 * Retangulo de chao em que o inimigo PODE andar. Sem isto, um inimigo ranged recua para longe
 * do heroi (movendo `position` direto, sem colisao) e acaba DENTRO/ATRAS do estrado do altar -
 * que tem colisao e BARRA o heroi - ficando imatavel. A sala passa estes limites (paredes
 * insetadas + frente do altar) para manter todo inimigo em terreno que o heroi alcanca.
 */
export interface EnemyBounds { minX: number; maxX: number; minZ: number; maxZ: number; }

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
  tellProfile?: TellProfile; // assinatura SONORA do tell (default basic)
  poise: number; // postura: o golpe do heroi drena; ao zerar, CAMBALEIA (interrompe a antecipacao)
  canUnblockable?: boolean; // pode telegrafar um golpe INQUEBRAVEL (ignora bloqueio; forca esquiva)
  monsterExposure?: number; // monstro nao humanoide: multiplicador da exposicao da tinta (yeti branco < 1)
  humanoid?: HumanoidSpec; // corpo Quaternius (UBC + roupa): animacoes da UAL por retarget, olhos ciano
}

/** Variacao de um morto humanoide sobre o mesmo corpo/rig (ver quaterniusRig.ts e tools/personagens). */
interface HumanoidSpec {
  attack: string; // clipe da UAL do golpe
  tint?: string; // multiplicador de cor (hex) sobre pele e roupa: elites mais quentes/escuras
  eyes?: number; // intensidade do brilho ciano dos olhos (1 = padrao)
}

const MORTOS = "/models/personagens/";
type EmissiveMat = Material & { emissiveColor: Color3 };
const DEAD_ALBEDO_BOOST = 1.12;
const DEAD_GLOW = new Color3(0.035, 0.05, 0.065); // piso de luz fria dos mortos humanoides
const clampN = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

const STATS: Record<SkeletonKind, SkelStats> = {
  minion: {
    model: MORTOS + "morto_aldeao.glb", humanoid: { attack: "Zombie_Scratch" }, height: 1.7, hp: 30, moveSpeed: 3.2, attackRange: 2.0, approachUntil: 1.8, cooldownSec: 0.35,
    overhead: { startup: 0.35, active: 0.1, recovery: 0.45, damage: 8, knockback: 0, hitStopFrames: 4 }, damage: 8, guards: false, reward: 3, poise: 12,
  },
  warrior: {
    model: MORTOS + "morto_guerreiro.glb", humanoid: { attack: "Melee_Hook" }, height: 1.85, hp: 60, moveSpeed: 2.4, attackRange: 2.2, approachUntil: 2.0, cooldownSec: 0.5,
    overhead: { startup: 0.6, active: 0.12, recovery: 0.75, damage: 16, knockback: 0, hitStopFrames: 6 }, damage: 16, guards: false, reward: 4, poise: 25,
  },
  rogue: {
    model: MORTOS + "morto_ladino.glb", humanoid: { attack: "Punch_Jab" }, height: 1.78, hp: 42, moveSpeed: 3.7, attackRange: 2.0, approachUntil: 1.8, cooldownSec: 0.3,
    overhead: { startup: 0.32, active: 0.08, recovery: 0.42, damage: 11, knockback: 1, hitStopFrames: 5 }, damage: 11, guards: false, reward: 4, tellProfile: "swift", poise: 14,
  },
  heavy: {
    model: MORTOS + "morto_guerreiro.glb", humanoid: { attack: "Melee_Hook", tint: "#c9a79a", eyes: 1.3 }, height: 2.45, hp: 130, moveSpeed: 1.5, attackRange: 2.7, approachUntil: 2.3, cooldownSec: 0.85,
    overhead: { startup: 0.95, active: 0.15, recovery: 0.85, damage: 28, knockback: 3, hitStopFrames: 10 }, damage: 28, guards: true, reward: 8, tellProfile: "heavy", poise: 65, canUnblockable: true,
  },
  // Antigo: morto de profundidade, mais vida e golpe forte. Bestiário §3. (Repontado para
  // orc_skull do Quaternius: Skeleton_Mage.glb nunca existiu em disco e o tipo falhava ao carregar.)
  antigo: {
    model: "/models/quaternius_monsters/orc_skull.glb", height: 2.0, hp: 95, moveSpeed: 2.2, attackRange: 2.4, approachUntil: 2.1, cooldownSec: 0.6,
    overhead: { startup: 0.7, active: 0.13, recovery: 0.8, damage: 21, knockback: 2, hitStopFrames: 8 }, damage: 21, guards: false, reward: 9, faceOffset: Math.PI, poise: 45,
  },
  // Sentinela: elite pré-chefe, enorme, tanque, bloqueia; drop alto. Bestiário §3.
  sentinela: {
    model: MORTOS + "morto_guerreiro.glb", humanoid: { attack: "Melee_Hook", tint: "#d6b48a", eyes: 1.6 }, height: 2.7, hp: 200, moveSpeed: 1.7, attackRange: 2.9, approachUntil: 2.5, cooldownSec: 0.8,
    overhead: { startup: 0.85, active: 0.15, recovery: 0.85, damage: 32, knockback: 4, hitStopFrames: 12 }, damage: 32, guards: true, reward: 20, tellProfile: "heavy", poise: 95, canUnblockable: true,
  },

  // --- Monstros Quaternius (Ultimate Monsters, CC0): variedade de silhueta + COMPORTAMENTO ---
  // Demonio: melee agressivo de meia-distancia, rapido, dano medio (pressao constante).
  demonio: {
    model: "/models/quaternius_monsters/demon.glb", height: 1.95, hp: 70, moveSpeed: 3.0, attackRange: 2.1, approachUntil: 1.9, cooldownSec: 0.45,
    overhead: { startup: 0.4, active: 0.1, recovery: 0.5, damage: 16, knockback: 2, hitStopFrames: 6 }, damage: 16, guards: false, reward: 6,
    behavior: "melee", faceOffset: Math.PI, poise: 25,
  },
  // Brutamonte: tanque lento e ENORME, golpe pesado lento de ler, bloqueia leve frontal.
  brutamonte: {
    model: "/models/quaternius_monsters/yeti.glb", monsterExposure: 0.45, height: 2.5, hp: 150, moveSpeed: 1.6, attackRange: 2.8, approachUntil: 2.4, cooldownSec: 0.8,
    overhead: { startup: 0.9, active: 0.15, recovery: 0.8, damage: 30, knockback: 4, hitStopFrames: 11 }, damage: 30, guards: true, reward: 12,
    behavior: "melee", faceOffset: Math.PI, tellProfile: "heavy", poise: 75, canUnblockable: true,
  },
  // Espreitador: veloz, golpeia e RECUA (hit-and-run). Pune quem persegue cegamente.
  espreitador: {
    model: "/models/quaternius_monsters/ninja.glb", height: 1.8, hp: 40, moveSpeed: 4.2, attackRange: 2.0, approachUntil: 1.7, cooldownSec: 0.55,
    overhead: { startup: 0.28, active: 0.08, recovery: 0.35, damage: 12, knockback: 1, hitStopFrames: 5 }, damage: 12, guards: false, reward: 6,
    behavior: "skirmisher", faceOffset: Math.PI, tellProfile: "swift", poise: 14,
  },
  // Conjurador: mantem distancia e DISPARA um projetil de fogo telegrafado. Forca fechar espaco.
  // Projetil JUSTO (design de bullet legivel): antecipacao longa (cast 0.95s), tiro LENTO
  // (esquivavel a pe ou com a esquiva) e cadencia espacada (cooldown 1.8s) para nao saturar.
  conjurador: {
    model: MORTOS + "morto_conjurador.glb", humanoid: { attack: "Spell_Simple_Shoot", eyes: 1.2 }, height: 1.95, hp: 70, moveSpeed: 1.8, attackRange: 11, approachUntil: 9, cooldownSec: 1.8,
    overhead: { startup: 0.95, active: 0.12, recovery: 0.7, damage: 14, knockback: 1, hitStopFrames: 6 }, damage: 14, guards: false, reward: 10,
    // Humanoide Quaternius (corpo UBC + roupa de camponesa): olha para +Z, sem faceOffset.
    behavior: "ranged", projectileSpeed: 6.5, faceOffset: 0, tellProfile: "cast", poise: 18,
  },
  // Arqueiro: esqueleto ranged ágil. Reusa a máquina ranged (mira telegrafada ~0.9s +
  // projétil lento esquivável do CombatDirector). Sem guarda, HP/poise baixos: força o
  // jogador a fechar distância e usar a cobertura dos pilares (bíblia-bestiário 3.3).
  arqueiro: {
    model: MORTOS + "morto_ladino.glb", humanoid: { attack: "OverhandThrow", tint: "#a9bfc4" }, height: 1.78, hp: 38, moveSpeed: 3.0, attackRange: 10, approachUntil: 8, cooldownSec: 1.5,
    overhead: { startup: 0.9, active: 0.1, recovery: 0.6, damage: 12, knockback: 1, hitStopFrames: 5 }, damage: 12, guards: false, reward: 8,
    behavior: "ranged", projectileSpeed: 8.5, faceOffset: Math.PI, tellProfile: "cast", poise: 14,
  },
};

const FLASH_SEC = 0.07;
const RESPAWN_SEC = 2.2;
const FLASH = Color3.FromHexString("#ffd2a0");
const STAGGER_SEC = 0.6; // tempo parado/exposto ao ter a postura (poise) quebrada
const STAGGER_DMG_MUL = 1.3; // cambaleado leva +30% de dano (recompensa da quebra)
const UNBLOCKABLE_CHANCE = 0.4; // chance de a investida de um tipo pesado ser inquebravel
// Coleira: distância máx. do ponto de spawn. Sem corpo físico, os que RECUAM (ranged/
// skirmisher) atravessariam a parede e ficariam inalcançáveis -> a sala nunca "limparia"
// (soft-lock que travava chegar ao altar). Mantém todo morto dentro da área jogável.
const MAX_LEASH = 11;
// EMERGÊNCIA: o morto NÃO surge do nada. Nasce enterrado (abaixo do piso) e SOBE rasgando o
// chão enquanto toca a animação de despertar, dentro da janela de "despertar" do diretor
// (wake ~0.9 s). Some o "pop-in" e ancora a chegada no mundo (eles vinham do solo).
const EMERGE_SEC = 0.8;
const RISE_DEPTH = 1.7; // quão fundo nasce enterrado (some sob o piso opaco)

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
  private mats: EmissiveMat[] = [];
  private matEmissive0: Color3[] = [];
  private ownMats: Material[] = []; // materiais proprios da instancia (liberados no dispose)
  private skeletons: Skeleton_[] = [];
  private glowMeshes: AbstractMesh[] = [];
  private contact: ContactShadowHandle | null = null;

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
  private poise = 0; // postura atual; ao zerar, CAMBALEIA (interrompe a antecipacao)
  private staggerTimer = 0; // > 0: parado e exposto (cambaleio)
  private attackUnblockable_ = false; // o golpe em curso ignora bloqueio (telegrafado em vermelho)
  private shot: ShotSpec | null = null;
  private flash = 0;
  private squash = 0;
  private respawn = 0;
  private deadElapsed = 0; // tempo desde a morte (para a dissolução em morte permanente)
  private torsoY = 0.9;
  private emergeTimer = 0; // > 0: subindo do chão (despertar); não age, não pode ser atingido ainda
  private loaded = false;
  private readonly respawns: boolean;
  private bounds: EnemyBounds | null = null; // terreno andavel (mantem o inimigo alcancavel)

  private readonly kind_: SkeletonKind;

  /** opts.kind: tipo do morto (default warrior). opts.respawns: renasce (treino) ou fica caido (descida). */
  constructor(scene: Scene, spawn: Vector3, opts?: { kind?: SkeletonKind; respawns?: boolean }) {
    this.scene = scene;
    this.base = spawn.clone();
    this.kind_ = opts?.kind ?? "warrior";
    this.stats = STATS[this.kind_];
    this.health = new Health(this.stats.hp);
    this.poise = this.stats.poise;
    this.respawns = opts?.respawns ?? true;
    void this.load(spawn);
  }

  /** Arma que este inimigo DROPA ao morrer (captura de arma): brutamonte=clava, conjurador=cajado. */
  get weaponDrop(): "clava" | "cajado" | "espada" | null {
    // Cada FAMILIA de morto larga uma arma propria (matar tipos diferentes = armas diferentes).
    switch (this.kind_) {
      case "brutamonte":
      case "heavy":
      case "antigo":
        return "clava"; // brutos largam a clava (smash de area)
      case "conjurador":
      case "demonio":
        return "cajado"; // conjuradores largam o cajado (bola de fogo)
      case "warrior":
      case "sentinela":
        return "espada"; // guardas largam a espada (golpe forte e com alcance)
      default:
        return null; // minions/rogues/etc. nao largam arma (mantem o drop especial)
    }
  }

  /** Dano que este morto causa no heroi ao conectar o golpe (lido pelo CombatDirector). */
  get attackDamage(): number {
    return this.stats.damage;
  }

  /** Está cambaleando (postura quebrada): parado e exposto. */
  get staggered(): boolean {
    return this.staggerTimer > 0;
  }

  /** O golpe que está conectando agora é INQUEBRÁVEL? (ignora bloqueio; só esquiva salva). */
  get attackUnblockable(): boolean {
    return this.attackUnblockable_ && this.sm.is("attacking");
  }

  /** Cambaleia o inimigo de fora (usado pelo PARRY do herói): interrompe e o expõe. */
  stagger(seconds = STAGGER_SEC): void {
    if (this.health.alive && !this.sm.is("dead")) this.beginStagger(seconds);
  }

  /** Define o terreno andável (a sala chama ao spawnar): impede recuar para fora do alcance. */
  setBounds(b: EnemyBounds): void {
    this.bounds = b;
    this.clampPos();
  }

  /** Prende a posição ao terreno andável (chamado após cada movimento/empurrão). */
  private clampPos(): void {
    const b = this.bounds;
    const p = this.rootNode?.position;
    if (!b || !p) return;
    if (p.x < b.minX) p.x = b.minX;
    else if (p.x > b.maxX) p.x = b.maxX;
    if (p.z < b.minZ) p.z = b.minZ;
    else if (p.z > b.maxZ) p.z = b.maxZ;
  }

  /** Fagulha (cinza quente) que este morto credita ao ser derrotado. */
  get reward(): number {
    return this.stats.reward;
  }

  /** Em VACILO: vivo, carregado e com vida baixa (< 22%) - pode ser EXECUTADO (finisher). */
  get executable(): boolean {
    return this.loaded && this.health.alive && !this.sm.is("dead") && this.health.fraction < 0.22;
  }

  /** Posição do tronco (para o prompt de execução e VFX). */
  get torsoPos(): Vector3 {
    return this.hurtbox.center;
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
    this.contact?.dispose();
    this.contact = null;
    const glow = this.scene.getGlowLayerByName("glow");
    for (const m of this.glowMeshes) glow?.removeIncludedOnlyMesh(m as never);
    this.glowMeshes = [];
    this.hpBar?.dispose();
    this.hpBar = null;
    // Nao derruba material/textura do container em cache (compartilhados entre inimigos do tipo):
    // so os materiais PROPRIOS desta instancia e o esqueleto do Babylon (vazava um por morto).
    this.rootNode?.dispose(false, false);
    this.rootNode = null;
    for (const m of this.ownMats) m.dispose(false, false);
    this.ownMats = [];
    for (const sk of this.skeletons) sk.dispose();
    this.skeletons = [];
  }

  private async load(spawn: Vector3): Promise<void> {
    const container = await loadModel(this.scene, this.stats.model);
    const hum = this.stats.humanoid;
    // Materiais POR INSTANCIA (texturas compartilhadas): o flash de dano e a telegrafia de um
    // morto nao acendem os irmaos do mesmo tipo nem os que aparecem nos andares seguintes.
    const entries = container.instantiateModelsToScene(undefined, true);
    const model = entries.rootNodes[0] as TransformNode | undefined;
    this.skeletons = entries.skeletons;
    if (!model || this.disposed) {
      for (const g of entries.animationGroups) g.dispose();
      model?.dispose(false, false);
      for (const sk of this.skeletons) sk.dispose();
      return;
    }
    this.animGroups = entries.animationGroups;

    const rootNode = new TransformNode("skeleton", this.scene);
    this.rootNode = rootNode;
    // CRÍTICO: medir e aterrar o modelo com o root na ORIGEM (world == local). Se o root já
    // estivesse no spawn e/ou enterrado (RISE_DEPTH), getHierarchyBoundingVectors devolve
    // bounds em MUNDO e o offset do spawn/emergência vazaria para model.position - o esqueleto
    // ficava FLUTUANDO ~RISE_DEPTH acima do chão e DESLOCADO horizontalmente do seu ponto
    // lógico (hurtbox/IA), por isso "nunca aparecia em cena". Só depois levo o root ao spawn.
    rootNode.position.setAll(0);

    let fitNode: TransformNode = model;
    if (hum) {
      // Humanoide Quaternius: o __root__ do loader guarda a conversao de mao-dupla (nao pode ser
      // zerado como nos KayKit/monstros); a escala e o aterramento vao num no de encaixe.
      fitNode = new TransformNode("skeleton_fit", this.scene);
      fitNode.parent = rootNode;
      model.parent = fitNode;
    } else {
      model.parent = rootNode;
      model.rotationQuaternion = null;
      model.position.setAll(0);
      model.rotation.setAll(0);
      model.scaling.setAll(1);
    }
    model.computeWorldMatrix(true);
    let b = model.getHierarchyBoundingVectors(true);
    const scale = this.stats.height / Math.max(0.001, b.max.y - b.min.y);
    fitNode.scaling.setAll(scale);
    fitNode.computeWorldMatrix(true);
    model.computeWorldMatrix(true);
    b = model.getHierarchyBoundingVectors(true);
    // root na origem => bounds locais: centra em XZ e aterra os pés na cota do root.
    fitNode.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    this.torsoY = this.stats.height * 0.5;

    // agora sim posiciona no spawn e enterra para a animação de emergir (sobe rasgando o chão).
    rootNode.position.copyFrom(spawn);
    rootNode.position.y = spawn.y - RISE_DEPTH;
    this.emergeTimer = EMERGE_SEC;

    const glow = this.scene.getGlowLayerByName("glow");
    const meshes = model.getChildMeshes(false) as AbstractMesh[];
    for (const m of meshes) {
      m.isPickable = false;
      const mat = m.material as (Material & { emissiveColor?: Color3; albedoColor?: Color3; emissiveIntensity?: number }) | null;
      if (!mat) continue;
      if (!this.ownMats.includes(mat)) this.ownMats.push(mat);
      if (hum && /olhos/i.test(m.name)) {
        // Olhos espectrais: emissivo ciano que nao entra no flash/telegrafia e brilha no glow.
        mat.emissiveIntensity = hum.eyes ?? 1;
        glow?.addIncludedOnlyMesh(m as never);
        this.glowMeshes.push(m);
        continue;
      }
      if (hum && mat.albedoColor) {
        // Da camera alta o morto precisa ler: albedo mais claro (x1.12) e um piso de luz fria propria
        // (o morto "brilha" de leve; a heroina e a unica luz quente da sala).
        const base = hum.tint ? Color3.FromHexString(hum.tint) : Color3.White();
        mat.albedoColor = mat.albedoColor.multiply(base).scale(DEAD_ALBEDO_BOOST);
        if (mat.emissiveColor) mat.emissiveColor = DEAD_GLOW.clone();
      }
      if ("emissiveColor" in mat && mat.emissiveColor && !this.mats.includes(mat as EmissiveMat)) {
        this.mats.push(mat as EmissiveMat);
        this.matEmissive0.push(mat.emissiveColor.clone());
      }
    }
    // Monstros nao humanoides (Quaternius saturado): tinta da paleta (dessatura, esfria as sombras).
    if (!hum) gradeMonsterMaterials(this.ownMats, this.stats.monsterExposure ?? 1);
    // ESTILO (Bloco 1, spec-estilo-visual-render §4.1b): contorno de tinta. Largura em METROS de
    // mundo (igual para todo ator, qualquer escala do modelo). Acompanha o esqueleto.
    if (hum) semContornoNosOlhos(model);
    outlineHierarchy(model, { worldWidth: this.stats.height * 0.016 });
    this.contact = getContactShadows(this.scene).add(rootNode, Math.max(0.45, this.stats.height * 0.3));
    this.contact.scale = 0;

    for (const g of entries.animationGroups) g.stop();
    if (hum) {
      const lib = await loadAnimLibrary(this.scene);
      if (this.disposed) { this.dispose(); return; }
      const g = retargetClips(lib, model, "morto" + rootNode.uniqueId, {
        idle: "Zombie_Idle_Loop", walk: "Zombie_Walk_Fwd_Loop", attack: hum.attack, hit: "Hit_Chest", death: "Death01", awaken: "LayToIdle",
      });
      this.anims = g;
      this.animGroups.push(...(Object.values(g) as AnimationGroup[]));
      // Ritmo dos clipes: o golpe dura o que o tuning manda (startup+active+recovery); a emergencia,
      // a janela de despertar; a passada acompanha a velocidade de movimento.
      const dur = (c?: AnimationGroup): number => (c ? (c.to - c.from) / 60 : 1);
      const o = this.stats.overhead;
      if (g.attack) g.attack.speedRatio = clampN(dur(g.attack) / (o.startup + o.active + o.recovery), 0.6, 3);
      if (g.awaken) g.awaken.speedRatio = dur(g.awaken) / EMERGE_SEC;
      if (g.walk) g.walk.speedRatio = clampN(this.stats.moveSpeed / 1.2, 0.8, 2.6);
    } else {
      const find = (re: RegExp): AnimationGroup | undefined => entries.animationGroups.find((g) => re.test(g.name));
      this.anims = {
        idle: find(/^Idle$/i) ?? find(/idle/i),
        walk: find(/^Walking_A$/i) ?? find(/walk/i),
        attack: find(/1H_Melee_Attack_Slice_Diagonal/i) ?? find(/1H_Melee_Attack_Chop/i) ?? find(/melee_attack/i) ?? find(/^Punch$/i),
        hit: find(/^Hit_A$/i) ?? find(/hit/i),
        death: find(/^Death_A$/i) ?? find(/death/i),
        awaken: find(/Skeletons_Awaken_Standing/i) ?? find(/awaken/i),
      };
    }

    this.hpBar = new HealthBar3D(this.scene, rootNode, this.stats.height * 1.08);
    this.loaded = true;
    // Despertar: toca a animação de levantar (se o modelo tiver) enquanto sobe; senão, idle.
    this.setAnim(this.emergeTimer > 0 ? (this.anims.awaken ?? this.anims.idle) : this.anims.idle, this.anims.awaken ? false : true);
  }

  /**
   * EMERGÊNCIA: avança a subida do chão (despertar). Roda durante a janela de "despertar" do
   * diretor (enquanto a IA está suspensa) e também blinda o início do update. Sobe de
   * -RISE_DEPTH até a cota do spawn com desaceleração; ao chegar, entra em idle e passa a agir.
   */
  emerge(dt: number): void {
    if (this.emergeTimer <= 0 || !this.rootNode || dt <= 0) return;
    this.hpBar?.update(dt);
    this.emergeTimer = Math.max(0, this.emergeTimer - dt);
    const t = 1 - this.emergeTimer / EMERGE_SEC; // 0..1
    const eased = 1 - (1 - t) * (1 - t); // ease-out: rompe o chão e assenta
    this.rootNode.position.y = this.base.y - RISE_DEPTH * (1 - eased);
    if (this.contact) this.contact.scale = eased; // a sombra de contato "abre" conforme ele sobe
    if (this.emergeTimer <= 0) {
      this.rootNode.position.y = this.base.y;
      this.setAnim(this.anims.idle, true);
    }
  }

  /** Ainda subindo do chão? (o diretor não testa acerto/IA contra quem está emergindo). */
  get emerging(): boolean {
    return this.emergeTimer > 0;
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
  takeHit(damage: number, dir: Vector3, knockback: number, guardBreak = false, poiseDamage = 0, positionalBonus = false): { guarded: boolean } {
    if (!this.health.alive || !this.rootNode) return { guarded: false };
    const guarding = this.stats.guards && this.sm.is("approach");
    const fy = this.rootNode.rotation.y;
    const frontal = dir.x * Math.sin(fy) + dir.z * Math.cos(fy) < -0.3;
    const blocked = guarding && frontal && !guardBreak;
    let dmg = blocked ? damage * 0.35 : damage;
    // FLANCO/BACKSTAB (Tier 3): lê a posição do herói vs. a orientação LÓGICA do inimigo (sem o
    // offset do modelo). Pelas costas (x1.5 dano, +50% poise); pelo flanco (x1.2 dano).
    let poiseMul = 1;
    if (positionalBonus && !blocked) {
      const lf = fy - (this.stats.faceOffset ?? 0);
      const d = dir.x * Math.sin(lf) + dir.z * Math.cos(lf);
      if (d > 0.4) { dmg *= 1.5; poiseMul = 1.5; } // costas
      else if (d > -0.4) dmg *= 1.2; // flanco
    }
    if (this.staggered) dmg *= STAGGER_DMG_MUL; // cambaleado: leva mais dano (recompensa da quebra)

    const { died } = this.health.damage(dmg);
    this.flash = FLASH_SEC;
    this.squash = 1;
    this.knock.set(dir.x * knockback * (blocked ? 0.3 : 1), 0, dir.z * knockback * (blocked ? 0.3 : 1));
    this.hpBar?.set(this.health.fraction);
    // POISE: golpes nao bloqueados drenam a postura; ao zerar, CAMBALEIA (interrompe o ataque).
    if (!died && !blocked && poiseDamage > 0 && !this.staggered) {
      this.poise -= poiseDamage * poiseMul;
      if (this.poise <= 0) this.beginStagger(STAGGER_SEC);
    }
    if (died) {
      this.respawn = this.respawns ? RESPAWN_SEC : -1;
      this.deadElapsed = 0;
      this.staggerTimer = 0;
      this.sm.to("dead");
      this.setAnim(this.anims.death, false);
    } else if (!blocked && !this.staggered && this.sm.is("approach")) {
      this.setAnim(this.anims.hit, false);
    }
    return { guarded: blocked };
  }

  /** Quebra de postura: cancela o golpe em curso, reseta o poise e deixa o inimigo exposto. */
  private beginStagger(seconds: number): void {
    this.staggerTimer = seconds;
    this.poise = this.stats.poise;
    this.attack.cancel();
    this.attackUnblockable_ = false;
    this.hitHeroThisSwing = true; // garante que o golpe interrompido nao conecta
    this.shot = null;
    this.restoreEmissive();
    this.sm.to("cooldown");
    this.setAnim(this.anims.hit, false);
  }

  /** Volta o emissivo dos materiais à cor-base (após telegrafia de inquebrável / cambaleio). */
  private restoreEmissive(): void {
    for (let i = 0; i < this.mats.length; i++) this.mats[i]!.emissiveColor.copyFrom(this.matEmissive0[i]!);
  }

  update(combatDt: number, heroPos: Vector3): boolean {
    if (!this.loaded || !this.rootNode) return false;
    if (this.emergeTimer > 0) { this.emerge(combatDt); return false; } // ainda subindo do chão: não age
    this.hpBar?.update(combatDt);
    if (combatDt <= 0) return false;

    this.decayReactions(combatDt);
    this.clampPos(); // empurrão do knockback não joga o inimigo para fora do alcance

    // CAMBALEIO (poise quebrado): parado e exposto. Conta o tempo e não age.
    if (this.staggerTimer > 0) {
      this.staggerTimer = Math.max(0, this.staggerTimer - combatDt);
      return false;
    }
    // Postura regenera fora do ataque (volta a poder cambalear depois de um tempo).
    if (!this.sm.is("attacking") && this.poise < this.stats.poise) {
      this.poise = Math.min(this.stats.poise, this.poise + this.stats.poise * 0.4 * combatDt);
    }

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
      // TELEGRAFIA do golpe INQUEBRÁVEL: o inimigo "esquenta" em vermelho na antecipação.
      if (this.attackUnblockable_ && this.attack.current === "startup") {
        const r = 0.4 + 1.0 * this.attack.phaseProgress;
        for (let i = 0; i < this.mats.length; i++) {
          const e0 = this.matEmissive0[i]!;
          this.mats[i]!.emissiveColor.set(e0.r + r, e0.g, e0.b);
        }
      }
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
        if (this.attackUnblockable_) this.restoreEmissive(); // apaga a telegrafia vermelha
        this.attackUnblockable_ = false;
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
    // Coleira: nunca deixa o morto sair além de MAX_LEASH do spawn (evita o kite p/ fora
    // da sala -> inalcançável -> sala não limpa). Cobre recuo, aproximação e knockback.
    const lx = root.position.x - this.base.x;
    const lz = root.position.z - this.base.z;
    const ld = Math.hypot(lx, lz);
    if (ld > MAX_LEASH) {
      root.position.x = this.base.x + (lx / ld) * MAX_LEASH;
      root.position.z = this.base.z + (lz / ld) * MAX_LEASH;
    }
    // A coleira é um círculo em volta do spawn: não sabe que o ALTAR barra o herói. O clamp
    // por terreno (frente do altar + paredes) garante que o inimigo fique sempre alcançável.
    this.clampPos();
    return struck;
  }

  private startOverhead(dirX: number, dirZ: number): void {
    this.attackDir.set(dirX, 0, dirZ);
    this.hitHeroThisSwing = false;
    // Tipos pesados às vezes carregam um golpe INQUEBRÁVEL (ignora bloqueio; força esquiva).
    // Só melee inquebrável (ranged dispara projétil esquivável, sem conceito de bloqueio).
    this.attackUnblockable_ = !!this.stats.canUnblockable && (this.stats.behavior ?? "melee") !== "ranged" && Math.random() < UNBLOCKABLE_CHANCE;
    this.attack.start(this.stats.overhead);
    this.sm.to("attacking");
    this.setAnim(this.anims.attack, false);
    tellSound(this.attackUnblockable_ ? "unblock" : (this.stats.tellProfile ?? "basic"));
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
        if (this.contact) this.contact.scale = vis;
      }
      return;
    }
    const root = this.rootNode!;
    this.respawn = Math.max(0, this.respawn - dt);
    const k = this.respawn / RESPAWN_SEC;
    root.scaling.set(Math.max(0.05, k), Math.max(0.05, k), Math.max(0.05, k));
    if (this.contact) this.contact.scale = k;
    if (this.respawn === 0) this.revive();
  }

  private revive(): void {
    const root = this.rootNode!;
    this.health.reset();
    root.position.copyFrom(this.base);
    root.scaling.set(1, 1, 1);
    if (this.contact) this.contact.scale = 1;
    for (let i = 0; i < this.mats.length; i++) this.mats[i]!.emissiveColor.copyFrom(this.matEmissive0[i]!);
    this.knock.setAll(0);
    this.flash = 0;
    this.squash = 0;
    this.poise = this.stats.poise;
    this.staggerTimer = 0;
    this.attackUnblockable_ = false;
    this.hpBar?.set(1);
    this.sm.to("approach");
    this.currentAnim = null;
    this.setAnim(this.anims.awaken ?? this.anims.idle, false);
  }
}
