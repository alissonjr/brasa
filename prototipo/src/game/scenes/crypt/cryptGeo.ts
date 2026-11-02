import { DynamicTexture, Mesh, Texture, VertexData } from "@babylonjs/core";
import type { AssetContainer, Material, Scene } from "@babylonjs/core";
import type { Layout } from "./cryptLayouts";

/**
 * CAMADA JOGO (Brasa). Ferramentas de GEOMETRIA FACETADA low-poly para a cenografia do piso:
 * um acumulador (Facet) que junta triangulos de face chapada (normal por face, cor por vertice)
 * e primitivas por codigo (prisma, caixa, tubo, rocha, cacos, laminas) para montar o chao como
 * OBJETOS 3D em vez de pintura. Tudo vira UMA malha por material (poucas chamadas de desenho).
 * Texturas do piso/agua sao pequenas e TILEAVEIS (densidade constante em unidades de mundo).
 */

export type V3 = [number, number, number];
export type RGB = [number, number, number];
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dentro da faixa central de combate (elipse spawn->saida), escalada por k. */
export function inCalm(L: Layout, x: number, z: number, k = 1): boolean {
  const c = L.calm;
  const dx = (x - c.cx) / (c.rx * k);
  const dz = (z - c.cz) / (c.rz * k);
  return dx * dx + dz * dz < 1;
}

/** h em graus, s e l em 0..100 -> rgb 0..1. */
export function hsl(h: number, s: number, l: number): RGB {
  const S = s / 100, L = l / 100;
  const k = (n: number): number => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number): number => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
export const hex = (s: string): RGB => {
  const n = parseInt(s.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Acumulador de triangulos de face chapada com cor por vertice e UV planar em unidades de mundo. */
export class Facet {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];
  readonly uv: number[] = [];
  /** deslocamento do grao no UV (varia de laje a laje: some a repeticao do tile). */
  uvU = 0;
  uvV = 0;

  constructor(private readonly tile = 3) {}

  get triCount(): number {
    return this.pos.length / 9;
  }

  /** Triangulo; `hint` e a direcao aproximada da face (a ordem dos vertices se ajusta sozinha). */
  tri(a: V3, b: V3, c: V3, col: RGB, hint?: V3): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = vy * uz - vz * uy;
    let ny = vz * ux - vx * uz;
    let nz = vx * uy - vy * ux;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-10) return;
    nx /= len; ny /= len; nz /= len;
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
      const t = b; b = c; c = t;
      nx = -nx; ny = -ny; nz = -nz;
    }
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.col.push(col[0], col[1], col[2], 1);
      if (Math.abs(ny) > 0.6) this.uv.push(p[0] / this.tile + this.uvU, p[2] / this.tile + this.uvV);
      else this.uv.push(((p[0] + p[2]) * 0.7071) / this.tile + this.uvU, p[1] / this.tile + this.uvV);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, col: RGB, hint?: V3): void {
    this.tri(a, b, c, col, hint);
    this.tri(a, c, d, col, hint);
  }

  /** Poligono convexo (leque a partir do 1o vertice). */
  fan(pts: V3[], col: RGB, hint?: V3): void {
    for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0]!, pts[i]!, pts[i + 1]!, col, hint);
  }

  /** Funde outra malha (ja em coordenadas de mundo). */
  append(o: Facet): void {
    for (const k of ["pos", "nor", "col", "uv"] as const) for (const v of o[k]) this[k].push(v);
  }

  toMesh(name: string, scene: Scene, material: Material | null): Mesh | null {
    if (this.pos.length === 0) return null;
    const n = this.pos.length / 3;
    const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    const vd = new VertexData();
    vd.positions = this.pos;
    vd.normals = this.nor;
    vd.colors = this.col;
    vd.uvs = this.uv;
    vd.indices = Array.from(idx);
    const m = new Mesh(name, scene);
    vd.applyToMesh(m);
    if (material) m.material = material;
    m.isPickable = false;
    return m;
  }
}

