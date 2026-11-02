import { Color3, Mesh, MeshBuilder, Vector3, VertexBuffer, VertexData } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import type { FloorTheme } from "./cryptTheme";
import type { Layout } from "./cryptLayouts";

/**
 * CAMADA JOGO (Brasa). Pecas de CENOGRAFIA da caverna (fora dos muros, nunca na faixa de combate).
 * Tudo nasce como malha com cor por vertice e e FUNDIDO pelo chamador: rocha/ossos/ruina entram
 * numa malha lit (1 draw call), brasa/cristais/velas numa malha emissiva (1) e agua numa terceira
 * (1). Alturas respeitam o teto `cap(d)` (a rocha nunca tapa o heroi na camera orbital).
 */

export type Rng = () => number;

export interface CaveCtx {
  scene: Scene;
  rnd: Rng;
  theme: FloorTheme;
  halfX: number;
  halfZ: number;
  doorX: number;
  layout: Layout;
  /** Altura real do terreno em (x,z). */
  surf(x: number, z: number): number;
  /** Distancia horizontal ate a borda da sala (0 dentro/na borda). */
  dist(x: number, z: number): number;
  /** Teto de altura de uma peca a `d` metros da borda. */
  cap(d: number): number;
  lit: Mesh[]; // partes da malha de rocha (iluminada)
  glow: Mesh[]; // partes emissivas (entram no GlowLayer)
  geoGlow: Geo; // fitas emissivas (veios, fissuras)
  geoWater: Geo; // agua, cascatas, marolas
  /** Manchas escuras de sangue/ferrugem na rocha (usadas na pintura do terreno). */
  stains: { x: number; z: number; r: number }[];
}

const TAU = Math.PI * 2;
export const col = (h: string): Color3 => Color3.FromHexString(h);

/** Tinge uma malha inteira com uma cor por vertice (a luz multiplica por cima). */
export function paint(m: Mesh, c: Color3, k = 1): Mesh {
  const n = m.getTotalVertices();
  const arr = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    arr[i * 4] = c.r * k;
    arr[i * 4 + 1] = c.g * k;
    arr[i * 4 + 2] = c.b * k;
    arr[i * 4 + 3] = 1;
  }
  m.setVerticesData(VertexBuffer.ColorKind, arr);
  return m;
}

export interface Xf { ry?: number; rx?: number; rz?: number; sx?: number; sy?: number; sz?: number }

/** Posiciona e "assa" a transformacao nos vertices (a malha vira geometria de mundo). */
export function place(m: Mesh, x: number, y: number, z: number, o: Xf = {}): Mesh {
  m.scaling.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  m.position.set(x, y, z);
  m.bakeCurrentTransformIntoVertices();
  return m;
}

function jit(c: Color3, rnd: Rng, a = 0.14): Color3 {
  const k = 1 - a / 2 + rnd() * a;
  return new Color3(c.r * k, c.g * k, c.b * k);
}

/** Geometria em fita construida a mao (veios, fissuras, agua): posicao + cor RGBA por vertice. */
export class Geo {
  pos: number[] = [];
  cols: number[] = [];
  idx: number[] = [];
  get empty(): boolean { return this.idx.length === 0; }

  /** Fita ao longo de um caminho (xz) com largura por ponto; `core` opcional faz o miolo mais claro. */
  strip(pts: { x: number; y: number; z: number; w: number }[], c: [number, number, number, number], core?: [number, number, number, number]): void {
    const rows: number[][] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      const a = pts[Math.max(0, i - 1)]!;
      const b = pts[Math.min(pts.length - 1, i + 1)]!;
      let tx = b.x - a.x;
      let tz = b.z - a.z;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      const nx = -tz;
      const nz = tx;
      const fade = i === 0 || i === pts.length - 1 ? 0.35 : 1;
      const edge: [number, number, number, number] = [c[0] * fade, c[1] * fade, c[2] * fade, c[3]];
      const row: number[] = [];
      const push = (ox: number, cc: [number, number, number, number]): void => {
        row.push(this.pos.length / 3);
        this.pos.push(p.x + nx * ox, p.y, p.z + nz * ox);
        this.cols.push(cc[0], cc[1], cc[2], cc[3]);
      };
      push(p.w / 2, edge);
      if (core) {
        push(0, [core[0] * fade, core[1] * fade, core[2] * fade, core[3]]);
      }
      push(-p.w / 2, edge);
      rows.push(row);
    }
    for (let i = 0; i < rows.length - 1; i++) {
      const r0 = rows[i]!;
      const r1 = rows[i + 1]!;
      for (let k = 0; k < r0.length - 1; k++) {
        this.idx.push(r0[k]!, r1[k]!, r0[k + 1]!, r0[k + 1]!, r1[k]!, r1[k + 1]!);
      }
    }
  }

  /** Quadrilatero plano horizontal (marolas, espuma). */
  quad(cx: number, y: number, cz: number, hx: number, hz: number, ry: number, c: [number, number, number, number]): void {
    const s = Math.sin(ry);
    const co = Math.cos(ry);
    const base = this.pos.length / 3;
    for (const [px, pz] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]] as const) {
      this.pos.push(cx + px * co - pz * s, y, cz + px * s + pz * co);
      this.cols.push(c[0], c[1], c[2], c[3]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Quadrilatero vertical (feixe de luz): cor/alfa embaixo e em cima. */
  vquad(cx: number, y0: number, cz: number, hw: number, h: number, ry: number, cb: [number, number, number, number], ct: [number, number, number, number]): void {
    const dx = Math.cos(ry) * hw;
    const dz = Math.sin(ry) * hw;
    const base = this.pos.length / 3;
    this.pos.push(cx - dx, y0, cz - dz, cx + dx, y0, cz + dz, cx + dx, y0 + h, cz + dz, cx - dx, y0 + h, cz - dz);
    this.cols.push(...cb, ...cb, ...ct, ...ct);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** Moldura retangular (anel) entre dois retangulos concentricos, a altura y. */
  frame(inX: number, inZ: number, outX: number, outZ: number, y: number, cin: [number, number, number, number], cout: [number, number, number, number]): void {
    const base = this.pos.length / 3;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sz] of corners as number[][]) {
      this.pos.push(sx! * inX, y, sz! * inZ);
      this.cols.push(cin[0], cin[1], cin[2], cin[3]);
    }
    for (const [sx, sz] of corners as number[][]) {
      this.pos.push(sx! * outX, y, sz! * outZ);
      this.cols.push(cout[0], cout[1], cout[2], cout[3]);
    }
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.idx.push(base + i, base + 4 + i, base + j, base + j, base + 4 + i, base + 4 + j);
    }
  }

  toMesh(name: string, scene: Scene): Mesh | null {
    if (this.empty) return null;
    const m = new Mesh(name, scene);
    const vd = new VertexData();
    vd.positions = this.pos;
    vd.indices = this.idx;
    const n = this.pos.length / 3;
    const normals = new Array<number>(n * 3);
    const uvs = new Array<number>(n * 2).fill(0);
    for (let i = 0; i < n; i++) {
      normals[i * 3] = 0;
      normals[i * 3 + 1] = 1;
      normals[i * 3 + 2] = 0;
    }
    vd.normals = normals;
    vd.uvs = uvs;
    vd.colors = this.cols;
    vd.applyToMesh(m, false);
    m.hasVertexAlpha = true;
    m.isPickable = false;
    m.metadata = { noOutline: true };
    return m;
  }
}

