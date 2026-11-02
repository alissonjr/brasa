import { SSAORenderingPipeline } from "@babylonjs/core";
import type { Camera, PostProcess, Scene } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Oclusão de ambiente em espaço de tela: escurece cantos, frestas e
 * contatos, aterrando atores e dando volume à pedra low-poly. Custo full-screen (por pixel).
 * Ver docs/brasa/spec-estilo-visual-render §4.1(c).
 *
 * Usamos o SSAORenderingPipeline (v1, baseado SÓ em PROFUNDIDADE) e não o SSAO2: o SSAO2 monta
 * um geometry buffer MRT (depth + normal) e o CellMaterial (toon, §4.1a) não escreve em todos
 * os alvos do MRT, o que dispara "missing fragment shader outputs" a cada draw. O v1 usa apenas
 * o depth renderer (alvo único) + uma textura de ruído, sem MRT: robusto com materiais custom e
 * suficiente para o look estilizado. Degrada para null se não for suportado.
 */

export interface SsaoOptions {
  /** Raio de amostragem. Maior = sombra de contato mais ampla. Default 0.0008 (escala v1). */
  radius?: number;
  /** Força total do escurecimento. Default 1.1. */
  strength?: number;
  /** Base (piso de luz que o AO nunca apaga). Default 0.3. */
  base?: number;
  /** Área de amostragem. Default 0.0075. */
  area?: number;
  /** Atenuação. Default 0.000001. */
  fallOff?: number;
  /** Resolução do passe de AO (0..1). Default 0.7. */
  ratio?: number;
}

export interface SsaoHandle {
  pipeline: SSAORenderingPipeline;
  dispose(): void;
}

export function enableSsao(scene: Scene, camera: Camera, opts: SsaoOptions = {}): SsaoHandle | null {
  const ratio = opts.ratio ?? 0.7;
  let pipeline: SSAORenderingPipeline;
  try {
    // Sem câmeras no construtor: tiramos o passe de cópia (abaixo) antes de anexar.
    pipeline = new SSAORenderingPipeline("ssao", scene, { ssaoRatio: ratio, combineRatio: 1.0 });
  } catch (err) {
    console.warn("[render] SSAO indisponível neste backend; pulando AO.", err);
    return null;
  }
  // O pipeline v1 abre com um passe "SSAOOriginalSceneColor" que só COPIA a cena; o combine usa a textura de
  // ENTRADA desse passe (a cor da cena). O passe de AO ignora a própria entrada (lê só profundidade). Então
  // o passe de cópia sai (-1 draw call full-screen) e o combine lê a entrada do passe de AO, que é a mesma textura.
  const internals = pipeline as unknown as {
    _renderEffects: Record<string, unknown>;
    _originalColorPostProcess: PostProcess;
    _ssaoPostProcess: PostProcess;
    _ssaoCombinePostProcess: PostProcess;
  };
  delete internals._renderEffects["SSAOOriginalSceneColorEffect"];
  internals._originalColorPostProcess.dispose();
  const aoPass = internals._ssaoPostProcess;
  internals._ssaoCombinePostProcess.onApply = (effect) => {
    effect.setFloat4("viewport", 0, 0, 1, 1);
    (effect as unknown as { _bindTexture(name: string, tex: unknown): void })._bindTexture("originalColor", aoPass.inputTexture.texture);
  };
  scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);
  pipeline.totalStrength = opts.strength ?? 1.1;
  pipeline.base = opts.base ?? 0.3;
  pipeline.radius = opts.radius ?? 0.0008;
  pipeline.area = opts.area ?? 0.0075;
  pipeline.fallOff = opts.fallOff ?? 0.000001;
  return {
    pipeline,
    dispose(): void {
      scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline("ssao", camera);
      pipeline.dispose();
    },
  };
}