// ---------------------------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------------------------

export function rectPoly(cx: number, cz: number, w: number, d: number, yaw = 0): [number, number][] {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const pts: [number, number][] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  return pts.map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]);
}

function centroid(poly: [number, number][]): [number, number] {
  let x = 0, z = 0;
  for (const p of poly) { x += p[0]; z += p[1]; }
  return [x / poly.length, z / poly.length];
}

export interface PrismOpts {
  /** largura do chanfro do topo (0 = canto vivo). */
  bevel?: number;
  /** queda vertical do chanfro. */
  drop?: number;
  colBevel?: RGB;
  colSide?: RGB;
  /** nao emite as faces laterais (peca apoiada no chao). */
  noSides?: boolean;
}

/**
 * Prisma convexo (laje, caco, degrau): topo na altura yTop(x,z) (permite inclinar), chanfro e laterais
 * ate yBot. O poligono pode ser dado em qualquer ordem de volta (so precisa ser convexo).
 */
export function prism(f: Facet, poly: [number, number][], yTop: number | ((x: number, z: number) => number), yBot: number, colTop: RGB, o: PrismOpts = {}): void {
  const yt = typeof yTop === "number" ? (): number => yTop : yTop;
  const [cx, cz] = centroid(poly);
  const bevel = o.bevel ?? 0;
  const drop = o.drop ?? bevel * 0.8;
  const colSide = o.colSide ?? shade(colTop, 0.62);
  const colBevel = o.colBevel ?? shade(colTop, 0.84);
  const n = poly.length;
  const inner: [number, number][] = bevel > 0
    ? poly.map(([x, z]) => {
        const dx = cx - x, dz = cz - z;
        const l = Math.hypot(dx, dz) || 1;
        const k = Math.min(bevel * 1.25, l * 0.45) / l;
        return [x + dx * k, z + dz * k];
      })
    : poly;
  const top = inner.map(([x, z]): V3 => [x, yt(x, z), z]);
  f.fan(top, colTop, [0, 1, 0]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ox0, oz0] = poly[i]!, [ox1, oz1] = poly[j]!;
    const yo0 = yt(ox0, oz0) - drop, yo1 = yt(ox1, oz1) - drop;
    const mx = (ox0 + ox1) / 2 - cx, mz = (oz0 + oz1) / 2 - cz;
    if (bevel > 0) {
      const a: V3 = [ox0, yo0, oz0], b: V3 = [ox1, yo1, oz1], c = top[j]!, d = top[i]!;
      f.quad(a, b, c, d, colBevel, [mx, 1, mz]);
    }
    if (!o.noSides) {
      const hi0: V3 = [ox0, yo0, oz0], hi1: V3 = [ox1, yo1, oz1];
      f.quad(hi0, hi1, [ox1, yBot, oz1], [ox0, yBot, oz0], colSide, [mx, 0, mz]);
    }
  }
}

/** Caixa alinhada ao yaw (base em y0). */
export function box(f: Facet, cx: number, y0: number, cz: number, w: number, h: number, d: number, yaw: number, col: RGB, o: PrismOpts = {}): void {
  prism(f, rectPoly(cx, cz, w, d, yaw), y0 + h, y0, col, { noSides: false, ...o });
}

