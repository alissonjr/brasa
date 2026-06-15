import {
  Material,
  MaterialPluginBase,
  Matrix,
  Mesh,
  MeshBuilder,
  MultiMaterial,
  PhysicsAggregate,
  PhysicsShapeType,
  Quaternion,
  ShaderLanguage,
  UniformBuffer,
  Vector3,
} from "@babylonjs/core";
import type { AssetContainer, Scene, ShadowGenerator } from "@babylonjs/core";
import { QuadraticErrorSimplification } from "@babylonjs/core/Meshes/meshSimplification";
import { applyFlat, mulberry32 } from "./sceneKit";
import { terrainHeightAt } from "./world";

/**
 * CAMADA JOGO. Vegetação por THIN INSTANCES (mesma estratégia de masonry.ts): cada
 * espécie vira UMA malha base (os meshes do glTF mesclados em uma só) e todas as
 * cópias entram num único buffer de matrizes = 1 draw call por espécie, mesmo com
 * dezenas/centenas de plantas. Substitui o antigo espalhamento por modelo
 * (instantiateModelsToScene por planta), que furava o teto de < 100 draw calls da
 * cena (ver docs/biblia-ambientes.md Parte 4 / ficha 4.1 e padrao-de-detalhe.md 2.1).
 *
 * A malha base é normalizada (base em y=0, centro XZ na origem) e DECIMADA ao
 * orçamento low-poly da régua 2.1: os modelos CC0/IA chegam com dezenas de milhares de
 * tris (tronco ~102k, arbusto ~27k, palmeira ~16k), muito acima do alvo (tufo 20-80,
 * arbusto 50-200, árvore 200-500). A decimação por erro quadrático (Babylon) traz a
 * geometria renderizada para o alvo. Cada cópia recebe jitter de cor (~±8%) e VENTO
 * (duas senoidais no vertex shader, fase por instância), conforme a seção "Vegetação:
 * valores ratificados" da bíblia de ambientes.
 *
 * A COLISÃO, quando pedida, fica em caixas invisíveis na cena (thin instances não
 * carregam física), como nos demais props.
 */
const Y_AXIS = new Vector3(0, 1, 0);

export interface FoliageTemplate {
  base: Mesh; // malha mesclada na origem (identidade), pronta para thin instances
  nativeHeight: number; // altura da base (m de modelo) para escalar por altura-alvo
  footX: number; // largura nativa (para dimensionar colisor)
  footZ: number; // profundidade nativa (para dimensionar colisor)
}

export interface FoliagePlacement {
  x: number;
  z: number;
  rotY?: number;
  targetH?: number; // altura final em metros (escala = targetH / nativeHeight)
  scale?: number; // OU multiplicador do tamanho nativo (default 1); ignorado se targetH
  y?: number; // Y da base; se omitido, assenta no terreno via terrainHeightAt
}

export interface ScatterOpts {
  collider?: "box" | "none"; // caixa invisível por instância (troncos sólidos)
  /**
   * Jitter de tom por instância (0..1): multiplica a cor base de cada cópia por um
   * fator próximo de 1, com leve viés no verde, para que plantas idênticas não saiam
   * clonadas. 0 desliga. Default 0.08 (~±8%, valor ratificado em biblia-ambientes.md,
   * seção "Vegetação: valores ratificados"). Aplicado via buffer de cor dos thin instances.
   */
  tintJitter?: number;
  tintSeed?: number; // semente do PRNG do jitter (determinístico para save)
  /**
   * Amplitude do vento em radianos (sway = amplitude * altura_do_vertice * onda).
   * Ratificado ~0,03-0,08; default 0.06. 0 desliga o vento.
   */
  windAmplitude?: number;
}

/* --------------------------------------------------------------------------
 * Vento: material plugin que balança os vértices no vertex shader (GPU). Duas
 * senoidais (~0,5 e ~1,1 Hz), fase por instância (atributo windPhase dos thin
 * instances), amplitude escalada pela altura do vértice acima da base (a base não
 * se mexe, a copa balança mais). Aplicado em mundo (direção de vento global).
 * ------------------------------------------------------------------------ */
const W1 = 2 * Math.PI * 0.5; // ~0,5 Hz
const W2 = 2 * Math.PI * 1.1; // ~1,1 Hz

