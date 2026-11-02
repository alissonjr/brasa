/**
 * CAMADA JOGO. MURAIS (fase R5): a textura do painel 3D (redesenho 5.6). NÃO monta parede nem
 * material: só devolve a `DynamicTexture` 1024 x 512 de um painel, para a fase da antessala (R1)
 * pendurar na caixa 6 x 3 m. Nada aqui toca a cena além de criar a textura que o chamador pede.
 *
 * Uso previsto (antessala/mural.ts):
 *   const tex = await createMuralTexture(scene, andar, "vem");   // "foi" para o painel esquerdo
 *   mat.emissiveTexture = tex;  mat.emissiveColor = accent;      // o traço é a máscara do emissivo
 *   // frio -> aceso: animar mat.emissiveIntensity de 0,15 para 1,0 em 0,8 s (dois materiais)
 *   mesh.onDisposeObservable.add(() => tex.dispose());           // a textura morre com a sala
 * A textura é a MESMA nos dois estados: o frio/aceso é intensidade de material, não pixel.
 */
import { DynamicTexture } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { muralDataFor, muralFoiSvg, muralVemSvg } from "./muralPlate";
import { rasterizeSvg } from "./muralRaster";

export const MURAL_TEX_W = 1024;
export const MURAL_TEX_H = 512;

/** Textura de um painel do mural do `andar` (1 a 7). `lado`: "foi" (esquerdo) ou "vem" (direito). */
export async function createMuralTexture(scene: Scene, andar: number, lado: "foi" | "vem"): Promise<DynamicTexture> {
  const d = muralDataFor(andar);
  const svg = lado === "foi" ? muralFoiSvg(d, "paisagem") : muralVemSvg(d, "paisagem");
  const canvas = await rasterizeSvg(svg, MURAL_TEX_W, MURAL_TEX_H);
  const tex = new DynamicTexture(`muralTex-${andar}-${lado}`, { width: MURAL_TEX_W, height: MURAL_TEX_H }, scene, true);
  tex.getContext().drawImage(canvas, 0, 0);
  tex.update(false);
  return tex;
}