/** Tubo facetado ao longo de uma polilinha (ossos, costelas). radii por ponto. */
export function tube(f: Facet, pts: V3[], radii: number[], sides: number, col: RGB, capEnds = true): void {
  const rings: V3[][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    // vetor de referencia nao paralelo ao tangente
    const ref: V3 = Math.abs(ty) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let n1x = ty * ref[2] - tz * ref[1], n1y = tz * ref[0] - tx * ref[2], n1z = tx * ref[1] - ty * ref[0];
    const nl = Math.hypot(n1x, n1y, n1z) || 1;
    n1x /= nl; n1y /= nl; n1z /= nl;
    const n2x = ty * n1z - tz * n1y, n2y = tz * n1x - tx * n1z, n2z = tx * n1y - ty * n1x;
    const r = radii[i] ?? radii[radii.length - 1]!;
    const ring: V3[] = [];
    for (let k = 0; k < sides; k++) {
      const an = (k / sides) * Math.PI * 2;
      const c = Math.cos(an) * r, s = Math.sin(an) * r;
      ring.push([pts[i]![0] + n1x * c + n2x * s, pts[i]![1] + n1y * c + n2y * s, pts[i]![2] + n1z * c + n2z * s]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      const a = rings[i]![k]!, b = rings[i]![k2]!, c = rings[i + 1]![k2]!, d = rings[i + 1]![k]!;
      const hint: V3 = [a[0] - pts[i]![0], a[1] - pts[i]![1], a[2] - pts[i]![2]];
      f.quad(a, b, c, d, col, hint);
    }
  }
  if (capEnds) {
    const last = pts.length - 1;
    const hs: V3 = [pts[0]![0] - pts[1]![0], pts[0]![1] - pts[1]![1], pts[0]![2] - pts[1]![2]];
    const he: V3 = [pts[last]![0] - pts[last - 1]![0], pts[last]![1] - pts[last - 1]![1], pts[last]![2] - pts[last - 1]![2]];
    f.fan(rings[0]!, col, hs);
    f.fan(rings[last]!, col, he);
  }
}

const T = (1 + Math.sqrt(5)) / 2;
const ICO_V: V3[] = ([[-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0], [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T], [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1]] as V3[]).map(
  ([x, y, z]) => {
    const l = Math.hypot(x, y, z);
    return [x / l, y / l, z / l] as V3;
  }
);
const ICO_F: [number, number, number][] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

/** Rocha irregular de 20 faces (entulho, pedregulho), achatada e com a base no chao em y0. */
export function rock(f: Facet, cx: number, y0: number, cz: number, size: number, squash: number, r: Rng, col: RGB, yaw = 0): void {
  const pts: V3[] = ICO_V.map(([x, y, z]) => {
    const k = 0.72 + r() * 0.5;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const px = (x * c - z * s) * k * size, pz = (x * s + z * c) * k * size;
    return [px, y * k * size * squash, pz] as V3;
  });
  let minY = Infinity;
  for (const p of pts) minY = Math.min(minY, p[1]);
  const lift = y0 - minY - size * 0.06; // afunda um tico: assenta no chao
  for (const [a, b, c] of ICO_F) {
    const A = pts[a]!, B = pts[b]!, C = pts[c]!;
    const tone = 0.86 + r() * 0.28;
    const hint: V3 = [A[0] + B[0] + C[0], A[1] + B[1] + C[1], A[2] + B[2] + C[2]];
    f.tri([A[0] + cx, A[1] + lift, A[2] + cz], [B[0] + cx, B[1] + lift, B[2] + cz], [C[0] + cx, C[1] + lift, C[2] + cz], shade(col, tone), hint);
  }
}

/** Octaedro (cabeca de osso, nozinho). */
export function knob(f: Facet, c: V3, rad: number, col: RGB, sy = 1): void {
  const P: V3[] = [
    [c[0] + rad, c[1], c[2]], [c[0] - rad, c[1], c[2]], [c[0], c[1] + rad * sy, c[2]], [c[0], c[1] - rad * sy, c[2]], [c[0], c[1], c[2] + rad], [c[0], c[1], c[2] - rad],
  ];
  const F: [number, number, number][] = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]];
  for (const [a, b, d] of F) {
    const A = P[a]!, B = P[b]!, D = P[d]!;
    f.tri(A, B, D, col, [A[0] + B[0] + D[0] - 3 * c[0], A[1] + B[1] + D[1] - 3 * c[1], A[2] + B[2] + D[2] - 3 * c[2]]);
  }
}

