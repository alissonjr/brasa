import { ColorCurves, ImageProcessingConfiguration, PBRMaterial } from "@babylonjs/core";
import type { Material } from "@babylonjs/core";

/**
 * CAMADA JOGO (Brasa). Tinta de paleta dos monstros NÃO humanoides (Quaternius Ultimate Monsters,
 * saturados demais para o preto e ouro de brasa): ImageProcessingConfiguration PRÓPRIA do
 * material (não afeta a cena), compartilhada por exposição. Dessatura, escurece e esfria as
 * sombras. Adaptado do patch de coerência de atores da branch ambientacao.
 */
const cache = new Map<number, ImageProcessingConfiguration>();

function monsterGrade(exposureK: number): ImageProcessingConfiguration {
  const key = Math.round(exposureK * 100);
  let cfg = cache.get(key);
  if (!cfg) {
    cfg = new ImageProcessingConfiguration();
    cfg.toneMappingEnabled = false;
    cfg.exposure = 0.86 * exposureK;
    cfg.contrast = 1.04;
    const cc = new ColorCurves();
    cc.globalSaturation = -40;
    cc.shadowsHue = 214;
    cc.shadowsDensity = 22;
    cc.shadowsSaturation = 8;
    cfg.colorCurves = cc;
    cfg.colorCurvesEnabled = true;
    cache.set(key, cfg);
  }
  return cfg;
}

/** Aplica a tinta de monstro aos materiais PBR (próprios da instância) de um ator não humanoide. */
export function gradeMonsterMaterials(materials: Material[], exposureK = 1): void {
  const cfg = monsterGrade(exposureK);
  for (const m of materials) if (m instanceof PBRMaterial) m.imageProcessingConfiguration = cfg;
}
