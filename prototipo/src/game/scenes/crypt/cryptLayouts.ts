import { Vector3 } from "@babylonjs/core";
import type { RoomDef, RoomKind } from "./cryptRoom";

/**
 * CAMADA JOGO (Brasa). PLANTAS de sala. Antes existia uma unica planta (caixa 24x24)
 * reskined por tipo: toda sala lia como "a mesma sala com outra mobilia". Aqui a FORMA
 * passa a variar - corredor longo, salao largo, arena ampla, cripta de pilares - mudando
 * a silhueta da sala a cada andar. O dressing (cryptRoom) continua por cima.
 *
 * Restricao deliberada: a IA do inimigo se move em LINHA RETA (sem navegacao). Por isso
 * NAO criamos paredes internas que separem heroi de inimigo (prenderiam os mortos). A
 * variedade vem de dimensoes/forma e do arranjo de pilares (obstaculos pontuais fora da
 * pista central spawn->altar), nunca de divisorias solidas no caminho.
 *
 * Convencao de tiling (para o piso e as paredes do KayKit fecharem sem fresta):
 *  - piso: ladrilho de 6m  -> dimensao TOTAL multipla de 6.
 *  - parede: peca de 4m    -> dimensao TOTAL multipla de 4.
 * Logo as dimensoes totais sao multiplas de 12 (halfX/halfZ multiplos de 6 e PARES).
 */

export interface WallSeg { x: number; z: number; rotY?: number; }
export interface PillarSpot { x: number; z: number; broken?: boolean; rotY?: number; }
export interface TorchSpot { x: number; z: number; rotY: number; }
export interface BoxCol { cx: number; cz: number; w: number; d: number; }

export interface Layout {
  kind: RoomKind;
  shape: string; // rotulo legivel (log/debug)
  halfX: number;
  halfZ: number;
  spawn: Vector3;
  altar: { x: number; z: number };
  exit: { x: number; z: number; radius: number };
  daisScale: number;
  floorX: number[]; // centros de ladrilho em X
  floorZ: number[]; // centros de ladrilho em Z
  walls: WallSeg[];
  broken: WallSeg[];
  wallColliders: BoxCol[];
  corners: { x: number; z: number }[];
  pillars: PillarSpot[];
  torches: TorchSpot[];
  enemyAnchor: { x: number; z: number }; // centro em torno do qual os inimigos surgem
}

const r1 = (v: number): number => Math.round(v * 100) / 100;

/** Centros de ladrilho de 6m cobrindo [-half, half] (ex.: half12 -> -9,-3,3,9). */
function tileCenters(half: number): number[] {
  const out: number[] = [];
  for (let v = -(half - 3); v <= half - 3 + 1e-6; v += 6) out.push(r1(v));
  return out;
}

/** Centros de segmento de parede de 4m cobrindo [-half, half] (ex.: half12 -> -10..10). */
function wallCenters(half: number): number[] {
  const out: number[] = [];
  for (let v = -(half - 2); v <= half - 2 + 1e-6; v += 4) out.push(r1(v));
  return out;
}

interface ShapeOpts {
  halfX: number;
  halfZ: number;
  daisScale?: number;
  pillars: PillarSpot[];
  /** x do vao da porta na parede sul (entrada). default 2. */
  doorX?: number;
}

/** Monta uma planta retangular aberta a partir das dimensoes + arranjo de pilares. */
function rect(kind: RoomKind, shape: string, o: ShapeOpts): Layout {
  const { halfX, halfZ } = o;
  const doorX = o.doorX ?? 2;
  const xs = wallCenters(halfX);
  const zs = wallCenters(halfZ);

  const walls: WallSeg[] = [];
  const broken: WallSeg[] = [];
  // Parede norte (fundo, atras do altar) e sul (entrada). A sul abre um vao para a porta.
  const doorSeg = xs.reduce((a, b) => (Math.abs(b - doorX) < Math.abs(a - doorX) ? b : a), xs[0]!);
  for (const x of xs) {
    walls.push({ x, z: halfZ }); // norte
    if (x !== doorSeg) walls.push({ x, z: -halfZ }); // sul (vao na porta)
  }
  // Paredes leste/oeste.
  for (const z of zs) {
    walls.push({ x: halfX, z, rotY: Math.PI / 2 });
    walls.push({ x: -halfX, z, rotY: Math.PI / 2 });
  }
  // Alguns segmentos quebrados (acento de ruina) trocando paredes inteiras por quebradas.
  const brk: WallSeg[] = [];
  if (xs.length >= 4) {
    brk.push({ x: xs[1]!, z: -halfZ });
    brk.push({ x: xs[xs.length - 2]!, z: -halfZ });
  }
  // remove de walls os que viraram quebrados (mesma posicao) e move para broken
  for (const b of brk) {
    const i = walls.findIndex((w) => w.x === b.x && w.z === b.z && (w.rotY ?? 0) === (b.rotY ?? 0));
    if (i >= 0) { walls.splice(i, 1); broken.push(b); }
  }

  const wallColliders: BoxCol[] = [
    { cx: 0, cz: halfZ, w: halfX * 2, d: 0.8 },
    { cx: 0, cz: -halfZ, w: halfX * 2, d: 0.8 },
    { cx: halfX, cz: 0, w: 0.8, d: halfZ * 2 },
    { cx: -halfX, cz: 0, w: 0.8, d: halfZ * 2 },
  ];

  const corners = [
    { x: halfX, z: halfZ }, { x: -halfX, z: halfZ },
    { x: halfX, z: -halfZ }, { x: -halfX, z: -halfZ },
  ];

  // Tochas de parede: amostra de z nas paredes leste/oeste + duas ao norte.
  const torchZ = zs.filter((_, i) => i % 2 === 1); // a cada 8m
  const torches: TorchSpot[] = [];
  for (const z of torchZ) {
    torches.push({ x: -halfX + 0.5, z, rotY: -Math.PI / 2 });
    torches.push({ x: halfX - 0.5, z, rotY: Math.PI / 2 });
  }
  torches.push({ x: -6, z: halfZ - 0.5, rotY: Math.PI }, { x: 6, z: halfZ - 0.5, rotY: Math.PI });

  return {
    kind,
    shape,
    halfX,
    halfZ,
    spawn: new Vector3(0, 1.0, -(halfZ - 3)),
    altar: { x: 0, z: halfZ - 2.8 },
    exit: { x: 0, z: halfZ - 6, radius: 2.6 },
    daisScale: o.daisScale ?? 1,
    floorX: tileCenters(halfX),
    floorZ: tileCenters(halfZ),
    walls,
    broken,
    wallColliders,
    corners,
    pillars: o.pillars,
    torches,
    enemyAnchor: { x: 0, z: Math.min(2.5, halfZ - 6) },
  };
}