/** Osso longo deitado: haste hexagonal + duas bolotas em cada ponta. (x,z) = centro. */
export function bone(f: Facet, x: number, y0: number, z: number, yaw: number, len: number, rad: number, col: RGB): void {
  const dx = Math.cos(yaw) * len / 2, dz = Math.sin(yaw) * len / 2;
  const yc = y0 + rad * 1.1;
  const a: V3 = [x - dx, yc, z - dz], b: V3 = [x + dx, yc, z + dz];
  tube(f, [a, [x, yc + rad * 0.1, z], b], [rad * 1.15, rad * 0.8, rad * 1.15], 6, col, true);
  const px = -Math.sin(yaw) * rad * 1.1, pz = Math.cos(yaw) * rad * 1.1;
  const kc = shade(col, 1.08);
  for (const e of [a, b]) {
    knob(f, [e[0] + px, yc, e[2] + pz], rad * 1.35, kc, 0.9);
    knob(f, [e[0] - px, yc, e[2] - pz], rad * 1.35, kc, 0.9);
  }
}

/** Caixa toracica deitada: coluna + costelas em arco (tubos), de lado para o ceu. */
export function ribcage(f: Facet, x: number, y0: number, z: number, yaw: number, sc: number, col: RGB): void {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const to = (lx: number, ly: number, lz: number): V3 => [x + lx * c - lz * s, y0 + ly, z + lx * s + lz * c];
  tube(f, [to(-0.5 * sc, 0.05 * sc, 0), to(0.5 * sc, 0.05 * sc, 0)], [0.035 * sc, 0.035 * sc], 6, shade(col, 0.92), true);
  const n = 4;
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const u = -0.42 + (i / (n - 1)) * 0.84;
      const len = (0.34 - Math.abs(u) * 0.18) * sc;
      const pts: V3[] = [];
      const seg = 4;
      for (let k = 0; k <= seg; k++) {
        const t = (k / seg) * Math.PI * 0.82;
        pts.push(to(u * sc, 0.05 * sc + Math.sin(t) * len * 0.9, side * (0.03 * sc + (1 - Math.cos(t)) * len * 0.55)));
      }
      // as costelas apoiam no chao: sem nada abaixo de y0
      const rr = Array.from({ length: seg + 1 }, (_, k) => (0.024 - k * 0.0022) * sc);
      tube(f, pts, rr, 4, col, true);
    }
  }
}

/** Caco de laje quebrada: prisma de 5 a 7 lados, levemente inclinado. */
export function shard(f: Facet, x: number, y0: number, z: number, size: number, thick: number, r: Rng, col: RGB): void {
  const n = 5 + Math.floor(r() * 3);
  const a0 = r() * Math.PI * 2;
  const poly: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const an = a0 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.35;
    const k = 0.55 + r() * 0.5;
    poly.push([x + Math.cos(an) * size * k * 1.15, z + Math.sin(an) * size * k * 0.85]);
  }
  const tx = (r() - 0.5) * 0.5, tz = (r() - 0.5) * 0.5;
  prism(f, poly, (px, pz) => y0 + thick + (px - x) * tx * 0.4 + (pz - z) * tz * 0.4, y0 - 0.02, col, { bevel: Math.min(0.03, size * 0.1), drop: 0.02 });
}

