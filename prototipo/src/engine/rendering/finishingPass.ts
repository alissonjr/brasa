import { DynamicTexture, Effect, PostProcess } from "@babylonjs/core";
import type { Camera, Texture } from "@babylonjs/core";

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

  const pp = new PostProcess(SHADER, SHADER, ["posterizeLevels", "ditherStrength", "paperStrength"], ["paperSampler"], 1.0, camera);
  pp.onApply = (effect) => {
    effect.setFloat("posterizeLevels", levels);
    effect.setFloat("ditherStrength", dither);
    effect.setFloat("paperStrength", paperStrength);
    effect.setTexture("paperSampler", paper);
  };

  return {
    postProcess: pp,
    dispose(): void {
      pp.dispose(camera);
      paper.dispose();
    },
  };
}