// ---------------------------------------------------------------------------------------------
// Auxiliares de posicionamento
// ---------------------------------------------------------------------------------------------

/** Sorteia um ponto na rampa com distancia entre dmin e dmax da borda (fora da sala). */
export function pickPoint(c: CaveCtx, dmin: number, dmax: number, region?: "n" | "s" | "e" | "w"): { x: number; z: number; d: number } {
  for (let k = 0; k < 120; k++) {
    const x = (c.rnd() * 2 - 1) * (c.halfX + dmax + 1);
    const z = (c.rnd() * 2 - 1) * (c.halfZ + dmax + 1);
    const d = c.dist(x, z);
    if (d < dmin || d > dmax) continue;
    if (c.rnd() > Math.exp(-(d - dmin) / 6.5)) continue; // a maioria perto do muro, onde a camera enxerga
    if (region === "n" && z < c.halfZ) continue;
    if (region === "s" && z > -c.halfZ) continue;
    if (region === "e" && x < c.halfX) continue;
    if (region === "w" && x > -c.halfX) continue;
    return { x, z, d };
  }
  const x = c.halfX + dmin + 1;
  return { x, z: 0, d: c.dist(x, 0) };
}

/** Ponto de um lado (n/s/e/w) a `d` metros da borda, com deslocamento lateral `along`. */
export function rimPoint(c: CaveCtx, side: "n" | "s" | "e" | "w", along: number, d: number): { x: number; z: number } {
  const off = 0.5 + d;
  switch (side) {
    case "n": return { x: along, z: c.halfZ + off };
    case "s": return { x: along, z: -c.halfZ - off };
    case "e": return { x: c.halfX + off, z: along };
    default: return { x: -c.halfX - off, z: along };
  }
}

// ---------------------------------------------------------------------------------------------
// Pecas genericas
// ---------------------------------------------------------------------------------------------

const ROCK_GAIN = 0.8;

/** Rochas facetadas soltas (e espiras altas ao longe, onde o teto de altura permite). */
export function rocks(c: CaveCtx, n: number, color: Color3): void {
  for (let i = 0; i < n * 3 && c.lit.length < 4000; i++) {
    if (i >= n * 3) break;
    const p = pickPoint(c, 1.4, 20);
    const h = Math.min(c.cap(p.d), 0.45 + c.rnd() * 2.2);
    const w = h * (0.7 + c.rnd() * 0.9);
    const m = MeshBuilder.CreatePolyhedron("rocha", { type: 3, size: 0.5 }, c.scene);
    paint(m, jit(color, c.rnd, 0.3), ROCK_GAIN);
    place(m, p.x, c.surf(p.x, p.z) - h * 0.12 + h * 0.4, p.z, { ry: c.rnd() * TAU, sx: w, sy: h, sz: w * (0.8 + c.rnd() * 0.4) });
    c.lit.push(m);
    if (--n <= 0) break;
  }
}

/** Espetos/estalagmites (cones). `lean` inclina (ferro torto). */
export function spikes(c: CaveCtx, n: number, lean: number, color: Color3, tall = 1): void {
  for (let i = 0; i < n; i++) {
    const p = pickPoint(c, c.theme.terrain.moat ? 4.6 : 3, 19);
    const h = Math.min(c.cap(p.d) * 1.15 * tall, 0.6 + c.rnd() * 2.0 * tall);
    const w = Math.max(0.4, h * (0.28 + c.rnd() * 0.2));
    const m = MeshBuilder.CreateCylinder("espeto", { diameterTop: 0, diameterBottom: w, height: h, tessellation: 5 }, c.scene);
    paint(m, jit(color, c.rnd, 0.3), ROCK_GAIN);
    const a = c.rnd() * TAU;
    place(m, p.x, c.surf(p.x, p.z) - 0.1 + h / 2, p.z, { ry: a, rx: (c.rnd() - 0.5) * lean * 1.2, rz: (c.rnd() - 0.5) * lean * 1.2 });
    c.lit.push(m);
  }
}

/** Espiras altas e distantes (d > 14): so aparecem no topo da tela, dao silhueta de caverna. */
export function farSpires(c: CaveCtx, n: number, color: Color3): void {
  for (let i = 0; i < n; i++) {
    const p = pickPoint(c, 15, 24);
    const h = 4 + c.rnd() * 6;
    const w = 1.2 + c.rnd() * 1.6;
    const m = MeshBuilder.CreateCylinder("espira", { diameterTop: 0.1, diameterBottom: w, height: h, tessellation: 6 }, c.scene);
    paint(m, jit(color, c.rnd, 0.25), ROCK_GAIN * 0.85);
    place(m, p.x, c.surf(p.x, p.z) - 0.3 + h / 2, p.z, { ry: c.rnd() * TAU, rx: (c.rnd() - 0.5) * 0.25, rz: (c.rnd() - 0.5) * 0.25 });
    c.lit.push(m);
  }
}

