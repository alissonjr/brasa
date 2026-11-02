import { CharacterController, createLightPool, getContactShadows, type CombatInputSource, type InputSource, type ThirdPersonCamera } from "@engine";
import { Color3, PointLight, Quaternion, Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { HeroModel, type HeroAction } from "./heroModel";
import { HeroCombat } from "../combat/heroCombat";

/**
 * CAMADA JOGO (Brasa). A Acendedora: a heroína jogável da cripta. Compõe o
 * CharacterController genérico (engine), o HeroModel (visual) apontado para o corpo
 * Quaternius CC0 vestido de Acendedora (heroina.glb) e o HeroCombat
 * (moveset). É aqui, no jogo, que a engine encontra o herói: a engine NÃO importa o
 * HeroModel nem o combate.
 */

// Corpo Quaternius (Universal Base Characters + Modular Outfits Fantasy, CC0) em preto, bronze e
// ouro de brasa: heroina.glb (ver heroModel.ts). O modelo estatico do Tripo fica so nos menus.
const ACENDEDORA_MODEL = "/models/personagens/heroina.glb";
const HIT_REACTION_SEC = 0.33;
const FORWARD = new Vector3(0, 0, 1); // eixo local "frente" do modelo (para getFacing)

/** Input de locomoção zerado: usado enquanto o combate trava o ator (golpe comprometido). */
const FROZEN_INPUT: InputSource = {
  forward: 0,
  strafe: 0,
  running: false,
  consumeJump: () => false,
};

/** Velocidade de corrida do controlador (engine: RUN_SPEED); o lunge manda um input de fração disto. */
const RUN_SPEED = 8;
/** Distância (m) centro-a-centro em que o lunge para diante do alvo (cápsula 0,5 + corpo do alvo). */
const LUNGE_STOP_DIST = 1.1;

export class Acendedora {
  readonly model: HeroModel;
  private readonly controller: CharacterController;
  private readonly combat_: HeroCombat;
  private readonly aimQuat = new Quaternion();
  private readonly aimTarget = new Vector3(); // alvo de mira (lock-on / soft-target)
  private hasAim = false;
  private readonly spark: PointLight;
  private sparkOnHand = false;
  private lastHp = -1;
  private hitT = 0; // tempo restante da reação de dano (clipe Hit_Chest ~0,33 s)
  // Lunge (avanço do golpe): input sintético ao longo do que ela encara, parando diante do alvo.
  private readonly lungeInput = { forward: 0, strafe: 0, running: true, consumeJump: () => false };
  private lungeLeft = 0; // metros que ainda pode avançar neste golpe
  private readonly lungeFacing = new Vector3();
  private readonly lungeLocal = new Vector3();
  private readonly lungeQuat = new Quaternion();

  constructor(scene: Scene, spawn: Vector3, gravity: Vector3) {
    this.model = new HeroModel(scene, { modelUrl: ACENDEDORA_MODEL, name: "acendedora" });
    this.controller = new CharacterController(scene, spawn, gravity, this.model);
    this.combat_ = new HeroCombat(scene, this.model.root);
    // Luz-fagulha: bolha de visibilidade quente que acompanha a Acendedora (sem sombra).
    // É a única luz quente na sala fria, antes de o braseiro ser aceso.
    const spark = new PointLight("luz_fagulha", new Vector3(0, 1.2, 0), scene);
    spark.diffuse = Color3.FromHexString("#ffa63d");
    spark.specular = Color3.Black();
    spark.intensity = 1.0;
    spark.range = 9;
    spark.shadowEnabled = false;
    spark.parent = this.model.root; // ao carregar o modelo, passa para a mão (brasa), ver update()
    this.spark = spark;
    // Halo quente no chão sob a Acendedora: a lanterna dela e o ponto de luz da cena fria.
    const pool = createLightPool(scene, { radius: 3.4, color: "#ffa63d", alpha: 0.4, y: -0.84 });
    pool.parent = this.model.root;
    // Aterramento: sombra de contato (1 draw call para todos os atores; lê da câmera alta).
    getContactShadows(scene).add(this.model.root, 0.6);
  }

  get position(): Vector3 {
    return this.controller.position;
  }

  /** Reposiciona a heroína (ao descer para o próximo andar). */
  teleport(pos: Vector3): void {
    this.controller.teleport(pos);
  }

  /** Aplica o manto escolhido na criação (variante de textura), delegado ao modelo visual. */
  setMantle(id: string): void {
    this.model.setMantle(id);
  }

  /** Combate da heroína (lido pelo CombatDirector para detecção de acerto). */
  get combat(): HeroCombat {
    return this.combat_;
  }

  /**
   * Alvo de mira (lock-on ou soft-target): durante a antecipação do golpe/ember a heroína
   * encara este ponto em vez do yaw da câmera, fazendo o golpe "grudar" no inimigo escolhido.
   * null = sem alvo (volta a mirar pela câmera). Definido pelo CombatDirector a cada frame.
   */
  setAimTarget(pos: { x: number; y: number; z: number } | null): void {
    this.hasAim = pos !== null;
    if (pos) this.aimTarget.set(pos.x, pos.y, pos.z);
  }

  /** Direção horizontal que a heroína encara (forward do modelo). Usado para defesa frontal. */
  getFacing(out: Vector3): Vector3 {
    this.model.root.getDirectionToRef(FORWARD, out);
    out.y = 0;
    const len = Math.hypot(out.x, out.z) || 1;
    out.x /= len;
    out.z /= len;
    return out;
  }

  /**
   * Durante o golpe a locomoção trava (comprometimento), exceto o LUNGE: um avanço curto para a
   * frente (para onde ela encara: alvo travado/soft-target ou a mira), que para a ~1,1 m do alvo.
   * Vai pelo controlador (colide com parede) e acompanha o passo do clipe (meio da antecipação
   * até o fim da janela ativa), então não desliza.
   */
  private lungeOrFrozen(dt: number, camera: ThirdPersonCamera): InputSource {
    const hc = this.combat_;
    if (hc.aiming && hc.lungeSpeed === 0) {
      // Antes de o avanço começar: orçamento = distância do golpe, limitada pela distância ao alvo.
      let budget = hc.lungeDistance;
      if (this.hasAim) {
        const p = this.position;
        const d = Math.hypot(this.aimTarget.x - p.x, this.aimTarget.z - p.z);
        budget = Math.min(budget, Math.max(0, d - LUNGE_STOP_DIST));
      }
      this.lungeLeft = budget;
    }
    const v = hc.lungeSpeed;
    if (v <= 0 || this.lungeLeft <= 0 || dt <= 0) return FROZEN_INPUT;
    const f = this.getFacing(this.lungeFacing);
    camera.getYawOrientation(this.lungeQuat);
    this.lungeQuat.invertInPlace();
    f.rotateByQuaternionToRef(this.lungeQuat, this.lungeLocal);
    const mag = Math.min(1, v / RUN_SPEED);
    this.lungeInput.strafe = this.lungeLocal.x * mag;
    this.lungeInput.forward = this.lungeLocal.z * mag;
    this.lungeLeft -= v * dt;
    return this.lungeInput;
  }

  /** Chamar de scene.onAfterPhysicsObservable. */
  update(deltaSeconds: number, input: CombatInputSource, camera: ThirdPersonCamera): void {
    if (!this.sparkOnHand && this.model.emberNode) {
      // A luz-fagulha passa a viver na brasa da mão esquerda: a única luz quente da sala fria
      // acompanha o gesto (ataque, esquiva, bloqueio), em vez de ficar parada no tronco.
      this.spark.parent = this.model.emberNode;
      this.spark.position.set(0, 0.05, 0);
      this.sparkOnHand = true;
    }
    this.combat_.update(deltaSeconds, input);
    // Animação dominante a partir do estado de combate (bloqueio > esquiva > golpe > idle).
    // Reação de dano: só quando a vida cai e a heroína não está guardando, esquivando ou comprometida num golpe.
    const hp = this.combat_.health.current;
    if (this.lastHp >= 0 && hp < this.lastHp - 0.01 && hp > 0 && !this.combat_.isBlocking && !this.combat_.moveOverride && !this.combat_.busy) {
      this.hitT = HIT_REACTION_SEC;
    }
    this.lastHp = hp;
    this.hitT = Math.max(0, this.hitT - deltaSeconds);
    const action: HeroAction = hp <= 0
      ? "death"
      : this.combat_.isBlocking
      ? "block"
      : this.combat_.moveOverride
        ? "dodge"
        : this.combat_.casting
          ? "ember"
          : this.combat_.busy
            ? this.combat_.heavyAttack
              ? "heavy"
              : "light"
            : this.hitT > 0
              ? "hit"
              : "idle";
    const withSync = action === "light" || action === "heavy" || action === "ember" || action === "dodge";
    this.model.setAction(action, withSync ? this.combat_.clipSync : null, deltaSeconds <= 0);
    // Durante a ANTECIPAÇÃO do golpe, encara para onde a câmera olha (a mira). Parado, o
    // controller só gira o modelo na direção do movimento, então a hitbox (à frente do
    // modelo) apontaria para a última direção andada e o golpe de frente erraria. Re-mira a
    // cada golpe do combo e trava ao ficar ativo; durante o ataque o ator não anda
    // (FROZEN_INPUT), logo o syncVisual do controller não sobrescreve.
    const wantsAim = this.combat_.aiming || this.combat_.casting;
    if (this.hasAim && wantsAim) {
      // LOCK-ON / SOFT-TARGET: durante a antecipação do golpe/ember, encara o alvo escolhido
      // (não o yaw da câmera). Faz a hitbox frontal cair sobre o inimigo certo na turba.
      const p = this.position;
      const dx = this.aimTarget.x - p.x;
      const dz = this.aimTarget.z - p.z;
      if (dx * dx + dz * dz > 1e-4) {
        Quaternion.FromEulerAnglesToRef(0, Math.atan2(dx, dz), 0, this.aimQuat);
        const root = this.model.root;
        if (root.rotationQuaternion) root.rotationQuaternion.copyFrom(this.aimQuat);
        else root.rotationQuaternion = this.aimQuat.clone();
      }
    } else if (this.combat_.aiming || this.combat_.isBlocking) {
      // Mira do golpe E do BLOQUEIO: encara para onde a câmera olha (aponta o escudo na
      // ameaça). Sem isso o herói bloqueia para a última direção andada e a defesa frontal
      // contra projétil não funcionaria.
      camera.getYawOrientation(this.aimQuat);
      const root = this.model.root;
      if (root.rotationQuaternion) root.rotationQuaternion.copyFrom(this.aimQuat);
      else root.rotationQuaternion = this.aimQuat.clone();
    }
    // Esquiva = dash (override de movimento); golpe = locomoção travada (comprometimento);
    // senão, input normal.
    const moveInput: InputSource = this.combat_.moveOverride ?? (this.combat_.busy ? this.lungeOrFrozen(deltaSeconds, camera) : input);
    this.controller.update(deltaSeconds, moveInput, camera);
  }
}
