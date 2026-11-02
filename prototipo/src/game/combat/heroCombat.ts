import { TransformNode, Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { AttackState, Health, type CombatInputSource, type InputSource } from "@engine";
import { DRINK, HERO, type AttackTuning, type PotionKind } from "./tuning";
import { buildSword } from "../actors/weapons";

/**
 * CAMADA JOGO. Combate da Acendedora (M2.0 esqueleto + M2.1 acerto + M2.2 moveset/recursos).
 *
 * Verbos (graybox): ataque LEVE em combo de até 3 (a 3a com empurrão), ataque PESADO
 * (antecipação longa, custa stamina), ESQUIVA direcional com i-frames no miolo (custa
 * stamina) e BLOQUEIO (hold). Recursos: vida e stamina magra (só esquiva e pesado
 * consomem; spec-combate §3). O comprometimento é mantido: golpe iniciado não cancela; a
 * locomoção trava no golpe e é substituída por um dash na esquiva (ver Acendedora.update).
 *
 * Detecção de acerto fica no CombatDirector (lê canHit/weaponHitPoint/strikeTuning).
 * Visual GRAYBOX: "arma" caixa que faz o swing por rotação (sem rig/animação final).
 */
type State = "idle" | "attacking" | "dodging" | "ember" | "drinking";

/** Ações com buffer de entrada (toque guardado por HERO.inputBufferSec). */
const BUFFERED = ["attack", "heavy", "dodge", "ember"] as const;
type Buffered = (typeof BUFFERED)[number];

/**
 * Sincronia do clipe com a mecânica: o ator (Acendedora) passa isto ao HeroModel todo quadro,
 * que posiciona o clipe pelo estado do golpe (e não por um relógio próprio). `progress` 0..1 na
 * fase; `sec` = duração da fase. Assim o instante de contato do clipe cai na janela ativa e o
 * clipe congela junto com o hit stop.
 */
export interface ClipSync {
  kind: "light" | "finisher" | "heavy" | "ember" | "dodge";
  phase: "startup" | "active" | "recovery" | "dodge";
  progress: number;
  sec: number;
  /** Contador que muda a cada golpe/esquiva novo (reinicia o clipe numa cadeia leve-leve). */
  seq: number;
}

/** Estado do gole para o ator/modelo (pose do braço, frasco) e para o HUD. */
export interface DrinkInfo {
  kind: PotionKind;
  /** Segundos desde o começo do gesto (tempo de combate: congela no hit stop). */
  elapsed: number;
  sec: number;
  commitSec: number;
  /** A carga já foi gasta e o efeito aplicado (a partir de commitSec). */
  committed: boolean;
}

/** Por que o gole terminou antes do fim (o que não gastou a carga é "dodge", "reset", "death" e "gate"). */
export type DrinkCancel = "dodge" | "reset" | "death" | "gate";

/**
 * Ganchos do gole, ligados pelo app (o inventário e os efeitos moram lá). `commit` roda UMA vez em
 * DRINK.commitSec e devolve false se o efeito não pôde ser aplicado (a carga NÃO é gasta e o gole acaba).
 */
export interface DrinkHandlers {
  start?: (kind: PotionKind) => void;
  commit: (kind: PotionKind) => boolean;
  cancel?: (kind: PotionKind, reason: DrinkCancel) => void;
}

// Ângulos do swing (rad), em torno do eixo X do pivô na "mão".
const REST = 0.5;
const WINDUP = -1.2;
const STRIKE = 1.3;
const GUARD = -0.2; // pose de bloqueio (lâmina/escudo erguido à frente)
const PARRY_WINDOW_SEC = 0.18; // janela de deflect ao iniciar o bloqueio (ref. Sekiro ~200ms)
const BLOCK_DRAIN_PER_SEC = 12; // stamina escorre enquanto a guarda fica erguida (Tier 3)
const BLOCK_CHIP_FRAC = 0.5; // aparar um golpe custa esta fração do dano em STAMINA (chip)
const GUARD_BREAK_SEC = 0.5; // cambaleio do herói ao esvaziar a stamina bloqueando

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class HeroCombat {
  readonly health = new Health(HERO.maxHealth);

  private readonly attack = new AttackState();
  private readonly pivot: TransformNode;
  private readonly hitNode: TransformNode; // ponto de acerto à frente, na altura do torso

  private state: State = "idle";
  private activeTuning: AttackTuning = HERO.light;
  private hitConsumed = false;
  private blocking = false;
  private wasBlocking_ = false; // borda do bloqueio (para abrir a janela de parry)
  private parryTimer_ = 0; // janela de parry restante (deflect de projétil)

  // Combo de leves.
  private comboStep = 0; // 0,1 = leve; 2 = finalizadora
  private comboQueued = false;
  private comboLive = false; // o último golpe foi um leve (não a finalizadora): o próximo toque continua o combo
  private isLightChain = false;
  private idleTime = 0;
  private seq = 0; // novo golpe/esquiva/fogo: reinicia o clipe
  // Buffer de entrada (s restantes, em tempo de jogo) por ação.
  private readonly buf: Record<Buffered, number> = { attack: 0, heavy: 0, dodge: 0, ember: 0 };
  // Se um passo grande (hitch) atravessou a janela ativa inteira, o acerto vale neste quadro.
  private skippedActive_ = false;
  private skippedEmber_ = false;

  // Gole (poção): pedido guardado no buffer, estado do gesto e ganchos do app.
  private bufDrink = 0;
  private bufDrinkKind: PotionKind = "vida";
  private drinkKind: PotionKind = "vida";
  private drinkElapsed = 0;
  private drinkCommitted = false;
  private drinkHandlers: DrinkHandlers | null = null;

  // Stamina.
  private stamina: number = HERO.maxStamina;
  private regenDelay = 0;
  private guardBreakTimer = 0; // > 0: herói cambaleando (guard break), não age e fica vulnerável

  // Fagulha (recurso de fogo) em CARGAS (0..charges, fracionario durante a regeneracao) +
  // estado do golpe de fogo (ember). 1 carga por Golpe de Fogo (W6).
  private spark: number = HERO.spark.charges;
  private emberConsumed = false;

  // Esquiva. Objeto mutável (os eixos mudam por esquiva); InputSource tem eixos readonly.
  private dodgeElapsed = 0;
  private perfectConsumed_ = false; // já recompensou a esquiva perfeita neste rolamento?
  private readonly dodgeMove = { forward: 0, strafe: 0, running: true, consumeJump: () => false };

  // Dano recebido escalado pela dificuldade (criação de personagem); 1 = Normal.
  private damageTakenMul = 1;
  // Modificadores de UPGRADE (dádivas da Brasa adquiridas entre andares).
  private dmgMul = 1;
  private extraReach_ = 0;
  private lifesteal_ = 0; // fração do dano causado que vira vida (dádiva "Sede da Brasa")
  // Buff de dano TEMPORIZADO (Elixir de Fúria): soma ao dmgMul enquanto o timer corre.
  private buffMul = 0;
  private buffTimer = 0;

  // --- W2: árvore de dádivas (ramos Agressão/Defesa/Utilidade) ---
  private burnDurationBonus_ = 0; // Queimador: +segundos na Queimadura aplicada pelo ember
  private burnStackBonus_ = 0; // Queimador: +stacks máximos de Queimadura
  private damageCap_ = 0; // Revestimento: dano recebido acima disto é cortado para isto (0 = sem cap)
  private sparkRegenMul_ = 1; // Fagulha Perene: multiplica a regeneração de Fagulha
  private maxStamina_ = HERO.maxStamina; // Fôlego: stamina máxima (mutável)
  private lightRadiusBonus_ = 0; // Luz da Acendedora: +raio de luz (lido pela sala/iluminação)
  private brazierHealFrac_ = 0.4; // Braseiro Quente: fração curada ao acender (base 0.25)
  // Ressonância: acertos encadeados sem apanhar dão dano crescente; zera ao tomar dano.
  private resonanceOn_ = false;
  private hitStreak_ = 0;

  constructor(scene: Scene, parent: TransformNode) {
    this.pivot = new TransformNode("weaponPivot", scene);
    this.pivot.parent = parent;
    this.pivot.position.set(0.35, 1.1, 0.2);
    this.pivot.rotation.x = REST;

    // Arma graybox desativada: o herói KayKit (Mage) tem a propria malha/cajado e agora
    // toca animacao de ataque real (ver HeroModel.setAction). Mantida desabilitada para
    // nao remover o pivo/poseWeapon que ainda servem de fallback.
    const sword = buildSword(scene);
    sword.parent = this.pivot;
    sword.setEnabled(false);

    // Ponto de acerto: à FRENTE do herói (não na ponta alta da lâmina), na altura do torso.
    // Desacopla a detecção do swing visual -> golpear fica confiável quando se está de frente
    // e perto (resolve "não está claro como eu acerto"). Parentado na raiz (não no pivô que gira).
    this.hitNode = new TransformNode("heroHitPoint", scene);
    this.hitNode.parent = parent;
    this.hitNode.position.set(0, 0.2, 1.0);
  }

  // --- estado para Acendedora / HUD / CombatDirector ---

  /** Trava a locomoção? (golpe melee ou conjuração de fogo). Esquiva NÃO trava: usa moveOverride. */
  get busy(): boolean {
    return this.state === "attacking" || this.state === "ember";
  }

  /** Está conjurando o golpe de fogo? (o ator escolhe a animação de cast). */
  get casting(): boolean {
    return this.state === "ember";
  }

  /**
   * Em ANTECIPAÇÃO de um golpe (windup, antes do ativo). O ator usa isto para reorientar
   * a heroína para onde a câmera olha: a hitbox fica à frente do modelo, então sem isso o
   * golpe de frente erraria (o modelo só gira na direção do movimento). Trava ao ficar ativo.
   */
  get aiming(): boolean {
    return this.busy && this.attack.current === "startup";
  }

  /** Fração da Fagulha (0..1) para a luz/efeitos. */
  get sparkFraction(): number {
    return this.spark / HERO.spark.charges;
  }

  /** Cargas de Fagulha atuais (float 0..charges; o HUD usa o piso para os pips cheios). */
  get sparkCharges(): number {
    return this.spark;
  }

  /** Número máximo de cargas de Fagulha (pips no HUD). */
  get sparkChargeMax(): number {
    return HERO.spark.charges;
  }

  /** Janela ativa do golpe de fogo: o CombatDirector resolve a área UMA vez. */
  get canEmber(): boolean {
    return this.state === "ember" && (this.attack.isActive || this.skippedEmber_) && !this.emberConsumed;
  }

  get emberTuning(): typeof HERO.ember {
    return HERO.ember;
  }

  markEmber(): void {
    this.emberConsumed = true;
  }

  /** Recarrega a Fagulha (ao entrar numa sala / acender o braseiro). */
  refillSpark(): void {
    this.spark = HERO.spark.charges;
  }

  /** Recompensa do PARRY de melee: devolve stamina e libera a regeneração (aparar mantém a ofensiva). */
  rewardParry(): void {
    this.stamina = Math.min(this.maxStamina_, this.stamina + 30);
    this.regenDelay = 0;
  }

  /** Ganha cargas de Fagulha (ao matar um morto desperto): mantem o fogo "vivo" na turba. */
  gainSparkCharge(n = 1): void {
    this.spark = Math.min(HERO.spark.charges, this.spark + n);
  }

  /** Cura uma fração da vida máxima (respiro ao acender o braseiro). */
  healByMax(frac: number): void {
    this.health.heal(this.health.max * frac);
  }

  /** Input de movimento sintético durante a esquiva (dash), ou null. */
  get moveOverride(): InputSource | null {
    return this.state === "dodging" ? this.dodgeMove : null;
  }

  /** Janela em que o golpe causa dano e ainda não acertou neste swing. */
  get canHit(): boolean {
    return ((this.state === "attacking" && this.attack.isActive) || this.skippedActive_) && !this.hitConsumed;
  }

  /** Em golpe corpo a corpo, na janela ativa (o giro da lâmina). */
  get swingActive(): boolean {
    return this.state === "attacking" && this.attack.isActive;
  }

  /** Dados para o ator sincronizar o clipe com a mecânica (null fora de golpe/esquiva/fogo). */
  get clipSync(): ClipSync | null {
    if (this.state === "dodging") {
      const d = HERO.dodge.durationSec;
      return { kind: "dodge", phase: "dodge", progress: Math.min(1, this.dodgeElapsed / d), sec: d, seq: this.seq };
    }
    if (this.state !== "attacking" && this.state !== "ember") return null;
    const ph = this.attack.current;
    if (ph === "idle") return null;
    const t = this.state === "ember" ? HERO.ember : this.activeTuning;
    const kind = this.state === "ember" ? "ember" : this.activeTuning === HERO.heavy ? "heavy" : this.comboStep >= 2 && this.isLightChain ? "finisher" : "light";
    return { kind, phase: ph, progress: this.attack.phaseProgress, sec: t[ph], seq: this.seq };
  }

  /**
   * Velocidade de avanço (m/s, ao longo do que o herói encara) do lunge do golpe corrente: do
   * meio da antecipação até o fim da janela ativa. O ator limita pela distância ao alvo.
   */
  get lungeSpeed(): number {
    if (this.state !== "attacking") return 0;
    const t = this.activeTuning;
    if (!t.lunge) return 0;
    const ph = this.attack.current;
    const early = ph === "startup" && this.attack.phaseProgress >= 0.3;
    if (!early && ph !== "active") return 0;
    return t.lunge / (t.startup * 0.7 + t.active);
  }

  /** Distância total do lunge do golpe corrente (m). */
  get lungeDistance(): number {
    return this.state === "attacking" ? (this.activeTuning.lunge ?? 0) : 0;
  }

  get strikeTuning(): AttackTuning {
    return this.activeTuning;
  }

  /** O golpe em andamento é o pesado? (o ator escolhe a animação certa). */
  get heavyAttack(): boolean {
    return this.activeTuning === HERO.heavy;
  }

  /** i-frames: invulnerável no MIOLO do rolamento (vulnerável no início e no fim). */
  get invulnerable(): boolean {
    return (
      this.state === "dodging" &&
      this.dodgeElapsed >= HERO.dodge.iframeStartSec &&
      this.dodgeElapsed <= HERO.dodge.iframeEndSec
    );
  }

  get isBlocking(): boolean {
    return this.blocking;
  }

  /**
   * ESQUIVA PERFEITA: um golpe anulado pelos i-frames na JANELA INICIAL do rolamento (você
   * esquivou no último instante) recompensa uma vez. Consome o crédito (uma por rolamento).
   */
  consumePerfectDodge(): boolean {
    const start = HERO.dodge.iframeStartSec;
    const inWindow = this.state === "dodging" && this.dodgeElapsed >= start && this.dodgeElapsed <= start + 0.12;
    if (!inWindow || this.perfectConsumed_) return false;
    this.perfectConsumed_ = true;
    return true;
  }

  /** Janela de parry ativa (bloqueio recém-iniciado): bloqueio frontal DEVOLVE o projétil. */
  get parryActive(): boolean {
    return this.blocking && this.parryTimer_ > 0;
  }

  get healthFraction(): number {
    return this.health.fraction;
  }
  get staminaFraction(): number {
    return this.stamina / this.maxStamina_;
  }

  setDamageTakenMultiplier(mul: number): void {
    this.damageTakenMul = mul > 0 ? mul : 1;
  }

  // --- Upgrades (dádivas da Brasa) ---
  /** Multiplicador de dano causado (lido pelo CombatDirector). Inclui buff temporário e Ressonância. */
  get damageMul(): number {
    const resonance = this.resonanceOn_ ? Math.min(0.3, this.hitStreak_ * 0.06) : 0;
    return this.dmgMul + (this.buffTimer > 0 ? this.buffMul : 0) + resonance;
  }
  /** Queimadura aplicada pelo ember: duração e stacks extra das dádivas (lido pelo CombatDirector). */
  get burnDurationBonus(): number {
    return this.burnDurationBonus_;
  }
  get burnStackBonus(): number {
    return this.burnStackBonus_;
  }
  /** +raio de luz por dádiva (lido pela sala ao acender o braseiro). */
  get lightRadiusBonus(): number {
    return this.lightRadiusBonus_;
  }
  /** Fração curada ao acender o braseiro (Braseiro Quente sobe de 0.25 para 0.5). */
  get brazierHealFrac(): number {
    return this.brazierHealFrac_;
  }
  /** Fração do dano que vira vida no acerto (0 = sem roubo de vida). */
  get lifesteal(): number {
    return this.lifesteal_;
  }
  /** Pode beber poção agora? (fora de golpe/conjuração; idle ou aproximação). */
  get canDrink(): boolean {
    return this.state === "idle";
  }
  /** Liga os ganchos do gole (o app aplica o efeito e gasta a carga em `commit`). */
  setDrinkHandlers(h: DrinkHandlers): void {
    this.drinkHandlers = h;
  }
  /**
   * Pede um gole. Fica no buffer de entrada (HERO.inputBufferSec) e começa quando o herói abre a ação
   * (fim do golpe, ponto de cancelamento). Ignorado durante outro gole, na guarda quebrada e morto.
   * Quem chama já validou carga e vida (o app); a carga só é gasta no `commit`.
   */
  requestDrink(kind: PotionKind): boolean {
    if (this.state === "drinking" || this.guardBreakTimer > 0 || this.health.current <= 0) return false;
    this.bufDrink = HERO.inputBufferSec;
    this.bufDrinkKind = kind;
    return true;
  }
  /** Bebendo agora (janela vulnerável de DRINK.durationSec). NÃO trava a locomoção: ver `moveScale`. */
  get drinking(): boolean {
    return this.state === "drinking";
  }
  /** Dados do gole em andamento (null fora dele). */
  get drinkInfo(): DrinkInfo | null {
    if (this.state !== "drinking") return null;
    return { kind: this.drinkKind, elapsed: this.drinkElapsed, sec: DRINK.durationSec, commitSec: DRINK.commitSec, committed: this.drinkCommitted };
  }
  /** Fração da velocidade de locomoção permitida agora (lentidão do gole). */
  get moveScale(): number {
    return this.state === "drinking" ? DRINK.moveMul : 1;
  }
  /** O Elixir de Fúria está ativo? (a arma brilha e o slot do HUD pulsa). */
  get buffActive(): boolean {
    return this.buffTimer > 0;
  }
  /** Aborta o gole sem gastar a carga (se ainda não foi gasta): troca de sala, morte, reset. */
  cancelDrink(reason: DrinkCancel): void {
    this.bufDrink = 0;
    if (this.state !== "drinking") return;
    const kind = this.drinkKind;
    const committed = this.drinkCommitted;
    this.state = "idle";
    if (!committed) this.drinkHandlers?.cancel?.(kind, reason);
  }
  /** Ressonância: a dádiva está ativa? (para o HUD mostrar o streak). */
  get resonanceActive(): boolean {
    return this.resonanceOn_;
  }
  /** Ressonância: acertos encadeados sem apanhar (0..5; zera ao apanhar). */
  get resonanceStreak(): number {
    return this.hitStreak_;
  }
  /** Elixir de Fúria: soma um multiplicador de dano por uma duração. */
  applyDamageBuff(mul: number, seconds: number): void {
    this.buffMul = mul;
    this.buffTimer = seconds;
  }
  /** Soma roubo de vida (dádiva "Sede da Brasa"). */
  addLifesteal(frac: number): void {
    this.lifesteal_ += frac;
  }
  /** Cura ao conectar um golpe (chamado pelo CombatDirector se houver roubo de vida). */
  lifestealHeal(damageDealt: number): void {
    if (this.lifesteal_ > 0) this.health.heal(damageDealt * this.lifesteal_);
  }
  /** Cura uma quantidade absoluta de vida (essência coletada / poção). */
  heal(amount: number): void {
    if (amount > 0) this.health.heal(amount);
  }
  /** Vida máxima atual (para curar por fração na poção). */
  get maxHealth(): number {
    return this.health.max;
  }
  /** Alcance extra do golpe (somado ao raio da hitbox no CombatDirector). */
  get extraReach(): number {
    return this.extraReach_;
  }
  addDamageMul(f: number): void {
    this.dmgMul += f;
  }
  addReach(r: number): void {
    this.extraReach_ += r;
  }
  /** Aumenta a vida máxima e cura (dádiva de vigor). */
  addMaxHealth(n: number): void {
    this.health.raiseMax(n);
  }
  // --- W2: dádivas da árvore ---
  /** Queimador: Queimadura do ember dura +seconds e ganha +stacks. */
  addBurnBoost(seconds: number, stacks: number): void {
    this.burnDurationBonus_ += seconds;
    this.burnStackBonus_ += stacks;
  }
  /** Revestimento: dano recebido acima de `cap` é cortado para `cap`. */
  setDamageCap(cap: number): void {
    this.damageCap_ = cap;
  }
  /** Fagulha Perene: multiplica a regeneração de Fagulha. */
  addSparkRegenMul(factor: number): void {
    this.sparkRegenMul_ *= factor;
  }
  /** Fôlego: aumenta a stamina máxima (e enche). */
  addMaxStamina(n: number): void {
    this.maxStamina_ += n;
    this.stamina = this.maxStamina_;
  }
  /** Luz da Acendedora: +raio de luz (a sala lê ao acender). */
  addLightRadius(m: number): void {
    this.lightRadiusBonus_ += m;
  }
  /** Braseiro Quente: define a fração curada ao acender o braseiro. */
  setBrazierHealFrac(frac: number): void {
    this.brazierHealFrac_ = frac;
  }
  /** Ressonância: liga o dano crescente por acertos encadeados. */
  enableResonance(): void {
    this.resonanceOn_ = true;
  }

  weaponHitPoint(): Vector3 {
    this.hitNode.computeWorldMatrix(true);
    return this.hitNode.getAbsolutePosition().clone();
  }

  markHit(): void {
    this.hitConsumed = true;
    if (this.resonanceOn_) this.hitStreak_ = Math.min(5, this.hitStreak_ + 1); // Ressonância sobe (cap +30%)
  }

  /**
   * Recebe dano (inimigos, M2.3). i-frames da esquiva anulam (applied=false); bloqueio
   * reduz. `applied` diz se a vida foi tocada (para vinheta/shake/som de dano).
   */
  takeDamage(amount: number, unblockable = false): { applied: boolean; died: boolean; guardBroken: boolean } {
    if (this.invulnerable || amount <= 0) return { applied: false, died: false, guardBroken: false };
    // Bloqueio efetivo? Inquebrável ignora a guarda. Aparar custa STAMINA (chip); sem stamina,
    // GUARD BREAK: o golpe passa cheio e o herói cambaleia (Tier 3).
    let blocking = this.blocking && !unblockable;
    let guardBroken = false;
    if (blocking) {
      const chip = amount * BLOCK_CHIP_FRAC;
      if (this.stamina >= chip) {
        this.stamina -= chip;
        this.regenDelay = HERO.staminaRegenDelaySec;
      } else {
        this.stamina = 0;
        this.beginGuardBreak();
        blocking = false; // guarda quebrou: dano cheio
        guardBroken = true;
      }
    }
    const blockMul = blocking ? 0.25 : 1;
    let dmg = amount * this.damageTakenMul * blockMul;
    if (this.damageCap_ > 0 && dmg > this.damageCap_) dmg = this.damageCap_; // Revestimento
    this.hitStreak_ = 0; // apanhar zera a Ressonância
    const { died } = this.health.damage(dmg);
    return { applied: true, died, guardBroken };
  }

  /** GUARD BREAK: stamina zerou bloqueando. O herói cambaleia (não age) por um instante. */
  private beginGuardBreak(): void {
    this.cancelDrink("reset");
    this.guardBreakTimer = GUARD_BREAK_SEC;
    this.blocking = false;
    this.comboStep = 0;
    this.comboLive = false;
    this.state = "idle";
  }

  /** Revive o herói com vida cheia (M2.3 graybox: respawn após morrer, sem GameOver ainda). */
  revive(): void {
    this.cancelDrink("reset");
    this.health.reset();
    this.state = "idle";
    this.stamina = this.maxStamina_;
    this.hitStreak_ = 0;
    this.guardBreakTimer = 0;
  }

  /** Zera todos os upgrades/dádivas (jogo novo): volta o herói ao estado-base. */
  resetUpgrades(): void {
    this.cancelDrink("reset");
    this.dmgMul = 1;
    this.extraReach_ = 0;
    this.lifesteal_ = 0;
    this.buffMul = 0;
    this.buffTimer = 0;
    this.health.setMax(HERO.maxHealth);
    // W2: zera as dádivas da árvore.
    this.burnDurationBonus_ = 0;
    this.burnStackBonus_ = 0;
    this.damageCap_ = 0;
    this.sparkRegenMul_ = 1;
    this.maxStamina_ = HERO.maxStamina;
    this.lightRadiusBonus_ = 0;
    this.brazierHealFrac_ = 0.4;
    this.resonanceOn_ = false;
    this.hitStreak_ = 0;
  }

  // --- loop ---

  update(deltaSeconds: number, input: CombatInputSource): void {
    this.skippedActive_ = false;
    this.skippedEmber_ = false;
    this.pollInput(deltaSeconds, input);
    this.regenStamina(deltaSeconds);
    this.regenSpark(deltaSeconds);
    if (this.buffTimer > 0) this.buffTimer = Math.max(0, this.buffTimer - deltaSeconds);

    // GUARD BREAK (Tier 3): a guarda quebrou (stamina zerou bloqueando). O herói cambaleia:
    // não aceita inputs de combate por um instante (pode andar). A guarda fica caída.
    if (this.guardBreakTimer > 0) {
      this.guardBreakTimer = Math.max(0, this.guardBreakTimer - deltaSeconds);
      for (const a of BUFFERED) this.buf[a] = 0;
      this.blocking = false;
      this.state = "idle";
      this.poseWeapon();
      return;
    }

    // Janela de PARRY: ao INICIAR o bloqueio, abre ~0,18 s em que o bloqueio frontal DEVOLVE
    // o projétil (deflect), em vez de só pará-lo. Spam de bloqueio não renova (precisa soltar).
    const blockingNow = input.isHeld("block");
    if (blockingNow && !this.wasBlocking_) this.parryTimer_ = PARRY_WINDOW_SEC;
    else if (this.parryTimer_ > 0) this.parryTimer_ = Math.max(0, this.parryTimer_ - deltaSeconds);
    this.wasBlocking_ = blockingNow;

    switch (this.state) {
      case "dodging":
        this.updateDodge(deltaSeconds, input);
        break;
      case "attacking":
        this.updateAttacking(deltaSeconds, input);
        break;
      case "ember":
        this.updateEmber(deltaSeconds, input);
        break;
      case "drinking":
        this.updateDrink(deltaSeconds, input);
        break;
      default:
        this.updateIdle(deltaSeconds, input);
    }

    this.poseWeapon();
  }

  /**
   * Lê os toques do quadro para o buffer de entrada (HERO.inputBufferSec). Roda em TODOS os
   * estados: um toque dado durante o golpe/esquiva fica guardado e dispara quando a ação abre
   * (fim do golpe ou ponto de cancelamento), sem latência extra e sem vazar para depois.
   */
  private pollInput(dt: number, input: CombatInputSource): void {
    for (const a of BUFFERED) {
      if (input.consumePressed(a)) {
        this.buf[a] = HERO.inputBufferSec;
        // Qualquer toque de ataque durante um leve enfileira o próximo elo (como antes).
        if (a === "attack" && this.state === "attacking" && this.isLightChain) this.comboQueued = true;
      } else if (this.buf[a] > 0) {
        this.buf[a] = Math.max(0, this.buf[a] - dt);
      }
    }
    if (this.bufDrink > 0) this.bufDrink = Math.max(0, this.bufDrink - dt);
  }

  private anyBuffered(): boolean {
    return this.buf.attack > 0 || this.buf.heavy > 0 || this.buf.dodge > 0 || this.buf.ember > 0;
  }

  /** Dispara a ação guardada de maior prioridade (esquiva > pesado > fogo > leve). Falta de recurso descarta o toque. */
  private tryBuffered(input: CombatInputSource): boolean {
    if (this.buf.dodge > 0) {
      this.buf.dodge = 0;
      if (this.spend(HERO.dodge.staminaCost)) {
        this.startDodge(input);
        return true;
      }
    }
    if (this.bufDrink > 0) {
      this.bufDrink = 0;
      this.beginDrink(this.bufDrinkKind);
      return true;
    }
    if (this.buf.heavy > 0) {
      this.buf.heavy = 0;
      if (this.spend(HERO.heavy.staminaCost ?? 0)) {
        this.isLightChain = false;
        this.comboLive = false;
        this.beginAttack(HERO.heavy);
        return true;
      }
    }
    if (this.buf.ember > 0) {
      this.buf.ember = 0;
      if (this.spark >= HERO.spark.emberCost) {
        this.beginEmber();
        return true;
      }
    }
    if (this.buf.attack > 0) {
      this.buf.attack = 0;
      // Toque dentro da janela do combo continua a cadeia (leve -> leve -> finalizadora).
      if (this.comboLive && this.comboStep < 2 && this.idleTime <= HERO.comboResetSec) this.comboStep += 1;
      else this.comboStep = 0;
      this.isLightChain = true;
      this.beginAttack(this.comboStep >= 2 ? HERO.lightFinisher : HERO.light);
      return true;
    }
    return false;
  }

  /**
   * Cancelamento da RECUPERAÇÃO (golpe/fogo): a partir de `cancelAt` da recuperação, esquiva
   * guardada ou bloqueio segurado interrompem o golpe. O comprometimento (antecipação e ativo)
   * continua intacto. Retorna true se cancelou.
   */
  private tryRecoveryCancel(input: CombatInputSource, cancelAt: number | undefined): boolean {
    if (cancelAt === undefined || this.attack.current !== "recovery" || this.attack.phaseProgress < cancelAt) return false;
    if (this.buf.dodge > 0) {
      this.buf.dodge = 0;
      if (this.spend(HERO.dodge.staminaCost)) {
        this.attack.cancel();
        this.startDodge(input);
        return true;
      }
    }
    if (input.isHeld("block")) {
      this.attack.cancel();
      this.endAction(input);
      return true;
    }
    return false;
  }

  /** Volta a idle e já processa o que estiver guardado/segurado (sem esperar o próximo quadro). */
  private endAction(input: CombatInputSource): void {
    this.state = "idle";
    this.idleTime = 0;
    this.isLightChain = false;
    this.updateIdle(0, input);
  }

  private updateIdle(dt: number, input: CombatInputSource): void {
    this.idleTime += dt;
    if (this.idleTime > HERO.comboResetSec) {
      this.comboStep = 0;
      this.comboLive = false;
    }
    this.blocking = input.isHeld("block");
    // Tier 3: segurar a guarda DRENA stamina; ao esvaziar, GUARD BREAK (cambaleia).
    if (this.blocking) {
      this.stamina -= BLOCK_DRAIN_PER_SEC * dt;
      this.regenDelay = HERO.staminaRegenDelaySec;
      if (this.stamina <= 0) this.beginGuardBreak();
    }
    this.tryBuffered(input);
  }

  private updateAttacking(dt: number, input: CombatInputSource): void {
    const wasBusy = this.attack.isBusy;
    const before = this.attack.current;
    this.attack.advance(dt);
    // Um passo grande pode atravessar a janela ativa inteira (hitch): o acerto vale neste quadro.
    if (before === "startup" && this.attack.current !== "startup" && this.attack.current !== "active") this.skippedActive_ = true;

    if (wasBusy && !this.attack.isBusy) {
      // Golpe terminou: encadeia ou volta a idle (já consumindo o buffer neste quadro).
      if (this.isLightChain && this.comboQueued && this.comboStep < 2) {
        this.comboStep += 1;
        this.beginAttack(this.comboStep >= 2 ? HERO.lightFinisher : HERO.light);
      } else {
        // Terminou um leve (não a finalizadora): o combo continua vivo por comboResetSec.
        this.comboLive = this.isLightChain && this.comboStep < 2;
        this.endAction(input);
      }
      return;
    }
    this.tryRecoveryCancel(input, this.activeTuning.cancelAt);
  }

  private updateDodge(dt: number, input: CombatInputSource): void {
    this.dodgeElapsed += dt;
    if (this.dodgeElapsed >= HERO.dodge.durationSec) {
      this.endAction(input);
    } else if (this.dodgeElapsed >= HERO.dodge.cancelSec && this.anyBuffered()) {
      // Fim da esquiva já passou dos i-frames: ataque/esquiva guardados cancelam o resto do rolamento.
      this.endAction(input);
    }
  }

  private beginEmber(): void {
    this.spark = Math.max(0, this.spark - HERO.spark.emberCost);
    this.emberConsumed = false;
    this.blocking = false;
    this.comboStep = 0;
    this.comboLive = false;
    this.seq++;
    this.state = "ember";
    this.attack.start(HERO.ember);
  }

  private updateEmber(dt: number, input: CombatInputSource): void {
    const wasBusy = this.attack.isBusy;
    const before = this.attack.current;
    this.attack.advance(dt);
    if (before === "startup" && this.attack.current !== "startup" && this.attack.current !== "active") this.skippedEmber_ = true;
    if (wasBusy && !this.attack.isBusy) {
      this.endAction(input);
      return;
    }
    this.tryRecoveryCancel(input, HERO.ember.cancelAt);
  }

  private beginDrink(kind: PotionKind): void {
    this.drinkKind = kind;
    this.drinkElapsed = 0;
    this.drinkCommitted = false;
    this.blocking = false;
    this.comboStep = 0;
    this.comboLive = false;
    this.isLightChain = false;
    this.seq++;
    this.state = "drinking";
    this.drinkHandlers?.start?.(kind);
  }

  /**
   * Gole: janela vulnerável. Leve, pesado, fogo e bloqueio ficam fora (o buffer segue valendo e dispara no
   * fim); só a esquiva cancela (antes de DRINK.commitSec sem gastar a carga). A carga e o efeito saem em commitSec.
   */
  private updateDrink(dt: number, input: CombatInputSource): void {
    if (this.health.current <= 0) {
      this.cancelDrink("death");
      return;
    }
    this.drinkElapsed += dt;
    this.blocking = false;
    if (this.buf.dodge > 0) {
      this.buf.dodge = 0;
      if (this.spend(HERO.dodge.staminaCost)) {
        const early = !this.drinkCommitted;
        const kind = this.drinkKind;
        this.state = "idle"; // o startDodge assume o estado; a carga só foi gasta se já passou do commit
        if (early) this.drinkHandlers?.cancel?.(kind, "dodge");
        this.startDodge(input);
        return;
      }
    }
    if (!this.drinkCommitted && this.drinkElapsed >= DRINK.commitSec) {
      this.drinkCommitted = true;
      if (this.drinkHandlers && !this.drinkHandlers.commit(this.drinkKind)) {
        this.drinkCommitted = false; // não aplicou: nada foi gasto
        this.cancelDrink("gate");
        return;
      }
    }
    if (this.drinkElapsed >= DRINK.durationSec) this.endAction(input);
  }

  private regenSpark(dt: number): void {
    if (this.spark < HERO.spark.charges) {
      this.spark = Math.min(HERO.spark.charges, this.spark + HERO.spark.regenPerSec * this.sparkRegenMul_ * dt);
    }
  }

  private beginAttack(tuning: AttackTuning): void {
    this.activeTuning = tuning;
    this.hitConsumed = false;
    this.comboQueued = false;
    this.blocking = false;
    this.seq++;
    this.state = "attacking";
    this.attack.start(tuning);
  }

  private startDodge(input: CombatInputSource): void {
    // Direção capturada no início (relativa à câmera, como o movimento); sem input = recuo.
    let f = input.forward;
    let s = input.strafe;
    if (f === 0 && s === 0) f = -1;
    this.dodgeMove.forward = f;
    this.dodgeMove.strafe = s;
    this.dodgeElapsed = 0;
    this.perfectConsumed_ = false; // novo rolamento: rearma a esquiva perfeita
    this.blocking = false;
    this.comboStep = 0;
    this.comboLive = false;
    this.seq++;
    this.state = "dodging";
  }

  private spend(cost: number): boolean {
    if (this.stamina < cost) return false;
    this.stamina -= cost;
    this.regenDelay = HERO.staminaRegenDelaySec;
    return true;
  }

  private regenStamina(dt: number): void {
    if (this.regenDelay > 0) {
      this.regenDelay = Math.max(0, this.regenDelay - dt);
      return;
    }
    if (this.stamina < this.maxStamina_) {
      this.stamina = Math.min(this.maxStamina_, this.stamina + HERO.staminaRegenPerSec * dt);
    }
  }

  private poseWeapon(): void {
    // Variedade visual do combo: alterna o lado a cada golpe (graybox).
    const side = this.comboStep % 2 === 0 ? 1 : -1;
    let angleX = REST;
    let angleZ = 0;

    if (this.state === "attacking") {
      const p = this.attack.phaseProgress;
      switch (this.attack.current) {
        case "startup":
          angleX = lerp(REST, WINDUP, p);
          break;
        case "active":
          angleX = lerp(WINDUP, STRIKE, p);
          angleZ = 0.5 * side * (1 - p);
          break;
        case "recovery":
          angleX = lerp(STRIKE, REST, p);
          break;
      }
    } else if (this.state === "dodging") {
      angleX = REST + 0.3; // recolhe a arma no rolamento
    } else if (this.blocking) {
      angleX = GUARD; // guarda erguida
    }

    this.pivot.rotation.x = angleX;
    this.pivot.rotation.z = angleZ;
  }
}