/** Colunas hexagonais de basalto, em feixes (altura cai do centro para a borda do feixe). */
export function hexColumns(c: CaveCtx, clusters: number, color: Color3): void {
  for (let k = 0; k < clusters; k++) {
    const p = pickPoint(c, 2.6, 15);
    const R = 2;
    const rad = 0.52;
    for (let q = -R; q <= R; q++) {
      for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
        const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
        if (ring === R && c.rnd() < 0.35) continue;
        const ox = (q + r / 2) * rad * 1.8;
        const oz = r * rad * 1.56;
        const x = p.x + ox;
        const z = p.z + oz;
        const d = c.dist(x, z);
        if (d < 1.4) continue;
        const h = Math.min(c.cap(d) * 1.1, (0.5 + c.rnd() * 0.9) * (1.55 - 0.25 * ring));
        if (h < 0.25) continue;
        const base = c.surf(x, z) - 0.7;
        const m = MeshBuilder.CreateCylinder("coluna_hex", { diameter: rad * 1.9, height: h + 0.7, tessellation: 6 }, c.scene);
        paint(m, jit(color, c.rnd, 0.35), ROCK_GAIN);
        place(m, x, base + (h + 0.7) / 2, z, { ry: c.rnd() < 0.5 ? 0 : Math.PI / 6, rx: (c.rnd() - 0.5) * 0.1, rz: (c.rnd() - 0.5) * 0.1 });
        c.lit.push(m);
      }
    }
  }
}

const BONE = col("#a8a290");

function bone(c: CaveCtx, x: number, z: number, len: number, ry: number, lift = 0.05, tint = BONE): void {
  const y = c.surf(x, z) + lift;
  const m = MeshBuilder.CreateCylinder("osso", { diameter: 0.08 + c.rnd() * 0.03, height: len, tessellation: 5 }, c.scene);
  paint(m, jit(tint, c.rnd, 0.2), 0.8);
  place(m, x, y, z, { rz: Math.PI / 2, ry });
  c.lit.push(m);
  for (const s of [-1, 1]) {
    const k = MeshBuilder.CreatePolyhedron("junta", { type: 1, size: 0.07 }, c.scene);
    paint(k, jit(tint, c.rnd, 0.2), 0.8);
    place(k, x + Math.cos(ry) * -s * len * 0.5, y, z + Math.sin(ry) * s * len * 0.5, { sx: 1.2 });
    c.lit.push(k);
  }
}

function skull(c: CaveCtx, x: number, z: number, scale = 1, ry = 0, y?: number, tint = BONE): void {
  const yy = y ?? c.surf(x, z) + 0.1 * scale;
  const m = MeshBuilder.CreateSphere("cranio", { diameter: 0.3 * scale, segments: 4 }, c.scene);
  paint(m, jit(tint, c.rnd, 0.16), 0.85);
  place(m, x, yy + 0.1 * scale, z, { ry, sy: 0.9, sz: 1.1 });
  c.lit.push(m);
  const j = MeshBuilder.CreateBox("mandibula", { width: 0.17 * scale, height: 0.06 * scale, depth: 0.14 * scale }, c.scene);
  paint(j, jit(tint, c.rnd, 0.16), 0.7);
  place(j, x + Math.sin(ry) * 0.13 * scale, yy, z + Math.cos(ry) * 0.13 * scale, { ry });
  c.lit.push(j);
}

/** Ossada meio enterrada na rocha: ossos soltos e alguns cranios. */
export function bones(c: CaveCtx, n: number, tint = BONE): void {
  for (let i = 0; i < n; i++) {
    const p = pickPoint(c, 1.5, 11);
    if (c.rnd() < 0.28) skull(c, p.x, p.z, 0.8 + c.rnd() * 0.4, c.rnd() * TAU, undefined, tint);
    else bone(c, p.x, p.z, 0.35 + c.rnd() * 0.55, c.rnd() * TAU, 0.05, tint);
  }
}

/** Direcao unitaria (xz) rumo ao muro mais proximo a partir de (x,z). */
function towardRoom(c: CaveCtx, x: number, z: number): { dx: number; dz: number } {
  const ox = Math.abs(x) - c.halfX;
  const oz = Math.abs(z) - c.halfZ;
  return ox >= oz ? { dx: -Math.sign(x), dz: 0 } : { dx: 0, dz: -Math.sign(z) };
}

/** Raizes rastejando pela rocha em direcao ao muro (a superficie ficou la em cima). */
export function roots(c: CaveCtx, n: number, color: Color3): void {
  for (let i = 0; i < n; i++) {
    const p = pickPoint(c, 3, 13);
    let x = p.x;
    let z = p.z;
    const t = towardRoom(c, x, z);
    let ang = Math.atan2(t.dz, t.dx) + (c.rnd() - 0.5) * 0.9;
    const path: Vector3[] = [];
    const steps = 7 + Math.floor(c.rnd() * 5);
    for (let s = 0; s < steps; s++) {
      path.push(new Vector3(x, c.surf(x, z) + 0.09, z));
      ang += (c.rnd() - 0.5) * 0.7;
      x += Math.cos(ang) * 0.75;
      z += Math.sin(ang) * 0.75;
      if (c.dist(x, z) < 0.8) break;
    }
    if (path.length < 3) continue;
    const r0 = 0.07 + c.rnd() * 0.05;
    const m = MeshBuilder.CreateTube("raiz", { path, radiusFunction: (_i: number, d: number) => r0 * (1 - 0.7 * (d / (path.length * 0.75))), tessellation: 4, cap: Mesh.NO_CAP }, c.scene);
    paint(m, jit(color, c.rnd, 0.3), 0.8);
    c.lit.push(m);
  }
}

