import {
  BoxParticleEmitter,
  Color3,
  Color4,
  ColorCurves,
  DynamicTexture,
  ParticleSystem,
  Vector3,
} from "@babylonjs/core";
import type { ArcRotateCamera, Scene, Texture } from "@babylonjs/core";

/**
 * CAMADA JOGO (Brasa). IDENTIDADE POR ANDAR. Cada um dos 7 andares tem um TEMA (rocha da caverna,
 * luz, neblina, etalonagem, particulas e cenografia de borda) para ser reconhecido sem texto.
 * O tema e escolhido pelo INDICE do andar (nao pelo RoomKind: salao e cisterna se repetem).
 *
 * Progressao (canon, narrativa-e-historia secao 0): o povo morto (arenito, ossos, raizes) ->
 * alguem desceu antes (basalto, acampamento apagado) -> a duvida (calcario e gelo, agua) ->
 * o custo (ferro, primeiras brasas, grades) -> o luto (osso e cal, respiro) -> a verdade (a
 * Brasa visivel no fundo, fissura incandescente) -> o confronto (obsidiana, cratera de brasa).
 * A descida esfria o ar e esquenta a rocha: quanto mais fundo, mais brasa por dentro.
 *
 * Este arquivo so tem DADOS e o "atmosferico" (etalonagem + particulas). A geometria da caverna
 * vive em cryptCave.ts / cryptProps.ts. Nenhuma luz nova: tudo e malha fundida + 1 particula.
 */

export type RockKind = "arenito" | "basalto" | "calcario" | "ferro" | "osso" | "brasa" | "obsidiana";
export type SetPiece = "tumulo" | "acampamento" | "cascata" | "grades" | "ossuario" | "fissura" | "cratera";
export type ParticleKind = "poeira" | "cinza" | "nevoa" | "brasas" | "cal" | "centelhas";

export interface FloorTheme {
  name: string;
  /** Rocha da caverna: textura procedural + cor-base (multiplica a textura). */
  rock: { kind: RockKind; base: string; tint: [string, string] };
  /** Terreno: rugosidade do relevo, terracas (estratos), lago em volta dos muros, cristas anelares. */
  terrain: { rough: number; strata: number; moat: boolean; ridges: number };
  /** Contagens de cenografia de borda (tudo dentro do teto de altura de rockCap). */
  props: {
    rocks: number;
    spikes: number;
    lean: number; // inclinacao dos espetos (0 reto, 1 torto)
    columns: number; // aglomerados de colunas hexagonais (basalto)
    bones: number;
    roots: number;
    drums: number; // tambores de coluna afundados (ruina da cripta)
    crystals: number; // aglomerados de cristal (emissivo)
    veins: number; // veios de brasa (emissivo)
    far: number; // espiras altas e longe (d > 14): so aparecem no topo da tela
  };
  set: SetPiece;
  /** Tom multiplicado sobre a pedra da arquitetura (muros e pilares): cada andar com sua pedra. */
  stone: string;
  /** Cor do emissivo da caverna (veios, cristais, velas) e brilho base (0 = sem emissivo). */
  accent: { color: string; strength: number };
  fog: { cold: string; warm: string; density: number };
  amb: { cold: string; warm: string; intensity: number; warmDrop: number };
  key: { diffuse: string; intensity: number; warmDrop: number };
  /** Cores das pocas de luz das tochas (substitui o POOL_COL por tipo de sala). */
  pool: { torch: string; accent: string; warm: boolean };
  /** Etalonagem (ColorCurves) e vinheta. */
  grade: {
    shadowsHue: number;
    shadowsDensity: number;
    shadowsSaturation: number;
    highlightsHue: number;
    highlightsDensity: number;
    highlightsSaturation: number;
    globalSaturation: number;
    vignette: [number, number, number];
  };
  particles: { kind: ParticleKind; rate: number };
}

