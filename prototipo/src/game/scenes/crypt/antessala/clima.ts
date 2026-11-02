import { Color3 } from "@babylonjs/core";
import { themeFor, type FloorTheme } from "../cryptTheme";

/**
 * CAMADA JOGO (Brasa). CLIMA da antessala: a casa de guarda da ordem. Parte do tema do andar
 * (rocha, pedra, acento, partículas: a identidade de cada andar não muda) e o torna mais ÍNTIMO e
 * QUENTE: névoa um pouco mais densa (o mundo é perto), o ar frio menos azul, a luz do braseiro
 * segura mais o calor quando acende (`warmDrop` menor) e a etalonagem puxa os claros para o âmbar.
 */
const mix = (a: string, b: string, t: number): string => {
  const c = Color3.Lerp(Color3.FromHexString(a), Color3.FromHexString(b), t);
  return c.toHexString();
};

export function antessalaTheme(index: number): FloorTheme {
  const t = themeFor(index);
  return {
    ...t,
    fog: { cold: mix(t.fog.cold, "#2a2018", 0.25), warm: mix(t.fog.warm, "#3a2414", 0.5), density: t.fog.density * 1.3 },
    amb: { cold: mix(t.amb.cold, "#b89a78", 0.22), warm: mix(t.amb.warm, "#d8a878", 0.35), intensity: t.amb.intensity * 0.9, warmDrop: t.amb.warmDrop * 0.45 },
    key: { diffuse: mix(t.key.diffuse, "#c8a888", 0.3), intensity: t.key.intensity * 0.92, warmDrop: t.key.warmDrop * 0.6 },
    pool: { torch: "#ffa850", accent: mix(t.pool.accent, "#ffb870", 0.5), warm: true },
    grade: {
      ...t.grade,
      highlightsHue: Math.round(t.grade.highlightsHue * 0.4 + 30 * 0.6),
      highlightsDensity: t.grade.highlightsDensity + 6,
      highlightsSaturation: t.grade.highlightsSaturation + 8,
      vignette: [t.grade.vignette[0] + 0.02, t.grade.vignette[1] + 0.01, t.grade.vignette[2]],
    },
  };
}
