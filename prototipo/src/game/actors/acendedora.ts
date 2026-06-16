import { CharacterController, type CombatInputSource, type InputSource, type ThirdPersonCamera } from "@engine";
import { Color3, PointLight, Quaternion, Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { HeroModel, type HeroAction } from "./heroModel";
import { HeroCombat } from "../combat/heroCombat";

/**
 * CAMADA JOGO (Brasa). A Acendedora: a heroína jogável da cripta. Compõe o
 * CharacterController genérico (engine), o HeroModel (visual) apontado para um KayKit
 * Adventurer CC0 (Mage.glb, já em disco e autossuficiente em animação) e o HeroCombat
 * (moveset). É aqui, no jogo, que a engine encontra o herói: a engine NÃO importa o
 * HeroModel nem o combate.
 */

// KayKit - Adventurers: Rogue_Hooded (CC0). Silhueta ENCAPUZADA (lê como a Acendedora,
// melhor que o Mage genérico) e, crucial p/ jogo, com rig/pesos/animações LIMPOS. O
// modelo próprio do Tripo fica só nos menus (estático): o auto-rig dele deforma como
// gelatina e a malha saiu com defeito, inadequado para o personagem jogável.
const ACENDEDORA_MODEL = "/models/Rogue_Hooded.glb";
const FORWARD = new Vector3(0, 0, 1); // eixo local "frente" do modelo (para getFacing)

/** Input de locomoção zerado: usado enquanto o combate trava o ator (golpe comprometido). */
const FROZEN_INPUT: InputSource = {
  forward: 0,
  strafe: 0,
  running: false,
  consumeJump: () => false,
};

export class Acendedora {
  readonly model: HeroModel;
  private readonly controller: CharacterController;
  private readonly combat_: HeroCombat;
  private readonly aimQuat = new Quaternion();

  constructor(scene: Scene, spawn: Vector3, gravity: Vector3) {
    this.model = new HeroModel(scene, { modelUrl: ACENDEDORA_MODEL, name: "acendedora" });
    this.controller = new CharacterController(scene, spawn, gravity, this.model);
    this.combat_ = new HeroCombat(scene, this.model.root);
    // Luz-fagulha: bolha de visibilidade quente que acompanha a Acendedora (sem sombra).
    // É a única luz quente na sala fria, antes de o braseiro ser aceso.
    const spark = new PointLight("luz_fagulha", new Vector3(0, 1.2, 0), scene);
    spark.diffuse = Color3.FromHexString("#ffa63d");
    spark.specular = Color3.Black();
    spark.intensity = 0.45;
    spark.range = 4.5;
    spark.shadowEnabled = false;
    spark.parent = this.model.root;
  }

  get position(): Vector3 {
    return this.controller.position;
  }

  /** Reposiciona a heroína (ao descer para o próximo andar). */
  teleport(pos: Vector3): void {
    this.controller.teleport(pos);
  }

  /** Combate da heroína (lido pelo CombatDirector para detecção de acerto). */
  get combat(): HeroCombat {
    return this.combat_;
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

  /** Chamar de scene.onAfterPhysicsObservable. */
  update(deltaSeconds: number, input: CombatInputSource, camera: ThirdPersonCamera): void {
    this.combat_.update(deltaSeconds, input);
    // Animação dominante a partir do estado de combate (bloqueio > esquiva > golpe > idle).
    const action: HeroAction = this.combat_.isBlocking
      ? "block"
      : this.combat_.moveOverride
        ? "dodge"
        : this.combat_.casting
          ? "ember"
          : this.combat_.busy
            ? this.combat_.heavyAttack
              ? "heavy"
              : "light"
            : "idle";
    this.model.setAction(action);
    // Durante a ANTECIPAÇÃO do golpe, encara para onde a câmera olha (a mira). Parado, o
    // controller só gira o modelo na direção do movimento, então a hitbox (à frente do
    // modelo) apontaria para a última direção andada e o golpe de frente erraria. Re-mira a
    // cada golpe do combo e trava ao ficar ativo; durante o ataque o ator não anda
    // (FROZEN_INPUT), logo o syncVisual do controller não sobrescreve.
    if (this.combat_.aiming || this.combat_.isBlocking) {
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
    const moveInput: InputSource = this.combat_.moveOverride ?? (this.combat_.busy ? FROZEN_INPUT : input);
    this.controller.update(deltaSeconds, moveInput, camera);
  }
}