export const FLOOR_THEMES: FloorTheme[] = [
  // 0 - ABERTURA (guarda): arenito frio em estratos, raizes e ossada embutida; o povo morto.
  {
    name: "arenito",
    rock: { kind: "arenito", base: "#7a8294", tint: ["#6d7588", "#8a8fa0"] },
    terrain: { rough: 0.8, strata: 0.55, moat: false, ridges: 0 },
    props: { rocks: 70, spikes: 6, lean: 0.15, columns: 0, bones: 26, roots: 16, drums: 5, crystals: 0, veins: 0, far: 6 },
    set: "tumulo",
    stone: "#d4deee",
    accent: { color: "#9ab8e0", strength: 0 },
    fog: { cold: "#2a3b50", warm: "#241a14", density: 0.0052 },
    amb: { cold: "#a8bcd6", warm: "#a98f6e", intensity: 0.5, warmDrop: 0.26 },
    key: { diffuse: "#9bb0cf", intensity: 0.62, warmDrop: 0.2 },
    pool: { torch: "#ff9a40", accent: "#ff9a40", warm: true },
    grade: { shadowsHue: 214, shadowsDensity: 22, shadowsSaturation: 6, highlightsHue: 34, highlightsDensity: 42, highlightsSaturation: 28, globalSaturation: 6, vignette: [0.03, 0.04, 0.07] },
    particles: { kind: "poeira", rate: 1 },
  },
  // 1 - SALAO (alguem desceu antes): basalto colunar escuro, cinzas, acampamento apagado.
  {
    name: "basalto",
    rock: { kind: "basalto", base: "#59606f", tint: ["#4a505e", "#68707e"] },
    terrain: { rough: 1.15, strata: 0, moat: false, ridges: 0 },
    props: { rocks: 40, spikes: 0, lean: 0, columns: 11, bones: 6, roots: 0, drums: 2, crystals: 0, veins: 0, far: 10 },
    set: "acampamento",
    stone: "#98a0ac",
    accent: { color: "#ff7a30", strength: 0 },
    fog: { cold: "#1c2634", warm: "#241a14", density: 0.0078 },
    amb: { cold: "#8a9fbd", warm: "#a98f6e", intensity: 0.34, warmDrop: 0.16 },
    key: { diffuse: "#8196b4", intensity: 0.5, warmDrop: 0.16 },
    pool: { torch: "#ffa04a", accent: "#ffcf80", warm: true },
    grade: { shadowsHue: 205, shadowsDensity: 26, shadowsSaturation: 4, highlightsHue: 52, highlightsDensity: 30, highlightsSaturation: 10, globalSaturation: -34, vignette: [0.02, 0.03, 0.06] },
    particles: { kind: "cinza", rate: 1 },
  },
  // 2 - CISTERNA (a duvida): calcario com veios de gelo, lago em volta, cristais frios, cascatas.
  {
    name: "calcario",
    rock: { kind: "calcario", base: "#6a8690", tint: ["#5b7580", "#78939c"] },
    terrain: { rough: 0.6, strata: 0, moat: true, ridges: 0 },
    props: { rocks: 36, spikes: 22, lean: 0.05, columns: 0, bones: 4, roots: 0, drums: 3, crystals: 9, veins: 0, far: 14 },
    set: "cascata",
    stone: "#86bcbc",
    accent: { color: "#5fd4ee", strength: 0.9 },
    fog: { cold: "#15303c", warm: "#1f2420", density: 0.0095 },
    amb: { cold: "#86bccf", warm: "#a29878", intensity: 0.42, warmDrop: 0.2 },
    key: { diffuse: "#8fbfd2", intensity: 0.6, warmDrop: 0.2 },
    pool: { torch: "#ffa860", accent: "#43b6cf", warm: false },
    grade: { shadowsHue: 192, shadowsDensity: 34, shadowsSaturation: 14, highlightsHue: 40, highlightsDensity: 34, highlightsSaturation: 22, globalSaturation: 6, vignette: [0.02, 0.05, 0.07] },
    particles: { kind: "nevoa", rate: 1 },
  },
  // 3 - SALAO (o custo): ferro enferrujado, espetos tortos, grades, primeiros veios de brasa.
  {
    name: "ferro",
    rock: { kind: "ferro", base: "#6e5852", tint: ["#5e4844", "#7e6058"] },
    terrain: { rough: 1.3, strata: 0, moat: false, ridges: 0 },
    props: { rocks: 46, spikes: 24, lean: 0.85, columns: 0, bones: 10, roots: 0, drums: 2, crystals: 0, veins: 12, far: 8 },
    set: "grades",
    stone: "#d29684",
    accent: { color: "#ff5a26", strength: 0.5 },
    fog: { cold: "#2a1c24", warm: "#2a1a14", density: 0.0095 },
    amb: { cold: "#9a8394", warm: "#b0916e", intensity: 0.38, warmDrop: 0.18 },
    key: { diffuse: "#a4838c", intensity: 0.56, warmDrop: 0.18 },
    pool: { torch: "#ff7a3a", accent: "#ff5a26", warm: true },
    grade: { shadowsHue: 224, shadowsDensity: 28, shadowsSaturation: 10, highlightsHue: 24, highlightsDensity: 40, highlightsSaturation: 22, globalSaturation: 8, vignette: [0.05, 0.02, 0.04] },
    particles: { kind: "brasas", rate: 0.5 },
  },
  // 4 - SANTUARIO (luto, respiro): osso e cal, claridade calma, velas votivas, duas ossadas.
  {
    name: "osso e cal",
    rock: { kind: "osso", base: "#7d7770", tint: ["#6f6a66", "#8c867c"] },
    terrain: { rough: 0.45, strata: 0.2, moat: false, ridges: 0 },
    props: { rocks: 36, spikes: 8, lean: 0.1, columns: 0, bones: 44, roots: 0, drums: 4, crystals: 0, veins: 0, far: 6 },
    set: "ossuario",
    stone: "#e8dfca",
    accent: { color: "#ffd890", strength: 0.9 },
    fog: { cold: "#2b2a3a", warm: "#2a2018", density: 0.0044 },
    amb: { cold: "#aa9cc2", warm: "#b09878", intensity: 0.44, warmDrop: 0.18 },
    key: { diffuse: "#b4a6c6", intensity: 0.6, warmDrop: 0.16 },
    pool: { torch: "#ffc070", accent: "#ffe0a0", warm: true },
    grade: { shadowsHue: 236, shadowsDensity: 22, shadowsSaturation: 6, highlightsHue: 42, highlightsDensity: 40, highlightsSaturation: 24, globalSaturation: 2, vignette: [0.04, 0.03, 0.06] },
    particles: { kind: "cal", rate: 1 },
  },
  // 5 - CISTERNA (a verdade se monta): rocha vulcanica, veios fortes, a Brasa visivel ao fundo.
  {
    name: "brasa ao fundo",
    rock: { kind: "brasa", base: "#6a4c50", tint: ["#553b40", "#7a5a5a"] },
    terrain: { rough: 1.2, strata: 0, moat: false, ridges: 0 },
    props: { rocks: 44, spikes: 12, lean: 0.4, columns: 3, bones: 6, roots: 0, drums: 3, crystals: 0, veins: 26, far: 12 },
    set: "fissura",
    stone: "#bc7c74",
    accent: { color: "#ff6a22", strength: 0.8 },
    fog: { cold: "#2e1a1c", warm: "#2e1c14", density: 0.0105 },
    amb: { cold: "#a8786c", warm: "#b8906c", intensity: 0.38, warmDrop: 0.16 },
    key: { diffuse: "#b4806c", intensity: 0.55, warmDrop: 0.16 },
    pool: { torch: "#ff6a30", accent: "#ff4a18", warm: true },
    grade: { shadowsHue: 220, shadowsDensity: 34, shadowsSaturation: 12, highlightsHue: 18, highlightsDensity: 52, highlightsSaturation: 36, globalSaturation: 12, vignette: [0.06, 0.02, 0.02] },
    particles: { kind: "brasas", rate: 1 },
  },
  // 6 - GUARDIAO (o confronto): obsidiana, cratera de brasa, cristas anelares, fendas radiais.
  {
    name: "obsidiana",
    rock: { kind: "obsidiana", base: "#5a5266", tint: ["#4a4458", "#6a6078"] },
    terrain: { rough: 1.0, strata: 0, moat: false, ridges: 1 },
    props: { rocks: 40, spikes: 18, lean: 0.3, columns: 0, bones: 4, roots: 0, drums: 4, crystals: 0, veins: 22, far: 16 },
    set: "cratera",
    stone: "#8c7eaa",
    accent: { color: "#ff7a2a", strength: 0.8 },
    fog: { cold: "#121c2c", warm: "#2a2030", density: 0.01 },
    amb: { cold: "#7a8ab0", warm: "#b08a78", intensity: 0.4, warmDrop: 0.18 },
    key: { diffuse: "#8896b8", intensity: 0.6, warmDrop: 0.2 },
    pool: { torch: "#ff6a30", accent: "#ff4a18", warm: true },
    grade: { shadowsHue: 232, shadowsDensity: 30, shadowsSaturation: 12, highlightsHue: 24, highlightsDensity: 50, highlightsSaturation: 36, globalSaturation: 6, vignette: [0.04, 0.02, 0.06] },
    particles: { kind: "centelhas", rate: 1 },
  },
];