const windClocks = new WeakMap<Scene, { t: number }>();
function windClock(scene: Scene): { t: number } {
  let c = windClocks.get(scene);
  if (!c) {
    const clk = { t: 0 };
    scene.onBeforeRenderObservable.add(() => {
      clk.t += scene.getEngine().getDeltaTime() / 1000;
    });
    windClocks.set(scene, clk);
    c = clk;
  }
  return c;
}

class FoliageWindPlugin extends MaterialPluginBase {
  constructor(material: Material, private clock: { t: number }, private amplitude: number) {
    super(material, "FoliageWind", 200, { FOLIAGE_WIND: true });
    this._enable(true);
  }

  getClassName(): string {
    return "FoliageWindPlugin";
  }

  // Compatível com GLSL (WebGL2) E WGSL (WebGPU). O default da base só aceita GLSL,
  // o que derrubava o boot em WebGPU ("plugin not compatible with the shader language").
  isCompatible(shaderLanguage: ShaderLanguage): boolean {
    return shaderLanguage === ShaderLanguage.GLSL || shaderLanguage === ShaderLanguage.WGSL;
  }

  prepareDefines(defines: Record<string, unknown>): void {
    defines.FOLIAGE_WIND = true;
  }

  getAttributes(attributes: string[]): void {
    attributes.push("windPhase");
  }

  getUniforms(shaderLanguage: ShaderLanguage = ShaderLanguage.GLSL) {
    const ubo = [
      { name: "windTime", size: 1, type: "float" },
      { name: "windParams", size: 4, type: "vec4" },
    ];
    // WGSL: o Babylon declara os membros do ubo automaticamente (uniforms.X); a string
    // extra só é necessária no GLSL.
    if (shaderLanguage === ShaderLanguage.WGSL) return { ubo };
    return {
      ubo,
      vertex: `#ifdef FOLIAGE_WIND
uniform float windTime;
uniform vec4 windParams;
#endif`,
    };
  }

  bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateFloat("windTime", this.clock.t);
    uniformBuffer.updateFloat4("windParams", this.amplitude, W1, W2, 0);
  }

  getCustomCode(
    shaderType: string,
    shaderLanguage: ShaderLanguage = ShaderLanguage.GLSL
  ): { [point: string]: string } | null {
    if (shaderType !== "vertex") return null;

    // WGSL (WebGPU): o processador de shader monta a struct vertexInputs a partir de
    // declarações `attribute nome: tipo;` no código (regex em webgpuShaderProcessorsWGSL);
    // então o atributo PRECISA ser declarado aqui (não basta getAttributes). Uniforms via
    // uniforms.*, e worldPos/finalWorld já existem no ponto de injeção.
    if (shaderLanguage === ShaderLanguage.WGSL) {
      return {
        CUSTOM_VERTEX_DEFINITIONS: `#ifdef FOLIAGE_WIND
attribute windPhase: f32;
#endif`,
        CUSTOM_VERTEX_UPDATE_WORLDPOS: `#ifdef FOLIAGE_WIND
{
  let wH = max(worldPos.y - finalWorld[3].y, 0.0);
  let wWave = sin(uniforms.windParams.y * uniforms.windTime + vertexInputs.windPhase) + 0.5 * sin(uniforms.windParams.z * uniforms.windTime + vertexInputs.windPhase * 1.7);
  let wSway = uniforms.windParams.x * wH * wWave;
  worldPos.x += wSway * 0.8;
  worldPos.z += wSway * 0.6;
}
#endif`,
      };
    }

    // GLSL (WebGL2).
    return {
      CUSTOM_VERTEX_DEFINITIONS: `#ifdef FOLIAGE_WIND
attribute float windPhase;
#endif`,
      // worldPos e finalWorld já existem aqui; finalWorld[3].y = base da instância.
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `#ifdef FOLIAGE_WIND
float wH = max(worldPos.y - finalWorld[3].y, 0.0);
float wWave = sin(windParams.y * windTime + windPhase) + 0.5 * sin(windParams.z * windTime + windPhase * 1.7);
float wSway = windParams.x * wH * wWave;
worldPos.x += wSway * 0.8;
worldPos.z += wSway * 0.6;
#endif`,
    };
  }
}

/* --------------------------------------------------------------------------
 * Templates.
 * ------------------------------------------------------------------------ */