/** Tufo de musgo/capim: lâminas (piramides finas) inclinadas para fora. */
export function tuft(f: Facet, x: number, y0: number, z: number, size: number, blades: number, r: Rng, col: RGB): void {
  for (let i = 0; i < blades; i++) {
    const an = r() * Math.PI * 2;
    const dist = r() * size * 0.5;
    const bx = x + Math.cos(an) * dist, bz = z + Math.sin(an) * dist;
    const h = size * (0.5 + r() * 0.7);
    const lean = size * (0.15 + r() * 0.3);
    const ap: V3 = [bx + Math.cos(an) * lean, y0 + h, bz + Math.sin(an) * lean];
    const w = size * 0.17;
    const b0: V3 = [bx + Math.cos(an + 2.1) * w, y0, bz + Math.sin(an + 2.1) * w];
    const b1: V3 = [bx + Math.cos(an + 4.2) * w, y0, bz + Math.sin(an + 4.2) * w];
    const b2: V3 = [bx + Math.cos(an) * w, y0, bz + Math.sin(an) * w];
    const tone = 0.8 + r() * 0.4;
    const c = shade(col, tone);
    const mid: V3 = [bx, y0 + h * 0.4, bz];
    for (const [p, q] of [[b0, b1], [b1, b2], [b2, b0]] as [V3, V3][]) {
      f.tri(p, q, ap, c, [(p[0] + q[0]) / 2 - mid[0], 0.2, (p[2] + q[2]) / 2 - mid[2]]);
    }
  }
}

/** Fita larga ao longo de uma polilinha no chao (rachadura, trilho, entalhe). `lift` em y. */
export function ribbon(f: Facet, pts: [number, number][], widths: number[], y: number | ((x: number, z: number) => number), col: RGB): { left: [number, number][]; right: [number, number][] } {
  const yy = typeof y === "number" ? (): number => y : y;
  const left: [number, number][] = [], right: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    const w = (widths[i] ?? widths[widths.length - 1]!) / 2;
    left.push([pts[i]![0] - tz * w, pts[i]![1] + tx * w]);
    right.push([pts[i]![0] + tz * w, pts[i]![1] - tx * w]);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    f.quad(
      [left[i]![0], yy(left[i]![0], left[i]![1]), left[i]![1]],
      [right[i]![0], yy(right[i]![0], right[i]![1]), right[i]![1]],
      [right[i + 1]![0], yy(right[i + 1]![0], right[i + 1]![1]), right[i + 1]![1]],
      [left[i + 1]![0], yy(left[i + 1]![0], left[i + 1]![1]), left[i + 1]![1]],
      col,
      [0, 1, 0]
    );
  }
  return { left, right };
}

/** Desloca uma polilinha para o lado (positivo = esquerda do sentido de percurso), com distancia por ponto. */
export function offs(pts: [number, number][], d: number | number[]): [number, number][] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    const k = typeof d === "number" ? d : (d[i] ?? d[d.length - 1]!);
    return [p[0] - tz * k, p[1] + tx * k] as [number, number];
  });
}

/** Rampa inclinada entre duas fitas (lateral de uma rachadura/borda): topo mais alto que a base. */
export function slope(f: Facet, a: [number, number][], ya: number, b: [number, number][], yb: number, col: RGB, hint: V3): void {
  for (let i = 0; i < a.length - 1; i++) {
    f.quad([a[i]![0], ya, a[i]![1]], [a[i + 1]![0], ya, a[i + 1]![1]], [b[i + 1]![0], yb, b[i + 1]![1]], [b[i]![0], yb, b[i]![1]], col, hint);
  }
}

// ---------------------------------------------------------------------------------------------
// Texturas pequenas e TILEAVEIS (densidade constante em unidades de mundo)
// ---------------------------------------------------------------------------------------------

let grainCanvas: HTMLCanvasElement | null = null;
const GRAIN = 256;

