import { TransformNode, Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { AttackState, Health, type CombatInputSource, type InputSource } from "@engine";
import { HERO, type AttackTuning } from "./tuning";
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
type State = "idle" | "attacking" | "dodging" | "ember";

// Ângulos do swing (rad), em torno do eixo X do pivô na "mão".
const REST = 0.5;
const WINDUP = -1.2;
const STRIKE = 1.3;
const GUARD = -0.2; // pose de bloqueio (lâmina/escudo erguido à frente)

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

  // Combo de leves.
  private comboStep = 0; // 0,1 = leve; 2 = finalizadora
  private comboQueued = false;
  private isLightChain = false;
  private idleTime = 0;

  // Stamina.
  private stamina: number = HERO.maxStamina;
  private regenDelay = 0;

  // Fagulha (recurso de fogo) + estado do golpe de fogo (ember).
  private spark: number = HERO.spark.max;
  private emberConsumed = false;

  // Esquiva. Objeto mutável (os eixos mudam por esquiva); InputSource tem eixos readonly.
  private dodgeElapsed = 0;
  private readonly dodgeMove = { forward: 0, strafe: 0, running: true, consumeJump: () => false };

  // Dano recebido escalado pela dificuldade (criação de personagem); 1 = Normal.
  private damageTakenMul = 1;
  // Modificadores de UPGRADE (dádivas da Brasa adquiridas entre andares).
  private dmgMul = 1;
  private extraReach_ = 0;

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

  /** Fração da Fagulha (0..1) para o HUD. */
  get sparkFraction(): number {
    return this.spark / HERO.spark.max;
  }

  /** Janela ativa do golpe de fogo: o CombatDirector resolve a área UMA vez. */
  get canEmber(): boolean {
    return this.state === "ember" && this.attack.isActive && !this.emberConsumed;
  }

  get emberTuning(): typeof HERO.ember {
    return HERO.ember;
  }

  markEmber(): void {
    this.emberConsumed = true;
  }

  /** Recarrega a Fagulha (ao entrar numa sala / acender o braseiro). */
  refillSpark(): void {
    this.spark = HERO.spark.max;
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
    return this.state === "attacking" && this.attack.isActive && !this.hitConsumed;
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

  get healthFraction(): number {
    return this.health.fraction;
  }
  get staminaFraction(): number {
    return this.stamina / HERO.maxStamina;
  }

  setDamageTakenMultiplier(mul: number): void {
    this.damageTakenMul = mul > 0 ? mul : 1;
  }

  // --- Upgrades (dádivas da Brasa) ---
  /** Multiplicador de dano causado (lido pelo CombatDirector). */
  get damageMul(): number {
    return this.dmgMul;
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

  weaponHitPoint(): Vector3 {
    this.hitNode.computeWorldMatrix(true);
    return this.hitNode.getAbsolutePosition().clone();
  }

  markHit(): void {
    this.hitConsumed = true;
  }

  /**
   * Recebe dano (inimigos, M2.3). i-frames da esquiva anulam (applied=false); bloqueio
   * reduz. `applied` diz se a vida foi tocada (para vinheta/shake/som de dano).
   */
  takeDamage(amount: number): { applied: boolean; died: boolean } {
    if (this.invulnerable || amount <= 0) return { applied: false, died: false };
    const blockMul = this.blocking ? 0.25 : 1; // bloqueio reduz dano frontal (parry exato fica p/ depois)
    const { died } = this.health.damage(amount * this.damageTakenMul * blockMul);
    return { applied: true, died };
  }

  /** Revive o herói com vida cheia (M2.3 graybox: respawn após morrer, sem GameOver ainda). */
  revive(): void {
    this.health.reset();
    this.state = "idle";
    this.stamina = HERO.maxStamina;
  }

  // --- loop ---

  update(deltaSeconds: number, input: CombatInputSource): void {
    this.regenStamina(deltaSeconds);
    this.regenSpark(deltaSeconds);

    switch (this.state) {
      case "dodging":
        this.updateDodge(deltaSeconds);
        break;
      case "attacking":
        this.updateAttacking(deltaSeconds, input);
        break;
      case "ember":
        this.updateEmber(deltaSeconds);
        break;
      default:
        this.updateIdle(deltaSeconds, input);
    }

    this.poseWeapon();
  }

  private updateIdle(dt: number, input: CombatInputSource): void {
    this.idleTime += dt;
    if (this.idleTime > HERO.comboResetSec) this.comboStep = 0;
    this.blocking = input.isHeld("block");

    if (input.consumePressed("dodge") && this.spend(HERO.dodge.staminaCost)) {
      this.startDodge(input);
      return;
    }
    if (input.consumePressed("heavy") && this.spend(HERO.heavy.staminaCost ?? 0)) {
      this.isLightChain = false;
      this.beginAttack(HERO.heavy);
      return;
    }
    if (input.consumePressed("ember") && this.spark >= HERO.spark.emberCost) {
      this.beginEmber();
      return;
    }
    if (input.consumePressed("attack")) {
      this.comboStep = 0;
      this.isLightChain = true;
      this.beginAttack(HERO.light);
    }
  }

  private updateAttacking(dt: number, input: CombatInputSource): void {
    // Buffer de combo: golpear durante o ataque encadeia a próxima leve.
    if (this.isLightChain && input.consumePressed("attack")) this.comboQueued = true;

    const wasBusy = this.attack.isBusy;
    this.attack.advance(dt);

    if (wasBusy && !this.attack.isBusy) {
      // Golpe terminou: encadeia ou volta a idle.
      if (this.isLightChain && this.comboQueued && this.comboStep < 2) {
        this.comboStep += 1;
        this.beginAttack(this.comboStep >= 2 ? HERO.lightFinisher : HERO.light);
      } else {
        this.state = "idle";
        this.idleTime = 0;
        this.isLightChain = false;
        this.comboStep = 0;
      }
    }
  }

  private updateDodge(dt: number): void {
    this.dodgeElapsed += dt;
    if (this.dodgeElapsed >= HERO.dodge.durationSec) {
      this.state = "idle";
      this.idleTime = 0;
    }
  }

  private beginEmber(): void {
    this.spark = Math.max(0, this.spark - HERO.spark.emberCost);
    this.emberConsumed = false;
    this.blocking = false;
    this.comboStep = 0;
    this.state = "ember";
    this.attack.start(HERO.ember);
  }

  private updateEmber(dt: number): void {
    const wasBusy = this.attack.isBusy;
    this.attack.advance(dt);
    if (wasBusy && !this.attack.isBusy) {
      this.state = "idle";
      this.idleTime = 0;
    }
  }

  private regenSpark(dt: number): void {
    if (this.spark < HERO.spark.max) {
      this.spark = Math.min(HERO.spark.max, this.spark + HERO.spark.regenPerSec * dt);
    }
  }

  private beginAttack(tuning: AttackTuning): void {
    this.activeTuning = tuning;
    this.hitConsumed = false;
    this.comboQueued = false;
    this.blocking = false;
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
    this.blocking = false;
    this.comboStep = 0;
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
    if (this.stamina < HERO.maxStamina) {
      this.stamina = Math.min(HERO.maxStamina, this.stamina + HERO.staminaRegenPerSec * dt);
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
