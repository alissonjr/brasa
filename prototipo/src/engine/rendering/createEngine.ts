import { Engine, WebGPUEngine } from "@babylonjs/core";
import type { AbstractEngine } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica/reutilizável). Cria a engine de render.
 *
 * Por padrão tenta WebGPU (alvo da stack, ver docs/tecnica-engines.md) com um
 * TIMEOUT: o initAsync do WebGPU pode buscar o transpiler twgsl/glslang num CDN
 * e, se isso pendurar (rede/firewall), a tela ficaria travada para sempre. Se o
 * WebGPU não inicializar a tempo (ou falhar), caímos para WebGL2 sozinhos.
 *
 * Forçar um renderer pela URL:
 *   ?renderer=webgl   -> só WebGL2
 *   ?renderer=webgpu  -> só WebGPU (sem fallback)
 */
export async function createEngine(canvas: HTMLCanvasElement): Promise<AbstractEngine> {
  const renderer = new URLSearchParams(location.search).get("renderer");
  const allowWebGPU = renderer !== "webgl";
  const allowWebGL = renderer !== "webgpu";

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