/** Grao de pedra: ruido fino + poucos veios/poros, tileavel (tudo desenhado com wrap). Luminancia ~0.78..1. */
function getGrainCanvas(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement("canvas");
  c.width = c.height = GRAIN;
  const g = c.getContext("2d")!;
  const img = g.createImageData(GRAIN, GRAIN);
  const r = mulberry32(31337);
  // valor-ruido em 3 oitavas, periodico (grade com wrap)
  const octave = (cells: number): Float32Array => {
    const grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    const out = new Float32Array(GRAIN * GRAIN);
    const step = GRAIN / cells;
    for (let y = 0; y < GRAIN; y++) {
      for (let x = 0; x < GRAIN; x++) {
        const gx = x / step, gy = y / step;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const fx = gx - x0, fy = gy - y0;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = grid[(y0 % cells) * cells + (x0 % cells)]!, b = grid[(y0 % cells) * cells + ((x0 + 1) % cells)]!;
        const cc = grid[((y0 + 1) % cells) * cells + (x0 % cells)]!, d = grid[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)]!;
        out[y * GRAIN + x] = a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
      }
    }
    return out;
  };
  const o1 = octave(8), o2 = octave(32), o3 = octave(128);
  for (let i = 0; i < GRAIN * GRAIN; i++) {
    const v = 0.5 * o1[i]! + 0.3 * o2[i]! + 0.2 * o3[i]!;
    const L = Math.round(255 * (0.78 + 0.22 * v));
    img.data[i * 4] = L; img.data[i * 4 + 1] = L; img.data[i * 4 + 2] = L; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // poros e riscos finos com wrap (desenha 9 copias deslocadas)
  const wrap = (fn: (ox: number, oy: number) => void): void => {
    for (const ox of [-GRAIN, 0, GRAIN]) for (const oy of [-GRAIN, 0, GRAIN]) fn(ox, oy);
  };
  for (let i = 0; i < 46; i++) {
    const x = r() * GRAIN, y = r() * GRAIN, rad = 0.8 + r() * 1.6;
    wrap((ox, oy) => {
      g.fillStyle = `rgba(0,0,0,${0.18 + r() * 0.18})`;
      g.beginPath(); g.arc(x + ox, y + oy, rad, 0, Math.PI * 2); g.fill();
    });
  }
  for (let i = 0; i < 18; i++) {
    const x = r() * GRAIN, y = r() * GRAIN, a = r() * Math.PI, len = 10 + r() * 26;
    wrap((ox, oy) => {
      g.strokeStyle = "rgba(0,0,0,0.16)"; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + Math.cos(a) * len * 0.5 + (r() - 0.5) * 3, y + oy + Math.sin(a) * len * 0.5);
      g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len + (r() - 0.5) * 3); g.stroke();
    });
  }
  grainCanvas = c;
  return c;
}

/** Textura de grao (uma por sala: o dispose da sala leva os materiais e texturas junto). */
export function makeGrainTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture("graoPedra", { width: GRAIN, height: GRAIN }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.drawImage(getGrainCanvas(), 0, 0);
  tex.update(true);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = 4;
  return tex;
}

