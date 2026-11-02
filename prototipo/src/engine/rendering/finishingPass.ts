import { DynamicTexture, Effect, PostProcess } from "@babylonjs/core";
import type { Camera, Texture } from "@babylonjs/core";
import { clearSceneOutlineConfig, getSceneOutlineConfig } from "./sceneOutline";

/**
 * CAMADA ENGINE (genérica). Passe de FINALIZAÇÃO "impresso": posterize (poucos níveis de cor)
 * + dither ordenado (Bayer 4x4, quebra banding de forma estilizada) + multiply de PAPEL
 * (textura procedural de fibra, tira o aspecto plástico). Liga DEPOIS do pipeline (grão/
 * vinheta permanecem). Ver docs/brasa/spec-estilo-visual-render.md §4.2(a).
 *
 * Política WebGPU x WebGL2 (§2.3): o shader é GLSL. Em WebGPU (que precisaria de WGSL), o
 * passe é PULADO com aviso; o restante da pilha (toon + outline + SSAO + grão) segue valendo.
 * Verificável em WebGL2 (?renderer=webgl).
 */

const SHADER = "brasaFinishing";

const GLSL = `
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D paperSampler;
uniform float posterizeLevels;
uniform float ditherStrength;
uniform float paperStrength;
#ifdef GRAIN
uniform float grainIntensity;
uniform float animatedSeed;
#endif
#ifdef EDGE
uniform sampler2D depthSampler;   // profundidade linear 0..1 (DepthRenderer)
uniform vec2 texel;
uniform float depthThreshold;
uniform float thickness;
uniform vec3 lineColor;
uniform float lineStrength;
float depthAt(vec2 uv){ return texture2D(depthSampler, uv).r; }
#endif

// Matriz de Bayer 4x4 (0..15) para dither ordenado. mat4 é coluna-maior: m[col][row].
float bayer4(vec2 fragxy){
  int x = int(mod(fragxy.x, 4.0));
  int y = int(mod(fragxy.y, 4.0));
  mat4 m = mat4(
     0.0,  8.0,  2.0, 10.0,
    12.0,  4.0, 14.0,  6.0,
     3.0, 11.0,  1.0,  9.0,
    15.0,  7.0, 13.0,  5.0);
  return m[x][y];
}

void main(void){
  vec4 c = texture2D(textureSampler, vUV);
#ifdef GRAIN
  // grão de película (mesma conta do GrainPostProcess do Babylon): mais forte nos tons médios
  {
    float r = fract(sin(dot(vUV * animatedSeed, vec2(12.9898, 78.233))) * 43758.5453);
    float g = mix(-grainIntensity / 255.0, grainIntensity / 255.0, r);
    float lum = clamp(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
    float amount = (cos(-3.14159265 + lum * 6.2831853) + 1.0) / 2.0;
    c.rgb = max(c.rgb + g * amount, 0.0);
  }
#endif
#ifdef EDGE
  // contorno de tinta do cenário: Sobel sobre a profundidade (antes do posterize, a linha também é papelada)
  {
    vec2 o = texel * thickness;
    float dC = depthAt(vUV);
    float dR = depthAt(vUV + vec2(o.x, 0.0));
    float dL = depthAt(vUV - vec2(o.x, 0.0));
    float dD = depthAt(vUV + vec2(0.0, o.y));
    float dU = depthAt(vUV - vec2(0.0, o.y));
    float depthEdge = abs(dC - dR) + abs(dC - dL) + abs(dC - dD) + abs(dC - dU);
    float dThresh = depthThreshold * (0.4 + dC * 1.6); // limiar cresce com a profundidade
    float edge = step(dThresh, depthEdge) * step(dC, 0.999) * lineStrength;
    c.rgb = mix(c.rgb, lineColor, edge);
  }
#endif
  // dither: empurra a cor +/- meio nível ANTES do posterize (escolhe a faixa vizinha)
  float d = (bayer4(gl_FragCoord.xy) + 0.5) / 16.0 - 0.5; // -0.5..0.5
  vec3 col = c.rgb + d * (ditherStrength / max(posterizeLevels, 1.0));
  // posterize: corta em poucos níveis (look impresso)
  col = floor(col * posterizeLevels + 0.5) / posterizeLevels;
  // papel: multiply suave de uma fibra clara (escurece de leve, dá textura)
  vec3 paper = texture2D(paperSampler, vUV * 2.0).rgb;
  col *= mix(vec3(1.0), paper, paperStrength);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
}
`;

export interface FinishingOptions {
  /** Níveis de posterize (mais = mais suave). Default 20. */
  posterizeLevels?: number;
  /** Intensidade do dither (0..1). Default 0.6. */
  ditherStrength?: number;
  /** Intensidade do papel no multiply (0..1). Default 0.16. */
  paperStrength?: number;
  /** Grão de película embutido neste passe (em vez do GrainPostProcess do pipeline: 1 passe a menos). */
  grain?: FinishingGrain;
}

