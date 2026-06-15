import "@babylonjs/loaders/glTF";
import { HDRCubeTexture, LoadAssetContainerAsync } from "@babylonjs/core";
import type { AssetContainer, Mesh, Scene } from "@babylonjs/core";
import { assetUrl } from "./assetUrl";

/**
 * CAMADA ENGINE (genérica). Carregamento de assets reais: modelos glTF/.glb e
 * ambiente HDRI (céu + iluminação baseada em imagem). Genérico: as URLs e o uso
 * vêm do jogo. Ver docs/tecnica-graficos-fisica.md (KTX2/Draco entram aqui depois).
 */

/** Carrega um glTF/.glb num AssetContainer (templates), sem adicioná-lo à cena.
 * O jogo instancia cópias com container.instantiateModelsToScene(). */
export async function loadContainer(scene: Scene, url: string): Promise<AssetContainer> {
  return LoadAssetContainerAsync(assetUrl(url), scene);
}

export interface HdrEnvOptions {
  /** Tamanho da face do cubemap gerado a partir do HDRI equirretangular. */
  size?: number;
  intensity?: number;
  skyboxSize?: number;
  blur?: number;
}

/**
 * Define o ambiente da cena a partir de um HDRI (.hdr): vira a fonte de luz IBL
 * (reflexos e luz ambiente reais) e o skybox. Substitui céu+ambiente procedurais.
 */
export function createHdrEnvironment(scene: Scene, url: string, opts: HdrEnvOptions = {}): { skybox: Mesh } {
  const env = new HDRCubeTexture(url, scene, opts.size ?? 256);
  scene.environmentTexture = env;
  scene.environmentIntensity = opts.intensity ?? 1;
  const skybox = scene.createDefaultSkybox(env, true, opts.skyboxSize ?? 1000, opts.blur ?? 0.18);
  if (!skybox) throw new Error("Falha ao criar o skybox do HDRI");
  return { skybox };
}
