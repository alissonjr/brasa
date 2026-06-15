import {
  CharacterSupportedState,
  PhysicsCharacterController,
  Quaternion,
  Vector3,
} from "@babylonjs/core";
import type { CharacterSurfaceInfo, Scene, TransformNode } from "@babylonjs/core";
import type { InputSource } from "../input/inputState";

const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.5;
const WALK_SPEED = 4;
const RUN_SPEED = 8;
const IN_AIR_SPEED = 5;
const JUMP_HEIGHT = 1.6;

type LocomotionState = "ON_GROUND" | "IN_AIR" | "START_JUMP";

/**
 * Port: o que o controlador precisa de um "visual" de personagem. Qualquer jogo
 * fornece o seu (no nosso caso, o HeroModel da Acendedora). A engine NÃO conhece o herói.
 */
export interface CharacterVisual {
  readonly root: TransformNode;
  /** Dirigido pelo controlador a cada passo. */
  animate(deltaSeconds: number, horizontalSpeed: number, grounded: boolean): void;
}

/** Port mínimo de orientação (a câmera de 3a pessoa o satisfaz estruturalmente). */
export interface YawOrientationProvider {
  getYawOrientation(out: Quaternion): void;
}

/**
 * CAMADA ENGINE (genérica). Controlador de personagem em 3a pessoa: cápsula
 * cinemática via PhysicsCharacterController do Havok (andar/correr, gravidade,
 * pulo, colisão, subir rampa/degraus) + direção do visual fornecido.
 *
 * A lógica de estados (chão/ar/pulo) segue o exemplo oficial de character
 * controller do Babylon.js. Sem nenhuma referência ao jogo: recebe o visual por
 * interface (CharacterVisual) e a orientação por interface (YawOrientationProvider).
 */
export class CharacterController {
  private readonly controller: PhysicsCharacterController;
  private readonly gravity: Vector3;
  private readonly visual: CharacterVisual;

  private state: LocomotionState = "IN_AIR";
  private wantJump = false;

  // Buffers reaproveitados para não alocar por frame.
  private readonly inputDirection = new Vector3();
  private readonly orientation = new Quaternion();
  private readonly forwardLocal = new Vector3(0, 0, 1);
  private readonly down = new Vector3(0, -1, 0);

  constructor(scene: Scene, spawn: Vector3, gravity: Vector3, visual: CharacterVisual) {
    this.gravity = gravity;

    this.controller = new PhysicsCharacterController(
      spawn.clone(),
      { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS },
      scene
    );

    this.visual = visual;
    this.visual.root.rotationQuaternion = Quaternion.Identity();
    this.visual.root.position.copyFrom(spawn);
  }

  get position(): Vector3 {
    return this.controller.getPosition();
  }

  /** Reposiciona o personagem (ex.: ao descer para o próximo andar da cripta). */
  teleport(pos: Vector3): void {
    this.controller.setPosition(pos.clone());
    this.visual.root.position.copyFrom(pos);
    this.state = "IN_AIR";
  }

  /**
   * Avança a simulação do personagem em um passo de física.
   * Chamar de scene.onAfterPhysicsObservable.
   */
  update(deltaSeconds: number, input: InputSource, camera: YawOrientationProvider): void {
    if (deltaSeconds <= 0) {
      return;
    }

    if (input.consumeJump()) {
      this.wantJump = true;
    }

    // Direção desejada em espaço local (z = frente da câmera, x = lado).
    this.inputDirection.set(input.strafe, 0, input.forward);
    if (this.inputDirection.lengthSquared() > 1) {
      this.inputDirection.normalize();
    }
    camera.getYawOrientation(this.orientation);

    const support = this.controller.checkSupport(deltaSeconds, this.down);
    const speed = input.running ? RUN_SPEED : WALK_SPEED;
    const desiredVelocity = this.computeDesiredVelocity(deltaSeconds, support, speed);

    this.controller.setVelocity(desiredVelocity);
    this.controller.integrate(deltaSeconds, support, this.gravity);

    this.syncVisual(deltaSeconds);
  }

  private nextState(support: CharacterSurfaceInfo): LocomotionState {
    const supported = support.supportedState === CharacterSupportedState.SUPPORTED;
    switch (this.state) {
      case "IN_AIR":
        return supported ? "ON_GROUND" : "IN_AIR";
      case "ON_GROUND":
        if (!supported) return "IN_AIR";
        return this.wantJump ? "START_JUMP" : "ON_GROUND";
      case "START_JUMP":
        return "IN_AIR";
    }
  }

  private computeDesiredVelocity(
    dt: number,
    support: CharacterSurfaceInfo,
    speed: number
  ): Vector3 {
    this.state = this.nextState(support);

    const up = this.gravity.normalizeToNew().scaleInPlace(-1);
    const forwardWorld = this.forwardLocal.applyRotationQuaternion(this.orientation);
    const currentVelocity = this.controller.getVelocity();

    if (this.state === "IN_AIR") {
      const desired = this.inputDirection.scale(IN_AIR_SPEED).applyRotationQuaternion(this.orientation);
      const out = this.controller.calculateMovement(
        dt,
        forwardWorld,
        up,
        currentVelocity,
        Vector3.ZeroReadOnly,
        desired,
        up
      );
      // Preserva a componente vertical real (gravidade/pulo), só dirige no plano.
      out.addInPlace(up.scale(-out.dot(up)));
      out.addInPlace(up.scale(currentVelocity.dot(up)));
      out.addInPlace(this.gravity.scale(dt));
      return out;
    }

    if (this.state === "ON_GROUND") {
      const desired = this.inputDirection.scale(speed).applyRotationQuaternion(this.orientation);
      const out = this.controller.calculateMovement(
        dt,
        forwardWorld,
        support.averageSurfaceNormal,
        currentVelocity,
        support.averageSurfaceVelocity,
        desired,
        up
      );
      // Mantém o movimento colado à superfície (anda em rampa sem decolar).
      out.subtractInPlace(support.averageSurfaceVelocity);
      if (out.dot(up) > 1e-3) {
        const velLen = out.length();
        out.normalizeFromLength(velLen);
        const horizLen = velLen / support.averageSurfaceNormal.dot(up);
        const c = support.averageSurfaceNormal.cross(out);
        c.cross(up).scaleToRef(horizLen, out);
      }
      out.addInPlace(support.averageSurfaceVelocity);
      return out;
    }

    // START_JUMP: aplica impulso vertical para atingir JUMP_HEIGHT.
    this.wantJump = false;
    const jumpSpeed = Math.sqrt(2 * this.gravity.length() * JUMP_HEIGHT);
    const currentUp = currentVelocity.dot(up);
    return currentVelocity.add(up.scale(jumpSpeed - currentUp));
  }

  /** Posiciona, orienta e anima o visual conforme o controlador. */
  private syncVisual(dt: number): void {
    const root = this.visual.root;
    root.position.copyFrom(this.controller.getPosition());

    const v = this.controller.getVelocity();
    const horizSpeed = Math.hypot(v.x, v.z);

    // Vira o personagem na direção horizontal do movimento (passada de frente).
    if (horizSpeed > 0.2) {
      const yaw = Math.atan2(v.x, v.z);
      const target = Quaternion.FromEulerAngles(0, yaw, 0);
      Quaternion.SlerpToRef(
        root.rotationQuaternion ?? Quaternion.Identity(),
        target,
        1 - Math.exp(-15 * dt),
        root.rotationQuaternion!
      );
    }

    this.visual.animate(dt, horizSpeed, this.state === "ON_GROUND");
  }
}
