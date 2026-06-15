import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImportMeshAsync,
  Scene,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type AnimationGroup,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF"; // registra o loader glTF
import { assetUrl, el } from "@engine";

/**
 * CAMADA JOGO (Brasa). Vitrine 3D embutida nas telas de menu: um "nicho iluminado"
 * que mostra um modelo (personagem ou prop) girando, com luz quente de brasa, dentro
 * do overlay HTML. Dá ao menu o peso de um jogo de verdade (a Crônica deixa de ser só
 * texto apertado e passa a mostrar o personagem ao lado).
 *
 * Por que um Engine PRÓPRIO (WebGL2) num canvas próprio, e não a cena do jogo:
 * - Isolamento total: não mexe na cena/física do jogo, não disputa câmera nem luzes.
 * - Vive só enquanto o nicho está aberto: start() cria tudo; dispose() devolve o
 *   contexto WebGL. Telas chamam isso no onShow/onHide.
 * - WebGL2 síncrono (sem o init assíncrono do WebGPU/CDN): abre instantâneo e robusto.
 *
 * O modelo é normalizado (centrado na origem, escalado para caber) então serve para
 * qualquer glb - personagem rigado (toca o idle) ou prop estático (só gira). Ver
 * docs/tecnica-assets-e-carregamento.md e docs/tecnica-animacao-babylon.md.
 */

export interface ModelStageOptions {
  /** glb a exibir (ex.: "/models/Mage.glb"). */
  modelUrl: string;
  /** Liga a auto-rotação lenta (default: true). */
  autoRotate?: boolean;
  /** Permite arrastar para girar (default: true). */
  interactive?: boolean;
  /** Cor de destaque do nicho (luz de recorte + brilho do chão). Default: brasa. */
  accent?: string;
  /**
   * "niche": moldura compacta para dentro de um painel (Crônica, criação).
   * "backdrop": preenche o espaço atrás de uma tela (diorama da tela-título).
   */
  variant?: "niche" | "backdrop";
}

const DEFAULT_ACCENT = "#ff9646"; // brasa

const FIT_SIZE = 2.2; // maior dimensão do modelo, em unidades de cena, após o encaixe

export class ModelStage {
  /** Moldura DOM (canvas + vinheta) para inserir no painel da tela. */
  readonly element: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly opts: Required<ModelStageOptions>;

  private engine?: Engine;
  private scene?: Scene;
  private idle?: AnimationGroup;
  private rim?: DirectionalLight;
  private resizeObs?: ResizeObserver;
  private disposed = false;

  constructor(opts: ModelStageOptions) {
    this.opts = {
      autoRotate: true,
      interactive: true,
      accent: DEFAULT_ACCENT,
      variant: "niche",
      ...opts,
    };
    this.canvas = el("canvas", { class: "model-stage-canvas" }) as HTMLCanvasElement;
    // touch-action none: o arrastar para girar não rola a página por baixo.
    this.canvas.style.touchAction = "none";
    const cls = "model-stage" + (this.opts.variant === "backdrop" ? " model-stage-backdrop" : "");
    this.element = el(
      "div",
      { class: cls },
      this.canvas,
      el("div", { class: "model-stage-vignette" }),
      el("div", { class: "model-stage-floor" })
    );
    this.element.style.setProperty("--stage-accent", this.opts.accent);
  }

