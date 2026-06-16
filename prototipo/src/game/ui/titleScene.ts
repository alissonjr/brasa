import {
  ArcRotateCamera,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  DynamicTexture,
  Engine,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  ImportMeshAsync,
  MeshBuilder,
  ParticleSystem,
  PointLight,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { assetUrl, el, loadContainer } from "@engine";

/**
 * CAMADA JOGO (Brasa). Tela-título CINEMATOGRÁFICA DIEGÉTICA, mirando a sensação de uma
 * "login screen" (WoW/FF) com o que temos: a Acendedora numa CÂMARA de cripta montada com
 * o KayKit (chão, parede ao fundo, pilares ladeando, pilares quebrados em primeiro plano
 * pra dar profundidade, tochas de parede), SOMBRAS dinâmicas, fog, brasas e poeira no ar,
 * a Brasa piscando, e um PIPELINE de pós cinematográfico (tone mapping ACES, bloom,
 * vinheta, grão, aberração). Câmera com deriva/dolly lento. Engine própria full-bleed.
 */

const FIT_HEIGHT = 2.0;
const ACCENT_DEFAULT = "#ff8a3c";
const KIT = "/assets/dungeon_kit/";

export interface TitleSceneOptions {
  modelUrl: string;
  accent?: string;
  reducedMotion?: boolean;
}

export class TitleScene {
  readonly element: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly opts: Required<TitleSceneOptions>;

  private engine?: Engine;
  private camera?: ArcRotateCamera;
  private brasaLight?: PointLight;
  private torchLights: PointLight[] = [];
  private shadow?: ShadowGenerator;
  private resizeObs?: ResizeObserver;
  private t = 0;
  private disposed = false;

  constructor(opts: TitleSceneOptions) {
    this.opts = { accent: ACCENT_DEFAULT, reducedMotion: false, ...opts };
    this.canvas = el("canvas", { class: "title-scene-canvas" }) as HTMLCanvasElement;
    this.element = el("div", { class: "title-scene" }, this.canvas);
  }

  start(): void {
    if (this.engine || this.disposed) return;
    const engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      powerPreference: "high-performance",
    });
    this.engine = engine;
    const scene = new Scene(engine);

    const accent = Color3.FromHexString(this.opts.accent);
    scene.clearColor = new Color4(0.015, 0.025, 0.04, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.03, 0.05, 0.08);
    scene.fogDensity = 0.05;

    const camera = new ArcRotateCamera("titleCam", -Math.PI / 2, 1.36, 6.0, new Vector3(0, 1.05, 0.2), scene);
    camera.fov = 0.72;
    camera.minZ = 0.05;
    camera.maxZ = 80;
    this.camera = camera;

    // Luz fria ambiente baixíssima + recorte frio atrás (separa do breu).
    const hemi = new HemisphericLight("titleHemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.36;
    hemi.diffuse = new Color3(0.4, 0.5, 0.72);
    hemi.groundColor = new Color3(0.02, 0.03, 0.05);

    const rim = new DirectionalLight("titleRim", new Vector3(0.4, -0.25, -0.9), scene);
    rim.intensity = 0.5;
    rim.diffuse = new Color3(0.5, 0.64, 0.98);

    // Sol-de-sombra quente vindo de cima-frente: dá as sombras dramáticas no chão/parede.
    const sun = new DirectionalLight("titleSun", new Vector3(-0.25, -1, 0.55), scene);
    sun.position = new Vector3(2, 8, -4);
    sun.intensity = 0.9;
    sun.diffuse = new Color3(1.0, 0.74, 0.46);
    const shadow = new ShadowGenerator(1024, sun);
    shadow.useBlurExponentialShadowMap = true;
    shadow.blurKernel = 32;
    shadow.darkness = 0.35;
    this.shadow = shadow;

    // A Brasa: ponto quente no chão, à frente da Acendedora (entre ela e a câmera).
    const brasa = new PointLight("brasa", new Vector3(0.0, 0.4, 1.5), scene);
    brasa.diffuse = accent;
    brasa.intensity = 15.0;
    brasa.range = 16;
    this.brasaLight = brasa;

    // Preenchimento quente no tronco: a heroína É iluminada pelo fogo (não silhueta).
    const fill = new PointLight("titleFill", new Vector3(0.0, 1.25, 1.1), scene);
    fill.diffuse = new Color3(1.0, 0.72, 0.46);
    fill.intensity = 9.0;
    fill.range = 7;

    const ember = MeshBuilder.CreateSphere("brasaMesh", { diameter: 0.36, segments: 12 }, scene);
    ember.position.copyFrom(brasa.position);
    const emberMat = new StandardMaterial("brasaMat", scene);
    emberMat.emissiveColor = accent;
    emberMat.diffuseColor = new Color3(0, 0, 0);
    emberMat.specularColor = new Color3(0, 0, 0);
    ember.material = emberMat;

    const glow = new GlowLayer("titleGlow", scene);
    glow.intensity = 1.0;

    // Pipeline cinematográfico: tone mapping ACES + bloom + vinheta + grão + aberração.
    const pipe = new DefaultRenderingPipeline("titlePipe", true, scene, [camera]);
    pipe.fxaaEnabled = true;
    pipe.bloomEnabled = true;
    pipe.bloomThreshold = 0.3;
    pipe.bloomWeight = 0.85;
    pipe.bloomKernel = 64;
    pipe.bloomScale = 0.7;
    pipe.grainEnabled = true;
    pipe.grain.intensity = 7;
    pipe.grain.animated = true;
    pipe.chromaticAberrationEnabled = true;
    pipe.chromaticAberration.aberrationAmount = 6;
    const ip = pipe.imageProcessing;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.contrast = 1.15;
    ip.exposure = 1.65;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.4;
    ip.vignetteColor = new Color4(0.01, 0.015, 0.03, 1);

    if (!this.opts.reducedMotion) {
      this.spawnEmbers(scene, brasa.position, accent);
      this.spawnDust(scene);
    }

    void this.buildChamber(scene);
    void this.loadModel(scene);

    engine.runRenderLoop(() => {
      const dt = engine.getDeltaTime() / 1000;
      this.t += dt;
      const f = 0.82 + 0.18 * Math.sin(this.t * 7.3) * Math.sin(this.t * 2.1) + 0.06 * Math.sin(this.t * 19);
      brasa.intensity = 15.0 * f;
      fill.intensity = 9.0 * (0.9 + 0.1 * f);
      emberMat.emissiveColor = accent.scale(0.8 + 0.5 * f);
      for (let i = 0; i < this.torchLights.length; i++) {
        const tf = 0.7 + 0.3 * Math.sin(this.t * (9 + i * 3) + i * 2.1) + 0.1 * Math.sin(this.t * 23 + i);
        this.torchLights[i]!.intensity = 2.4 * tf;
      }
      if (!this.opts.reducedMotion && this.camera) {
        // Deriva + dolly lento (parallax cinematográfico de login screen).
        this.camera.alpha = -Math.PI / 2 + Math.sin(this.t * 0.11) * 0.13;
        this.camera.beta = 1.36 + Math.sin(this.t * 0.08) * 0.035;
        this.camera.radius = 6.0 + Math.sin(this.t * 0.05) * 0.5;
      }
      scene.render();
    });

    engine.resize();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObs = new ResizeObserver(() => this.engine?.resize());
      this.resizeObs.observe(this.canvas);
    }
  }

  setAccent(hex: string): void {
    this.opts.accent = hex;
    if (this.brasaLight) this.brasaLight.diffuse = Color3.FromHexString(hex);
  }

  dispose(): void {
    this.disposed = true;
    this.resizeObs?.disconnect();
    this.resizeObs = undefined;
    this.camera = undefined;
    this.brasaLight = undefined;
    this.torchLights = [];
    this.shadow = undefined;
    this.engine?.stopRenderLoop();
    this.engine?.dispose();
    this.engine = undefined;
  }

  /** Monta a câmara de cripta ao redor (chão, parede ao fundo, pilares, tochas). */
  private async buildChamber(scene: Scene): Promise<void> {
    const cast = (root: TransformNode): void => {
      for (const m of root.getChildMeshes(false)) {
        this.shadow?.addShadowCaster(m);
      }
    };
    try {
      const [floorC, wallC, pillarC, brokenC, torchC] = await Promise.all([
        loadContainer(scene, assetUrl(KIT + "floor.glb")),
        loadContainer(scene, assetUrl(KIT + "wall.glb")),
        loadContainer(scene, assetUrl(KIT + "pillar.glb")),
        loadContainer(scene, assetUrl(KIT + "pillar_broken.glb")),
        loadContainer(scene, assetUrl(KIT + "torch_wall.glb")),
      ]);
      if (this.disposed) return;

      const place = (c: typeof floorC, pos: Vector3, rotY = 0): TransformNode => {
        const e = c.instantiateModelsToScene();
        const root = e.rootNodes[0] as TransformNode;
        root.position.copyFrom(pos);
        root.rotation.y = rotY;
        return root;
      };

      // Chão: grade 3x3 de lajes de 6m; topo encostado em y=0 (laje afunda sob o piso).
      for (const x of [-6, 0, 6]) {
        for (const z of [-6, 0, 6]) {
          const fr = place(floorC, new Vector3(x, -1.06, z));
          for (const m of fr.getChildMeshes(false)) m.receiveShadows = true;
        }
      }
      // Parede ao fundo (atrás dela): 3 segmentos de 4m.
      for (const x of [-4, 0, 4]) {
        const w = place(wallC, new Vector3(x, 0, -4.2));
        for (const m of w.getChildMeshes(false)) m.receiveShadows = true;
        cast(w);
      }
      // Pilares ladeando, logo atrás dela (enquadram o plano).
      cast(place(pillarC, new Vector3(-3.4, 0, -2.6)));
      cast(place(pillarC, new Vector3(3.4, 0, -2.6)));
      // Pilares quebrados em PRIMEIRO PLANO (silhueta/parallax perto da câmera).
      cast(place(brokenC, new Vector3(-5.2, 0, 3.4)));
      cast(place(brokenC, new Vector3(5.2, 0, 3.4)));
      // Tochas na parede do fundo: chama emissiva (glow) + luz quente piscando.
      for (const x of [-3.2, 3.2]) {
        place(torchC, new Vector3(x, 2.4, -3.7));
        const tl = new PointLight(`torchL${x}`, new Vector3(x, 2.6, -3.2), scene);
        tl.diffuse = new Color3(1.0, 0.66, 0.36);
        tl.intensity = 2.4;
        tl.range = 8;
        this.torchLights.push(tl);
      }
    } catch (err) {
      console.warn("[title-scene] câmara não carregou (segue só com a figura)", err);
    }
  }

  private spawnEmbers(scene: Scene, at: Vector3, accent: Color3): void {
    const tex = softDot(scene, "emberTex");
    const ps = new ParticleSystem("embers", 240, scene);
    ps.particleTexture = tex;
    ps.emitter = at.clone();
    ps.minEmitBox = new Vector3(-0.8, -0.1, -0.8);
    ps.maxEmitBox = new Vector3(0.8, 0.2, 0.8);
    ps.color1 = new Color4(accent.r, accent.g, accent.b, 0.95);
    ps.color2 = new Color4(1, 0.85, 0.5, 0.85);
    ps.colorDead = new Color4(accent.r * 0.4, accent.g * 0.2, 0, 0);
    ps.minSize = 0.015;
    ps.maxSize = 0.06;
    ps.minLifeTime = 2.2;
    ps.maxLifeTime = 5.5;
    ps.emitRate = 42;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new Vector3(0, 0.4, 0);
    ps.direction1 = new Vector3(-0.3, 1, -0.3);
    ps.direction2 = new Vector3(0.3, 1.5, 0.3);
    ps.minEmitPower = 0.15;
    ps.maxEmitPower = 0.55;
    ps.updateSpeed = 0.02;
    ps.start();
  }

  /** Poeira/cinza flutuando na câmara inteira (profundidade atmosférica). */
  private spawnDust(scene: Scene): void {
    const tex = softDot(scene, "dustTex");
    const ps = new ParticleSystem("dust", 160, scene);
    ps.particleTexture = tex;
    ps.emitter = new Vector3(0, 2.2, -0.5);
    ps.minEmitBox = new Vector3(-7, -2, -5);
    ps.maxEmitBox = new Vector3(7, 2.5, 5);
    ps.color1 = new Color4(0.7, 0.75, 0.85, 0.06);
    ps.color2 = new Color4(0.9, 0.8, 0.6, 0.09);
    ps.colorDead = new Color4(0.5, 0.55, 0.65, 0);
    ps.minSize = 0.01;
    ps.maxSize = 0.035;
    ps.minLifeTime = 6;
    ps.maxLifeTime = 12;
    ps.emitRate = 22;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.gravity = new Vector3(0.05, -0.02, 0);
    ps.minEmitPower = 0.02;
    ps.maxEmitPower = 0.12;
    ps.updateSpeed = 0.015;
    ps.start();
  }

  private async loadModel(scene: Scene): Promise<void> {
    let meshes: AbstractMesh[];
    try {
      const r = await ImportMeshAsync(assetUrl(this.opts.modelUrl), scene, { pluginExtension: ".glb" });
      meshes = r.meshes;
    } catch (err) {
      console.warn(`[title-scene] falha ao carregar ${this.opts.modelUrl}`, err);
      return;
    }
    if (this.disposed) return;
    const top = meshes.find((m) => m.name === "__root__") ?? meshes[0];
    if (!top) return;
    const { min, max } = top.getHierarchyBoundingVectors(true);
    const h = Math.max(0.001, max.y - min.y);
    const scale = FIT_HEIGHT / h;
    const cx = (min.x + max.x) / 2;
    const cz = (min.z + max.z) / 2;
    const fit = new TransformNode("titleFit", scene);
    fit.scaling.setAll(scale);
    fit.position.set(-cx * scale, -min.y * scale, -cz * scale);
    top.parent = fit;
    for (const m of meshes) {
      m.receiveShadows = true;
      this.shadow?.addShadowCaster(m);
    }
    this.element.classList.add("title-scene-ready");
  }
}

/** Textura de ponto radial macio (fagulha/poeira), desenhada sem asset externo. */
function softDot(scene: Scene, name: string): DynamicTexture {
  const tex = new DynamicTexture(name, 64, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,210,150,0.7)");
  g.addColorStop(1, "rgba(255,150,70,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  tex.update();
  return tex;
}
