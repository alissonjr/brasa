import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Skydome com gradiente vertical pintado numa
 * DynamicTexture (sem CDN/HDRI, funciona offline). Não recebe luz e acompanha a
 * câmera (infiniteDistance). As cores vêm de fora: o jogo passa a paleta (deserto,
 * noite, etc.).
 */
export interface SkyColors {
  zenith: string;
  middle?: string;
  horizon: string;
}

export function createGradientSky(scene: Scene, colors: SkyColors, diameter = 1200): Mesh {
  const tex = new DynamicTexture("skyGradient", { width: 8, height: 256 }, scene, false);
  const ctx = tex.getContext();
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, colors.zenith);
  if (colors.middle) grad.addColorStop(0.5, colors.middle);
  grad.addColorStop(1, colors.horizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 256);
  tex.update(false);

  const mat = new StandardMaterial("skyMat", scene);
  mat.emissiveTexture = tex;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();

  const dome = MeshBuilder.CreateSphere(
    "sky",
    { diameter, segments: 16, sideOrientation: Mesh.BACKSIDE },
    scene
  );
  dome.material = mat;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  dome.applyFog = false;
  return dome;
}