export interface FinishingGrain {
  /** Intensidade em níveis de 0..255 (igual ao `grain.intensity` do pipeline). */
  intensity: number;
  /** Sorteia uma semente nova a cada quadro (grão vivo). */
  animated: boolean;
}

const GRAIN = new WeakMap<Camera, FinishingGrain>();
/** Declara o grão da câmera ANTES de addFinishingPass: ele o embute no próprio shader (o chamador desliga o do pipeline). */
export function setFinishingGrain(camera: Camera, grain: FinishingGrain): void {
  GRAIN.set(camera, grain);
}
/** Grão declarado para a câmera (se houver). */
export function getFinishingGrain(camera: Camera): FinishingGrain | undefined {
  return GRAIN.get(camera);
}

export interface FinishingHandle {
  postProcess: PostProcess;
  dispose(): void;
}

/** Gera uma textura de PAPEL procedural (fibra clara) sem precisar de asset em disco. */
function makePaperTexture(scene: import("@babylonjs/core").Scene): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture("paper", { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  // Fibra: muitos riscos curtos cinza-claros em ângulos aleatórios (determinístico via seno).
  for (let i = 0; i < 4200; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 12543.987) % 1;
    const a = (Math.sin(i * 3.17) * 1000) % 1;
    const g = 200 + Math.floor((Math.abs(Math.sin(i * 1.7)) * 45)); // 200..245
    const px = Math.abs(x) * size;
    const py = Math.abs(y) * size;
    const len = 1 + Math.abs(a) * 3;
    ctx.strokeStyle = `rgb(${g},${g},${g})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + len, py + len * (a > 0.5 ? 1 : -1));
    ctx.stroke();
  }
  tex.update(false);
  (tex as unknown as Texture).wrapU = 1; // WRAP
  (tex as unknown as Texture).wrapV = 1;
  return tex;
}

/** Liga o passe de finalização. Retorna null (e avisa) se o backend não roda o shader GLSL. */
export function addFinishingPass(camera: Camera, opts: FinishingOptions = {}): FinishingHandle | null {
  const scene = camera.getScene();
  const engine = scene.getEngine();
  const isWebGPU = (engine as unknown as { isWebGPU?: boolean }).isWebGPU === true || engine.constructor.name === "WebGPUEngine";
  if (isWebGPU) {
    console.warn("[render] passe de finalização (GLSL) pulado em WebGPU; ver spec §2.3 (WGSL pendente).");
    return null;
  }

  Effect.ShadersStore[SHADER + "FragmentShader"] = GLSL;
  const paper = makePaperTexture(scene);
  const levels = opts.posterizeLevels ?? 20;
  const dither = opts.ditherStrength ?? 0.6;
  const paperStrength = opts.paperStrength ?? 0.16;

  // Absorve o edge-detect de cena (se houver) e o grão: tudo no mesmo shader, 2 passes full-screen a menos.
  const edge = getSceneOutlineConfig(camera);
  const grain = opts.grain ?? GRAIN.get(camera);
  const defines = [edge ? "#define EDGE" : "", grain ? "#define GRAIN" : ""].filter(Boolean).join("\n");
  const uniforms = ["posterizeLevels", "ditherStrength", "paperStrength"];
  const samplers = ["paperSampler"];
  if (edge) { uniforms.push("texel", "depthThreshold", "thickness", "lineColor", "lineStrength"); samplers.push("depthSampler"); }
  if (grain) uniforms.push("grainIntensity", "animatedSeed");
  const pp = new PostProcess(SHADER, SHADER, uniforms, samplers, 1.0, camera, undefined, undefined, undefined, defines || undefined);
  pp.onApply = (effect) => {
    effect.setFloat("posterizeLevels", levels);
    effect.setFloat("ditherStrength", dither);
    effect.setFloat("paperStrength", paperStrength);
    effect.setTexture("paperSampler", paper);
    if (edge) {
      effect.setTexture("depthSampler", edge.depthMap);
      effect.setFloat2("texel", 1 / pp.width, 1 / pp.height);
      effect.setFloat("depthThreshold", edge.depthThreshold);
      effect.setFloat("thickness", edge.thickness);
      effect.setColor3("lineColor", edge.color);
      effect.setFloat("lineStrength", edge.strength);
    }
    if (grain) {
      effect.setFloat("grainIntensity", grain.intensity);
      effect.setFloat("animatedSeed", grain.animated ? Math.random() + 1 : 1);
    }
  };
  if (edge) {
    edge.postProcess.dispose(camera); // o passe próprio do edge-detect some: a linha vive neste shader
    clearSceneOutlineConfig(camera);
  }

  return {
    postProcess: pp,
    dispose(): void {
      pp.dispose(camera);
      paper.dispose();
    },
  };
}