/** Tambores de coluna e capiteis da cripta afundando na rocha (a ruina que a caverna engoliu). */
export function drums(c: CaveCtx, n: number, color: Color3): void {
  for (let i = 0; i < n; i++) {
    const p = pickPoint(c, 2.2, 12);
    const stack = 1 + Math.floor(c.rnd() * 2);
    const tiltX = (c.rnd() - 0.5) * 0.7;
    const tiltZ = (c.rnd() - 0.5) * 0.7;
    const ry = c.rnd() * TAU;
    const dia = 0.9 + c.rnd() * 0.5;
    for (let s = 0; s < stack; s++) {
      const hh = Math.min(0.55 + c.rnd() * 0.35, Math.max(0.35, c.cap(p.d) * 0.9));
      const m = MeshBuilder.CreateCylinder("tambor", { diameter: dia * (1 - 0.06 * s), height: hh, tessellation: 8 }, c.scene);
      paint(m, jit(color, c.rnd, 0.2), 0.85);
      place(m, p.x + s * 0.12, c.surf(p.x, p.z) + hh * (0.15 + s * 0.85), p.z + s * 0.1, { ry, rx: tiltX * (1 + s * 0.4), rz: tiltZ * (1 + s * 0.4) });
      c.lit.push(m);
    }
    if (c.rnd() < 0.5) {
      const b = MeshBuilder.CreateBox("plinto", { width: dia * 1.15, height: 0.22, depth: dia * 1.15 }, c.scene);
      paint(b, jit(color, c.rnd, 0.2), 0.75);
      place(b, p.x + 1.1, c.surf(p.x + 1.1, p.z) + 0.02, p.z - 0.2, { ry: ry + 0.4, rx: tiltX * 0.6, rz: tiltZ * 0.6 });
      c.lit.push(b);
    }
  }
}

/** Aglomerados de cristal emissivo (cor unica do andar; a intensidade varia por vertice). */
export function crystals(c: CaveCtx, clusters: number): void {
  for (let k = 0; k < clusters; k++) {
    const p = pickPoint(c, c.theme.terrain.moat ? 4.4 : 2.2, 13);
    const cnt = 3 + Math.floor(c.rnd() * 4);
    for (let i = 0; i < cnt; i++) {
      const a = c.rnd() * TAU;
      const rr = c.rnd() * 0.55;
      const x = p.x + Math.cos(a) * rr;
      const z = p.z + Math.sin(a) * rr;
      const d = c.dist(x, z);
      const h = Math.min(c.cap(d) * 1.15, 0.5 + c.rnd() * 1.1);
      const m = MeshBuilder.CreateCylinder("cristal", { diameterTop: 0, diameterBottom: 0.2 + c.rnd() * 0.2, height: h, tessellation: 6 }, c.scene);
      const g = 0.55 + c.rnd() * 0.45;
      paint(m, new Color3(g, g, g));
      place(m, x, c.surf(x, z) + h * 0.35, z, { ry: c.rnd() * TAU, rx: (c.rnd() - 0.5) * 0.7, rz: (c.rnd() - 0.5) * 0.7 });
      c.glow.push(m);
    }
  }
}

/** Veios de brasa: fitas finas e tortas sobre a rocha (emissivo; ramificam). */
export function veins(c: CaveCtx, n: number, widthK = 1): void {
  const walk = (x0: number, z0: number, ang0: number, len: number, w0: number, depth: number): void => {
    const pts: { x: number; y: number; z: number; w: number }[] = [];
    let x = x0;
    let z = z0;
    let ang = ang0;
    for (let s = 0; s < len; s++) {
      const w = w0 * (1 - 0.65 * (s / len)) * (0.8 + c.rnd() * 0.4);
      pts.push({ x, y: c.surf(x, z) + 0.12, z, w });
      ang += (c.rnd() - 0.5) * 1.1;
      const st = 0.5 + c.rnd() * 0.45;
      x += Math.cos(ang) * st;
      z += Math.sin(ang) * st;
      if (c.dist(x, z) < 0.9) break;
      if (depth < 2 && s > 1 && c.rnd() < 0.2) walk(x, z, ang + (c.rnd() < 0.5 ? 1 : -1) * (0.6 + c.rnd() * 0.6), Math.max(3, len - s - 2), w0 * 0.6, depth + 1);
    }
    if (pts.length >= 2) {
      const g = 0.55 + c.rnd() * 0.4;
      c.geoGlow.strip(pts, [g * 0.9, g * 0.75, g * 0.6, 1], [g * 1.3, g * 1.1, g * 0.85, 1]);
    }
  };
  for (let i = 0; i < n; i++) {
    const p = pickPoint(c, 1.6, 15);
    walk(p.x, p.z, c.rnd() * TAU, 6 + Math.floor(c.rnd() * 6), (0.14 + c.rnd() * 0.12) * widthK, 0);
  }
}

/** Fissura larga e incandescente (a Brasa vista atraves da rocha): miolo quase branco. */
export function fissure(c: CaveCtx, x0: number, z0: number, x1: number, z1: number, width: number, strength = 1): void {
  const segs = Math.max(5, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.9));
  const pts: { x: number; y: number; z: number; w: number }[] = [];
  const nx = -(z1 - z0);
  const nz = x1 - x0;
  const nl = Math.hypot(nx, nz) || 1;
  for (let s = 0; s <= segs; s++) {
    const u = s / segs;
    const wob = (c.rnd() - 0.5) * 1.1;
    const x = x0 + (x1 - x0) * u + (nx / nl) * wob;
    const z = z0 + (z1 - z0) * u + (nz / nl) * wob;
    const w = width * Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.03)) * (0.65 + c.rnd() * 0.6) + 0.15;
    pts.push({ x, y: c.surf(x, z) + 0.14, z, w });
  }
  c.geoGlow.strip(pts, [0.7 * strength, 0.26 * strength, 0.07 * strength, 1], [1.5 * strength, 1.1 * strength, 0.65 * strength, 1]);
}

// ---------------------------------------------------------------------------------------------
// Agua (andar da cisterna): lago em volta dos muros + cascatas descendo a rampa
// ---------------------------------------------------------------------------------------------

export const WATER_Y = 0.14;

