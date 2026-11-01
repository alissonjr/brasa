import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { createLightPool } from "@engine";
import type { Layout } from "./cryptLayouts";
import type { RoomKind } from "./cryptRoom";

/**
 * CAMADA JOGO (Brasa). CENOGRAFIA DO PISO vista de cima (camera alta). Em vez de dezenas de
 * malhas, o chao inteiro e UMA textura procedural (DynamicTexture, canvas 2D) colada na laje
 * base: lajes irregulares com chanfro, rachaduras, sujeira, sangue, poças, ossos, palha,
 * teias de canto e a assinatura de cada tipo de sala (RoomKind). Custo: 0 draw calls novos.
 * Alem disso: lajes erguidas (1 malha mesclada) e grupos de poças de luz mesclados (1 malha
 * por cor), que substituem as poças avulsas de cada tocha.
 *
 * Leitura de combate: a faixa central (Layout.calm) recebe detalhe de baixo contraste e nenhuma
 * peça 3D; a sujeira forte vive nas bordas.
 */

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

const KIND_SALT: Record<RoomKind, number> = { guarda: 11, salao: 23, cisterna: 37, santuario: 53, guardiao: 71 };

export interface Slab { x: number; z: number; w: number; d: number }
export interface Spot { x: number; z: number; r: number }

export interface FloorResult {
  tex: DynamicTexture;
  /** UV do bolsao escuro (canto -x,-z) que as faces laterais da laje base amostram. */
  sideUV: { u: number; v: number };
  slabs: Slab[];
  puddles: Spot[]; // poças d'agua pintadas (a luz de agua se apoia nelas)
  candles: Spot[]; // velas pintadas/reais do santuario (poças de luz douradas)
  embers: Spot[]; // brasas das rachaduras do guardiao
}

