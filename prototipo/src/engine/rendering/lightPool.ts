import { Color3, Constants, DynamicTexture, Mesh, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). "Poça de luz": disco achatado, aditivo e sem iluminação, com
 * gradiente radial, que simula o halo de uma fonte quente no chão (tocha, braseiro,
 * lanterna). Barato (1 malha, sem luz real) e dá o contraste quente/frio que a luz de
 * ponto sozinha não entrega em visão alta. Cada poça tem material e textura próprios, então
 * `mesh.dispose(false, true)` (ou o dispose do pai com materiais) a libera por completo.
 */
export interface LightPoolOptions {
  /** Raio do halo, em unidades de mundo. */
  radius: number;
  /** Cor do halo (hex). */
  color: string;
  /** Opacidade máxima no centro (0..1). */
  alpha: number;
  /** Altura sobre o piso. */
  y?: number;
}

export function createLightPool(scene: Scene, o: LightPoolOptions): Mesh {
  const tex = new DynamicTexture("poolTex", { width: 128, height: 128 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  // Queda suave e longa (sem aro visível na borda): curva ~gaussiana em vários degraus.
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.72)");
  g.addColorStop(0.42, "rgba(255,255,255,0.34)");
  g.addColorStop(0.65, "rgba(255,255,255,0.12)");
  g.addColorStop(0.85, "rgba(255,255,255,0.03)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  tex.update();
  tex.hasAlpha = true;

  const mat = new StandardMaterial("poolMat", scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString(o.color);
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.opacityTexture = tex;
  mat.alpha = o.alpha;
  mat.alphaMode = Constants.ALPHA_ADD;
  mat.backFaceCulling = false;
  mat.zOffset = -2;

  const disc = MeshBuilder.CreateDisc("poca_de_luz", { radius: o.radius, tessellation: 40 }, scene);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = o.y ?? 0.08;
  disc.material = mat;
  disc.isPickable = false;
  disc.receiveShadows = false;
  return disc;
}
