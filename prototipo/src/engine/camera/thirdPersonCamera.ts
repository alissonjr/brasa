import { ArcRotateCamera, Quaternion, Scalar, Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

/**
 * CAMADA ENGINE. Câmera de 3a pessoa estilo action-RPG (GTA-like): mouse-look livre
 * via pointer lock (clica na tela para travar o ponteiro, o mouse gira sem segurar
 * botão, ESC solta). O alvo segue o personagem com suavização (damping). O movimento
 * do herói é relativo à direção horizontal da câmera (ver getYawOrientation).
 */
export class ThirdPersonCamera {
  readonly camera: ArcRotateCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly smoothedTarget: Vector3;
  private readonly targetHeight = 1.2;
  private readonly defaultRadius = 6; // distância padrão (reaplicada a cada sala, view consistente)

  // Sensibilidade do mouse (rad por pixel).
  private readonly lookSensitivity = 0.0028;
  private locked = false;

  // Screen shake (kick de impacto): amplitude que decai + buffer do alvo perturbado.
  private shakeAmp = 0;
  private readonly _shakeTarget = new Vector3();

  // Limites de inclinação vertical da câmera (não olha de baixo do chão nem
  // vira de cabeça para baixo).
  private readonly betaMin = 0.25;
  private readonly betaMax = Math.PI / 2.05;

  constructor(scene: Scene, canvas: HTMLCanvasElement, initialTarget: Vector3) {
    this.canvas = canvas;
    this.smoothedTarget = initialTarget.add(new Vector3(0, this.targetHeight, 0));

    this.camera = new ArcRotateCamera(
      "cameraTerceira",
      -Math.PI / 2, // alpha: atrás do personagem
      1.05, // beta: levemente de cima
      6, // radius (over-the-shoulder; cabe em ambientes fechados)
      this.smoothedTarget.clone(),
      scene
    );

    this.camera.lowerRadiusLimit = 2;
    this.camera.upperRadiusLimit = 14;
    this.camera.minZ = 0.1;

    // Colisão de câmera: em ambiente fechado a câmera não atravessa parede; ela encurta
    // o raio ao bater (pull-in). Usa o sistema de colisão do Babylon (independente do
    // Havok do jogador); os colisores da sala marcam checkCollisions=true.
    scene.collisionsEnabled = true;
    this.camera.checkCollisions = true;
    this.camera.collisionRadius = new Vector3(0.5, 0.5, 0.5);

    this.setupPointerLook();
    this.setupWheelZoom();
  }

  /** Pointer lock + mouse-look livre. */
  private setupPointerLook(): void {
    this.canvas.addEventListener("click", () => {
      if (!this.locked) {
        void this.canvas.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
    });

    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (!this.locked) return;
      // Mouse para a direita -> olhar para a direita; para cima -> olhar para cima.
      this.camera.alpha -= e.movementX * this.lookSensitivity;
      this.camera.beta = Scalar.Clamp(
        this.camera.beta - e.movementY * this.lookSensitivity,
        this.betaMin,
        this.betaMax
      );
    });
  }

  /** Zoom com a roda do mouse (aproxima/afasta a câmera). */
  private setupWheelZoom(): void {
    this.canvas.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        e.preventDefault();
        // Passo proporcional à distância atual: zoom suave tanto perto quanto longe.
        const step = Math.sign(e.deltaY) * this.camera.radius * 0.12;
        const next = this.camera.radius + step;
        this.camera.radius = Scalar.Clamp(
          next,
          this.camera.lowerRadiusLimit ?? 4,
          this.camera.upperRadiusLimit ?? 45
        );
      },
      { passive: false }
    );
  }

  /**
   * Atualiza o ponto perseguido a cada frame, com suavização exponencial
   * independente de framerate. O screen shake (kick de impacto) perturba o alvo por
   * um instante e decai rápido (< 0,15 s, spec-combate §6); usa o dt REAL, então
   * continua durante o hit stop (que congela só atacante e alvo, não a câmera).
   */
  update(targetPosition: Vector3, deltaSeconds: number): void {
    const desired = targetPosition.add(new Vector3(0, this.targetHeight, 0));
    const lerpFactor = 1 - Math.exp(-12 * deltaSeconds);
    Vector3.LerpToRef(this.smoothedTarget, desired, lerpFactor, this.smoothedTarget);

    if (this.shakeAmp > 0.0006) {
      this.shakeAmp *= Math.exp(-deltaSeconds / 0.04); // decai a ~5% em ~0,12 s
      const a = this.shakeAmp;
      this._shakeTarget.set(
        this.smoothedTarget.x + (Math.random() * 2 - 1) * a,
        this.smoothedTarget.y + (Math.random() * 2 - 1) * a,
        this.smoothedTarget.z + (Math.random() * 2 - 1) * a
      );
      this.camera.setTarget(this._shakeTarget);
    } else {
      this.shakeAmp = 0;
      this.camera.setTarget(this.smoothedTarget);
    }
  }

  /**
   * Cola a câmera atrás do herói IMEDIATAMENTE (sem suavização). Usar ao trocar de sala /
   * teleportar: sem isso, o alvo só interpola e, no salto entre andares, a câmera varre o
   * cenário com colisão e acaba do lado de fora da parede até se reassentar. Por padrão
   * reenquadra "atrás do herói, olhando para dentro da sala".
   */
  snap(targetPosition: Vector3, faceInto = true): void {
    this.smoothedTarget.copyFrom(targetPosition);
    this.smoothedTarget.y += this.targetHeight;
    this.shakeAmp = 0;
    if (faceInto) {
      // Enquadramento PADRÃO: idêntico em toda sala (atrás do herói, mesma distância/ângulo).
      this.camera.alpha = -Math.PI / 2; // atrás do herói
      this.camera.beta = 1.05; // levemente de cima
      this.camera.radius = this.defaultRadius; // reseta o zoom: view consistente a cada andar
    }
    this.camera.setTarget(this.smoothedTarget);
  }

  /** Dispara um kick de câmera (impacto). Amplitude em unidades de mundo; pega o maior pedido. */
  shake(amplitude: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amplitude);
  }

  /**
   * Quaternion de rotação só no eixo Y correspondente à direção horizontal em
   * que a câmera olha. Converte input local (frente/lado) em direção de mundo,
   * dando o movimento "relativo à câmera".
   */
  getYawOrientation(result: Quaternion): void {
    const dir = this.camera.target.subtract(this.camera.position);
    const yaw = Math.atan2(dir.x, dir.z);
    Quaternion.FromEulerAnglesToRef(0, yaw, 0, result);
  }
}