export function themeFor(index: number): FloorTheme {
  return FLOOR_THEMES[Math.max(0, Math.min(FLOOR_THEMES.length - 1, index))]!;
}

/** Aplica a etalonagem do andar ao pipeline (ColorCurves + vinheta). Chamado ao montar cada sala. */
export function applyGrade(
  pipe: { imageProcessing: { colorCurves: ColorCurves | null; vignetteColor: { r: number; g: number; b: number; a: number } } },
  t: FloorTheme
): void {
  const g = t.grade;
  const cc = pipe.imageProcessing.colorCurves ?? new ColorCurves();
  cc.shadowsHue = g.shadowsHue;
  cc.shadowsDensity = g.shadowsDensity;
  cc.shadowsSaturation = g.shadowsSaturation;
  cc.highlightsHue = g.highlightsHue;
  cc.highlightsDensity = g.highlightsDensity;
  cc.highlightsSaturation = g.highlightsSaturation;
  cc.globalSaturation = g.globalSaturation;
  pipe.imageProcessing.colorCurves = cc;
  pipe.imageProcessing.vignetteColor = new Color4(g.vignette[0], g.vignette[1], g.vignette[2], 1);
}

// ---------------------------------------------------------------------------------------------
// Particulas ambientais: UM sistema por andar (1 draw call), caixa em volta do alvo da camera.
// ---------------------------------------------------------------------------------------------