export function lake(c: CaveCtx): void {
  const g = c.geoWater;
  const inner = [c.halfX + 0.25, c.halfZ + 0.25];
  g.frame(inner[0]!, inner[1]!, c.halfX + 11, c.halfZ + 11, WATER_Y, [0.1, 0.34, 0.42, 0.78], [0.08, 0.3, 0.4, 0.78]);
  // marolas claras espalhadas sobre a agua
  for (let i = 0; i < 46; i++) {
    const p = pickPoint(c, 0.8, 5.5);
    if (c.surf(p.x, p.z) > WATER_Y - 0.05) continue;
    const l = 0.4 + c.rnd() * 0.9;
    g.quad(p.x, WATER_Y + 0.012, p.z, l, 0.06 + c.rnd() * 0.05, c.rnd() * TAU, [0.55, 0.85, 0.95, 0.5]);
  }
}

/** Cascata: fita clara descendo a rampa em linha reta ate o lago, com espuma na base. */
export function cascade(c: CaveCtx, side: "n" | "s" | "e" | "w", along: number, w0 = 1.1): void {
  const top = rimPoint(c, side, along, 13);
  const bot = rimPoint(c, side, along, 3.6);
  const n = 12;
  const pts: { x: number; y: number; z: number; w: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = top.x + (bot.x - top.x) * u + Math.sin(u * 7 + along) * 0.18;
    const z = top.z + (bot.z - top.z) * u + Math.cos(u * 6 + along) * 0.18;
    pts.push({ x, y: Math.max(c.surf(x, z) + 0.1, WATER_Y + 0.02), z, w: w0 * (0.7 + 0.8 * u) });
  }
  c.geoWater.strip(pts, [0.3, 0.6, 0.72, 0.6], [0.5, 0.78, 0.88, 0.7]);
  const last = pts[pts.length - 1]!;
  c.geoWater.quad(last.x, WATER_Y + 0.02, last.z, 1.1, 1.1, 0.4, [0.8, 0.95, 1, 0.45]);
}

// ---------------------------------------------------------------------------------------------
// Pecas de cena (set pieces): a narrativa do andar contada em cenografia, sem texto
// ---------------------------------------------------------------------------------------------

function box(c: CaveCtx, w: number, h: number, d: number, x: number, y: number, z: number, color: Color3, xf: Xf = {}, k = 0.85): Mesh {
  const m = MeshBuilder.CreateBox("peca", { width: w, height: h, depth: d }, c.scene);
  paint(m, jit(color, c.rnd, 0.12), k);
  place(m, x, y, z, xf);
  c.lit.push(m);
  return m;
}

/** Sarcofago arrombado: tampa deslizada, interior escuro, ossos pelo chao (o povo morto, andar 1). */
export function tomb(c: CaveCtx, x: number, z: number, ry: number): void {
  const y = c.surf(x, z);
  const stone = col("#76788a");
  box(c, 2.2, 0.55, 0.95, x, y + 0.22, z, stone, { ry });
  box(c, 1.9, 0.06, 0.62, x, y + 0.5, z, col("#0a0c12"), { ry }, 0.9);
  const lx = Math.cos(ry) * 0.85;
  const lz = -Math.sin(ry) * 0.85;
  box(c, 2.25, 0.22, 1.0, x + lx, y + 0.66, z + lz + 0.25, stone, { ry: ry + 0.38, rz: 0.1 });
  skull(c, x - lx * 0.6 + 0.5, z - lz * 0.6 + 0.9, 1, ry + 1, undefined);
  bone(c, x + 0.4, z + 1.1, 0.6, ry + 0.7);
  bone(c, x - 0.9, z + 0.95, 0.5, ry - 0.5);
  // segundo tumulo menor, tombado
  const x2 = x + 3.4;
  const z2 = z - 0.6;
  box(c, 1.7, 0.45, 0.8, x2, c.surf(x2, z2) + 0.15, z2, stone, { ry: ry + 0.5, rz: 0.22 });
  box(c, 1.7, 0.15, 0.85, x2 + 0.6, c.surf(x2 + 0.6, z2 + 0.7) + 0.08, z2 + 0.7, stone, { ry: ry - 0.3, rx: 0.12 });
}

/** Acampamento apagado da Acendedora que desceu antes: circulo de pedras, cinza, trapo vermelho. */
export function camp(c: CaveCtx, x: number, z: number): void {
  const y = c.surf(x, z);
  const stoneC = col("#5c606c");
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + c.rnd() * 0.3;
    const m = MeshBuilder.CreatePolyhedron("pedra_fogueira", { type: 3, size: 0.2 }, c.scene);
    paint(m, jit(stoneC, c.rnd, 0.3), 0.8);
    place(m, x + Math.cos(a) * 0.75, y + 0.06, z + Math.sin(a) * 0.75, { sx: 1.1, sy: 0.8, ry: c.rnd() * TAU });
    c.lit.push(m);
  }
  const ash = MeshBuilder.CreateCylinder("cinza_fogueira", { diameter: 1.25, height: 0.05, tessellation: 9 }, c.scene);
  paint(ash, col("#16171d"), 0.9);
  place(ash, x, y + 0.04, z);
  c.lit.push(ash);
  for (let i = 0; i < 3; i++) {
    const a = c.rnd() * TAU;
    const st = MeshBuilder.CreateCylinder("graveto", { diameter: 0.07, height: 0.7, tessellation: 4 }, c.scene);
    paint(st, col("#241d1a"), 0.8);
    place(st, x + Math.cos(a) * 0.2, y + 0.1, z + Math.sin(a) * 0.2, { rz: Math.PI / 2, ry: a });
    c.lit.push(st);
  }
  // trouxa/esteira ao lado e mastro com o manto rasgado (vermelho gasto)
  const cloth = col("#8a3636");
  box(c, 0.6, 0.18, 1.7, x - 1.8, y + 0.08, z + 0.3, col("#5e5848"), { ry: 0.5 });
  const pole = MeshBuilder.CreateCylinder("mastro", { diameter: 0.07, height: 1.5, tessellation: 4 }, c.scene);
  paint(pole, col("#2a221c"), 0.8);
  place(pole, x + 1.5, y + 0.7, z - 0.8, { rz: 0.12 });
  c.lit.push(pole);
  for (let i = 0; i < 3; i++) {
    const t = MeshBuilder.CreateBox("trapo", { width: 0.5 - i * 0.1, height: 0.45 - i * 0.07, depth: 0.03 }, c.scene);
    paint(t, jit(cloth, c.rnd, 0.3), 0.85);
    place(t, x + 1.78 + i * 0.14, y + 1.25 - i * 0.28, z - 0.8, { ry: 0.4 + i * 0.2, rz: -0.25 - i * 0.2 });
    c.lit.push(t);
  }
  const rag = box(c, 1.1, 0.04, 0.8, x - 0.4, y + 0.06, z + 1.8, cloth, { ry: 0.9 }, 0.8);
  rag.name = "manto_rasgado";
  bone(c, x + 0.5, z + 1.4, 0.5, 1.2);
}

