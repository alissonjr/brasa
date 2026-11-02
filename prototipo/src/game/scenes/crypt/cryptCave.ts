import { Color3, DynamicTexture, Mesh, StandardMaterial, Texture, VertexBuffer, VertexData } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import type { FloorTheme, RockKind } from "./cryptTheme";
import type { Layout } from "./cryptLayouts";
import * as P from "./cryptProps";

/**
 * CAMADA JOGO (Brasa). CAVERNA em volta do santuario (camera alta orbital). Em vez de paredes
 * altas que a camera atravessaria ao girar, a sala fica no fundo de uma caverna: a rocha sobe
 * em rampa por fora do muro baixo, sempre ABAIXO da linha de visao entre a camera (que olha
 * ~43 graus para baixo) e o heroi, entao nada tapa a tela em nenhum angulo e nada precisa
 * subir ou descer. O relevo e facetado (low-poly) e recebe a mesma luz/neblina da sala.
 *
 * IDENTIDADE POR ANDAR: o tema (cryptTheme) escolhe a rocha (textura + cor), o relevo (estratos,
 * lago, cristas), as pecas de borda e a peca de cena que conta a historia do andar. Custo: a
 * rocha, os ossos, as ruinas e as formacoes entram FUNDIDOS numa malha (1 draw call); brasa,
 * cristais e velas numa segunda (emissiva); agua e cascatas numa terceira (translucida).
 *
 * Geometria da regra: com o heroi na borda da sala, a linha de visao sobe ~0,82 m por metro
 * em direcao a camera; a rampa sobe ~0,45 m/m (+ leve curvatura), e as rochas por cima tem
 * altura limitada por essa mesma linha. Ver `caveHeight` e `rockCap`.
 */
const REACH = 26; // alcance da rampa alem da borda da sala (m)
const CELL = 2; // lado da celula do relevo (m)
const EDGE = 0.5; // a rampa comeca meio metro alem do eixo das paredes
const ROCK_GAIN = 0.8; // a cor do tema multiplica uma textura de ~0,6: este ganho mantem a rocha escura

/** Altura da rampa a `d` metros da borda da sala (d <= 0: dentro, sob a laje). */
export function caveHeight(d: number): number {
  return d <= 0 ? -0.6 : 0.9 + 0.45 * d + 0.012 * d * d;
}

/** Altura maxima de uma rocha sobre a rampa a `d` metros da borda (abaixo da linha de visao). */
export function rockCap(d: number): number {
  return d < 14 ? 0.9 * (0.3 + 0.2 * d) : 4;
}

