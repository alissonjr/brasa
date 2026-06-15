import { CharacterController, type CombatInputSource, type InputSource, type ThirdPersonCamera } from "@engine";
import type { Scene, Vector3 } from "@babylonjs/core";
import { HeroModel, type HeroAction } from "./heroModel";
import { HeroCombat } from "../combat/heroCombat";

/**
 * CAMADA JOGO (Brasa). A Acendedora: a heroína jogável da cripta. Compõe o
 * CharacterController genérico (engine), o HeroModel (visual) apontado para um KayKit
 * Adventurer CC0 (Mage.glb, já em disco e autossuficiente em animação) e o HeroCombat
 * (moveset). É aqui, no jogo, que a engine encontra o herói: a engine NÃO importa o
 * HeroModel nem o combate.
 */

// KayKit - Character Pack: Adventurers (CC0). Trocável por Rogue_Hooded.glb para a
// silhueta encapuzada, ou pelo modelo final na passada de arte.
const ACENDEDORA_MODEL = "/models/Mage.glb";

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

  constructor(scene: Scene, spawn: Vector3, gravity: Vector3) {
    this.model = new HeroModel(scene, { modelUrl: ACENDEDORA_MODEL, name: "acendedora" });
    this.controller = new CharacterController(scene, spawn, gravity, this.model);
    this.combat_ = new HeroCombat(scene, this.model.root);
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
    // Esquiva = dash (override de movimento); golpe = locomoção travada (comprometimento);
    // senão, input normal.
    const moveInput: InputSource = this.combat_.moveOverride ?? (this.combat_.busy ? FROZEN_INPUT : input);
    this.controller.update(deltaSeconds, moveInput, camera);
  }
}