/** Grades de ferro cravadas na rocha (o custo): barras finas em moldura, e mancha escura de sangue. */
export function grates(c: CaveCtx, spots: { x: number; z: number; ry: number }[]): void {
  const iron = col("#3a3034");
  for (const s of spots) {
    const y = c.surf(s.x, s.z);
    const w = 1.5;
    const h = Math.min(1.1, Math.max(0.6, c.cap(c.dist(s.x, s.z)) * 1.2));
    const cs = Math.cos(s.ry);
    const sn = Math.sin(s.ry);
    const lean = 0.35;
    for (let i = 0; i <= 8; i++) {
      const u = -w / 2 + (w * i) / 8;
      box(c, 0.06, h, 0.06, s.x + cs * u, y + h / 2 - 0.1, s.z - sn * u, iron, { ry: s.ry, rx: -lean }, 0.9);
    }
    for (const hv of [0.18, h - 0.1]) {
      box(c, w + 0.14, 0.07, 0.08, s.x, y + hv - 0.05, s.z - Math.sin(lean) * (hv - h / 2) * 0.0, iron, { ry: s.ry, rx: -lean }, 0.9);
    }
    c.stains.push({ x: s.x, z: s.z, r: 2.4 });
    skull(c, s.x + cs * 0.4 + sn * 0.9, s.z - sn * 0.4 + cs * 0.9, 0.9, s.ry, undefined, col("#8a8070"));
  }
}

/** Duas Acendedoras (luto): uma tombou na porta, voltando; outra seguiu mais fundo. Velas votivas. */
export function twoRemains(c: CaveCtx): void {
  const cloak = col("#4a4658");
  // 1) a que voltou ate a porta: fora do vao da porta (sul), cabeca rumo a sala
  const door = rimPoint(c, "s", c.doorX + 1.8, 2.4);
  const dy = c.surf(door.x, door.z);
  skull(c, door.x, door.z + 0.9, 1.05, Math.PI, undefined);
  box(c, 0.7, 0.1, 1.5, door.x, dy + 0.09, door.z - 0.1, cloak, { ry: 0.12 });
  for (let i = 0; i < 4; i++) {
    box(c, 0.55 - i * 0.04, 0.05, 0.05, door.x, dy + 0.18, door.z + 0.1 - i * 0.14, col("#a8a290"), { ry: 0.1 }, 0.8);
  }
  bone(c, door.x - 0.7, door.z + 0.4, 0.7, 0.3);
  bone(c, door.x + 0.7, door.z + 0.3, 0.7, -0.3);
  bone(c, door.x - 0.35, door.z - 0.9, 0.6, 1.4);
  // 2) a que desceu mais fundo: ossos e manto rente ao fundo (norte), junto a saida
  const deep = rimPoint(c, "n", -4.2, 2.8);
  const ey = c.surf(deep.x, deep.z);
  box(c, 0.8, 0.1, 1.5, deep.x, ey + 0.09, deep.z, cloak, { ry: -0.5 });
  skull(c, deep.x + 0.35, deep.z - 0.9, 1, 0.6, undefined);
  bone(c, deep.x - 0.4, deep.z + 0.3, 0.7, -0.8);
  bone(c, deep.x + 0.4, deep.z + 0.2, 0.7, 0.6);
  // velas votivas (emissivo): pequenas, em pares junto de cada ossada
  for (const [px, pz] of [[door.x - 1.3, door.z + 0.2], [door.x + 1.2, door.z - 0.4], [deep.x - 1.4, deep.z - 0.2], [deep.x + 1.5, deep.z + 0.3], [deep.x + 1.1, deep.z - 1.2]] as const) {
    const m = MeshBuilder.CreateCylinder("vela", { diameter: 0.1, height: 0.22, tessellation: 5 }, c.scene);
    paint(m, new Color3(1, 1, 1));
    place(m, px, c.surf(px, pz) + 0.12, pz);
    c.glow.push(m);
    const f = MeshBuilder.CreateCylinder("chama_vela", { diameterTop: 0, diameterBottom: 0.09, height: 0.2, tessellation: 4 }, c.scene);
    paint(f, new Color3(1.6, 1.4, 1));
    place(f, px, c.surf(px, pz) + 0.33, pz);
    c.glow.push(f);
  }
}

/** Pilhas de cranios e ossos nas laterais (ossuario embutido na parede da caverna). */
export function ossuary(c: CaveCtx, side: "e" | "w", along: number): void {
  const base = rimPoint(c, side, along, 3.4);
  const tint = col("#a39d8c");
  for (let row = 0; row < 4; row++) {
    const n = 5 - row;
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * 0.34;
      const x = base.x;
      const z = base.z + lx;
      skull(c, x + (c.rnd() - 0.5) * 0.1, z, 0.95, (side === "e" ? Math.PI / 2 : -Math.PI / 2) + (c.rnd() - 0.5) * 0.6, c.surf(x, z) + row * 0.24, tint);
    }
  }
  for (let i = 0; i < 6; i++) bone(c, base.x + (c.rnd() - 0.5) * 1.4, base.z + (c.rnd() - 0.5) * 2.6, 0.5 + c.rnd() * 0.3, c.rnd() * TAU, 0.06, tint);
}