/**
 * Mescla os meshes de um container em uma única malha base normalizada e a decima ao
 * orçamento. Se `hex` for dado, aplica cor chapada antes de mesclar (CC0 sem textura);
 * sem `hex`, preserva os materiais do modelo (glb com textura, ex.: palmeira).
 * `targetTris` (se dado) decima a geometria renderizada até ~esse número de triângulos.
 */
export async function makeFoliageTemplate(
  scene: Scene,
  container: AssetContainer,
  name: string,
  hex?: string,
  targetTris?: number
): Promise<FoliageTemplate> {
  if (hex) applyFlat(scene, container, hex);
  const src = container.meshes.filter((m) => m.getTotalVertices() > 0) as Mesh[];
  src.forEach((m) => m.computeWorldMatrix(true));
  // disposeSource=false: o mesmo container pode virar vários templates (ex.: palmeira
  // reusada na cidade, no oásis e na lâmina d'água). As malhas-fonte não entram na cena
  // (ficam no AssetContainer), então não renderizam nem custam draw call.
  const merged = Mesh.MergeMeshes(src, false, true, undefined, false, true);
  if (!merged) throw new Error("Falha ao mesclar vegetação: " + name);
  merged.name = name;

  // Normaliza: base em y=0, centro XZ na origem, transform em identidade na origem
  // (assim a matriz de cada thin instance vale como matriz de mundo).
  const bb = merged.getBoundingInfo().boundingBox;
  const cx = (bb.minimum.x + bb.maximum.x) / 2;
  const cz = (bb.minimum.z + bb.maximum.z) / 2;
  merged.bakeTransformIntoVertices(Matrix.Translation(-cx, -bb.minimum.y, -cz));
  merged.refreshBoundingInfo();

  const base = targetTris ? await decimate(merged, targetTris, name) : merged;

  const b2 = base.getBoundingInfo().boundingBox;
  const nativeHeight = Math.max(0.001, b2.maximum.y - b2.minimum.y);
  const footX = b2.maximum.x - b2.minimum.x;
  const footZ = b2.maximum.z - b2.minimum.z;

  base.isPickable = false;
  base.receiveShadows = true;
  return { base, nativeHeight, footX, footZ };
}

/** Decima a malha ao orçamento (erro quadrático). Em falha, mantém a malha original. */
function decimate(mesh: Mesh, targetTris: number, name: string): Promise<Mesh> {
  const before = mesh.getTotalIndices() / 3;
  if (before <= targetTris * 1.1) return Promise.resolve(mesh);
  const quality = Math.max(0.002, Math.min(1, targetTris / before));
  return new Promise<Mesh>((resolve) => {
    new QuadraticErrorSimplification(mesh).simplify(
      { quality, distance: 0, optimizeMesh: true },
      (simplified) => {
        const after = simplified.getTotalIndices() / 3;
        console.info(`[vegetacao] ${name}: ${before} -> ${after} tris (alvo ${targetTris})`);
        simplified.name = name;
        mesh.dispose();
        resolve(simplified);
      }
    );
    // Sem errorCallback no simplificador direto: se nunca resolver, a build falha
    // visivelmente em dev; em produção o catch do chamador segue com a malha cheia.
  }).catch(() => {
    console.warn(`[vegetacao] decimação falhou em ${name}; mantendo malha cheia`);
    return mesh;
  });
}

/** Carrega um glTF/.glb e o transforma em template de vegetação. */
export async function loadFoliageTemplate(
  scene: Scene,
  loadContainer: (scene: Scene, url: string) => Promise<AssetContainer>,
  url: string,
  name: string,
  hex?: string,
  targetTris?: number
): Promise<FoliageTemplate> {
  const container = await loadContainer(scene, url);
  return makeFoliageTemplate(scene, container, name, hex, targetTris);
}

/* --------------------------------------------------------------------------
 * Espalhamento.
 * ------------------------------------------------------------------------ */

/**
 * Espalha as cópias de uma espécie como thin instances (1 draw call por submaterial),
 * assentando cada uma no terreno, com jitter de cor e vento por instância.
 */
