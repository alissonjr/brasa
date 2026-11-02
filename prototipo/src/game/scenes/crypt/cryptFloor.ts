import { Color3, Mesh, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import type { AssetContainer, DynamicTexture, Scene } from "@babylonjs/core";
import type { Layout } from "./cryptLayouts";
import type { RoomKind } from "./cryptRoom";
import {
  Facet, bakeKitPiece, bone, box, hex, hsl, inCalm, makeGrainTexture, makeWaterTexture, mix, mulberry32, offs, placeKit,
  prism, rectPoly, ribbon, ribcage, rock, shade, shard, slope, tuft, type RGB, type Rng, type V3,
} from "./cryptGeo";

/**
 * CAMADA JOGO (Brasa). CENOGRAFIA DO PISO COMO OBJETOS 3D (substitui o piso pintado em canvas).
 *
 *  - O chao e feito de LAJES reais (prismas com chanfro, juntas fundas, altura e inclinacao proprias,
 *    algumas erguidas/afundadas/lascadas), numa malha so com cor por vertice + um grao de pedra
 *    pequeno e TILEAVEL em unidades de mundo (a densidade da textura e a mesma em x e z, em qualquer
 *    sala; nada e esticado).
 *  - Os detalhes sao geometria de apoio: rachaduras em fenda (faixa escura com borda erguida), ossos,
 *    costelas, cranios (peca do kit), entulho, cacos de laje, ralo de ferro, musgo em tufos, tapete,
 *    palha, gravura ritual, e AGUA de verdade (plano rebaixado translucido com ondulacao por UV,
 *    bacias de pedra com borda molhada).
 *  - Orcamento de desenho: underlay + laje + detalhes (+ agua, + emissivo) = no maximo 5 malhas.
 *
 * Leitura de combate: a faixa central (Layout.calm) so recebe peca baixa (<= ~3 cm); a cenografia
 * alta vive fora dela. Nada passa de ~0,4 m (a camera e orbital: nada deve tapar o heroi).
 */

export interface Spot { x: number; z: number; r: number }

export interface FloorScape {
  /** Todas as malhas criadas (o chamador faz parent/track). */
  meshes: Mesh[];
  /** Laje + tapete + bacias (recebe sombra). */
  floor: Mesh;
  /** Detalhes em relevo (projetam sombra). */
  details: Mesh | null;
  /** Rachaduras com brasa / gravura dourada (emissivos, com choreografia de luz). */
  emissive: { mesh: Mesh; mat: StandardMaterial } | null;
  puddles: Spot[]; // agua (a luz fria se apoia nelas)
  candles: Spot[]; // velas do santuario
  embers: Spot[]; // brasas das fendas do guardiao
  /** Anima a agua (chamar todo frame com o tempo em segundos). */
  update(t: number): void;
  stats: { slabs: number; tris: number };
}

const KIND_SALT: Record<RoomKind, number> = { guarda: 11, salao: 23, cisterna: 37, santuario: 53, guardiao: 71 };

interface Pal {
  slabs: [number, number, number][]; // [matiz, saturacao %, luminosidade %]
  joint: string;
  moss: [number, number, number];
}
const PAL: Record<RoomKind, Pal> = {
  guarda: { slabs: [[218, 9, 34], [32, 7, 33], [222, 9, 28], [205, 7, 37]], joint: "#07090c", moss: [100, 22, 20] },
  salao: { slabs: [[32, 8, 34], [215, 8, 32], [26, 9, 29], [40, 7, 37]], joint: "#08080b", moss: [90, 18, 18] },
  cisterna: { slabs: [[188, 14, 27], [160, 12, 24], [212, 11, 22], [170, 16, 30]], joint: "#050a0c", moss: [118, 30, 22] },
  santuario: { slabs: [[252, 8, 37], [42, 9, 38], [235, 10, 29], [270, 7, 33]], joint: "#08080d", moss: [110, 16, 18] },
  guardiao: { slabs: [[262, 8, 21], [10, 12, 22], [240, 9, 16], [20, 10, 26]], joint: "#030205", moss: [60, 10, 12] },
};

interface Rect { x0: number; z0: number; x1: number; z1: number }
type SlabKind = "flat" | "raised" | "sunk";
interface Slab extends Rect { h: number; tx: number; tz: number; kind: SlabKind; col: RGB }

const Y_JOINT = -0.3; // fundo das juntas (topo do underlay)
const Y_WATER_SUNK = -0.18; // agua das bacias (rebaixada)
const Y_BASIN = -0.78; // fundo das bacias

function cutRect(s: Rect, h: Rect): Rect[] {
  if (s.x1 <= h.x0 || s.x0 >= h.x1 || s.z1 <= h.z0 || s.z0 >= h.z1) return [s];
  const out: Rect[] = [];
  if (s.z0 < h.z0) out.push({ x0: s.x0, x1: s.x1, z0: s.z0, z1: h.z0 });
  if (s.z1 > h.z1) out.push({ x0: s.x0, x1: s.x1, z0: h.z1, z1: s.z1 });
  const zz0 = Math.max(s.z0, h.z0), zz1 = Math.min(s.z1, h.z1);
  if (s.x0 < h.x0) out.push({ x0: s.x0, x1: h.x0, z0: zz0, z1: zz1 });
  if (s.x1 > h.x1) out.push({ x0: h.x1, x1: s.x1, z0: zz0, z1: zz1 });
  return out;
}

/** Repartir um comprimento em n pedacos de pesos aleatorios (sem sobra/lasca). */
function split(span: number, avg: number, r: Rng, spread = 0.28): number[] {
  const n = Math.max(1, Math.round(span / avg));
  const w = Array.from({ length: n }, () => 1 - spread + r() * spread * 2);
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => (v / sum) * span);
}