/** Aneis de brasa em volta da sala (o crater do Guardiao): fendas radiais e dois arcos concentricos. */
export function crater(c: CaveCtx): void {
  const side = ["n", "s", "e", "w"] as const;
  // fendas radiais saindo da metade de cada lado e de cada canto
  for (const s of side) {
    for (const along of s === "n" || s === "s" ? [-6, 6] : [-6, 6]) {
      const a = rimPoint(c, s, along, 1.2);
      const b = rimPoint(c, s, along * 1.5, 11);
      fissure(c, a.x, a.z, b.x, b.z, 0.45, 0.8);
    }
  }
  // arcos concentricos tracejados no perimetro, a 5 m e a 10 m da borda
  for (const d of [5.5, 10.5]) {
    const hx = c.halfX + 0.5 + d;
    const hz = c.halfZ + 0.5 + d;
    const perim: { x: number; z: number }[] = [];
    const steps = 90;
    for (let i = 0; i < steps; i++) {
      const u = (i / steps) * 4;
      const side4 = Math.floor(u);
      const t = (u - side4) * 2 - 1;
      perim.push(side4 === 0 ? { x: t * hx, z: -hz } : side4 === 1 ? { x: hx, z: t * hz } : side4 === 2 ? { x: -t * hx, z: hz } : { x: -hx, z: -t * hz });
    }
    let i = 0;
    while (i < perim.length) {
      const len = 3 + Math.floor(c.rnd() * 5);
      const gap = 2 + Math.floor(c.rnd() * 4);
      const seg = perim.slice(i, i + len).map((p, k) => {
        const jx = (c.rnd() - 0.5) * 0.5;
        const jz = (c.rnd() - 0.5) * 0.5;
        return { x: p.x + jx, y: c.surf(p.x + jx, p.z + jz) + 0.13, z: p.z + jz, w: 0.16 + 0.16 * Math.sin((Math.PI * (k + 0.5)) / len) };
      });
      if (seg.length >= 3) c.geoGlow.strip(seg, [0.6, 0.22, 0.06, 1], [1.4, 1.0, 0.6, 1]);
      i += len + gap;
    }
  }
}

/** Feixes de luz fria vindos do alto (a superficie ainda e perto, andar 1): translucidos e suaves. */
export function lightShafts(c: CaveCtx, n: number): void {
  for (let i = 0; i < n; i++) {
    const p = pickPoint(c, 4, 12);
    const y = c.surf(p.x, p.z) - 0.2;
    const w = 1.1 + c.rnd() * 0.9;
    const ry = c.rnd() * Math.PI;
    for (const a of [0, Math.PI / 2]) c.geoWater.vquad(p.x, y, p.z, w, 8.5, ry + a, [0.72, 0.86, 1, 0.1], [0.72, 0.86, 1, 0]);
    c.geoWater.quad(p.x, y + 0.08, p.z, w * 1.1, w * 0.8, ry, [0.72, 0.86, 1, 0.13]);
  }
}

// ---------------------------------------------------------------------------------------------
// Coroamento dos muros: a identidade onde a camera mais enxerga (o topo do muro e a face interna)
// ---------------------------------------------------------------------------------------------

interface CrownSpot { x: number; z: number; nx: number; nz: number; ax: number; az: number; ry: number }

/** Pontos ao longo do topo dos muros (a cada `step` m), fora de tochas, cantos, vao da porta e faixa de combate. */
function crownSpots(c: CaveCtx, step: number): CrownSpot[] {
  const L = c.layout;
  const out: CrownSpot[] = [];
  for (const w of L.walls) {
    const alongZ = Math.abs(w.rotY ?? 0) > 0.1;
    const n = alongZ ? { nx: Math.sign(w.x), nz: 0 } : { nx: 0, nz: Math.sign(w.z) };
    for (let t = -1.8; t <= 1.81; t += step) {
      const x = alongZ ? w.x : w.x + t;
      const z = alongZ ? w.z + t : w.z;
      if (Math.abs(x) > c.halfX - 1.4 && Math.abs(z) > c.halfZ - 1.4) continue; // cantos
      if (L.torches.some((q) => Math.hypot(q.x - x, q.z - z) < 1.0)) continue; // tochas
      const cl = L.calm;
      const dx = (x - cl.cx) / (cl.rx * 1.1);
      const dz = (z - cl.cz) / (cl.rz * 1.1);
      if (dx * dx + dz * dz < 1) continue; // faixa de combate
      out.push({ x, z, nx: n.nx, nz: n.nz, ax: alongZ ? 0 : 1, az: alongZ ? 1 : 0, ry: alongZ ? Math.PI / 2 : 0 });
    }
  }
  return out;
}

const WALL_TOP = 1.2;