// --- Arranjos de pilar (sempre |x| >= 4: deixam a pista central spawn->altar livre) ---
function pillarsRimmed(halfX: number, halfZ: number): PillarSpot[] {
  const px = halfX - 4;
  return [
    { x: -px, z: 0 }, { x: px, z: 0 },
    { x: -px, z: halfZ - 6 }, { x: px, z: halfZ - 6 },
    { x: -px, z: -(halfZ - 6), broken: true }, { x: px, z: -(halfZ - 6), broken: true, rotY: 1.2 },
  ];
}
function pillarsColonnade(halfX: number, halfZ: number): PillarSpot[] {
  // Duas fileiras ladeando a pista central, do fundo a entrada (corredor solene).
  const px = halfX - 3.5;
  const out: PillarSpot[] = [];
  for (let z = -(halfZ - 6); z <= halfZ - 6 + 1e-6; z += 8) {
    out.push({ x: -px, z: r1(z) }, { x: px, z: r1(z) });
  }
  return out;
}
function pillarsForest(_halfX: number, halfZ: number): PillarSpot[] {
  // Floresta de pilares fora do eixo central (|x| 4 e 7): cobertura/quebra de linha de visao.
  const out: PillarSpot[] = [];
  for (const x of [-7, -4, 4, 7]) {
    for (let z = -(halfZ - 7); z <= halfZ - 9 + 1e-6; z += 6) {
      out.push({ x, z: r1(z), broken: Math.abs(x) === 4 && z < 0 });
    }
  }
  return out;
}

/**
 * Escolhe a planta de um andar. Por INDICE (deterministico) garantindo que andares
 * CONSECUTIVOS nunca repetem a forma. O kind define o tema do dressing (cryptRoom).
 */
export function pickLayout(def: RoomDef): Layout {
  switch (def.index) {
    case 0: // abertura: salao quadrado classico (tutorial)
      return rect(def.kind, "quadrado_24", { halfX: 12, halfZ: 12, pillars: pillarsRimmed(12, 12) });
    case 1: // salao LARGO (36x24): horizonte aberto
      return rect(def.kind, "largo_36x24", { halfX: 18, halfZ: 12, pillars: pillarsRimmed(18, 12) });
    case 2: // CORREDOR longo (24x48): combate em avenida, altar distante
      return rect(def.kind, "corredor_24x48", { halfX: 12, halfZ: 24, pillars: pillarsColonnade(12, 24) });
    case 3: // cripta de PILARES (24x24): cobertura e flanqueio
      return rect(def.kind, "pilares_24", { halfX: 12, halfZ: 12, pillars: pillarsForest(12, 12) });
    case 4: // salao largo de novo, porem com colunata (difere do 1 e do 3)
      return rect(def.kind, "largo_colunata_36x24", { halfX: 18, halfZ: 12, pillars: pillarsColonnade(18, 12) });
    case 5: // corredor medio (24x36)
      return rect(def.kind, "corredor_24x36", { halfX: 12, halfZ: 18, pillars: pillarsColonnade(12, 18) });
    case 6: // ARENA do Guardiao (36x36): ampla e simetrica, estrado maior
    default:
      return rect(def.kind, "arena_36", { halfX: 18, halfZ: 18, daisScale: 1.25, pillars: pillarsRimmed(18, 18) });
  }
}
