import { Engine, WebGPUEngine } from "@babylonjs/core";
import type { AbstractEngine } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica/reutilizável). Cria a engine de render.
 *
 * PADRÃO: WebGL2. O look estilizado do jogo (CellMaterial, contorno, brilho, SSAO e os
 * passes GLSL de acabamento) foi construído e verificado em WebGL2; em WebGPU essas peças
 * não compilam e a cena inteira fica PRETA (confirmado no Chrome com WebGPU). Por isso
 * o WebGPU é opt-in até esses materiais ganharem versão WGSL.
 *
 * Escolher o renderer pela URL:
 *   (sem parâmetro)    -> WebGL2
 *   ?renderer=webgl    -> WebGL2
 *   ?renderer=webgpu   -> WebGPU, com fallback para WebGL2 se não iniciar (o initAsync
 *                         pode buscar o transpiler twgsl/glslang num CDN, então tem timeout)
 */
export async function createEngine(canvas: HTMLCanvasElement): Promise<AbstractEngine> {
  const renderer = new URLSearchParams(location.search).get("renderer");
  const allowWebGPU = renderer === "webgpu";
  const allowWebGL = true;

  if (allowWebGPU && (await WebGPUEngine.IsSupportedAsync)) {
    try {
      const engine = new WebGPUEngine(canvas, { antialias: true, stencil: true });
      await withTimeout(engine.initAsync(), 6000, "WebGPUEngine.initAsync");
      return engine;
    } catch (err) {
      if (!allowWebGL) throw err;
      console.warn("[engine] WebGPU indisponível/expirou; usando WebGL2.", err);
    }
  }

  return new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} expirou após ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