// Ruido em tons de cinza (tile 256) reaproveitado como sobreposicao de granulado.
let noiseCanvas: HTMLCanvasElement | null = null;
function getNoise(): HTMLCanvasElement {
  if (noiseCanvas) return noiseCanvas;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const img = g.createImageData(256, 256);
  const r = mulberry32(90210);
  for (let i = 0; i < 256 * 256; i++) {
    const v = 90 + Math.floor(r() * 80); // cinza medio: 'overlay' quase neutro
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  noiseCanvas = c;
  return c;
}

interface Pal {
  /** [matiz, saturacao %, luminosidade %] das lajes */
  slabs: [number, number, number][];
  joint: string;
  wet: boolean;
}
const PAL: Record<RoomKind, Pal> = {
  guarda: { slabs: [[218, 9, 34], [32, 7, 33], [222, 9, 28], [205, 7, 37]], joint: "#12161c", wet: false },
  salao: { slabs: [[32, 8, 34], [215, 8, 32], [26, 9, 29], [40, 7, 37]], joint: "#14141a", wet: false },
  cisterna: { slabs: [[188, 14, 27], [160, 12, 24], [212, 11, 22], [170, 16, 30]], joint: "#0c1417", wet: true },
  santuario: { slabs: [[252, 8, 37], [42, 9, 38], [235, 10, 29], [270, 7, 33]], joint: "#14131c", wet: false },
  guardiao: { slabs: [[262, 8, 21], [10, 12, 22], [240, 9, 16], [20, 10, 26]], joint: "#08070b", wet: false },
};

const hsl = (h: number, s: number, l: number): string => `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(1)}%)`;

/** Gera a malha de lajes irregulares (fileiras de altura variavel, com escalonamento). */
export function genSlabs(halfX: number, halfZ: number, r: Rng): Slab[] {
  const out: Slab[] = [];
  let z = -halfZ;
  while (z < halfZ - 0.2) {
    const d = Math.min(halfZ - z, 1.5 + r() * 1.5);
    let x = -halfX - r() * 1.2;
    while (x < halfX - 0.2) {
      const w = 1.4 + r() * 2.0;
      const x0 = Math.max(x, -halfX);
      const x1 = Math.min(x + w, halfX);
      if (x1 - x0 > 0.3) out.push({ x: (x0 + x1) / 2, z: z + d / 2, w: x1 - x0, d });
      x += w;
    }
    z += d;
  }
  return out;
}

export function inCalm(L: Layout, x: number, z: number, k = 1): boolean {
  const c = L.calm;
  const dx = (x - c.cx) / (c.rx * k);
  const dz = (z - c.cz) / (c.rz * k);
  return dx * dx + dz * dz < 1;
}

/** 0 no miolo da faixa de combate, 1 fora dela (para atenuar o detalhe do centro). */
function calmFactor(L: Layout, x: number, z: number): number {
  const c = L.calm;
  const dx = (x - c.cx) / c.rx;
  const dz = (z - c.cz) / c.rz;
  const d = Math.sqrt(dx * dx + dz * dz);
  const t = Math.max(0, Math.min(1, (d - 0.55) / 0.7));
  return 0.22 + 0.78 * t;
}

export function paintFloor(scene: Scene, L: Layout, kind: RoomKind, index: number): FloorResult {
  const r = mulberry32(index * 7919 + KIND_SALT[kind] * 131 + 17);
  const pal = PAL[kind];
  const HX = L.halfX;
  const HZ = L.halfZ;
  const spanX = HX * 2;
  const spanZ = HZ * 2;
  const ppm = Math.min(48, 3000 / Math.max(spanX, spanZ));
  const W = Math.round(spanX * ppm);
  const H = Math.round(spanZ * ppm);
  const tex = new DynamicTexture("pisoCenario", { width: W, height: H }, scene, true);
  tex.anisotropicFilteringLevel = 4;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  // Unidades de mundo (metros): +x para a direita, +z para CIMA do canvas (lado do altar).
  const world = (): void => ctx.setTransform(ppm, 0, 0, -ppm, W / 2, H / 2);
  world();

  const slabs = genSlabs(HX, HZ, r);
  const puddles: Spot[] = [];
  const candles: Spot[] = [];
  const embers: Spot[] = [];
  const cf = (x: number, z: number): number => calmFactor(L, x, z);

  // --- helpers de desenho ---
  const blob = (x: number, z: number, rad: number, rgb: string, a: number, squash = 1, rot = 0): void => {
    ctx.save();
    ctx.translate(x, z);
    ctx.rotate(rot);
    ctx.scale(1, squash);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(0.55, `rgba(${rgb},${a * 0.55})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const line = (x0: number, z0: number, x1: number, z1: number, w: number, col: string): void => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, z0);
    ctx.lineTo(x1, z1);
    ctx.stroke();
  };

  // 1) juntas + lajes irregulares com chanfro (luz vem de +x/+z): borda clara a +x/+z, escura a -x/-z.
  ctx.fillStyle = pal.joint;
  ctx.fillRect(-HX - 1, -HZ - 1, spanX + 2, spanZ + 2);
  for (const s of slabs) {
    const base = pal.slabs[Math.floor(r() * pal.slabs.length)]!;
    const dark = r() < 0.12 ? -6 : 0; // lajes mais escuras
    const l = base[2] + dark + (r() - 0.5) * 3.5;
    const g = 0.04;
    const x0 = s.x - s.w / 2 + g, z0 = s.z - s.d / 2 + g, w = s.w - 2 * g, d = s.d - 2 * g;
    ctx.fillStyle = hsl(base[0] + (r() - 0.5) * 8, base[1] + (r() - 0.5) * 4, l);
    ctx.fillRect(x0, z0, w, d);
    // gradiente suave dentro da laje (centro levemente mais claro)
    const gr = ctx.createLinearGradient(x0, z0, x0 + w, z0 + d);
    gr.addColorStop(0, "rgba(0,0,0,0.10)");
    gr.addColorStop(1, "rgba(255,255,255,0.07)");
    ctx.fillStyle = gr;
    ctx.fillRect(x0, z0, w, d);
    const b = 0.045;
    ctx.fillStyle = "rgba(255,255,255,0.17)";
    ctx.fillRect(x0, z0 + d - b, w, b); // topo (+z)
    ctx.fillRect(x0 + w - b, z0, b, d); // direita (+x)
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fillRect(x0, z0, w, b); // baixo (-z)
    ctx.fillRect(x0, z0, b, d); // esquerda (-x)
  }

  // 2) granulado (overlay) em resolucao de pixel + manchas grandes de tom (nuvens).
  {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const pat = ctx.createPattern(getNoise(), "repeat");
    if (pat) {
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    world();
    const n = Math.round((spanX * spanZ) / 14);
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * spanX, z = (r() - 0.5) * spanZ;
      const rad = 1.2 + r() * 3.2;
      if (r() < 0.55) blob(x, z, rad, "0,0,0", 0.07 + r() * 0.07, 0.6 + r() * 0.4, r() * 3);
      else blob(x, z, rad, "200,210,225", 0.025 + r() * 0.035, 0.6 + r() * 0.4, r() * 3);
    }
  }

  // 3) assinatura por tipo (por baixo das rachaduras/sujeira)
  const cc = { x: 0, z: Math.min(0, L.altar.z - 6) }; // centro da zona de combate (igual ao decalque)
  if (kind === "guarda") {
    // palha espalhada junto as paredes e um trilho gasto da porta ao altar
    ctx.globalAlpha = 0.5;
    for (let p = 0; p < 5; p++) {
      const side = r() < 0.5 ? -1 : 1;
      const px = side * (HX - 1.8 - r() * 2.5), pz = -HZ + 2 + r() * (spanZ - 6);
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI, ox = (r() - 0.5) * 3.2, oz = (r() - 0.5) * 2.4, len = 0.25 + r() * 0.3;
        line(px + ox, pz + oz, px + ox + Math.cos(a) * len, pz + oz + Math.sin(a) * len, 0.025, r() < 0.5 ? "#8c7a47" : "#6b5a35");
      }
    }
    ctx.globalAlpha = 1;
  } else if (kind === "salao") {
    // tapete-corredor gasto e rasgado (ocre escuro, nao vermelho: o manto do heroi e vermelho)
    const x0 = -1.5, x1 = 1.5, z0 = -HZ + 2, z1 = L.altar.z - 3.2;
    ctx.fillStyle = "hsl(36 26% 20%)";
    ctx.fillRect(x0, z0, x1 - x0, z1 - z0);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x0 + 0.5, z0, 0.12, z1 - z0);
    ctx.fillRect(x1 - 0.62, z0, 0.12, z1 - z0);
    ctx.strokeStyle = "hsl(43 55% 36%)";
    ctx.lineWidth = 0.08;
    ctx.strokeRect(x0 + 0.18, z0 + 0.1, x1 - x0 - 0.36, z1 - z0 - 0.2);
    // rasgos: manchas de laje por cima da trama
    for (let i = 0; i < 9; i++) {
      const bx = x0 + r() * (x1 - x0), bz = z0 + r() * (z1 - z0);
      blob(bx, bz, 0.5 + r() * 0.7, "26,28,34", 0.8, 0.8, r() * 3);
    }
    // franjas nas pontas
    for (let i = 0; i < 18; i++) line(x0 + 0.1 + i * 0.16, z1, x0 + 0.1 + i * 0.16, z1 + 0.22, 0.04, "hsl(43 45% 30%)");
    // vinho derramado
    blob(-6 - r() * 2, -2 + r() * 4, 0.9, "92,20,34", 0.5, 0.7, r() * 3);
  } else if (kind === "cisterna") {
    // poças irregulares (varias elipses sobrepostas) afastadas do centro de combate
    const n = 5;
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const px = side * (4.5 + r() * (HX - 8)) * (r() < 0.2 ? 0.4 : 1);
      const pz = -HZ + 3 + r() * (spanZ - 9);
      if (Math.hypot(px - L.exit.x, pz - L.exit.z) < 4.5) continue;
      puddles.push({ x: px, z: pz, r: 1.6 + r() * 1.8 });
    }
    const lobes: { x: number; z: number; rx: number; rz: number; a: number }[] = [];
    for (const p of puddles) {
      const k = 4 + Math.floor(r() * 3);
      for (let i = 0; i < k; i++) {
        lobes.push({ x: p.x + (r() - 0.5) * p.r * 1.2, z: p.z + (r() - 0.5) * p.r * 0.9, rx: p.r * (0.45 + r() * 0.4), rz: p.r * (0.3 + r() * 0.35), a: r() * 3 });
      }
    }
    ctx.strokeStyle = "rgba(120,170,175,0.5)";
    ctx.lineWidth = 0.2;
    for (const o of lobes) { ctx.beginPath(); ctx.ellipse(o.x, o.z, o.rx, o.rz, o.a, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = "rgba(10,34,42,0.9)";
    for (const o of lobes) { ctx.beginPath(); ctx.ellipse(o.x, o.z, o.rx, o.rz, o.a, 0, Math.PI * 2); ctx.fill(); }
    // brilho de agua: lasca clara + gradiente em cada poça
    for (const p of puddles) {
      blob(p.x + p.r * 0.15, p.z + p.r * 0.1, p.r * 0.7, "90,170,185", 0.22, 0.7, 0.4);
      line(p.x - p.r * 0.35, p.z + p.r * 0.18, p.x + p.r * 0.1, p.z + p.r * 0.3, 0.05, "rgba(190,235,240,0.55)");
      line(p.x - p.r * 0.1, p.z - p.r * 0.1, p.x + p.r * 0.4, p.z + p.r * 0.02, 0.04, "rgba(190,235,240,0.4)");
    }
    // limo/musgo nas bordas das lajes e ralo de ferro
    for (let i = 0; i < 40; i++) {
      const edge = r() < 0.5;
      const mx = edge ? (r() < 0.5 ? -1 : 1) * (HX - 0.8 - r() * 3) : (r() - 0.5) * spanX;
      const mz = edge ? (r() - 0.5) * spanZ : (r() < 0.5 ? -1 : 1) * (HZ - 0.8 - r() * 3);
      blob(mx, mz, 0.5 + r() * 1.1, "52,84,52", 0.22, 0.6 + r() * 0.4, r() * 3);
    }
    const drain = { x: -(HX - 5), z: L.altar.z - 8 };
    ctx.fillStyle = "#06090b";
    ctx.beginPath(); ctx.arc(drain.x, drain.z, 0.75, 0, Math.PI * 2); ctx.fill();
    for (let i = -2; i <= 2; i++) line(drain.x - 0.62, drain.z + i * 0.25, drain.x + 0.62, drain.z + i * 0.25, 0.07, "#39424a");
    ctx.strokeStyle = "#39424a"; ctx.lineWidth = 0.1;
    ctx.beginPath(); ctx.arc(drain.x, drain.z, 0.75, 0, Math.PI * 2); ctx.stroke();
  } else if (kind === "santuario") {
    // gravura ritual dourada ao redor do circulo do decalque + runas e estrela
    ctx.strokeStyle = "hsl(42 50% 36%)";
    ctx.lineCap = "round";
    for (const [rad, w] of [[4.3, 0.07], [3.7, 0.04], [2.2, 0.05]] as const) {
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(cc.x, cc.z, rad, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = ((i * 2) % 5) / 5 * Math.PI * 2 + Math.PI / 2;
      const px = cc.x + Math.cos(a) * 3.7, pz = cc.z + Math.sin(a) * 3.7;
      if (i === 0) ctx.moveTo(px, pz); else ctx.lineTo(px, pz);
    }
    ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const px = cc.x + Math.cos(a) * 4.0, pz = cc.z + Math.sin(a) * 4.0;
      const t = r();
      line(px, pz, px + Math.cos(a + 1.2) * 0.22, pz + Math.sin(a + 1.2) * 0.22, 0.04, "hsl(42 50% 40%)");
      if (t < 0.5) line(px + Math.cos(a) * 0.1, pz + Math.sin(a) * 0.1, px + Math.cos(a) * 0.28, pz + Math.sin(a) * 0.28, 0.035, "hsl(42 50% 40%)");
    }
    // cera derretida e velas votivas pintadas nos quatro cantos do circulo
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = cc.x + Math.cos(a) * 5.0, pz = cc.z + Math.sin(a) * 5.0;
      if (Math.hypot(px - L.exit.x, pz - L.exit.z) < 4) continue;
      blob(px, pz, 0.4, "205,190,150", 0.55, 1, 0);
      ctx.fillStyle = "#e6d9b0"; ctx.beginPath(); ctx.arc(px, pz, 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffcf70"; ctx.beginPath(); ctx.arc(px, pz, 0.05, 0, Math.PI * 2); ctx.fill();
      candles.push({ x: px, z: pz, r: 2.6 });
    }
  } else {
    // guardiao: chao calcinado, anel de cinza e rachaduras radiais com brasa
    blob(cc.x, cc.z, 7.5, "0,0,0", 0.3, 1, 0);
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.arc(cc.x, cc.z, 5.6, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 + r() * 0.3;
      let x = cc.x + Math.cos(a0) * 2.6, z = cc.z + Math.sin(a0) * 2.6;
      let a = a0;
      const segs = 6 + Math.floor(r() * 5);
      for (let s = 0; s < segs; s++) {
        a += (r() - 0.5) * 0.7;
        const nx = x + Math.cos(a) * (0.7 + r() * 0.6), nz = z + Math.sin(a) * (0.7 + r() * 0.6);
        line(x, z, nx, nz, 0.16 - s * 0.01, "rgba(4,3,6,0.9)");
        line(x, z, nx, nz, 0.05, "rgba(230,80,24,0.55)");
        if (s % 3 === 1) embers.push({ x: nx, z: nz, r: 2.2 });
        x = nx; z = nz;
      }
    }
  }

  // 4) rachaduras (ramificadas): mais fortes nas bordas, discretas no miolo
  const crack = (x: number, z: number, ang: number, len: number, w: number, depth: number): void => {
    const a0 = cf(x, z);
    let cx = x, cz = z, a = ang, left = len;
    while (left > 0) {
      const step = 0.35 + r() * 0.5;
      a += (r() - 0.5) * 0.9;
      const nx = cx + Math.cos(a) * step, nz = cz + Math.sin(a) * step;
      line(cx, cz, nx, nz, w, `rgba(6,8,12,${0.85 * a0})`);
      line(cx + 0.025, cz + 0.025, nx + 0.025, nz + 0.025, w * 0.4, `rgba(255,255,255,${0.1 * a0})`);
      if (depth < 2 && r() < 0.22) crack(nx, nz, a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.6), left * 0.5, w * 0.7, depth + 1);
      cx = nx; cz = nz; left -= step;
      w *= 0.95;
    }
  };
  const nCracks = Math.round((spanX * spanZ) / (kind === "guardiao" ? 28 : kind === "guarda" ? 60 : 38));
  for (let i = 0; i < nCracks; i++) {
    const x = (r() - 0.5) * (spanX - 1), z = (r() - 0.5) * (spanZ - 1);
    if (inCalm(L, x, z, 0.8) && r() < 0.7) continue;
    crack(x, z, r() * Math.PI * 2, 1.6 + r() * 3.2, 0.05 + r() * 0.04, 0);
  }

  // 5) sujeira, fuligem e sangue (poças + respingos + rastro de arrasto)
  const nDirt = Math.round((spanX * spanZ) / 22);
  for (let i = 0; i < nDirt; i++) {
    const x = (r() - 0.5) * spanX, z = (r() - 0.5) * spanZ;
    blob(x, z, 0.4 + r() * 1.1, "18,14,10", (0.22 + r() * 0.22) * cf(x, z), 0.55 + r() * 0.45, r() * 3);
  }
  const bloodN = kind === "guardiao" ? 9 : kind === "cisterna" ? 4 : kind === "santuario" ? 3 : 6;
  for (let i = 0; i < bloodN; i++) {
    const x = (r() - 0.5) * (spanX - 4), z = (r() - 0.5) * (spanZ - 4);
    const k = cf(x, z);
    if (Math.hypot(x - L.exit.x, z - L.exit.z) < 3.5) continue;
    const rad = 0.45 + r() * 0.8;
    blob(x, z, rad, "74,14,18", 0.6 * k + 0.1, 0.7 + r() * 0.3, r() * 3);
    blob(x, z, rad * 0.5, "40,6,10", 0.5 * k + 0.08, 1, 0);
    for (let s = 0; s < 8; s++) {
      const a = r() * Math.PI * 2, d = rad * (1 + r() * 1.6);
      blob(x + Math.cos(a) * d, z + Math.sin(a) * d, 0.05 + r() * 0.09, "70,12,16", 0.7 * k + 0.1, 1, 0);
    }
    if (r() < 0.6) {
      const a = r() * Math.PI * 2, len = 1.2 + r() * 2.2;
      line(x, z, x + Math.cos(a) * len, z + Math.sin(a) * len, 0.18 + r() * 0.12, `rgba(60,10,14,${0.35 * k + 0.08})`);
    }
  }

  // 6) restos pintados: ossos, caveiras, cacos de louca, moedas
  const bone = (x: number, z: number, a: number, len: number): void => {
    const dx = Math.cos(a), dz = Math.sin(a);
    line(x - 0.05, z - 0.05, x + dx * len - 0.05, z + dz * len - 0.05, 0.1, "rgba(0,0,0,0.42)");
    line(x, z, x + dx * len, z + dz * len, 0.085, "#c4bda4");
    for (const e of [0, 1]) {
      const ex = x + dx * len * e, ez = z + dz * len * e;
      for (const s of [-1, 1]) {
        ctx.fillStyle = "#cfc8ae";
        ctx.beginPath(); ctx.arc(ex + -dz * 0.05 * s, ez + dx * 0.05 * s, 0.07, 0, Math.PI * 2); ctx.fill();
      }
    }
  };
  const skull = (x: number, z: number, sc: number): void => {
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.arc(x - 0.07, z - 0.07, 0.17 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#cfc8ae"; ctx.beginPath(); ctx.arc(x, z, 0.16 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#15130f";
    ctx.beginPath(); ctx.arc(x - 0.06 * sc, z + 0.03 * sc, 0.04 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 0.06 * sc, z + 0.03 * sc, 0.04 * sc, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - 0.025 * sc, z - 0.09 * sc, 0.05 * sc, 0.05 * sc);
  };
  const rib = (x: number, z: number, a: number): void => {
    ctx.save(); ctx.translate(x, z); ctx.rotate(a);
    line(-0.55, 0, 0.55, 0, 0.07, "#bdb59b");
    for (let i = -3; i <= 3; i++) {
      ctx.strokeStyle = "#cfc8ae"; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.arc(i * 0.16, 0.0, 0.3, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    ctx.restore();
  };
  const boneDensity: Record<RoomKind, number> = { guarda: 0.5, salao: 0.7, cisterna: 1.0, santuario: 0.45, guardiao: 0.6 };
  const nBones = Math.round(((spanX * spanZ) / 38) * boneDensity[kind]);
  for (let i = 0; i < nBones; i++) {
    // poucos ossos no miolo: fora da faixa central, ou raros dentro dela
    const x = (r() - 0.5) * (spanX - 3), z = (r() - 0.5) * (spanZ - 3);
    if (inCalm(L, x, z, 0.9)) { if (r() < 0.8) continue; }
    if (Math.hypot(x - L.exit.x, z - L.exit.z) < 3.2) continue;
    const t = r();
    if (t < 0.55) bone(x, z, r() * Math.PI, 0.35 + r() * 0.3);
    else if (t < 0.8) skull(x, z, 0.9 + r() * 0.3);
    else if (t < 0.9) rib(x, z, r() * Math.PI);
    else {
      // caco de louca / lixo: 3 triangulos escuros
      ctx.fillStyle = r() < 0.5 ? "#4d3b2a" : "#55585f";
      for (let k = 0; k < 4; k++) {
        const a = r() * 6.28;
        ctx.beginPath(); ctx.moveTo(x, z); ctx.lineTo(x + Math.cos(a) * 0.14, z + Math.sin(a) * 0.14); ctx.lineTo(x + Math.cos(a + 1.5) * 0.1, z + Math.sin(a + 1.5) * 0.1); ctx.fill();
      }
    }
  }
  // pilhas de ossos junto a cantos (3 a 4), pequenas
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 === 0 ? -1 : 1, sz = i < 2 ? 1 : -1;
    const px = sx * (HX - 1.6 - r()), pz = sz * (HZ - 1.6 - r());
    for (let k = 0; k < 6; k++) bone(px + (r() - 0.5) * 1.1, pz + (r() - 0.5) * 1.1, r() * Math.PI, 0.3 + r() * 0.25);
    skull(px + (r() - 0.5) * 0.6, pz + (r() - 0.5) * 0.6, 1);
  }

  // 7) ambiente: oclusao nas paredes, base dos pilares/estrado, teias nos cantos
  {
    const edge = 2.2;
    const gl = (x0: number, z0: number, x1: number, z1: number): CanvasGradient => {
      const g = ctx.createLinearGradient(x0, z0, x1, z1);
      g.addColorStop(0, "rgba(0,0,0,0.55)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      return g;
    };
    ctx.fillStyle = gl(0, HZ, 0, HZ - edge); ctx.fillRect(-HX, HZ - edge, spanX, edge);
    ctx.fillStyle = gl(0, -HZ, 0, -HZ + edge); ctx.fillRect(-HX, -HZ, spanX, edge);
    ctx.fillStyle = gl(HX, 0, HX - edge, 0); ctx.fillRect(HX - edge, -HZ, edge, spanZ);
    ctx.fillStyle = gl(-HX, 0, -HX + edge, 0); ctx.fillRect(-HX, -HZ, edge, spanZ);
    for (const p of L.pillars) blob(p.x, p.z, 1.5, "0,0,0", 0.5, 1, 0);
    blob(0, L.altar.z - 1.2, 5.6, "0,0,0", 0.45, 0.5, 0);
    // teias nos 4 cantos: leque de fios + arcos frouxos
    const web = (cx: number, cz: number, sx: number, sz: number): void => {
      const R = 2.1 + r() * 0.8;
      ctx.strokeStyle = "rgba(210,220,230,0.38)";
      ctx.lineWidth = 0.018;
      const n = 6;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * (Math.PI / 2);
        line(cx, cz, cx + sx * Math.cos(a) * R, cz + sz * Math.sin(a) * R, 0.018, "rgba(210,220,230,0.38)");
      }
      for (let k = 1; k <= 4; k++) {
        const rr = (R * k) / 4;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * (Math.PI / 2);
          const sag = 0.9 + 0.06 * Math.sin(i * 2 + k);
          const px = cx + sx * Math.cos(a) * rr * sag, pz = cz + sz * Math.sin(a) * rr * sag;
          if (i === 0) ctx.moveTo(px, pz); else ctx.lineTo(px, pz);
        }
        ctx.stroke();
      }
    };
    web(-HX, HZ, 1, -1); web(HX, HZ, -1, -1); web(-HX, -HZ, 1, 1); web(HX, -HZ, -1, 1);
  }

  // 8) bolsao escuro de 8 px no canto (-x,-z): as faces laterais da laje amostram aqui
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#07090c";
  ctx.fillRect(0, H - 10, 10, 10);
  tex.update(true);
  return { tex, sideUV: { u: 5 / W, v: 5 / H }, slabs, puddles, candles, embers };
}

/**
 * Lajes erguidas/tombadas: caixas finas ligeiramente inclinadas, mescladas em UMA malha. Ficam
 * fora da faixa central (combate) e longe da saida/estrado.
 */
export function buildRaisedSlabs(scene: Scene, L: Layout, kind: RoomKind, index: number, slabs: Slab[], color: Color3): Mesh | null {
  const r = mulberry32(index * 104729 + KIND_SALT[kind] * 17 + 5);
  const pick = slabs.filter(
    (s) =>
      s.w > 1.6 && s.d > 1.4 &&
      !inCalm(L, s.x, s.z, 1.15) &&
      Math.hypot(s.x - L.exit.x, s.z - L.exit.z) > 4.5 &&
      s.z < L.altar.z - 3.5 &&
      Math.abs(s.x) < L.halfX - 0.5
  );
  const want = Math.min(pick.length, kind === "guardiao" ? 12 : kind === "cisterna" ? 9 : 7);
  const boxes: Mesh[] = [];
  for (let i = 0; i < want; i++) {
    const s = pick.splice(Math.floor(r() * pick.length), 1)[0]!;
    const h = 0.09 + r() * 0.07;
    const b = MeshBuilder.CreateBox("laje_erguida", { width: s.w - 0.1, height: h, depth: s.d - 0.1 }, scene);
    b.rotation.x = (r() - 0.5) * 0.07;
    b.rotation.z = (r() - 0.5) * 0.07;
    b.position.set(s.x, h * 0.5 + 0.015 + r() * 0.03, s.z);
    b.bakeCurrentTransformIntoVertices();
    boxes.push(b);
  }
  if (boxes.length === 0) return null;
  const merged = Mesh.MergeMeshes(boxes, true, true);
  if (!merged) return null;
  const m = new StandardMaterial("lajeErguidaMat", scene);
  m.diffuseColor = color;
  m.specularColor = Color3.Black();
  merged.material = m;
  merged.isPickable = false;
  merged.receiveShadows = true;
  return merged;
}

/**
 * Grupo de poças de luz numa malha so (1 draw call por cor): varios discos achatados que
 * compartilham material e gradiente. Devolve null se nao houver pontos. O alpha do material
 * e modulado pela sala ao aquecer (gangorra frio -> quente).
 */
export function buildPoolGroup(scene: Scene, pools: { x: number; z: number; r: number }[], color: string, alpha: number, y = 0.08): Mesh | null {
  if (pools.length === 0) return null;
  // Reaproveita o gradiente e o material de createLightPool (1 disco) e funde os demais nele.
  const first = createLightPool(scene, { radius: pools[0]!.r, color, alpha, y });
  first.position.set(pools[0]!.x, y, pools[0]!.z);
  if (pools.length === 1) return first;
  const parts: Mesh[] = [first];
  const mat = first.material!;
  first.bakeCurrentTransformIntoVertices();
  for (let i = 1; i < pools.length; i++) {
    const p = pools[i]!;
    const d = MeshBuilder.CreateDisc("poca_de_luz", { radius: p.r, tessellation: 40 }, scene);
    d.rotation.x = Math.PI / 2;
    d.position.set(p.x, y, p.z);
    d.bakeCurrentTransformIntoVertices();
    d.material = mat;
    parts.push(d);
  }
  const merged = Mesh.MergeMeshes(parts, true, false);
  if (!merged) return first;
  merged.material = mat;
  merged.isPickable = false;
  merged.receiveShadows = false;
  return merged;
}
