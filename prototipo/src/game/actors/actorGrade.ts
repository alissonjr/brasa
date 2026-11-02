import { Color3, ColorCurves, ImageProcessingConfiguration, PBRMaterial } from "@babylonjs/core";
import type { Material } from "@babylonjs/core";

/**
 * CAMADA JOGO (Brasa). Tinta de paleta dos monstros NÃO humanoides (Quaternius Ultimate Monsters,
 * saturados demais para o preto e ouro de brasa): ImageProcessingConfiguration PRÓPRIA do
 * material (não afeta a cena), compartilhada por exposição. Dessatura, escurece e esfria as
 * sombras. Adaptado do patch de coerência de atores da branch ambientacao.
 */
const cache = new Map<string, ImageProcessingConfiguration>();

function monsterGrade(exposureK: number, saturation: number): ImageProcessingConfiguration {
  const key = `${Math.round(exposureK * 100)}|${Math.round(saturation)}`;
  let cfg = cache.get(key);
  if (!cfg) {
    cfg = new ImageProcessingConfiguration();
    cfg.toneMappingEnabled = false;
    cfg.exposure = 0.62 * exposureK;
    cfg.contrast = 1.04;
    const cc = new ColorCurves();
    cc.globalSaturation = saturation;
    cc.shadowsHue = 214;
    cc.shadowsDensity = 22;
    cc.shadowsSaturation = 8;
    cfg.colorCurves = cc;
    cfg.colorCurvesEnabled = true;
    cache.set(key, cfg);
  }
  return cfg;
}

/**
 * Aplica a tinta de monstro aos materiais PBR (próprios da instância) de um ator não humanoide.
 * `saturation`: curva global (-100..0); o padrão -50 mantém um resto de cor, -85 tira o monstro
 * da paleta de pele (demônio rosado, yeti). `tint` (hex) multiplica o albedo (cinza/osso).
 */
export function gradeMonsterMaterials(materials: Material[], exposureK = 1, saturation = -50, tint?: string): void {
  const cfg = monsterGrade(exposureK, saturation);
  const t = tint ? Color3.FromHexString(tint) : null;
  for (const m of materials) {
    if (!(m instanceof PBRMaterial)) continue;
    m.imageProcessingConfiguration = cfg;
    if (t) m.albedoColor = m.albedoColor.multiply(t);
  }
}