/** Ondulacao da agua: filamentos de caustica (tileavel por construcao: ondas com numero inteiro de ciclos). */
export function makeWaterTexture(scene: Scene): DynamicTexture {
  const N = 256;
  const tex = new DynamicTexture("ondasAgua", { width: N, height: N }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const img = ctx.createImageData(N, N);
  const waves: { kx: number; ky: number; ph: number }[] = [
    { kx: 3, ky: 1, ph: 0.4 }, { kx: -2, ky: 3, ph: 1.9 }, { kx: 1, ky: -3, ph: 3.3 }, { kx: 4, ky: 2, ph: 5.1 },
  ];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (const w of waves) s += Math.sin(((w.kx * x + w.ky * y) / N) * Math.PI * 2 + w.ph);
      const f = Math.abs(s) / 2; // 0 sobre as linhas
      const line = Math.pow(Math.max(0, 1 - f / 0.32), 2.2);
      const base = 0.42;
      const v = Math.min(1, base + line * 0.58);
      const i = (y * N + x) * 4;
      img.data[i] = Math.round(255 * (0.55 * v));
      img.data[i + 1] = Math.round(255 * (0.86 * v));
      img.data[i + 2] = Math.round(255 * (0.92 * v));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.update(true);
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = 4;
  return tex;
}

// ---------------------------------------------------------------------------------------------
// Pecas do kit (cores planas -> cor por vertice) para fundir na malha de detalhes
// ---------------------------------------------------------------------------------------------

export interface KitGeo {
  pos: Float32Array; // base em y=0, centrada em xz
  nor: Float32Array;
  col: Float32Array; // rgb por vertice
  idx: Uint32Array;
  size: { x: number; y: number; z: number };
  /** false apos decimar: as normais nao valem como dica de face (a ordem dos vertices ja esta certa). */
  hinted: boolean;
}

type ColorMat = { albedoColor?: { r: number; g: number; b: number }; diffuseColor?: { r: number; g: number; b: number } };

/**
 * Extrai geometria de uma peca do kit (so cores planas) sem passar por MergeMeshes: le cada malha,
 * aplica a matriz de mundo, e guarda a cor do material por vertice. Base em y=0, centrada em xz.
 */
export function bakeKitPiece(container: AssetContainer | undefined, cell = 0): KitGeo | null {
  if (!container) return null;
  const entries = container.instantiateModelsToScene(undefined, false);
  const root = entries.rootNodes[0];
  if (!root) return null;
  (root as unknown as { computeWorldMatrix(f: boolean): void }).computeWorldMatrix(true);
  const meshes = (root as unknown as { getChildMeshes(d: boolean): Mesh[] }).getChildMeshes(false).filter((m) => m.getTotalVertices() > 0);
  const P: number[] = [], N: number[] = [], C: number[] = [], I: number[] = [];
  for (const m of meshes) {
    m.computeWorldMatrix(true);
    const W = m.getWorldMatrix();
    const p = m.getVerticesData("position"), nn = m.getVerticesData("normal"), ix = m.getIndices();
    if (!p || !ix) continue;
    const mat = m.material as unknown as ColorMat | null;
    const c = mat?.albedoColor ?? mat?.diffuseColor ?? { r: 0.6, g: 0.6, b: 0.6 };
    const base = P.length / 3;
    const w = W.m;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i]!, y = p[i + 1]!, z = p[i + 2]!;
      P.push(x * w[0]! + y * w[4]! + z * w[8]! + w[12]!, x * w[1]! + y * w[5]! + z * w[9]! + w[13]!, x * w[2]! + y * w[6]! + z * w[10]! + w[14]!);
      if (nn) {
        const nx = nn[i]!, ny = nn[i + 1]!, nz = nn[i + 2]!;
        const ax = nx * w[0]! + ny * w[4]! + nz * w[8]!, ay = nx * w[1]! + ny * w[5]! + nz * w[9]!, az = nx * w[2]! + ny * w[6]! + nz * w[10]!;
        const l = Math.hypot(ax, ay, az) || 1;
        N.push(ax / l, ay / l, az / l);
      } else N.push(0, 1, 0);
      C.push(c.r, c.g, c.b);
    }
    const det = W.determinant();
    for (let i = 0; i < ix.length; i += 3) {
      if (det < 0) I.push(base + ix[i]!, base + ix[i + 2]!, base + ix[i + 1]!);
      else I.push(base + ix[i]!, base + ix[i + 1]!, base + ix[i + 2]!);
    }
  }
  root.dispose();
  if (P.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    minX = Math.min(minX, P[i]!); maxX = Math.max(maxX, P[i]!);
    minY = Math.min(minY, P[i + 1]!); maxY = Math.max(maxY, P[i + 1]!);
    minZ = Math.min(minZ, P[i + 2]!); maxZ = Math.max(maxZ, P[i + 2]!);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  for (let i = 0; i < P.length; i += 3) { P[i] = P[i]! - cx; P[i + 1] = P[i + 1]! - minY; P[i + 2] = P[i + 2]! - cz; }
  if (cell > 0) {
    // decimacao por agrupamento de vertices (grade): colapsa detalhe fino que nao se le a 15 m de camera
    const key = new Map<string, number>();
    const np: number[] = [], nc: number[] = [], cnt: number[] = [];
    const remap: number[] = [];
    for (let i = 0; i < P.length; i += 3) {
      const k = `${Math.round(P[i]! / cell)},${Math.round(P[i + 1]! / cell)},${Math.round(P[i + 2]! / cell)}`;
      let id = key.get(k);
      if (id === undefined) { id = np.length / 3; key.set(k, id); np.push(0, 0, 0); nc.push(0, 0, 0); cnt.push(0); }
      np[id * 3] = np[id * 3]! + P[i]!; np[id * 3 + 1] = np[id * 3 + 1]! + P[i + 1]!; np[id * 3 + 2] = np[id * 3 + 2]! + P[i + 2]!;
      nc[id * 3] = nc[id * 3]! + C[i]!; nc[id * 3 + 1] = nc[id * 3 + 1]! + C[i + 1]!; nc[id * 3 + 2] = nc[id * 3 + 2]! + C[i + 2]!;
      cnt[id] = cnt[id]! + 1;
      remap.push(id);
    }
    for (let id = 0; id < cnt.length; id++) for (let k = 0; k < 3; k++) { np[id * 3 + k] = np[id * 3 + k]! / cnt[id]!; nc[id * 3 + k] = nc[id * 3 + k]! / cnt[id]!; }
    const seen = new Set<string>();
    const ni: number[] = [];
    for (let i = 0; i < I.length; i += 3) {
      const a = remap[I[i]!]!, b = remap[I[i + 1]!]!, c = remap[I[i + 2]!]!;
      if (a === b || b === c || a === c) continue;
      const sk = [a, b, c].sort((x, y) => x - y).join(",");
      if (seen.has(sk)) continue;
      seen.add(sk);
      ni.push(a, b, c);
    }
    P.length = 0; C.length = 0; I.length = 0;
    P.push(...np); C.push(...nc); I.push(...ni);
    N.length = 0;
    for (let i = 0; i < P.length; i++) N.push(i % 3 === 1 ? 1 : 0);
  }
  return {
    pos: new Float32Array(P), nor: new Float32Array(N), col: new Float32Array(C), idx: new Uint32Array(I),
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
    hinted: cell <= 0,
  };
}