function seeded(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------------------------
// Texturas de rocha (luminancia + veios; a cor vem do vertice)
// ---------------------------------------------------------------------------------------------

type Ctx2D = CanvasRenderingContext2D;

function blotches(c: Ctx2D, rnd: () => number, n: number, rgb: (v: number) => string, rmin: number, rmax: number, size: number): void {
  for (let i = 0; i < n; i++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const r = rmin + rnd() * (rmax - rmin);
    c.fillStyle = rgb(rnd());
    c.beginPath();
    const k = 5 + Math.floor(rnd() * 3);
    for (let j = 0; j < k; j++) {
      const a = (j / k) * Math.PI * 2 + rnd() * 0.5;
      const rr = r * (0.6 + rnd() * 0.5);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (j === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  }
}

function cracks(c: Ctx2D, rnd: () => number, n: number, style: string, width: number, step: number, size: number, segs = 5): void {
  c.strokeStyle = style;
  c.lineWidth = width;
  for (let i = 0; i < n; i++) {
    let x = rnd() * size;
    let y = rnd() * size;
    c.beginPath();
    c.moveTo(x, y);
    for (let k = 0; k < segs; k++) {
      x += (rnd() - 0.5) * step;
      y += (rnd() - 0.5) * step;
      c.lineTo(x, y);
    }
    c.stroke();
  }
}

function rockTexture(scene: Scene, rnd: () => number, kind: RockKind): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture("cavernaTex", { width: size, height: size }, scene, true);
  const c = tex.getContext() as unknown as Ctx2D;
  const grey = (v: number, tint = [0, 0, 0], a = 1): string => `rgba(${Math.round(v + tint[0]!)},${Math.round(v + tint[1]!)},${Math.round(v + tint[2]!)},${a})`;
  switch (kind) {
    case "arenito": {
      c.fillStyle = grey(168, [0, 2, 8]);
      c.fillRect(0, 0, size, size);
      blotches(c, rnd, 140, (v) => grey(140 + v * 60, [0, 3, 10], 0.3), 10, 38, size);
      // estratos: faixas horizontais onduladas (a rocha em camadas)
      for (let y = 6; y < size; y += 10 + Math.floor(rnd() * 14)) {
        c.strokeStyle = grey(rnd() < 0.5 ? 70 : 215, [0, 2, 8], 0.4 + rnd() * 0.3);
        c.lineWidth = 1 + rnd() * 2.4;
        c.beginPath();
        const ph = rnd() * 6;
        for (let x = 0; x <= size; x += 16) c.lineTo(x, y + Math.sin(x * 0.045 + ph) * 3);
        c.stroke();
      }
      cracks(c, rnd, 9, "rgba(24,28,40,0.5)", 1.1, 40, size);
      break;
    }
    case "basalto": {
      c.fillStyle = grey(150, [0, 2, 8]);
      c.fillRect(0, 0, size, size);
      // celulas hexagonais irregulares (juntas de resfriamento)
      const R = 22;
      for (let row = -1; row < 13; row++) {
        for (let col = -1; col < 12; col++) {
          const cx = col * R * 1.74 + (row % 2) * R * 0.87 + (rnd() - 0.5) * 6;
          const cy = row * R * 1.5 + (rnd() - 0.5) * 6;
          c.fillStyle = grey(120 + rnd() * 70, [0, 2, 8], 0.9);
          c.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
            const rr = R * (0.92 + rnd() * 0.1);
            const px = cx + Math.cos(a) * rr;
            const py = cy + Math.sin(a) * rr;
            if (k === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          c.closePath();
          c.fill();
          c.strokeStyle = "rgba(6,8,14,0.7)";
          c.lineWidth = 1.6;
          c.stroke();
        }
      }
      blotches(c, rnd, 40, (v) => grey(70 + v * 40, [0, 0, 6], 0.25), 6, 18, size);
      break;
    }
    case "calcario": {
      c.fillStyle = grey(176, [-4, 6, 10]);
      c.fillRect(0, 0, size, size);
      blotches(c, rnd, 150, (v) => grey(150 + v * 70, [-6, 6, 12], 0.3), 8, 34, size);
      // veios de gelo: ramos claros e azulados
      for (let i = 0; i < 12; i++) {
        let x = rnd() * size;
        let y = rnd() * size;
        c.strokeStyle = `rgba(210,245,255,${0.55 + rnd() * 0.35})`;
        c.lineWidth = 1.2 + rnd() * 2.2;
        c.beginPath();
        c.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (rnd() - 0.5) * 60;
          y += (rnd() - 0.2) * 40;
          c.lineTo(x, y);
        }
        c.stroke();
      }
      // escorridos verticais de agua
      for (let i = 0; i < 18; i++) {
        const x = rnd() * size;
        c.fillStyle = grey(96, [-10, 6, 10], 0.28);
        c.fillRect(x, rnd() * size * 0.5, 2 + rnd() * 3, 40 + rnd() * 100);
      }
      cracks(c, rnd, 8, "rgba(20,36,44,0.45)", 1, 36, size);
      break;
    }
    case "ferro": {
      c.fillStyle = grey(160, [10, 0, -6]);
      c.fillRect(0, 0, size, size);
      blotches(c, rnd, 120, (v) => `rgba(${150 + v * 70},${90 + v * 40},${60 + v * 30},0.34)`, 10, 40, size);
      blotches(c, rnd, 70, (v) => grey(70 + v * 50, [4, -2, -4], 0.4), 6, 24, size);
      // pintas de minerio claras
      for (let i = 0; i < 90; i++) {
        c.fillStyle = `rgba(${200 + rnd() * 50},${150 + rnd() * 60},${110 + rnd() * 50},0.55)`;
        c.fillRect(rnd() * size, rnd() * size, 1.5 + rnd() * 2.5, 1.5 + rnd() * 2.5);
      }
      cracks(c, rnd, 18, "rgba(20,8,8,0.6)", 1.3, 50, size);
      break;
    }
    case "osso": {
      c.fillStyle = grey(182, [6, 4, 0]);
      c.fillRect(0, 0, size, size);
      blotches(c, rnd, 160, (v) => grey(150 + v * 80, [6, 4, 0], 0.28), 10, 40, size);
      // lascas claras (cal/osso) e rachaduras finas
      for (let i = 0; i < 70; i++) {
        c.fillStyle = `rgba(240,235,215,${0.35 + rnd() * 0.35})`;
        c.beginPath();
        const x = rnd() * size;
        const y = rnd() * size;
        c.ellipse(x, y, 2 + rnd() * 6, 1.5 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
        c.fill();
      }
      cracks(c, rnd, 14, "rgba(60,54,48,0.45)", 1, 44, size);
      break;
    }
    case "brasa": {
      c.fillStyle = grey(138, [8, -2, -2]);
      c.fillRect(0, 0, size, size);
      blotches(c, rnd, 130, (v) => grey(80 + v * 70, [6, -2, -2], 0.35), 8, 34, size);
      cracks(c, rnd, 24, "rgba(10,4,6,0.6)", 1.4, 54, size, 6);
      // rachaduras quentes (apenas um tom mais avermelhado: o brilho de verdade e emissivo)
      cracks(c, rnd, 14, "rgba(255,120,70,0.5)", 1.2, 44, size, 5);
      break;
    }
    case "obsidiana": {
      c.fillStyle = grey(128, [4, 0, 12]);
      c.fillRect(0, 0, size, size);
      blotches(c, rnd, 110, (v) => grey(70 + v * 60, [4, 0, 14], 0.35), 10, 40, size);
      // brilho vitreo: riscos diagonais claros e arcos conchoidais
      c.strokeStyle = "rgba(190,180,230,0.28)";
      for (let i = 0; i < 26; i++) {
        c.lineWidth = 0.8 + rnd() * 2;
        const x = rnd() * size;
        const y = rnd() * size;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + 30 + rnd() * 50, y - 20 - rnd() * 30);
        c.stroke();
      }
      c.strokeStyle = "rgba(12,8,22,0.55)";
      for (let i = 0; i < 12; i++) {
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(rnd() * size, rnd() * size, 14 + rnd() * 30, rnd() * 3, rnd() * 3 + 1.6);
        c.stroke();
      }
      cracks(c, rnd, 10, "rgba(255,110,40,0.45)", 1, 44, size);
      break;
    }
  }
  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

// ---------------------------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------------------------

export interface CaveOpts {
  halfX: number;
  halfZ: number;
  seed: number;
  theme: FloorTheme;
  doorX: number;
  altarZ: number;
  layout: Layout;
}

export interface CaveBuild {
  /** Todas as malhas da caverna (o chamador as prende na sala). */
  meshes: Mesh[];
  /** Malhas que entram no GlowLayer. */
  glow: Mesh[];
  /** Brasa acesa (0..1): veios e cristais ganham vida. */
  setLit(t: number): void;
  /** Luz da Brasa do Guardiao (0..1): os veios da cratera pulsam ao contrario (mais brilho no breu). */
  setBrasaLight(v: number): void;
}

/** Monta o relevo da caverna e toda a cenografia de borda do andar. */
export function buildCave(scene: Scene, o: CaveOpts): CaveBuild {
  const th = o.theme;
  const rnd = seeded(o.seed * 977 + 13);
  const mat = new StandardMaterial("cavernaMat", scene);
  mat.diffuseTexture = rockTexture(scene, rnd, th.rock.kind);
  mat.diffuseColor = Color3.White(); // a cor do tema vai por vertice (assim as pecas fundidas tem cores proprias)
  mat.emissiveColor = Color3.FromHexString("#0f131b");
  mat.specularColor = Color3.Black();

  const dist = (x: number, z: number): number =>
    Math.hypot(Math.max(Math.abs(x) - o.halfX - EDGE, 0), Math.max(Math.abs(z) - o.halfZ - EDGE, 0));
  const inRoom = (x: number, z: number): boolean => Math.abs(x) <= o.halfX + EDGE && Math.abs(z) <= o.halfZ + EDGE;

  const ctx: P.CaveCtx = {
    scene,
    rnd,
    theme: th,
    halfX: o.halfX,
    halfZ: o.halfZ,
    doorX: o.doorX,
    layout: o.layout,
    surf: () => 0,
    dist,
    cap: rockCap,
    lit: [],
    glow: [],
    geoGlow: new P.Geo(),
    geoWater: new P.Geo(),
    stains: [],
  };

  // Patamares nivelados onde as pecas de cena precisam de chao (corta a rampa, nunca a eleva).
  const pads: { x: number; z: number; r: number; h: number }[] = [];
  const pad = (x: number, z: number, r: number): { x: number; z: number } => {
    const d = dist(x, z);
    pads.push({ x, z, r, h: caveHeight(Math.max(0.4, d - 0.55 * r)) - 0.15 });
    return { x, z };
  };

  // Posicoes das pecas de cena (decididas antes do relevo para abrir os patamares).
  const n = P.rimPoint(ctx, "n", 0, 4.4);
  const sRim = P.rimPoint(ctx, "s", 0, 3.6);
  let tombAt: { x: number; z: number } | null = null;
  let campAt: { x: number; z: number } | null = null;
  let gratesAt: { x: number; z: number; ry: number }[] = [];
  if (th.set === "tumulo") tombAt = pad(-5.5, n.z, 3.2);
  if (th.set === "acampamento") campAt = pad(-7.5, sRim.z + 0.4, 3);
  if (th.set === "grades") {
    gratesAt = [
      { x: -7, z: P.rimPoint(ctx, "n", 0, 4).z, ry: 0.15 },
      { x: 6.5, z: P.rimPoint(ctx, "n", 0, 5).z, ry: -0.2 },
      { x: o.halfX + 4.6, z: -3, ry: Math.PI / 2 + 0.1 },
    ];
    for (const g of gratesAt) pad(g.x, g.z, 2);
  }

  // Relevo: grade regular, altura = rampa + ruido que cresce com a distancia.
  const nx = Math.ceil((o.halfX + EDGE + REACH) / CELL);
  const nz = Math.ceil((o.halfZ + EDGE + REACH) / CELL);
  const cols = nx * 2 + 1;
  const rows = nz * 2 + 1;
  const H = new Float32Array(cols * rows);
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const x = (ix - nx) * CELL;
      const z = (iz - nz) * CELL;
      const d = dist(x, z);
      let y: number;
      if (inRoom(x, z)) {
        y = caveHeight(0);
        rnd();
      } else {
        y = caveHeight(d) + (rnd() - 0.5) * (0.5 + 0.14 * d) * th.terrain.rough;
        if (th.terrain.moat) y -= 1.75 * (1 - smooth(3.0, 6.6, d)); // lago em volta dos muros
        if (th.terrain.strata > 0) {
          const step = 0.55;
          y += (Math.round(y / step) * step - y) * th.terrain.strata; // terracas (estratos)
        }
        if (th.terrain.ridges > 0) y += th.terrain.ridges * (0.3 + 0.045 * d) * Math.sin(d * 1.05); // cristas anelares
        for (const p of pads) {
          const dd = Math.hypot(x - p.x, z - p.z);
          if (dd < p.r + 2) y = Math.min(y, p.h + Math.max(0, dd - p.r) * 0.9);
        }
      }
      H[iz * cols + ix] = y;
    }
  }
  ctx.surf = (x: number, z: number): number => {
    const fx = Math.max(0, Math.min(cols - 1.001, x / CELL + nx));
    const fz = Math.max(0, Math.min(rows - 1.001, z / CELL + nz));
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const u = fx - ix;
    const v = fz - iz;
    const ya = H[iz * cols + ix]!;
    const yb = H[iz * cols + ix + 1]!;
    const yc = H[(iz + 1) * cols + ix]!;
    const ye = H[(iz + 1) * cols + ix + 1]!;
    return u + v <= 1 ? ya + u * (yb - ya) + v * (yc - ya) : ye + (1 - u) * (yc - ye) + (1 - v) * (yb - ye);
  };

  // Malha do relevo: triangulos com vertices proprios (facetado) e cor por face.
  const tA = P.col(th.rock.tint[0]);
  const tB = P.col(th.rock.tint[1]);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const stainK = (x: number, z: number): number => {
    let k = 0;
    for (const s of ctx.stains) k = Math.max(k, 1 - Math.hypot(x - s.x, z - s.z) / s.r);
    return Math.max(0, k);
  };
  const tri = (a: number, b: number, c: number): void => {
    const pa = [(a % cols - nx) * CELL, H[a]!, (Math.floor(a / cols) - nz) * CELL];
    const pb = [(b % cols - nx) * CELL, H[b]!, (Math.floor(b / cols) - nz) * CELL];
    const pc = [(c % cols - nx) * CELL, H[c]!, (Math.floor(c / cols) - nz) * CELL];
    if (inRoom(pa[0]!, pa[2]!) && inRoom(pb[0]!, pb[2]!) && inRoom(pc[0]!, pc[2]!)) return;
    const ux = pa[0]! - pb[0]!, uy = pa[1]! - pb[1]!, uz = pa[2]! - pb[2]!;
    const vx = pc[0]! - pb[0]!, vy = pc[1]! - pb[1]!, vz = pc[2]! - pb[2]!;
    let nxx = uy * vz - uz * vy, nyy = uz * vx - ux * vz, nzz = ux * vy - uy * vx;
    const l = Math.hypot(nxx, nyy, nzz) || 1;
    nxx /= l; nyy /= l; nzz /= l;
    const cx = (pa[0]! + pb[0]! + pc[0]!) / 3;
    const cz = (pa[2]! + pb[2]! + pc[2]!) / 3;
    const cy = (pa[1]! + pb[1]! + pc[1]!) / 3;
    // cor por face: mistura dos dois tons do tema + variacao + faixa de estrato por altura
    const mixK = rnd();
    const j = 0.82 + rnd() * 0.24;
    let r = (tA.r + (tB.r - tA.r) * mixK) * j;
    let g = (tA.g + (tB.g - tA.g) * mixK) * j;
    let bl = (tA.b + (tB.b - tA.b) * mixK) * j;
    if (th.terrain.strata > 0 || th.rock.kind === "arenito") {
      const band = 0.5 + 0.5 * Math.sin(cy * 5.2);
      const k = 0.86 + 0.18 * band;
      r *= k; g *= k; bl *= k;
    }
    if (th.rock.kind === "basalto") {
      const k = 0.9 + 0.1 * Math.sin(cx * 1.9 + cz * 1.3);
      r *= k; g *= k; bl *= k;
    }
    const sk = stainK(cx, cz);
    if (sk > 0) {
      r = r * (1 - 0.6 * sk) + 0.18 * sk; g = g * (1 - 0.75 * sk); bl = bl * (1 - 0.75 * sk);
    }
    // facetas muito inclinadas ficam um pouco mais escuras (rocha exposta)
    const steep = 1 - 0.18 * (1 - Math.max(0, nyy));
    for (const p of [pa, pb, pc]) {
      const i = positions.length / 3;
      positions.push(p[0]!, p[1]!, p[2]!);
      normals.push(nxx, nyy, nzz);
      uvs.push(p[0]! / 7, p[2]! / 7);
      colors.push(r * ROCK_GAIN * steep, g * ROCK_GAIN * steep, bl * ROCK_GAIN * steep, 1);
      indices.push(i);
    }
  };
  for (let iz = 0; iz < rows - 1; iz++) {
    for (let ix = 0; ix < cols - 1; ix++) {
      const a = iz * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const e = c + 1;
      tri(a, b, c);
      tri(b, e, c);
    }
  }
  const terrain = new Mesh("caverna_relevo", scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.colors = colors;
  vd.indices = indices;
  vd.applyToMesh(terrain);

  // ----- Cenografia (tudo respeita o teto de altura; a faixa de combate fica dentro da sala) -----
  const pr = th.props;
  const stone = P.col(th.rock.base);
  const dark = new Color3(stone.r * 0.7, stone.g * 0.7, stone.b * 0.7);
  P.rocks(ctx, pr.rocks, stone);
  if (pr.columns > 0) P.hexColumns(ctx, pr.columns, stone);
  if (pr.spikes > 0) P.spikes(ctx, pr.spikes, pr.lean, th.rock.kind === "calcario" ? new Color3(stone.r * 1.05, stone.g * 1.1, stone.b * 1.1) : stone);
  if (pr.far > 0) P.farSpires(ctx, pr.far, dark);
  if (pr.bones > 0) P.bones(ctx, pr.bones, th.rock.kind === "osso" ? P.col("#b2aa96") : P.col("#a8a290"));
  if (pr.roots > 0) P.roots(ctx, pr.roots, P.col("#6c5440"));
  if (pr.drums > 0) P.drums(ctx, pr.drums, P.col(th.rock.kind === "osso" ? "#8c8780" : "#6e6c74"));
  if (pr.crystals > 0) P.crystals(ctx, pr.crystals);
  if (pr.veins > 0) P.veins(ctx, pr.veins, th.set === "fissura" || th.set === "cratera" ? 1.15 : 1);

  P.crown(ctx, stone);

  switch (th.set) {
    case "tumulo":
      if (tombAt) P.tomb(ctx, tombAt.x, tombAt.z, 0.2);
      P.lightShafts(ctx, 4);
      break;
    case "acampamento":
      if (campAt) P.camp(ctx, campAt.x, campAt.z);
      break;
    case "cascata":
      P.lake(ctx);
      P.cascade(ctx, "n", -5.5, 1.2);
      P.cascade(ctx, "n", 6.5, 1.0);
      P.cascade(ctx, "e", -4, 1.0);
      break;
    case "grades":
      P.grates(ctx, gratesAt);
      break;
    case "ossuario":
      P.twoRemains(ctx);
      P.ossuary(ctx, "e", 4);
      P.ossuary(ctx, "w", -4);
      break;
    case "fissura": {
      const a = P.rimPoint(ctx, "n", -7.5, 6.5);
      const b = P.rimPoint(ctx, "n", 7.5, 5.2);
      P.fissure(ctx, a.x, a.z, b.x, b.z, 1.3);
      const e1 = P.rimPoint(ctx, "e", -3, 4);
      const e2 = P.rimPoint(ctx, "e", 7, 8);
      P.fissure(ctx, e1.x, e1.z, e2.x, e2.z, 0.8, 0.8);
      const w1 = P.rimPoint(ctx, "w", 4, 4);
      const w2 = P.rimPoint(ctx, "w", -6, 8);
      P.fissure(ctx, w1.x, w1.z, w2.x, w2.z, 0.8, 0.8);
      break;
    }
    case "cratera":
      P.crater(ctx);
      break;
  }

  // ----- Fusao: 1 malha lit (relevo + pecas), 1 emissiva, 1 de agua -----
  const lit = Mesh.MergeMeshes([terrain, ...ctx.lit], true, true, undefined, false, false)!;
  lit.name = "caverna";
  lit.convertToFlatShadedMesh();
  lit.material = mat;
  lit.receiveShadows = true;
  lit.isPickable = false;
  lit.metadata = { noOutline: true };
  const meshes: Mesh[] = [lit];

  const glowMeshes: Mesh[] = [];
  let emMat: StandardMaterial | null = null;
  const accent = P.col(th.accent.color);
  const gm = ctx.geoGlow.toMesh("caverna_brasa", scene);
  const emParts: Mesh[] = [...ctx.glow];
  if (gm) emParts.push(gm);
  if (emParts.length) {
    // todas as partes emissivas precisam do mesmo conjunto de atributos para fundir
    for (const m of emParts) {
      if (!m.isVerticesDataPresent(VertexBuffer.UVKind)) m.setVerticesData(VertexBuffer.UVKind, new Float32Array((m.getTotalVertices() * 2)));
      if (!m.isVerticesDataPresent(VertexBuffer.ColorKind)) P.paint(m, Color3.White());
    }
    const em = emParts.length > 1 ? Mesh.MergeMeshes(emParts, true, true, undefined, false, false)! : emParts[0]!;
    em.name = "caverna_emissivo";
    emMat = new StandardMaterial("cavernaEmMat", scene);
    emMat.disableLighting = true;
    emMat.diffuseColor = Color3.Black();
    emMat.specularColor = Color3.Black();
    emMat.emissiveColor = accent.scale(Math.max(0.5, th.accent.strength));
    emMat.backFaceCulling = false;
    em.material = emMat;
    em.hasVertexAlpha = false;
    em.isPickable = false;
    em.receiveShadows = false;
    em.metadata = { noOutline: true };
    meshes.push(em);
    glowMeshes.push(em);
  }
  const wm = ctx.geoWater.toMesh("caverna_agua", scene);
  if (wm) {
    const wmat = new StandardMaterial("cavernaAguaMat", scene);
    wmat.disableLighting = true;
    wmat.diffuseColor = Color3.Black();
    wmat.specularColor = Color3.Black();
    wmat.emissiveColor = Color3.White();
    wmat.backFaceCulling = false;
    wm.material = wmat;
    wm.hasVertexAlpha = true;
    wm.metadata = { noOutline: true };
    meshes.push(wm);
  }

  const baseEm = accent.scale(Math.max(0.5, th.accent.strength));
  const grad = th.set === "fissura" || th.set === "cratera" || th.set === "grades";
  return {
    meshes,
    glow: glowMeshes,
    setLit(t: number): void {
      if (!emMat || !grad) return;
      const k = 0.7 + 0.3 * Math.max(0, Math.min(1, t));
      emMat.emissiveColor.set(baseEm.r * k, baseEm.g * k, baseEm.b * k);
    },
    setBrasaLight(v: number): void {
      if (!emMat) return;
      const k = 0.65 + 0.7 * (1 - Math.max(0, Math.min(1, v)));
      emMat.emissiveColor.set(baseEm.r * k, baseEm.g * k, baseEm.b * k);
    },
  };
}