export function scatterFoliage(
  scene: Scene,
  shadow: ShadowGenerator,
  tpl: FoliageTemplate,
  placements: FoliagePlacement[],
  opts: ScatterOpts = {}
): void {
  const base = tpl.base;
  if (placements.length === 0) {
    base.setEnabled(false);
    return;
  }
  const jitter = opts.tintJitter ?? 0.08;
  const windAmp = opts.windAmplitude ?? 0.06;
  const rng = mulberry32(opts.tintSeed ?? 0x5eaf);

  const data: number[] = [];
  const colors: number[] = [];
  const phases: number[] = [];
  for (const p of placements) {
    const s = p.targetH ? p.targetH / tpl.nativeHeight : p.scale ?? 1;
    const rotY = p.rotY ?? 0;
    const pos = new Vector3(p.x, p.y ?? terrainHeightAt(p.x, p.z), p.z);
    const m = Matrix.Compose(new Vector3(s, s, s), Quaternion.RotationAxis(Y_AXIS, rotY), pos);
    const a = m.asArray();
    for (let i = 0; i < 16; i++) data.push(a[i] as number);
    if (jitter > 0) {
      // Multiplicador de brilho por instância + leve viés no verde (vida vegetal).
      const v = 1 - jitter + rng() * 2 * jitter;
      const g = 1 + (rng() - 0.5) * jitter;
      colors.push(v, v * g, v, 1);
    }
    if (windAmp > 0) phases.push(rng() * Math.PI * 2);
    if (opts.collider === "box") addFoliageBox(scene, tpl, s, rotY, pos);
  }

  base.thinInstanceSetBuffer("matrix", new Float32Array(data), 16, true);
  if (jitter > 0) base.thinInstanceSetBuffer("color", new Float32Array(colors), 4, true);
  if (windAmp > 0) {
    base.thinInstanceSetBuffer("windPhase", new Float32Array(phases), 1, true);
    attachWind(scene, base, windAmp);
  }
  base.thinInstanceRefreshBoundingInfo(true);
  shadow.addShadowCaster(base);
}

/**
 * Aplica vento a uma malha thin-instanced QUALQUER (ex.: tufos de grama/junco montados
 * fora deste módulo): gera a fase por instância e anexa o plugin. Reutiliza o mesmo
 * shader de vento das demais plantas, para a folhagem balançar de forma coerente.
 */
export function addFoliageWind(
  scene: Scene,
  mesh: Mesh,
  instanceCount: number,
  amplitude = 0.06,
  seed = 0x21d
): void {
  if (amplitude <= 0 || instanceCount <= 0) return;
  const rng = mulberry32(seed);
  const phases: number[] = [];
  for (let i = 0; i < instanceCount; i++) phases.push(rng() * Math.PI * 2);
  mesh.thinInstanceSetBuffer("windPhase", new Float32Array(phases), 1, true);
  attachWind(scene, mesh, amplitude);
}

/** Anexa o vento a cada material (sub)material da malha base, uma única vez. */
function attachWind(scene: Scene, base: Mesh, amplitude: number): void {
  // O plugin de vento fornece só código GLSL; no WebGPU o material usa WGSL e o Babylon
  // recusa o plugin (quebrava o boot). Enquanto não houver versão WGSL do shader, pula o
  // vento no WebGPU: a folhagem fica estática, mas a cena carrega. No WebGL2 segue normal.
  if ((scene.getEngine() as { isWebGPU?: boolean }).isWebGPU) return;
  const clock = windClock(scene);
  const mats =
    base.material instanceof MultiMaterial
      ? base.material.subMaterials.filter((m): m is Material => !!m)
      : base.material
        ? [base.material]
        : [];
  for (const mat of mats) {
    if (mat.pluginManager?.getPlugin("FoliageWind")) continue;
    new FoliageWindPlugin(mat, clock, amplitude);
  }
}

/** Caixa estática invisível ajustada ao tronco escalado (mass 0). */
function addFoliageBox(scene: Scene, tpl: FoliageTemplate, s: number, rotY: number, pos: Vector3): void {
  const w = tpl.footX * s * 0.7;
  const h = tpl.nativeHeight * s;
  const d = tpl.footZ * s * 0.7;
  if (w <= 0 || h <= 0 || d <= 0) return;
  const box = MeshBuilder.CreateBox("colisor_veg", { width: w, height: h, depth: d }, scene);
  box.position.set(pos.x, pos.y + h / 2, pos.z);
  box.rotation.y = rotY;
  box.isVisible = false;
  box.isPickable = false;
  new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene);
}