/** Coloca uma peca do kit na malha (escala uniforme, giro em y, inclinacao leve, tintura). */
export function placeKit(f: Facet, k: KitGeo, x: number, y: number, z: number, scale: number, yaw: number, tint: RGB, pitch = 0, roll = 0): void {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  const tf = (vx: number, vy: number, vz: number): V3 => {
    // roll (z), pitch (x), yaw (y)
    let ax = vx * cr - vy * sr, ay = vx * sr + vy * cr, az = vz;
    const by = ay * cp - az * sp, bz = ay * sp + az * cp;
    ay = by; az = bz;
    return [ax * cy + az * sy, ay, -ax * sy + az * cy];
  };
  const n = k.idx.length;
  for (let i = 0; i < n; i += 3) {
    const tri: V3[] = [];
    let cr0 = 0, cg0 = 0, cb0 = 0;
    for (let j = 0; j < 3; j++) {
      const v = k.idx[i + j]!;
      const q = tf(k.pos[v * 3]! * scale, k.pos[v * 3 + 1]! * scale, k.pos[v * 3 + 2]! * scale);
      tri.push([q[0] + x, q[1] + y, q[2] + z]);
      cr0 += k.col[v * 3]!; cg0 += k.col[v * 3 + 1]!; cb0 += k.col[v * 3 + 2]!;
    }
    const nv = k.idx[i]!;
    const nrm = tf(k.nor[nv * 3]!, k.nor[nv * 3 + 1]!, k.nor[nv * 3 + 2]!);
    f.tri(tri[0]!, tri[1]!, tri[2]!, [(cr0 / 3) * tint[0], (cg0 / 3) * tint[1], (cb0 / 3) * tint[2]], k.hinted ? nrm : undefined);
  }
}