function dotTexture(scene: Scene, soft: boolean): DynamicTexture {
  const s = 64;
  const tex = new DynamicTexture("particulaPonto", { width: s, height: s }, scene, false);
  const c = tex.getContext() as unknown as CanvasRenderingContext2D;
  const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(soft ? 0.25 : 0.45, `rgba(255,255,255,${soft ? 0.5 : 0.9})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, s, s);
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

export interface Atmosphere {
  /** Brasa acesa (0..1): as particulas quentes ficam mais vivas. */
  setLit(t: number): void;
  dispose(): void;
}

/** Cria as particulas do andar. A caixa de emissao segue o alvo da camera (o jogador sempre as ve). */
export function createAtmosphere(scene: Scene, t: FloorTheme): Atmosphere | null {
  const kind = t.particles.kind;
  const tex = dotTexture(scene, kind === "nevoa" || kind === "poeira");
  const ps = new ParticleSystem("ambiente_" + kind, 150, scene);
  ps.particleTexture = tex as Texture;
  ps.isLocal = false;
  const box = new BoxParticleEmitter();
  box.minEmitBox = new Vector3(-15, 0.2, -15);
  box.maxEmitBox = new Vector3(15, 6.5, 15);
  box.direction1 = new Vector3(-0.15, 0, -0.15);
  box.direction2 = new Vector3(0.15, 0, 0.15);
  ps.particleEmitterType = box;
  const emitter = new Vector3(0, 0, 0);
  ps.emitter = emitter;
  ps.updateSpeed = 0.016;
  ps.minEmitPower = 0.4;
  ps.maxEmitPower = 1.2;
  ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  ps.gravity = new Vector3(0, 0, 0);
  ps.minAngularSpeed = 0;
  ps.maxAngularSpeed = 0;
  ps.disposeOnStop = false;

  let life = 9;
  switch (kind) {
    case "poeira": // poeira fria suspensa, quase parada
      life = 10;
      ps.color1 = new Color4(0.82, 0.9, 1, 0.42);
      ps.color2 = new Color4(0.66, 0.78, 0.95, 0.22);
      ps.colorDead = new Color4(0.7, 0.8, 1, 0);
      ps.minSize = 0.1;
      ps.maxSize = 0.24;
      ps.minLifeTime = 8;
      ps.maxLifeTime = 12;
      ps.gravity.y = 0.01;
      ps.minEmitPower = 0.05;
      ps.maxEmitPower = 0.25;
      break;
    case "cinza": // cinzas caindo devagar, graos maiores e irregulares
      life = 11;
      ps.color1 = new Color4(0.78, 0.8, 0.86, 0.55);
      ps.color2 = new Color4(0.5, 0.52, 0.58, 0.4);
      ps.colorDead = new Color4(0.5, 0.52, 0.58, 0);
      ps.minSize = 0.16;
      ps.maxSize = 0.4;
      ps.minLifeTime = 9;
      ps.maxLifeTime = 13;
      ps.gravity.y = -0.16;
      ps.minEmitPower = 0.08;
      ps.maxEmitPower = 0.3;
      ps.minAngularSpeed = -1.2;
      ps.maxAngularSpeed = 1.2;
      break;
    case "nevoa": // brumas frias e gotas claras: grandes e muito suaves
      life = 11;
      ps.color1 = new Color4(0.55, 0.85, 0.95, 0.16);
      ps.color2 = new Color4(0.4, 0.7, 0.85, 0.09);
      ps.colorDead = new Color4(0.5, 0.8, 0.9, 0);
      ps.minSize = 0.9;
      ps.maxSize = 2.0;
      ps.minLifeTime = 9;
      ps.maxLifeTime = 13;
      ps.gravity.y = 0.005;
      ps.minEmitPower = 0.05;
      ps.maxEmitPower = 0.2;
      break;
    case "brasas": // brasas subindo, faiscas laranja
      life = 6;
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.color1 = new Color4(1, 0.6, 0.22, 0.95);
      ps.color2 = new Color4(1, 0.32, 0.1, 0.7);
      ps.colorDead = new Color4(0.6, 0.12, 0.04, 0);
      ps.minSize = 0.07;
      ps.maxSize = 0.16;
      ps.minLifeTime = 4;
      ps.maxLifeTime = 8;
      ps.gravity.y = 0.32;
      ps.minEmitPower = 0.15;
      ps.maxEmitPower = 0.5;
      break;
    case "cal": // po de cal, dourado e calmo (respiro)
      life = 12;
      ps.color1 = new Color4(1, 0.92, 0.7, 0.5);
      ps.color2 = new Color4(0.95, 0.8, 0.6, 0.28);
      ps.colorDead = new Color4(1, 0.9, 0.7, 0);
      ps.minSize = 0.09;
      ps.maxSize = 0.2;
      ps.minLifeTime = 10;
      ps.maxLifeTime = 14;
      ps.gravity.y = 0.02;
      ps.minEmitPower = 0.04;
      ps.maxEmitPower = 0.18;
      break;
    case "centelhas": // centelhas brancas e laranja em espiral para cima (o fogo da Primeira)
      life = 5;
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.color1 = new Color4(1, 0.85, 0.5, 1);
      ps.color2 = new Color4(1, 0.4, 0.12, 0.8);
      ps.colorDead = new Color4(0.5, 0.1, 0.1, 0);
      ps.minSize = 0.07;
      ps.maxSize = 0.18;
      ps.minLifeTime = 3.5;
      ps.maxLifeTime = 6.5;
      ps.gravity.y = 0.5;
      ps.minEmitPower = 0.2;
      ps.maxEmitPower = 0.7;
      break;
  }
  ps.emitRate = (150 * t.particles.rate) / life;
  ps.preWarmCycles = Math.round(life * 50);
  ps.preWarmStepOffset = 4;
  ps.start();

  const cam = scene.activeCamera as ArcRotateCamera | null;
  const obs = scene.onBeforeRenderObservable.add(() => {
    const tg = cam && (cam as ArcRotateCamera).target ? (cam as ArcRotateCamera).target : null;
    if (tg) emitter.set(tg.x, 0, tg.z);
  });
  const baseAlpha = ps.color1.a;
  return {
    setLit(k: number): void {
      // a Brasa acesa aquece e acalma o ar: as brasas ficam um pouco mais vivas.
      if (kind === "brasas" || kind === "centelhas") ps.color1.a = baseAlpha * (0.75 + 0.25 * Math.min(1, k));
    },
    dispose(): void {
      scene.onBeforeRenderObservable.remove(obs);
      ps.dispose(true);
    },
  };
}

export const hex = (h: string): Color3 => Color3.FromHexString(h);
