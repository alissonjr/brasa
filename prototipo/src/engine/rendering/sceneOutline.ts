import { Effect, PostProcess } from "@babylonjs/core";
import { Color3 } from "@babylonjs/core";
import type { Camera, RenderTargetTexture } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Contorno de tinta de CENA via edge-detect full-screen sobre a
 * PROFUNDIDADE (DepthRenderer, alvo único): um Sobel pinta linha escura nos saltos de
 * profundidade (silhuetas e quebras de geometria do MUNDO). Coexiste com o inverted-hull dos
 * atores (§4.1b): o hull dá o contorno grosso e art-directável dos atores/chefe; este dá a
 * linha do cenário. Ver spec-estilo-visual-render §4.3.
 *
 * Usamos só profundidade (não normal) de propósito: um DepthRenderer é ALVO ÚNICO, evitando o
 * MRT do GeometryBufferRenderer (que disparava "missing fragment shader outputs" com o
 * CellMaterial/outline e custava caro). Silhueta por profundidade + hull dos atores já entrega
 * a leitura inkada; vincos internos ficam por conta do toon/AO.
 *
 * Se um addFinishingPass vier depois na mesma câmera, ele ABSORVE este passe (a linha é desenhada
 * no mesmo shader do posterize/papel: 1 passe full-screen a menos); este PostProcess é descartado.
 *
 * Política WebGPU x WebGL2 (§2.3): shader GLSL. Em WebGPU é pulado com aviso (fica o hull); o
 * resto da pilha segue valendo. Verificável em WebGL2 (?renderer=webgl).
 */

const SHADER = "brasaSceneOutline";

const GLSL = `
varying vec2 vUV;
uniform sampler2D textureSampler; // cor da cena
uniform sampler2D depthSampler;   // profundidade linear 0..1 (DepthRenderer)
uniform vec2 texel;            // 1/resolução
uniform float depthThreshold; // sensibilidade da silhueta
uniform float thickness;      // multiplicador do passo (linha mais grossa)
uniform vec3 lineColor;
uniform float lineStrength;

float depthAt(vec2 uv){ return texture2D(depthSampler, uv).r; }

void main(void){
  vec4 c = texture2D(textureSampler, vUV);
  vec2 o = texel * thickness;

  float dC = depthAt(vUV);
  float dR = depthAt(vUV + vec2(o.x, 0.0));
  float dL = depthAt(vUV - vec2(o.x, 0.0));
  float dD = depthAt(vUV + vec2(0.0, o.y));
  float dU = depthAt(vUV - vec2(0.0, o.y));
  // Sobel-ish: soma das diferenças com os vizinhos. dC ~1.0 é o fundo (sem geometria): ignora.
  float depthEdge = abs(dC - dR) + abs(dC - dL) + abs(dC - dD) + abs(dC - dU);
  float dThresh = depthThreshold * (0.4 + dC * 1.6); // limiar cresce com a profundidade (sem serrilhar o fundo)
  float edge = step(dThresh, depthEdge) * step(dC, 0.999) * lineStrength;

  gl_FragColor = vec4(mix(c.rgb, lineColor, edge), c.a);
}
`;

export interface SceneOutlineOptions {
  depthThreshold?: number; // default 0.0025 (profundidade linear normalizada)
  thickness?: number; // passo do Sobel em pixels. Default 1.3
  color?: Color3; // default near-black frio
  strength?: number; // 0..1 mistura da linha. Default 0.85
}

export interface SceneOutlineHandle {
  postProcess: PostProcess;
  dispose(): void;
}

const DEFAULT_COLOR = Color3.FromHexString("#0a0d14");

/** Configuração do edge-detect de uma câmera, para o passe de finalização absorvê-lo (1 passe a menos). */
export interface SceneOutlineConfig {
  depthMap: RenderTargetTexture;
  depthThreshold: number;
  thickness: number;
  color: Color3;
  strength: number;
  /** Passe próprio do edge-detect (o finishing o descarta ao absorver a linha no seu shader). */
  postProcess: PostProcess;
}
const CONFIGS = new WeakMap<Camera, SceneOutlineConfig>();
/** Config do edge-detect desta câmera (se houver). Usado por addFinishingPass. */
export function getSceneOutlineConfig(camera: Camera): SceneOutlineConfig | undefined {
  return CONFIGS.get(camera);
}
export function clearSceneOutlineConfig(camera: Camera): void {
  CONFIGS.delete(camera);
}

export function addSceneOutline(camera: Camera, opts: SceneOutlineOptions = {}): SceneOutlineHandle | null {
  const scene = camera.getScene();
  const engine = scene.getEngine();
  const isWebGPU = (engine as unknown as { isWebGPU?: boolean }).isWebGPU === true || engine.constructor.name === "WebGPUEngine";
  if (isWebGPU) {
    console.warn("[render] edge-detect de cena (GLSL) pulado em WebGPU; fica o inverted-hull (spec §2.3).");
    return null;
  }

  // DepthRenderer de alvo único (profundidade linear 0..1). Sem MRT, sem mismatch de outputs.
  const depthRenderer = scene.enableDepthRenderer(camera, false);
  const depthMap = depthRenderer.getDepthMap();

  Effect.ShadersStore[SHADER + "FragmentShader"] = GLSL;
  const color = (opts.color ?? DEFAULT_COLOR).clone();
  const depthThreshold = opts.depthThreshold ?? 0.0025;
  const thickness = opts.thickness ?? 1.3;
  const strength = opts.strength ?? 0.85;

  const pp = new PostProcess(
    SHADER,
    SHADER,
    ["texel", "depthThreshold", "thickness", "lineColor", "lineStrength"],
    ["depthSampler"],
    1.0,
    camera
  );
  pp.onApply = (effect) => {
    effect.setTexture("depthSampler", depthMap);
    effect.setFloat2("texel", 1 / pp.width, 1 / pp.height);
    effect.setFloat("depthThreshold", depthThreshold);
    effect.setFloat("thickness", thickness);
    effect.setColor3("lineColor", color);
    effect.setFloat("lineStrength", strength);
  };

  CONFIGS.set(camera, { depthMap, depthThreshold, thickness, color, strength, postProcess: pp });
  return {
    postProcess: pp,
    dispose(): void {
      CONFIGS.delete(camera);
      pp.dispose(camera);
      scene.disableDepthRenderer(camera);
    },
  };
}