export function crown(c: CaveCtx, tint: Color3): void {
  const kind = c.theme.rock.kind;
  const spots = crownSpots(c, kind === "ferro" ? 1.2 : 0.7);
  const rnd = c.rnd;
  let idx = 0;
  for (const s of spots) {
    idx++;
    const jitter = (rnd() - 0.5) * 0.3;
    const x = s.x + s.ax * jitter;
    const z = s.z + s.az * jitter;
    switch (kind) {
      case "arenito": {
        if (rnd() < 0.3) {
          const path = [
            new Vector3(x + s.nx * 0.75, WALL_TOP - 0.1, z + s.nz * 0.75),
            new Vector3(x + s.nx * 0.3, WALL_TOP + 0.14, z + s.nz * 0.3),
            new Vector3(x - s.nx * 0.05, WALL_TOP + 0.13, z - s.nz * 0.05),
            new Vector3(x - s.nx * 0.42, WALL_TOP - 0.06, z - s.nz * 0.42),
            new Vector3(x - s.nx * 0.5, WALL_TOP - 0.55, z - s.nz * 0.5),
          ];
          const m = MeshBuilder.CreateTube("raiz_muro", { path, radius: 0.06 + rnd() * 0.04, tessellation: 4, cap: Mesh.NO_CAP }, c.scene);
          paint(m, jit(col("#6c5440"), rnd, 0.3), 0.85);
          c.lit.push(m);
        } else if (rnd() < 0.2) {
          const m = MeshBuilder.CreatePolyhedron("seixo_muro", { type: 3, size: 0.13 }, c.scene);
          paint(m, jit(tint, rnd, 0.3), 0.7);
          place(m, x, WALL_TOP + 0.05, z + 0, { sx: 1 + rnd(), sy: 0.7, ry: rnd() * TAU });
          c.lit.push(m);
        }
        break;
      }
      case "basalto": {
        if (rnd() < 0.34) {
          const h = 0.15 + rnd() * 0.3;
          const m = MeshBuilder.CreateCylinder("coluna_muro", { diameter: 0.28 + rnd() * 0.16, height: h, tessellation: 6 }, c.scene);
          paint(m, jit(col("#3c424e"), rnd, 0.3), 0.8);
          place(m, x, WALL_TOP + h / 2 - 0.02, z, { ry: rnd() * TAU, rx: (rnd() - 0.5) * 0.3, rz: (rnd() - 0.5) * 0.3 });
          c.lit.push(m);
        } else if (rnd() < 0.3) {
          const m = MeshBuilder.CreateCylinder("cinza_muro", { diameter: 0.5 + rnd() * 0.3, height: 0.06, tessellation: 7 }, c.scene);
          paint(m, col("#23252c"), 0.8);
          place(m, x, WALL_TOP + 0.03, z, { ry: rnd() * TAU });
          c.lit.push(m);
        }
        break;
      }
      case "calcario": {
        if (rnd() < 0.3) {
          for (let k = 0; k < 2 + Math.floor(rnd() * 2); k++) {
            const h = 0.22 + rnd() * 0.36;
            const m = MeshBuilder.CreateCylinder("cristal_muro", { diameterTop: 0, diameterBottom: 0.11 + rnd() * 0.09, height: h, tessellation: 6 }, c.scene);
            const g = 0.6 + rnd() * 0.4;
            paint(m, new Color3(g, g, g));
            place(m, x + (rnd() - 0.5) * 0.3, WALL_TOP + h * 0.4, z + (rnd() - 0.5) * 0.2, { rx: (rnd() - 0.5) * 0.7, rz: (rnd() - 0.5) * 0.7 });
            c.glow.push(m);
          }
        } else if (rnd() < 0.3) {
          const m = MeshBuilder.CreateSphere("musgo_muro", { diameter: 0.3 + rnd() * 0.2, segments: 4 }, c.scene);
          paint(m, jit(col("#3f6a5e"), rnd, 0.3), 0.8);
          place(m, x, WALL_TOP, z, { sy: 0.45, sx: 1.3 });
          c.lit.push(m);
        }
        break;
      }
      case "ferro": {
        if (idx % 1 === 0 && rnd() < 0.75) {
          const h = 0.3 + rnd() * 0.22;
          const m = MeshBuilder.CreateCylinder("espeto_muro", { diameterTop: 0, diameterBottom: 0.1, height: h, tessellation: 4 }, c.scene);
          paint(m, jit(col("#40353a"), rnd, 0.2), 0.9);
          place(m, x, WALL_TOP + h / 2, z, { rx: s.nz * 0.0 + (-s.nz) * 0.25 * 0, rz: 0, ry: rnd() * TAU });
          c.lit.push(m);
          if (rnd() < 0.18) skull(c, x, z, 0.8, rnd() * TAU, WALL_TOP + h - 0.04, col("#8a8070"));
        }
        break;
      }
      case "osso": {
        if (rnd() < 0.2) skull(c, x, z, 0.85 + rnd() * 0.2, Math.atan2(s.nx, s.nz) + (rnd() - 0.5) * 0.5, WALL_TOP, col("#b0a994"));
        else if (rnd() < 0.2) {
          const m = MeshBuilder.CreateCylinder("vela_muro", { diameter: 0.1, height: 0.2 + rnd() * 0.12, tessellation: 5 }, c.scene);
          paint(m, new Color3(1, 1, 1));
          place(m, x, WALL_TOP + 0.12, z);
          c.glow.push(m);
          const f = MeshBuilder.CreateCylinder("chama_vela_muro", { diameterTop: 0, diameterBottom: 0.08, height: 0.18, tessellation: 4 }, c.scene);
          paint(f, new Color3(1.6, 1.4, 1));
          place(f, x, WALL_TOP + 0.34, z);
          c.glow.push(f);
        } else if (rnd() < 0.2) bone(c, x, z, 0.4 + rnd() * 0.3, rnd() * TAU, WALL_TOP - c.surf(x, z) + 0.02, col("#a8a290"));
        break;
      }
      case "brasa":
      case "obsidiana": {
        if (rnd() < (kind === "brasa" ? 0.28 : 0.13)) {
          // rachadura incandescente atravessando o topo do muro e descendo a face interna
          const len = 0.5 + rnd() * 0.5;
          const pts = [-0.45, -0.1, 0.18, 0.45].map((o, k) => ({
            x: x - s.nx * o + s.ax * (k % 2 === 0 ? -0.05 : 0.06),
            y: WALL_TOP + 0.03,
            z: z - s.nz * o + s.az * (k % 2 === 0 ? -0.05 : 0.06),
            w: 0.06 + rnd() * 0.05,
          }));
          void len;
          c.geoGlow.strip(pts, [0.7, 0.26, 0.07, 1], [1.4, 1.0, 0.6, 1]);
          const fx = x - s.nx * 0.46;
          const fz = z - s.nz * 0.46;
          for (let k = 0; k < 3; k++) {
            c.geoGlow.vquad(fx + s.ax * (k % 2 ? 0.06 : -0.05), WALL_TOP - 0.3 * (k + 1), fz + s.az * (k % 2 ? 0.06 : -0.05), 0.05, 0.3, s.ry, [1.3, 0.8, 0.45, 1], [0.8, 0.3, 0.1, 1]);
          }
        } else if (rnd() < 0.22) {
          const h = 0.25 + rnd() * 0.4;
          const m = MeshBuilder.CreateCylinder("estilhaco_muro", { diameterTop: 0, diameterBottom: 0.2 + rnd() * 0.1, height: h, tessellation: 5 }, c.scene);
          paint(m, jit(kind === "brasa" ? col("#4a3036") : col("#403a52"), rnd, 0.3), 0.85);
          place(m, x, WALL_TOP + h / 2 - 0.03, z, { rx: (rnd() - 0.5) * 0.5, rz: (rnd() - 0.5) * 0.5, ry: rnd() * TAU });
          c.lit.push(m);
        }
        break;
      }
    }
  }
}
