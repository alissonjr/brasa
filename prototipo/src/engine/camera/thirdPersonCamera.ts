import { ArcRotateCamera, Quaternion, Ray, Scalar, Vector3 } from "@babylonjs/core";
import type { AbstractMesh, Scene } from "@babylonjs/core";

/**
 * CAMADA ENGINE. Câmera de 3a pessoa estilo action-RPG (GTA-like): mouse-look livre
 * via pointer lock (clica na tela para travar o ponteiro, o mouse gira sem segurar
 * botão, ESC solta). O alvo segue o personagem com suavização (damping). O movimento
 * do herói é relativo à direção horizontal da câmera (ver getYawOrientation).
 */
export class ThirdPersonCamera {
  readonly camera: ArcRotateCamera;
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly smoothedTarget: Vector3;
  // Ponto que a câmera mira, ACIMA da posição do herói. Mira na parte de cima das costas
  // (~ombros), não acima da cabeça: evita encarar o topo do capuz quando a câmera é forçada
  // para perto (ex.: spawn encostado na parede). Antes era 1.2 (acima da cabeça ~1.9 m).
  private readonly targetHeight = 0.95;
  // MODO ALTA (direção de arte): câmera alta, estilo Hades/diorama. O mouse gira a câmera em
  // volta do herói (alpha livre); a inclinação fica numa faixa estreita para manter a leitura
  // do chão e a luz. As paredes viradas para a câmera baixam sozinhas (ver cryptRoom). Padrão;
  // ?cam=terceira volta à terceira pessoa clássica.
  private readonly alta =
    typeof location === "undefined" || !/[?&]cam=terceira\b/.test(location.search);
  private readonly altaAlpha = -Math.PI / 2 - Math.PI / 5; // diagonal: duas paredes à vista
  private readonly altaBeta = 0.82; // ~47 graus da vertical: vê o chão, esconde menos
  private readonly altaBetaMin = 0.7;
  private readonly altaBetaMax = 0.95;
  private readonly altaRadius = 15;
  private readonly defaultRadius = 6; // distância padrão (reaplicada a cada sala, view consistente)
  // Raio "desejado" (o que o jogador pediu via zoom/sala); o raio EFETIVO encurta sozinho
  // quando há parede entre o herói e a câmera (colisão manual, ver update). Sem isso, a
  // colisão embutida do ArcRotateCamera reescrevia alpha/beta e jogava a câmera num
  // top-down colado (o herói virava um borrão visto de cima) perto das paredes.
  private desiredRadius = 6;
  private readonly camDir = new Vector3(); // dir unitária alvo->câmera (reusada por frame)
  private readonly collidePredicate = (m: AbstractMesh): boolean => m.checkCollisions && m.isEnabled();

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
    this.scene = scene;
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
    if (this.alta) {
      this.camera.fov = 0.62; // lente mais longa: menos distorção, leitura de diorama
      this.camera.lowerRadiusLimit = 9;
      this.camera.upperRadiusLimit = 24;
      this.camera.alpha = this.altaAlpha;
      this.camera.beta = this.altaBeta;
      this.camera.radius = this.altaRadius;
      this.desiredRadius = this.altaRadius;
      this.camera.minZ = 0.5;
      this.camera.maxZ = 140;
    }

    // Colisão de câmera MANUAL (ver update): um raycast alvo->câmera encurta só o RAIO ao
    // achar parede, mantendo alpha/beta estáveis. NÃO usar a colisão embutida do
    // ArcRotateCamera: ela chama rebuildAnglesAndRadius e reescreve alpha/beta, empurrando
    // a câmera para um top-down colado perto das paredes (o herói virava um borrão de cima).
    this.camera.checkCollisions = false;

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
      // Na câmera alta a inclinação quase não muda (faixa estreita) e vai mais devagar.
      const lo = this.alta ? this.altaBetaMin : this.betaMin;
      const hi = this.alta ? this.altaBetaMax : this.betaMax;
      const k = this.alta ? 0.5 : 1;
      this.camera.beta = Scalar.Clamp(this.camera.beta - e.movementY * this.lookSensitivity * k, lo, hi);
    });
  }

  /** Zoom com a roda do mouse (aproxima/afasta a câmera). */
  private setupWheelZoom(): void {
    this.canvas.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        e.preventDefault();
        // Passo proporcional à distância atual: zoom suave tanto perto quanto longe.
        // Ajusta o raio DESEJADO; o efetivo ainda encurta por colisão (ver update).
        const step = Math.sign(e.deltaY) * this.desiredRadius * 0.12;
        this.desiredRadius = Scalar.Clamp(
          this.desiredRadius + step,
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

    if (!this.alta) this.resolveCollisionRadius(deltaSeconds);
    else this.camera.radius += (this.desiredRadius - this.camera.radius) * (1 - Math.exp(-8 * deltaSeconds));

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
    if (this.alta) {
      // Mantém o ângulo que o jogador escolheu ao trocar de sala (nada de a câmera brigar com ele);
      // só o zoom volta ao padrão.
      this.camera.radius = this.altaRadius;
      this.desiredRadius = this.altaRadius;
    } else if (faceInto) {
      // Enquadramento PADRÃO: idêntico em toda sala (atrás do herói, mesma distância/ângulo).
      this.camera.alpha = -Math.PI / 2; // atrás do herói
      this.camera.beta = 1.05; // levemente de cima
      this.camera.radius = this.defaultRadius; // reseta o zoom: view consistente a cada andar
      this.desiredRadius = this.defaultRadius; // a colisão manual parte do raio padrão
    }
    this.camera.setTarget(this.smoothedTarget);
  }

  /**
   * COLISÃO MANUAL: encurta só o raio quando há parede entre o herói e a câmera, mantendo
   * alpha/beta (sem o top-down colado que a colisão embutida do ArcRotateCamera causava).
   * Raycast do alvo na direção da câmera (derivada de alpha/beta); bate numa parede ->
   * recolhe rápido; livre -> volta devagar ao raio desejado (sem pop). Mira só nos colisores
   * da sala (checkCollisions=true), que são invisíveis/não-pickáveis.
   */
  private resolveCollisionRadius(deltaSeconds: number): void {
    const { alpha, beta } = this.camera;
    const sb = Math.sin(beta);
    // Dir unitária alvo->câmera na convenção do ArcRotateCamera.
    this.camDir.set(Math.cos(alpha) * sb, Math.cos(beta), Math.sin(alpha) * sb);

    const BUFFER = 0.4; // folga p/ a câmera não encostar na parede (near plane + margem)
    let goalRadius = this.desiredRadius;
    const ray = new Ray(this.smoothedTarget, this.camDir, this.desiredRadius + BUFFER);
    const hit = this.scene.pickWithRay(ray, this.collidePredicate);
    if (hit?.hit && hit.distance > 0) {
      goalRadius = Math.max(this.camera.lowerRadiusLimit ?? 2, hit.distance - BUFFER);
    }

    // Recolhe rápido (não atravessar parede); estende devagar (sem solavanco ao limpar).
    const pullingIn = goalRadius < this.camera.radius;
    const k = 1 - Math.exp(-(pullingIn ? 30 : 8) * deltaSeconds);
    this.camera.radius += (goalRadius - this.camera.radius) * k;
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

  /** Direção horizontal (normalizada) para onde a câmera olha. Usada para mira/aquisição de alvo. */
  getForward(out: Vector3): Vector3 {
    this.camera.target.subtractToRef(this.camera.position, out);
    out.y = 0;
    const len = Math.hypot(out.x, out.z) || 1;
    out.x /= len;
    out.z /= len;
    return out;
  }
}
