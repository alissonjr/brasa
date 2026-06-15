import { DirectionalLight, HemisphericLight, ShadowGenerator, Vector3 } from "@babylonjs/core";
import type { Color3, Scene } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Primitivas de iluminação de cena: sol direcional,
 * preenchimento ambiente (hemisférico) e sombras. Os valores (cor, ângulo,
 * intensidade) vêm do jogo (paleta da cena). Ver docs/biblia-iluminacao.md.
 */
export interface SunOptions {
  direction: Vector3;
  color: Color3;
  intensity: number;
  position?: Vector3;
}

export function createSun(scene: Scene, o: SunOptions): DirectionalLight {
  const sun = new DirectionalLight("sol", o.direction, scene);
  sun.diffuse = o.color;
  sun.intensity = o.intensity;
  if (o.position) sun.position = o.position;
  return sun;
}

export interface AmbientOptions {
  sky: Color3;
  ground: Color3;
  intensity: number;
}

export function createAmbient(scene: Scene, o: AmbientOptions): HemisphericLight {
  const h = new HemisphericLight("ambiente", new Vector3(0, 1, 0), scene);
  h.diffuse = o.sky;
  h.groundColor = o.ground;
  h.intensity = o.intensity;
  return h;
}

export interface ShadowOptions {
  resolution?: number;
  darkness?: number;
}

export function createShadows(sun: DirectionalLight, o: ShadowOptions = {}): ShadowGenerator {
  const sg = new ShadowGenerator(o.resolution ?? 2048, sun);
  sg.useBlurExponentialShadowMap = true;
  sg.blurKernel = 16;
  sg.darkness = o.darkness ?? 0.5;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 140;
  return sg;
}