  /** Cria engine/cena/modelo e começa a renderizar. Idempotente. */
  start(): void {
    if (this.engine || this.disposed) return;

    const engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      // O nicho não precisa de fundo transparente (tem clearColor próprio); manter
      // alpha:false evita o gotcha de compositing e fica mais barato.
      alpha: false,
      powerPreference: "low-power",
    });
    this.engine = engine;

    const scene = new Scene(engine);
    this.scene = scene;
    // Fundo do nicho: pedra fria com um respiro quente ao centro (combina com o painel).
    scene.clearColor = new Color4(0.043, 0.055, 0.078, 1);

    const backdrop = this.opts.variant === "backdrop";
    // backdrop: enquadramento mais heroico (recuado, quase à altura dos olhos) e giro
    // mais lento/ambiental; niche: retrato mais próximo e giro um pouco mais vivo.
    // O recuo maior + alvo elevado dão respiro acima da cabeça (a figura não encosta no topo).
    const radius = backdrop ? 4.4 : 3.4;
    const beta = backdrop ? 1.34 : 1.28;
    const target = new Vector3(0, backdrop ? 0.22 : 0, 0);
    const camera = new ArcRotateCamera("stageCam", -Math.PI / 2, beta, radius, target, scene);
    camera.minZ = 0.05;
    camera.lowerRadiusLimit = 2.4;
    camera.upperRadiusLimit = 6;
    camera.lowerBetaLimit = 0.6;
    camera.upperBetaLimit = 1.9;
    camera.wheelDeltaPercentage = 0.01;
    camera.panningSensibility = 0; // sem pan: só órbita
    if (this.opts.interactive) camera.attachControl(this.canvas, true);
    if (this.opts.autoRotate) {
      camera.useAutoRotationBehavior = true;
      const arb = camera.autoRotationBehavior!;
      arb.idleRotationSpeed = backdrop ? 0.16 : 0.32;
      arb.idleRotationWaitTime = 600; // retoma o giro logo após o usuário soltar
      arb.idleRotationSpinupTime = 800;
      arb.zoomStopsAnimation = false;
    }

    // Luz: chave quente de brasa + preenchimento frio suave + um rim atrás.
    const hemi = new HemisphericLight("stageHemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.55;
    hemi.diffuse = new Color3(0.7, 0.78, 0.95);
    hemi.groundColor = new Color3(0.12, 0.1, 0.08);

    const key = new DirectionalLight("stageKey", new Vector3(-0.6, -0.9, -0.5), scene);
    key.intensity = 2.2;
    key.diffuse = new Color3(1.0, 0.82, 0.55); // âmbar (brasa)

    const rim = new DirectionalLight("stageRim", new Vector3(0.7, -0.2, 0.8), scene);
    rim.intensity = 1.1;
    this.rim = rim;
    this.applyAccentToLight(this.opts.accent); // recorte nas costas na cor de destaque

    void this.loadModel(scene);

    engine.runRenderLoop(() => scene.render());

    // Acompanha o tamanho real do canvas no layout (responsivo + DPR correto).
    engine.resize();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObs = new ResizeObserver(() => this.engine?.resize());
      this.resizeObs.observe(this.canvas);
    }
  }

  /**
   * Troca a cor de destaque do nicho ao vivo (luz de recorte + brilho do chão).
   * Usado pela criação de personagem: escolher um manto banha a Acendedora na cor.
   */
  setAccent(hex: string): void {
    this.opts.accent = hex;
    this.element.style.setProperty("--stage-accent", hex);
    this.applyAccentToLight(hex);
  }

  private applyAccentToLight(hex: string): void {
    if (!this.rim) return;
    // Clareia um pouco a cor para a luz "estourar" no recorte sem perder o matiz.
    this.rim.diffuse = Color3.FromHexString(hex).scale(1.3);
  }

  /** Para o loop e devolve o contexto WebGL. Idempotente. */
  dispose(): void {
    this.disposed = true;
    this.resizeObs?.disconnect();
    this.resizeObs = undefined;
    this.idle = undefined;
    this.rim = undefined;
    this.scene = undefined;
    this.engine?.stopRenderLoop();
    this.engine?.dispose();
    this.engine = undefined;
  }

  private async loadModel(scene: Scene): Promise<void> {
    let meshes: AbstractMesh[];
    let animationGroups: AnimationGroup[];
    try {
      const result = await ImportMeshAsync(assetUrl(this.opts.modelUrl), scene, { pluginExtension: ".glb" });
      meshes = result.meshes;
      animationGroups = result.animationGroups;
    } catch (err) {
      console.warn(`[model-stage] falha ao carregar ${this.opts.modelUrl}`, err);
      this.element.classList.add("model-stage-empty");
      return;
    }
    if (this.disposed) return; // tela fechou durante o carregamento

    const top = meshes.find((m) => m.name === "__root__") ?? meshes[0];
    if (top) this.fit(top);
    this.playIdle(animationGroups);
    this.element.classList.add("model-stage-ready");
  }

  /** Centra o modelo na origem e o escala para caber no nicho (qualquer glb). */
  private fit(top: AbstractMesh): void {
    const { min, max } = top.getHierarchyBoundingVectors(true);
    const sizeX = max.x - min.x;
    const sizeY = max.y - min.y;
    const sizeZ = max.z - min.z;
    const maxDim = Math.max(0.001, sizeX, sizeY, sizeZ);
    const scale = FIT_SIZE / maxDim;
    const cx = (min.x + max.x) / 2;
    const cy = (min.y + max.y) / 2;
    const cz = (min.z + max.z) / 2;

    const fit = new TransformNode("stageFit", this.scene!);
    fit.scaling.setAll(scale);
    fit.position.set(-cx * scale, -cy * scale, -cz * scale);
    top.parent = fit;
  }

  private playIdle(groups: AnimationGroup[]): void {
    for (const g of groups) g.stop();
    // Personagens KayKit/Quaternius trazem o idle embutido; props não têm e só giram.
    this.idle = groups.find((g) => /idle/i.test(g.name)) ?? groups[0];
    this.idle?.play(true);
  }
}