export function buildFloorScape(scene: Scene, L: Layout, kind: RoomKind, index: number, pieces: Record<string, AssetContainer>): FloorScape {
  const r = mulberry32(index * 7919 + KIND_SALT[kind] * 131 + 17);
  const pal = PAL[kind];
  const HX = L.halfX, HZ = L.halfZ;
  const AZ = L.altar.z;
  const EX = L.exit.x, EZ = L.exit.z;
  const cc = { x: 0, z: Math.min(0, AZ - 6) }; // centro da zona de combate
  const area = (2 * HX) * (2 * HZ);
  const calmArea = Math.PI * L.calm.rx * L.calm.rz;
  const rimArea = Math.max(40, area - calmArea);

  // --- zonas proibidas para peca em relevo ---
  const taken: Spot[] = [];
  for (const p of L.pillars) taken.push({ x: p.x, z: p.z, r: 1.7 });
  taken.push({ x: EX, z: EZ, r: 3.6 });
  const NICHE_Z = -(HZ - 5);
  const zS = -(HZ - 4);
  const zb = Math.min(AZ - 3.7, HZ - 4.5);
  // retangulos de mobilia fixa (cryptRoom): so as bacias de agua os evitam
  const propRects: Rect[] = [
    { x0: -HX, x1: -HX + 3.1, z0: zS - 1.8, z1: zS + 3.4 }, // barris
    { x0: HX - 3.1, x1: HX, z0: zS - 2.2, z1: zS + 2.4 }, // caixas
    { x0: -HX, x1: -HX + 3.1, z0: -2.9, z1: 2.9 }, // caixoes
    { x0: -HX, x1: -HX + 3.1, z0: AZ - 1.8, z1: AZ + 3 }, // lapide
    { x0: HX - 3.1, x1: HX, z0: zb - 4.6, z1: zb + 3.4 }, // estantes
    { x0: -9.9, x1: -5.2, z0: -5.4, z1: -0.6 }, // refeitorio
    { x0: HX - 3.2, x1: HX, z0: NICHE_Z - 1.9, z1: NICHE_Z + 1.9 }, // nicho
    { x0: -5.6, x1: 5.6, z0: AZ - 4.0, z1: HZ }, // estrado
    { x0: -4, x1: 5.5, z0: -HZ, z1: -HZ + 2.8 }, // porta
  ];
  const inRect = (x: number, z: number, m: number, rc: Rect): boolean => x > rc.x0 - m && x < rc.x1 + m && z > rc.z0 - m && z < rc.z1 + m;
  const onProp = (x: number, z: number, m: number): boolean => propRects.some((rc) => inRect(x, z, m, rc));
  const nearTaken = (x: number, z: number, m: number): boolean => taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + m);
  const stage = (x: number, z: number): boolean => Math.abs(x) < 5.4 && z > AZ - 3.8; // estrado e degrau

  // =============================================================================================
  // 1) PLANTA DAS BACIAS DE AGUA (cisterna): tanque retangular, canal comprido e lagoa organica
  // =============================================================================================
  interface Basin { rect: Rect; kind: "tanque" | "canal" }
  interface Pond { x: number; z: number; r0: number; phase: number[]; ang: number }
  const basins: Basin[] = [];
  const ponds: Pond[] = [];
  const holes: Rect[] = [{ x0: EX - 1.3, x1: EX + 1.3, z0: EZ - 1.3, z1: EZ + 1.3 }];
  const bandX = L.calm.rx + 0.6; // |x| minimo das bacias (fora da faixa de combate)
  const placeWater = (w: number, d: number, tries = 60): { x: number; z: number } | null => {
    for (let t = 0; t < tries; t++) {
      const side = r() < 0.5 ? -1 : 1;
      const x = side * (bandX + w / 2 + r() * Math.max(0.01, HX - 1.4 - bandX - w));
      const z = (r() - 0.5) * (HZ * 2 - d - 5);
      const rc: Rect = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
      if (Math.abs(x) - w / 2 < bandX - 0.3) continue;
      if (Math.abs(x) + w / 2 > HX - 1.0) continue;
      if (propRects.some((p) => !(rc.x1 + 0.8 < p.x0 || rc.x0 - 0.8 > p.x1 || rc.z1 + 0.8 < p.z0 || rc.z0 - 0.8 > p.z1))) continue;
      if (taken.some((tk) => Math.hypot(Math.max(rc.x0 - tk.x, 0, tk.x - rc.x1), Math.max(rc.z0 - tk.z, 0, tk.z - rc.z1)) < tk.r + 0.4)) continue;
      return { x, z };
    }
    return null;
  };
  if (kind === "cisterna") {
    const long = HZ >= 18;
    const tw = 3.0 + r() * 0.6, td = 2.2 + r() * 0.8;
    const tp = placeWater(tw, td);
    if (tp) {
      const rc: Rect = { x0: tp.x - tw / 2, x1: tp.x + tw / 2, z0: tp.z - td / 2, z1: tp.z + td / 2 };
      basins.push({ rect: rc, kind: "tanque" });
      taken.push({ x: tp.x, z: tp.z, r: Math.hypot(tw, td) / 2 + 0.5 });
    }
    const cl = long ? 6.5 + r() * 2 : 4.6 + r() * 1.2;
    const cw = 1.15;
    const cp = placeWater(cw, cl);
    if (cp) {
      const rc: Rect = { x0: cp.x - cw / 2, x1: cp.x + cw / 2, z0: cp.z - cl / 2, z1: cp.z + cl / 2 };
      basins.push({ rect: rc, kind: "canal" });
      taken.push({ x: cp.x, z: cp.z, r: cl / 2 + 0.3 });
    }
    const pr = 1.5 + r() * 0.5;
    const pp = placeWater(pr * 2 + 1.2, pr * 2 + 1.2);
    if (pp) {
      ponds.push({ x: pp.x, z: pp.z, r0: pr, phase: [r() * 6.28, r() * 6.28, r() * 6.28], ang: r() * 6.28 });
      taken.push({ x: pp.x, z: pp.z, r: pr + 1.0 });
    }
    for (const b of basins) holes.push(b.rect);
  }
  const pondR = (p: Pond, a: number): number =>
    p.r0 * (1 + 0.2 * Math.sin(2 * a + p.phase[0]!) + 0.11 * Math.sin(3 * a + p.phase[1]!) + 0.06 * Math.sin(5 * a + p.phase[2]!));
  const inPond = (x: number, z: number, m: number): boolean =>
    ponds.some((p) => {
      const a = Math.atan2(z - p.z, x - p.x);
      return Math.hypot(x - p.x, z - p.z) < pondR(p, a - p.ang) + 0.5 + m;
    });
  const nearWater = (x: number, z: number, d: number): boolean =>
    basins.some((b) => inRect(x, z, d, b.rect)) || inPond(x, z, d);

  // =============================================================================================
  // 2) LAJES
  // =============================================================================================
  const slabs: Slab[] = [];
  {
    const X0 = -HX - 0.45, X1 = HX + 0.45, Z0 = -HZ - 0.45, Z1 = HZ + 0.45;
    const rows = split(Z1 - Z0, 2.35, r, 0.22);
    let z = Z0;
    const gap = 0.032;
    for (const d of rows) {
      const widths = split(X1 - X0, 2.7, r, 0.3);
      let x = X0;
      for (const w of widths) {
        const base: Rect = { x0: x, x1: x + w, z0: z, z1: z + d };
        x += w;
        for (const piece of holes.reduce<Rect[]>((acc, h) => acc.flatMap((p) => cutRect(p, h)), [base])) {
          if (piece.x1 - piece.x0 < 0.14 || piece.z1 - piece.z0 < 0.14) continue;
          slabs.push({ x0: piece.x0 + gap, x1: piece.x1 - gap, z0: piece.z0 + gap, z1: piece.z1 - gap, h: 0, tx: 0, tz: 0, kind: "flat", col: [0, 0, 0] });
        }
      }
      z += d;
    }
  }
  const burn = kind === "guardiao";
  for (const s of slabs) {
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
    const calm = inCalm(L, cx, cz, 1.12);
    const nearExit = Math.hypot(cx - EX, cz - EZ) < 4.6;
    const wallDist = Math.min(HX - Math.abs(cx), HZ - Math.abs(cz));
    s.h = calm ? r() * 0.006 : r() * 0.014;
    const canVary = !calm && !nearExit && !stage(cx, cz) && !nearWater(cx, cz, 1.6) && wallDist > 1.1 && !onProp(cx, cz, -0.5) && !nearTaken(cx, cz, -1.0);
    const roll = r();
    const pRaise = kind === "guardiao" ? 0.15 : kind === "cisterna" ? 0.1 : 0.11;
    if (canVary && roll < pRaise) {
      s.kind = "raised";
      s.h = 0.075 + r() * 0.09;
      const a = r() * Math.PI * 2, m = 0.012 + r() * 0.03;
      s.tx = Math.cos(a) * m; s.tz = Math.sin(a) * m;
    } else if (canVary && roll < pRaise + 0.06) {
      s.kind = "sunk";
      s.h = -0.055 - r() * 0.04;
    }
    // tom: paleta da sala, jitter por laje, menos contraste na faixa de combate
    const b = pal.slabs[Math.floor(r() * pal.slabs.length)]!;
    const jit = calm ? 0.45 : 1;
    let l = b[2] + (r() - 0.5) * 5 * jit + (r() < 0.12 && !calm ? -5 : 0);
    const sat = b[1] + (r() - 0.5) * 4 * jit;
    const hue = b[0] + (r() - 0.5) * 8 * jit;
    if (s.kind === "raised") l += 3;
    let col = hsl(hue, sat, l);
    if (wallDist < 1.8) col = shade(col, 0.8 + 0.1 * wallDist / 1.8);
    if (kind === "cisterna" && nearWater(cx, cz, 2.2)) col = mix(col, hsl(165, 28, 16), 0.42);
    if (burn) {
      const dd = Math.hypot(cx - cc.x, cz - cc.z);
      col = shade(col, 0.55 + 0.45 * Math.min(1, dd / 8));
    }
    if (s.kind === "sunk") col = shade(col, 0.72);
    s.col = col;
  }

  // alturas para posicionar objetos: so em laje "flat"
  const slabAt = (x: number, z: number): Slab | null => {
    for (const s of slabs) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return s;
    return null;
  };
  const flatY = (x: number, z: number): number | null => {
    const s = slabAt(x, z);
    return s && s.kind === "flat" ? s.h : null;
  };

  // =============================================================================================
  // 3) MALHAS
  // =============================================================================================
  const floorF = new Facet(3);
  const detF = new Facet(3);
  const waterF = new Facet(4);
  const emisF = new Facet(3);

  // ---- lajes
  for (const s of slabs) {
    const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
    floorF.uvU = r(); floorF.uvV = r();
    const w = s.x1 - s.x0, d = s.z1 - s.z0;
    let poly: [number, number][] = [[s.x0, s.z0], [s.x1, s.z0], [s.x1, s.z1], [s.x0, s.z1]];
    const calm = inCalm(L, cx, cz, 1.1);
    if (!calm && s.kind === "flat" && r() < 0.17 && w > 1 && d > 1) {
      // canto lascado: corta um canto em diagonal (a laje "perde" um pedaco)
      const c = Math.floor(r() * 4);
      const k1 = 0.22 + r() * 0.3, k2 = 0.22 + r() * 0.3;
      const P = poly;
      const prev = P[(c + 3) % 4]!, cur = P[c]!, next = P[(c + 1) % 4]!;
      const pa: [number, number] = [cur[0] + (prev[0] - cur[0]) * (k1 / Math.max(0.3, Math.hypot(prev[0] - cur[0], prev[1] - cur[1]))), cur[1] + (prev[1] - cur[1]) * (k1 / Math.max(0.3, Math.hypot(prev[0] - cur[0], prev[1] - cur[1])))];
      const pb: [number, number] = [cur[0] + (next[0] - cur[0]) * (k2 / Math.max(0.3, Math.hypot(next[0] - cur[0], next[1] - cur[1]))), cur[1] + (next[1] - cur[1]) * (k2 / Math.max(0.3, Math.hypot(next[0] - cur[0], next[1] - cur[1])))];
      poly = [...P.slice(0, c), pa, pb, ...P.slice(c + 1)];
    }
    const top = (x: number, z: number): number => s.h + s.tx * (x - cx) + s.tz * (z - cz);
    const raised = s.kind === "raised";
    prism(floorF, poly, top, Y_JOINT, s.col, {
      bevel: raised ? 0.05 : 0.04,
      drop: raised ? 0.05 : 0.03,
      colBevel: shade(s.col, raised ? 1.12 : 0.8),
      colSide: shade(s.col, raised ? 0.5 : 0.55),
    });
  }

  // ---- bacias retangulares (tanque, canal): paredes e fundo; agua rebaixada
  const puddles: Spot[] = [];
  const waterCol: RGB = [1, 1, 1];
  for (const b of basins) {
    const rc = b.rect;
    floorF.uvU = r(); floorF.uvV = r();
    const wallTop = mix(hsl(170, 22, 20), hsl(150, 24, 14), 0.3);
    const wallBot = hsl(172, 28, 9);
    const ym = -0.42;
    const P: [number, number][] = [[rc.x0, rc.z0], [rc.x1, rc.z0], [rc.x1, rc.z1], [rc.x0, rc.z1]];
    for (let i = 0; i < 4; i++) {
      const a = P[i]!, c = P[(i + 1) % 4]!;
      const hint: V3 = [(a[0] + c[0]) / 2 - (rc.x0 + rc.x1) / 2, 0, (a[1] + c[1]) / 2 - (rc.z0 + rc.z1) / 2];
      const inward: V3 = [-hint[0], 0, -hint[2]];
      floorF.quad([a[0], -0.1, a[1]], [c[0], -0.1, c[1]], [c[0], ym, c[1]], [a[0], ym, a[1]], wallTop, inward);
      floorF.quad([a[0], ym, a[1]], [c[0], ym, c[1]], [c[0], Y_BASIN, c[1]], [a[0], Y_BASIN, a[1]], wallBot, inward);
    }
    floorF.fan([[rc.x0, Y_BASIN, rc.z0], [rc.x1, Y_BASIN, rc.z0], [rc.x1, Y_BASIN, rc.z1], [rc.x0, Y_BASIN, rc.z1]], hsl(180, 30, 7), [0, 1, 0]);
    waterF.quad([rc.x1, Y_WATER_SUNK, rc.z0], [rc.x1, Y_WATER_SUNK, rc.z1], [rc.x0, Y_WATER_SUNK, rc.z1], [rc.x0, Y_WATER_SUNK, rc.z0], waterCol, [0, 1, 0]);
    puddles.push({ x: (rc.x0 + rc.x1) / 2, z: (rc.z0 + rc.z1) / 2, r: Math.max(rc.x1 - rc.x0, rc.z1 - rc.z0) * 0.6 });
    // objetos no fundo, vistos atraves da agua: ossos e pedras
    const n = b.kind === "tanque" ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const x = rc.x0 + 0.3 + r() * (rc.x1 - rc.x0 - 0.6), z = rc.z0 + 0.3 + r() * (rc.z1 - rc.z0 - 0.6);
      if (r() < 0.55) rock(detF, x, Y_BASIN, z, 0.14 + r() * 0.16, 0.6, r, hsl(180, 10, 16), r() * 6);
      else bone(detF, x, Y_BASIN, z, r() * 3.14, 0.4 + r() * 0.3, 0.025, shade(hex("#b7b098"), 0.55));
    }
    if (b.kind === "canal") {
      // ponte de laje atravessando o canal (peca solta com espessura real)
      const bz = rc.z0 + (rc.z1 - rc.z0) * (0.3 + r() * 0.4);
      const horizontalLong = rc.z1 - rc.z0 > rc.x1 - rc.x0;
      const bw = horizontalLong ? rc.x1 - rc.x0 + 0.9 : 1.1, bd = horizontalLong ? 1.1 : rc.z1 - rc.z0 + 0.9;
      const bx = (rc.x0 + rc.x1) / 2, bzz = horizontalLong ? bz : (rc.z0 + rc.z1) / 2;
      floorF.uvU = r(); floorF.uvV = r();
      prism(floorF, rectPoly(bx, bzz, bw, bd, 0), 0.035, -0.12, hsl(176, 12, 27), { bevel: 0.04, drop: 0.03, colSide: hsl(178, 14, 14) });
    }
  }

  // ---- lagoas organicas: borda de pedra (anel de blocos) acima do chao + agua rebaixada dentro dela
  for (const p of ponds) {
    const N = 26;
    const inner: [number, number][] = [], outer: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + p.ang;
      const rr = pondR(p, a - p.ang);
      inner.push([p.x + Math.cos(a) * rr, p.z + Math.sin(a) * rr]);
      outer.push([p.x + Math.cos(a) * (rr + 0.42), p.z + Math.sin(a) * (rr + 0.42)]);
    }
    const yWater = 0.03, yCurb = 0.115;
    // fundo escuro da lagoa
    floorF.uvU = r(); floorF.uvV = r();
    floorF.fan([[p.x, 0.018, p.z], ...inner.map(([x, z]): V3 => [x, 0.018, z]), [inner[0]![0], 0.018, inner[0]![1]] as V3], hsl(178, 30, 7), [0, 1, 0]);
    waterF.fan([[p.x, yWater, p.z], ...inner.map(([x, z]): V3 => [x, yWater, z]), [inner[0]![0], yWater, inner[0]![1]] as V3], waterCol, [0, 1, 0]);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      floorF.uvU = r(); floorF.uvV = r();
      const hh = yCurb + (r() - 0.5) * 0.022;
      const tone = hsl(172 + (r() - 0.5) * 14, 13, 17 + r() * 6);
      const a0 = inner[i]!, a1 = inner[j]!, b0 = outer[i]!, b1 = outer[j]!;
      const mx = (a0[0] + a1[0]) / 2 - p.x, mz = (a0[1] + a1[1]) / 2 - p.z;
      // topo do bloco, chanfro externo (desce ao chao) e parede interna molhada (desce a agua)
      floorF.quad([a0[0], hh, a0[1]], [a1[0], hh, a1[1]], [b1[0], hh - 0.012, b1[1]], [b0[0], hh - 0.012, b0[1]], tone, [0, 1, 0]);
      floorF.quad([b0[0], hh - 0.012, b0[1]], [b1[0], hh - 0.012, b1[1]], [b1[0], 0, b1[1]], [b0[0], 0, b0[1]], shade(tone, 0.62), [mx, 0.3, mz]);
      floorF.quad([a0[0], hh, a0[1]], [a1[0], hh, a1[1]], [a1[0], 0.018, a1[1]], [a0[0], 0.018, a0[1]], hsl(172, 26, 11), [-mx, 0.1, -mz]);
    }
    puddles.push({ x: p.x, z: p.z, r: p.r0 * 1.15 });
  }

  // ---- rachaduras (fenda: faixa escura + borda erguida)
  const crack = (s: Slab, start: [number, number], ang: number, len: number, w0: number, strength: number): void => {
    const pts: [number, number][] = [start];
    let a = ang, acc = 0;
    const m = 0.1;
    while (acc < len) {
      a += (r() - 0.5) * 0.95;
      const step = 0.22 + r() * 0.3;
      const last = pts[pts.length - 1]!;
      const nx = last[0] + Math.cos(a) * step, nz = last[1] + Math.sin(a) * step;
      if (nx < s.x0 + m || nx > s.x1 - m || nz < s.z0 + m || nz > s.z1 - m) break;
      pts.push([nx, nz]);
      acc += step;
    }
    if (pts.length < 3) return;
    const widths = pts.map((_, i) => w0 * (1 - (i / pts.length) * 0.65));
    const half = widths.map((w) => w / 2);
    const yb = s.h + 0.004;
    const dark = shade(hex(pal.joint), 1.0);
    ribbon(detF, pts, widths, yb, dark);
    const lw = 0.034 * (0.5 + strength * 0.5);
    const lipH = 0.014 * strength;
    const lipCol = shade(s.col, 1.18);
    const le = offs(pts, half), re = offs(pts, half.map((h) => -h));
    const lm = offs(pts, half.map((h) => h + lw)), rm = offs(pts, half.map((h) => -(h + lw)));
    const lo = offs(pts, half.map((h) => h + lw * 2)), ro = offs(pts, half.map((h) => -(h + lw * 2)));
    slope(detF, le, yb, lm, yb + lipH, lipCol, [0, 1, 0]);
    slope(detF, lm, yb + lipH, lo, yb, shade(lipCol, 0.8), [0, 1, 0]);
    slope(detF, re, yb, rm, yb + lipH, lipCol, [0, 1, 0]);
    slope(detF, rm, yb + lipH, ro, yb, shade(lipCol, 0.8), [0, 1, 0]);
  };
  {
    const nCr = Math.round(rimArea / (kind === "guardiao" ? 7 : kind === "guarda" ? 15 : 10));
    let made = 0;
    for (let t = 0; t < nCr * 8 && made < nCr; t++) {
      const s = slabs[Math.floor(r() * slabs.length)]!;
      if (s.kind !== "flat") continue;
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
      const calm = inCalm(L, cx, cz, 0.95);
      if (calm && r() < 0.8) continue;
      if (Math.hypot(cx - EX, cz - EZ) < 3.2 || stage(cx, cz)) continue;
      const w = s.x1 - s.x0, d = s.z1 - s.z0;
      if (w < 0.8 || d < 0.8) continue;
      const st: [number, number] = [s.x0 + 0.2 + r() * (w - 0.4), s.z0 + 0.2 + r() * (d - 0.4)];
      detF.uvU = r(); detF.uvV = r();
      crack(s, st, r() * Math.PI * 2, 0.7 + r() * 1.5, 0.05 + r() * 0.045, calm ? 0.45 : 1);
      made++;
    }
  }

  // =============================================================================================
  // 4) PECAS DE APOIO
  // =============================================================================================
  const skull = bakeKitPiece(pieces.skull);
  const rubbleKit = bakeKitPiece(pieces.rubble);
  const boneCol = hex("#c9c1a5");
  const rockCol = (): RGB => hsl(205 + (r() - 0.5) * 30, 7 + r() * 5, 21 + r() * 7);

  /** Posicao valida para peca em relevo (fora da faixa de combate, saida, estrado, pilares, agua). */
  const okAt = (x: number, z: number, rad: number, allowCalm = false): boolean => {
    if (Math.abs(x) > HX - 0.55 - rad * 0.5 || Math.abs(z) > HZ - 0.55 - rad * 0.5) return false;
    if (!allowCalm && inCalm(L, x, z, 1.04)) return false;
    if (nearTaken(x, z, rad)) return false;
    if (stage(x, z)) return false;
    if (nearWater(x, z, 0.3 + rad)) return false;
    return flatY(x, z) !== null;
  };
  /** Ponto com tendencia as paredes e cantos (cenografia de borda). */
  const rimPoint = (): [number, number] => {
    for (let t = 0; t < 40; t++) {
      let x: number, z: number;
      const u = r();
      if (u < 0.6) {
        // junto a uma parede: distancia ao quadrado favorece o encosto
        const wall = Math.floor(r() * 4);
        const dist = 0.7 + r() * r() * 4.2;
        if (wall === 0) { x = HX - dist; z = (r() - 0.5) * (HZ * 2 - 2); }
        else if (wall === 1) { x = -HX + dist; z = (r() - 0.5) * (HZ * 2 - 2); }
        else if (wall === 2) { z = HZ - dist; x = (r() - 0.5) * (HX * 2 - 2); }
        else { z = -HZ + dist; x = (r() - 0.5) * (HX * 2 - 2); }
      } else {
        x = (r() - 0.5) * (HX * 2 - 2);
        z = (r() - 0.5) * (HZ * 2 - 2);
      }
      if (!inCalm(L, x, z, 1.04)) return [x, z];
    }
    return [HX - 1.5, HZ - 1.5];
  };

  const rubbleCluster = (x: number, z: number, y: number, k: number): void => {
    detF.uvU = r(); detF.uvV = r();
    if (rubbleKit && k > 0.45) placeKit(detF, rubbleKit, x, y, z, 0.42 + k * 0.5, r() * 6.28, [0.9 + r() * 0.2, 0.9 + r() * 0.2, 0.95 + r() * 0.2]);
    const n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = 0.15 + r() * 0.65 * (0.6 + k);
      rock(detF, x + Math.cos(a) * d, y, z + Math.sin(a) * d, 0.07 + r() * 0.17 * (0.5 + k), 0.55 + r() * 0.25, r, rockCol(), r() * 6);
    }
    if (r() < 0.7) shard(detF, x + (r() - 0.5) * 0.8, y, z + (r() - 0.5) * 0.8, 0.28 + r() * 0.35, 0.05 + r() * 0.05, r, shade(hsl(215, 8, 30), 0.9 + r() * 0.3));
  };
  const boneGroup = (x: number, z: number, y: number, bigger: boolean): void => {
    detF.uvU = r(); detF.uvV = r();
    const nb = 2 + Math.floor(r() * 3) + (bigger ? 2 : 0);
    for (let i = 0; i < nb; i++) {
      const a = r() * 6.28, d = r() * 0.7;
      bone(detF, x + Math.cos(a) * d, y, z + Math.sin(a) * d, r() * 3.14, 0.34 + r() * 0.3, 0.022 + r() * 0.012, shade(boneCol, 0.78 + r() * 0.3));
    }
    const t = r();
    if (skull && t < 0.7) placeKit(detF, skull, x + (r() - 0.5) * 0.5, y - 0.03, z + (r() - 0.5) * 0.5, 0.3 + r() * 0.08, r() * 6.28, [0.92 + r() * 0.1, 0.9 + r() * 0.1, 0.84 + r() * 0.1], (r() - 0.5) * 0.4, (r() - 0.5) * 0.4);
    if (t > 0.5) ribcage(detF, x + (r() - 0.5) * 0.9, y, z + (r() - 0.5) * 0.9, r() * 6.28, 0.8 + r() * 0.5, shade(boneCol, 0.74 + r() * 0.2));
  };

  const dens: Record<RoomKind, { rubble: number; bones: number; shards: number; skulls: number }> = {
    guarda: { rubble: 1 / 26, bones: 1 / 52, shards: 1 / 22, skulls: 1 / 90 },
    salao: { rubble: 1 / 28, bones: 1 / 44, shards: 1 / 22, skulls: 1 / 80 },
    cisterna: { rubble: 1 / 16, bones: 1 / 26, shards: 1 / 16, skulls: 1 / 60 },
    santuario: { rubble: 1 / 34, bones: 1 / 40, shards: 1 / 26, skulls: 1 / 70 },
    guardiao: { rubble: 1 / 14, bones: 1 / 30, shards: 1 / 12, skulls: 1 / 60 },
  };
  const D = dens[kind];

  // entulho em aglomerados, preferindo cantos e paredes
  for (let i = 0, n = Math.round(rimArea * D.rubble), tr = 0; i < n && tr < n * 20; tr++) {
    const [x, z] = rimPoint();
    if (!okAt(x, z, 0.8)) continue;
    rubbleCluster(x, z, flatY(x, z)!, r());
    i++;
  }
  // montes de ossos (ossos + cranio + costelas)
  for (let i = 0, n = Math.round(rimArea * D.bones), tr = 0; i < n && tr < n * 20; tr++) {
    const [x, z] = rimPoint();
    if (!okAt(x, z, 0.8)) continue;
    boneGroup(x, z, flatY(x, z)!, r() < 0.3);
    i++;
  }
  // cranios soltos
  for (let i = 0, n = Math.round(rimArea * D.skulls), tr = 0; skull && i < n && tr < n * 20; tr++) {
    const [x, z] = rimPoint();
    if (!okAt(x, z, 0.5)) continue;
    detF.uvU = r(); detF.uvV = r();
    placeKit(detF, skull, x, flatY(x, z)! - 0.03, z, 0.3 + r() * 0.1, r() * 6.28, [0.92 + r() * 0.1, 0.9 + r() * 0.1, 0.84 + r() * 0.1], (r() - 0.5) * 0.5, (r() - 0.5) * 0.5);
    i++;
  }
  // cacos de laje quebrada soltos (a maior parte perto de lajes erguidas e paredes)
  for (let i = 0, n = Math.round(rimArea * D.shards), tr = 0; i < n && tr < n * 20; tr++) {
    const [x, z] = rimPoint();
    if (!okAt(x, z, 0.6)) continue;
    detF.uvU = r(); detF.uvV = r();
    const sl = slabAt(x, z)!;
    shard(detF, x, flatY(x, z)!, z, 0.3 + r() * 0.5, 0.045 + r() * 0.06, r, shade(sl.col, 1.05 + r() * 0.15));
    i++;
  }
  // cacos e entulho junto de cada laje erguida (de onde saiu o pedaco)
  for (const s of slabs) {
    if (s.kind !== "raised" || r() > 0.7) continue;
    const cz = (s.z0 + s.z1) / 2;
    const side = r() < 0.5 ? s.x1 + 0.4 : s.x0 - 0.4;
    const z = cz + (r() - 0.5) * (s.z1 - s.z0) * 0.6;
    if (!okAt(side, z, 0.4)) continue;
    detF.uvU = r(); detF.uvV = r();
    rock(detF, side, flatY(side, z)!, z, 0.1 + r() * 0.1, 0.6, r, rockCol(), r() * 6);
    shard(detF, side + (r() - 0.5) * 0.4, flatY(side, z)!, z + (r() - 0.5) * 0.5, 0.25 + r() * 0.2, 0.05, r, shade(s.col, 1.1));
  }

  // =============================================================================================
  // 5) ASSINATURA POR TIPO DE SALA
  // =============================================================================================
  const candles: Spot[] = [];
  const embers: Spot[] = [];
  let emissive: { mesh: Mesh; mat: StandardMaterial } | null = null;

  const mossCol = hsl(pal.moss[0], pal.moss[1], pal.moss[2]);
  const mossAt = (x: number, z: number, y: number, size: number, blades: number): void => {
    detF.uvU = r(); detF.uvV = r();
    tuft(detF, x, y, z, size, blades, r, mossCol);
  };

  const straw = (x: number, z: number, y: number, rad: number, n: number): void => {
    detF.uvU = r(); detF.uvV = r();
    const c0 = hsl(44, 38, 40), c1 = hsl(38, 32, 30);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * rad;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      const yaw = r() * 6.28, len = 0.22 + r() * 0.3, w = 0.016 + r() * 0.012;
      const dx = Math.cos(yaw) * len / 2, dz = Math.sin(yaw) * len / 2, nx = -Math.sin(yaw) * w, nz = Math.cos(yaw) * w;
      const yy = y + 0.004 + r() * 0.03 * (1 - d / rad);
      const c = mix(c0, c1, r());
      detF.quad([px - dx - nx, yy, pz - dz - nz], [px + dx - nx, yy + 0.006, pz + dz - nz], [px + dx + nx, yy + 0.006, pz + dz + nz], [px - dx + nx, yy, pz - dz + nz], c, [0, 1, 0]);
    }
  };

  if (kind === "cisterna") {
    // musgo em tufos: borda das lagoas/bacias, pe das paredes e junto de entulho
    const mossTargets: [number, number][] = [];
    for (const p of ponds) for (let i = 0; i < 18; i++) {
      const a = r() * 6.28, rr = pondR(p, a - p.ang) + 0.45 + r() * 0.6;
      mossTargets.push([p.x + Math.cos(a) * rr, p.z + Math.sin(a) * rr]);
    }
    for (const b of basins) for (let i = 0; i < 22; i++) {
      const rc = b.rect;
      const out = 0.12 + r() * 0.5;
      const t = r();
      if (t < 0.5) mossTargets.push([rc.x0 + r() * (rc.x1 - rc.x0), (r() < 0.5 ? rc.z0 - out : rc.z1 + out)]);
      else mossTargets.push([(r() < 0.5 ? rc.x0 - out : rc.x1 + out), rc.z0 + r() * (rc.z1 - rc.z0)]);
    }
    for (let i = 0; i < Math.round(rimArea / 5); i++) mossTargets.push(rimPoint());
    for (const [x, z] of mossTargets) {
      if (inCalm(L, x, z, 1.02) || nearTaken(x, z, -1.2) || stage(x, z) || Math.abs(x) > HX - 0.5 || Math.abs(z) > HZ - 0.5) continue;
      const y = flatY(x, z);
      if (y === null) continue;
      if (inPond(x, z, -0.45)) continue;
      mossAt(x, z, y, 0.16 + r() * 0.16, 3 + Math.floor(r() * 4));
    }
    // ralo de ferro: anel, boca escura e grade (peca 3D)
    for (let t = 0; t < 80; t++) {
      const [x, z] = rimPoint();
      if (!okAt(x, z, 1.1) || Math.hypot(x, z - cc.z) < 5) continue;
      const y = flatY(x, z)!;
      detF.uvU = r(); detF.uvV = r();
      const ring: [number, number][] = [], inn: [number, number][] = [];
      const N = 14;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * 6.28318;
        ring.push([x + Math.cos(a) * 0.78, z + Math.sin(a) * 0.78]);
        inn.push([x + Math.cos(a) * 0.6, z + Math.sin(a) * 0.6]);
      }
      const iron = hex("#2d343b");
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const tone = shade(iron, 0.9 + (i % 2) * 0.18);
        detF.quad([ring[i]![0], y + 0.04, ring[i]![1]], [ring[j]![0], y + 0.04, ring[j]![1]], [inn[j]![0], y + 0.055, inn[j]![1]], [inn[i]![0], y + 0.055, inn[i]![1]], tone, [0, 1, 0]);
        detF.quad([ring[i]![0], y, ring[i]![1]], [ring[j]![0], y, ring[j]![1]], [ring[j]![0], y + 0.04, ring[j]![1]], [ring[i]![0], y + 0.04, ring[i]![1]], shade(iron, 0.55), [ring[i]![0] - x, 0, ring[i]![1] - z]);
      }
      detF.fan(inn.map(([px, pz]): V3 => [px, y + 0.012, pz]), hex("#020304"), [0, 1, 0]);
      for (let i = -2; i <= 2; i++) {
        const half = Math.sqrt(Math.max(0, 0.6 * 0.6 - (i * 0.22) ** 2));
        box(detF, x, y + 0.02, z + i * 0.22, half * 2, 0.04, 0.06, 0, shade(iron, 1.15 + (i % 2) * 0.1));
      }
      taken.push({ x, z, r: 1.0 });
      break;
    }
    // limo nas juntas: filetes de musgo baixo ao longo das lajes proximas da agua
    for (const s of slabs) {
      if (s.kind !== "flat") continue;
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
      if (!nearWater(cx, cz, 2.6) || r() > 0.55) continue;
      detF.uvU = r(); detF.uvV = r();
      const along = r() < 0.5;
      const len = 0.5 + r() * 0.9;
      const px = along ? s.x0 + r() * (s.x1 - s.x0 - len) : (r() < 0.5 ? s.x0 + 0.03 : s.x1 - 0.03);
      const pz = along ? (r() < 0.5 ? s.z0 + 0.03 : s.z1 - 0.03) : s.z0 + r() * (s.z1 - s.z0 - len);
      const y = s.h + 0.006;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 4; i++) pts.push(along ? [px + (len * i) / 4, pz] : [px, pz + (len * i) / 4]);
      ribbon(detF, pts, [0.05, 0.1, 0.12, 0.09, 0.05], y, shade(mossCol, 0.7 + r() * 0.3));
    }
  } else if (kind === "guarda") {
    // palha espalhada junto as paredes
    for (let i = 0, tr = 0; i < 6 && tr < 80; tr++) {
      const [x, z] = rimPoint();
      if (!okAt(x, z, 1.2)) continue;
      straw(x, z, flatY(x, z)!, 0.8 + r() * 0.5, 38 + Math.floor(r() * 26));
      taken.push({ x, z, r: 0.9 });
      i++;
    }
  } else if (kind === "salao") {
    // tapete-corredor gasto e rasgado (ocre escuro; o manto do heroi e vermelho)
    const x0 = -1.5, x1 = 1.5, z0 = -HZ + 2.6, z1 = AZ - 3.6;
    const yR = 0.03;
    floorF.uvU = r(); floorF.uvV = r();
    const rugCol = hsl(36, 28, 19);
    // corpo com um canto roido (poligono de 6 pontos)
    prism(floorF, [[x0, z0], [x1, z0], [x1, z1 - 0.9], [x1 - 0.7, z1], [x0, z1]], yR, 0.0, rugCol, { bevel: 0.03, drop: 0.015, colSide: hsl(34, 24, 10) });
    // bordado dourado gasto (4 fios) e listras escuras
    const yB = yR + 0.006;
    const gold = hsl(43, 48, 30);
    for (const [bx, bz, bw, bd] of [[0, z0 + 0.14, x1 - x0 - 0.3, 0.07], [0, z1 - 0.14, x1 - x0 - 0.5, 0.07], [x0 + 0.15, (z0 + z1) / 2, 0.07, z1 - z0 - 0.4], [x1 - 0.15, (z0 + z1) / 2, 0.07, z1 - z0 - 0.4]] as const) {
      prism(floorF, rectPoly(bx, bz, bw, bd), yB, yR - 0.004, gold, { noSides: true });
    }
    for (const sx of [-0.55, 0.55]) prism(floorF, rectPoly(sx, (z0 + z1) / 2, 0.16, z1 - z0 - 0.6), yB, yR - 0.004, hsl(36, 22, 12), { noSides: true });
    // franjas nas pontas
    for (let i = 0; i < 14; i++) {
      const fx = x0 + 0.12 + i * ((x1 - x0 - 0.24) / 13);
      prism(floorF, rectPoly(fx, z0 - 0.1, 0.05, 0.2, (r() - 0.5) * 0.3), 0.012, 0, hsl(40, 30, 24), { noSides: true });
    }
    for (let i = 0, tr = 0; i < 5 && tr < 80; tr++) {
      const [x, z] = rimPoint();
      if (!okAt(x, z, 1.2)) continue;
      straw(x, z, flatY(x, z)!, 0.7 + r() * 0.4, 28 + Math.floor(r() * 20));
      taken.push({ x, z, r: 0.9 });
      i++;
    }
  } else if (kind === "santuario") {
    // gravura ritual: aneis, estrela e runas em fios de ouro (emissivo) sobre sulcos escuros
    const arc = (rad: number, w: number, y: number, f: Facet, col: RGB): void => {
      const pts: [number, number][] = [];
      const N = 72;
      for (let i = 0; i <= N; i++) { const a = (i / N) * 6.28318; pts.push([cc.x + Math.cos(a) * rad, cc.z + Math.sin(a) * rad]); }
      ribbon(f, pts, [w], y, col);
    };
    const groove = hex("#050509");
    for (const [rad, w] of [[4.3, 0.12], [3.7, 0.08], [2.2, 0.09]] as const) {
      arc(rad, w + 0.06, 0.014, detF, groove);
      arc(rad, w, 0.02, emisF, [1, 1, 1]);
    }
    const star: [number, number][] = [];
    for (let i = 0; i <= 5; i++) {
      const a = (((i * 2) % 5) / 5) * 6.28318 + Math.PI / 2;
      star.push([cc.x + Math.cos(a) * 3.7, cc.z + Math.sin(a) * 3.7]);
    }
    for (let i = 0; i < 5; i++) {
      const seg: [number, number][] = [star[i]!, star[i + 1]!];
      ribbon(detF, seg, [0.1], 0.014, groove);
      ribbon(emisF, seg, [0.05], 0.02, [1, 1, 1]);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 6.28318;
      const px = cc.x + Math.cos(a) * 4.0, pz = cc.z + Math.sin(a) * 4.0;
      const rune: [number, number][] = [[px, pz], [px + Math.cos(a + 1.2) * 0.22, pz + Math.sin(a + 1.2) * 0.22]];
      ribbon(emisF, rune, [0.045], 0.02, [1, 1, 1]);
      if (r() < 0.5) ribbon(emisF, [[px + Math.cos(a) * 0.1, pz + Math.sin(a) * 0.1], [px + Math.cos(a) * 0.3, pz + Math.sin(a) * 0.3]], [0.04], 0.02, [1, 1, 1]);
    }
    // cera derretida em disco e toco de vela nos quatro cantos do circulo
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.28318 + Math.PI / 4;
      const px = cc.x + Math.cos(a) * 5.0, pz = cc.z + Math.sin(a) * 5.0;
      if (Math.hypot(px - EX, pz - EZ) < 4) continue;
      const y = flatY(px, pz) ?? 0;
      const wax: [number, number][] = [];
      for (let k = 0; k < 9; k++) { const an = (k / 9) * 6.28318; const rr = 0.36 + 0.12 * Math.sin(k * 2.3 + i); wax.push([px + Math.cos(an) * rr, pz + Math.sin(an) * rr]); }
      detF.uvU = r(); detF.uvV = r();
      prism(detF, wax, y + 0.018, y, hsl(40, 28, 62), { bevel: 0.03, drop: 0.015, noSides: false, colSide: hsl(38, 22, 40) });
      candles.push({ x: px, z: pz, r: 2.6 });
    }
    // alguns pedaços de laje com runa quebrada ao redor
    for (let i = 0, tr = 0; i < 6 && tr < 80; tr++) {
      const [x, z] = rimPoint();
      if (!okAt(x, z, 1.0)) continue;
      mossAt(x, z, flatY(x, z)!, 0.12, 3);
      i++;
    }
  } else if (kind === "guardiao") {
    // fendas radiais com brasa: sulco escuro com borda erguida + nucleo emissivo
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + r() * 0.35;
      const pts: [number, number][] = [];
      let x = cc.x + Math.cos(a0) * 2.2, z = cc.z + Math.sin(a0) * 2.2, a = a0;
      const segs = 9 + Math.floor(r() * 6);
      pts.push([x, z]);
      for (let s = 0; s < segs; s++) {
        a += (r() - 0.5) * 0.7;
        const step = 0.8 + r() * 0.7;
        x += Math.cos(a) * step; z += Math.sin(a) * step;
        if (Math.abs(x) > HX - 1.1 || Math.abs(z) > HZ - 1.1) break;
        pts.push([x, z]);
        if (s % 3 === 1) embers.push({ x, z, r: 2.2 });
      }
      if (pts.length < 4) continue;
      const widths = pts.map((_, k) => 0.34 * (1 - k / pts.length) + 0.07);
      const half = widths.map((w) => w / 2);
      const lw = 0.07;
      ribbon(detF, pts, widths.map((w) => w + 0.05), 0.016, hex("#030204"));
      const le = offs(pts, half.map((h) => h + 0.025)), re = offs(pts, half.map((h) => -(h + 0.025)));
      const lm = offs(pts, half.map((h) => h + 0.025 + lw)), rm = offs(pts, half.map((h) => -(h + 0.025 + lw)));
      const lo = offs(pts, half.map((h) => h + 0.025 + lw * 2)), ro = offs(pts, half.map((h) => -(h + 0.025 + lw * 2)));
      const lip = hsl(255, 8, 24);
      slope(detF, le, 0.016, lm, 0.052, lip, [0, 1, 0]);
      slope(detF, lm, 0.052, lo, 0.01, shade(lip, 0.65), [0, 1, 0]);
      slope(detF, re, 0.016, rm, 0.052, lip, [0, 1, 0]);
      slope(detF, rm, 0.052, ro, 0.01, shade(lip, 0.65), [0, 1, 0]);
      ribbon(emisF, pts, widths.map((w) => w * 0.5), 0.028, [1, 1, 1]);
    }
    // pedras e cinzas soltas junto das fendas
    for (let i = 0, tr = 0; i < 18 && tr < 200; tr++) {
      const a = r() * 6.28, d = 2.8 + r() * 7;
      const x = cc.x + Math.cos(a) * d, z = cc.z + Math.sin(a) * d;
      if (Math.abs(x) > HX - 1 || Math.abs(z) > HZ - 1 || nearTaken(x, z, 0.4) || stage(x, z)) continue;
      const y = flatY(x, z);
      if (y === null) continue;
      detF.uvU = r(); detF.uvV = r();
      rock(detF, x, y, z, 0.1 + r() * 0.16, 0.55, r, hsl(250, 8, 15 + r() * 5), r() * 6);
      i++;
    }
  }
  // tufos de mofo discretos nos demais tipos (so cantos)
  if (kind !== "cisterna" && kind !== "guardiao") {
    for (let i = 0, tr = 0; i < 6 && tr < 60; tr++) {
      const [x, z] = rimPoint();
      if (!okAt(x, z, 0.3) || Math.hypot(x, z) < 4) continue;
      mossAt(x, z, flatY(x, z)!, 0.12 + r() * 0.08, 3);
      i++;
    }
  }

  // =============================================================================================
  // 6) MATERIAIS E MALHAS
  // =============================================================================================
  const grain = makeGrainTexture(scene);
  const stone = new StandardMaterial("pisoPedraMat", scene);
  stone.diffuseTexture = grain;
  stone.diffuseColor = Color3.White();
  stone.specularColor = Color3.Black();

  const under = new StandardMaterial("pisoJuntaMat", scene);
  under.diffuseColor = Color3.FromHexString(pal.joint);
  under.specularColor = Color3.Black();
  const underlay = MeshBuilder.CreateBox("piso_junta", { width: HX * 2 + 1.0, height: 1.0, depth: HZ * 2 + 1.0 }, scene);
  underlay.position.set(0, Y_JOINT - 0.5, 0);
  underlay.material = under;
  underlay.isPickable = false;
  underlay.receiveShadows = true;

  const floorMesh = floorF.toMesh("piso_lajes", scene, stone)!;
  floorMesh.receiveShadows = true;
  const detMesh = detF.toMesh("piso_detalhes", scene, stone);
  if (detMesh) detMesh.receiveShadows = true;

  const meshes: Mesh[] = [underlay, floorMesh];
  if (detMesh) meshes.push(detMesh);

  // agua: translucida, emissiva sutil, ondulacao por deslocamento de UV (barato)
  let waterTex: DynamicTexture | null = null;
  const waterMesh = waterF.toMesh("piso_agua", scene, null);
  if (waterMesh) {
    waterTex = makeWaterTexture(scene);
    const wm = new StandardMaterial("pisoAguaMat", scene);
    wm.disableLighting = true;
    wm.diffuseColor = Color3.Black();
    wm.specularColor = Color3.Black();
    wm.emissiveTexture = waterTex;
    wm.emissiveColor = new Color3(0.2, 0.46, 0.5);
    wm.alpha = 0.8;
    wm.backFaceCulling = false;
    waterMesh.material = wm;
    waterMesh.receiveShadows = false;
    waterMesh.renderingGroupId = 0;
    meshes.push(waterMesh);
  }

  const emisMesh = emisF.toMesh("piso_brasas", scene, null);
  if (emisMesh) {
    const em = new StandardMaterial("pisoEmissivoMat", scene);
    em.diffuseColor = Color3.Black();
    em.specularColor = Color3.Black();
    em.disableLighting = true;
    if (kind === "guardiao") { em.emissiveColor = Color3.FromHexString("#7a1c0c"); em.alpha = 0.95; }
    else { em.emissiveColor = Color3.FromHexString("#b98f4a"); em.alpha = 0.85; }
    emisMesh.material = em;
    emissive = { mesh: emisMesh, mat: em };
    meshes.push(emisMesh);
  }

  const tris = floorF.triCount + detF.triCount + waterF.triCount + emisF.triCount;
  return {
    meshes,
    floor: floorMesh,
    details: detMesh,
    emissive,
    puddles,
    candles,
    embers,
    update(t: number): void {
      if (!waterTex) return;
      waterTex.uOffset = t * 0.006 + Math.sin(t * 0.23) * 0.03;
      waterTex.vOffset = t * 0.004 + Math.cos(t * 0.19) * 0.03;
    },
    stats: { slabs: slabs.length, tris },
  };
}
