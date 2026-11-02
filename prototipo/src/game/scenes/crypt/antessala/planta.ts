import { Vector3 } from "@babylonjs/core";
import type { Layout, TorchSpot, WallSeg } from "../cryptLayouts";
import { ANTESSALAS, type OficioId } from "../../../content/descida";

/**
 * CAMADA JOGO (Brasa). PLANTA da antessala (docs/brasa/redesenho-da-descida.md, 2.1): 12 x 12 m
 * (A6: 12 x 18) com a disposição fixa da tabela: boca da escada no canto sudoeste, braseiro no
 * eixo um pouco ao sul, armário na parede oeste, ofício na leste, mural dos dois lados da porta de
 * pedra, porta no centro da parede norte. Convenção: x positivo = leste, z positivo = norte.
 * Esta é a ÚNICA fonte das coordenadas: as peças e o `main.ts` leem `ancoras(index)`.
 *
 * Câmera alta (padrão): chega pelo sudoeste, então as paredes sul e oeste são as do lado da câmera.
 * Nelas só entra coisa BAIXA (balcão, escada); o alto (estantes, mural, porta) fica nas paredes
 * norte e leste, que a câmera vê de frente.
 */

export interface Ponto2 {
  x: number;
  z: number;
}

export interface Ancoras {
  halfX: number;
  halfZ: number;
  spawn: Ponto2;
  /** Centro da bacia do braseiro. */
  braseiro: Ponto2;
  /** Centro da escada: sobe em direção à parede sul (a boca escura fica na parede). */
  boca: Ponto2 & { len: number; wid: number };
  /** Centro do balcão do armário (parede oeste, eixo longo em z). */
  armario: Ponto2;
  /** Centro de cada ofício (parede leste, eixo longo em z). */
  oficio: Partial<Record<OficioId, Ponto2>>;
  /** Centro do vão da porta de pedra (parede norte). */
  porta: Ponto2;
  /** Gatilho da porta (diante do vão). */
  gatilho: Ponto2 & { radius: number };
  /** Centro dos painéis do mural (o que foi à esquerda de quem entra, o que vem à direita). */
  muralFoi: Ponto2;
  muralVem: Ponto2;
  torches: TorchSpot[];
}

export const MURAL_W = 3.0;
export const MURAL_H = 2.2;

export function ancoras(index: number): Ancoras {
  const def = ANTESSALAS[Math.max(0, Math.min(ANTESSALAS.length - 1, index))]!;
  const halfX = def.planta.largura / 2;
  const halfZ = def.planta.profundidade / 2;
  const comprido = halfZ > 6.5;
  const boca = { x: -3.2, z: -halfZ + 0.75 + 1.4, len: 2.8, wid: 2.9 };
  const oficio: Ancoras["oficio"] = {};
  if (def.oficios.includes("estante")) oficio.estante = { x: halfX - 1.0, z: comprido ? 3.2 : 0.8 };
  if (def.oficios.includes("bancada")) oficio.bancada = { x: halfX - 1.0, z: comprido ? -0.8 : 0.8 };
  const tz = (f: number): number => Math.round(halfZ * f * 10) / 10;
  return {
    halfX,
    halfZ,
    spawn: { x: boca.x, z: boca.z + boca.len / 2 + 1.1 },
    braseiro: { x: 0, z: -Math.round(halfZ * 25) / 100 },
    boca,
    armario: { x: -halfX + 1.05, z: 0.4 },
    oficio,
    porta: { x: 0, z: halfZ },
    gatilho: { x: 0, z: halfZ - 1.9, radius: 1.7 },
    muralFoi: { x: -4.0, z: halfZ - 1.05 },
    muralVem: { x: 4.0, z: halfZ - 1.05 },
    torches: [
      { x: halfX - 0.5, z: tz(-0.4), rotY: Math.PI / 2 },
      { x: halfX - 0.5, z: tz(0.55), rotY: Math.PI / 2 },
      { x: -halfX + 0.5, z: tz(-0.4), rotY: -Math.PI / 2 },
      { x: -halfX + 0.5, z: tz(0.5), rotY: -Math.PI / 2 },
    ],
  };
}

/**
 * Ajusta a planta retangular de `rect()` (cryptLayouts) à antessala: fecha o vão da parede sul (a
 * entrada das câmaras, aqui não há), abre o da porta de pedra na norte, refaz as paredes leste e oeste
 * da A6 (18 m = 5 peças de 3,6 m) e reposiciona braseiro, saída, partida e tochas.
 */
export function plantaAntessala(l: Layout, index: number): Layout {
  const a = ancoras(index);
  const { halfX, halfZ } = a;
  l.shape = halfZ > 6.5 ? "antessala_12x18" : "antessala_12x12";
  let walls: WallSeg[] = l.walls.filter((w) => !(w.z === halfZ && Math.abs(w.x) < 0.01)); // vão da porta de pedra
  if (!walls.some((w) => w.z === -halfZ && Math.abs(w.x) < 0.01)) walls.push({ x: 0, z: -halfZ }); // fecha o vão sul
  if (halfZ > 6.5) {
    // 18 m não fecha com peças de 4 m: cinco peças de 3,6 m (escala 0,9 no comprimento) nas paredes leste e oeste.
    walls = walls.filter((w) => Math.abs(w.rotY ?? 0) < 0.1);
    const n = 5;
    const seg = (halfZ * 2) / n;
    for (let i = 0; i < n; i++) {
      const z = Math.round((-halfZ + seg * (i + 0.5)) * 100) / 100;
      walls.push({ x: halfX, z, rotY: Math.PI / 2, sx: seg / 4 }, { x: -halfX, z, rotY: Math.PI / 2, sx: seg / 4 });
    }
  }
  l.walls = walls;
  l.broken = [];
  l.spawn = new Vector3(a.spawn.x, 1.0, a.spawn.z);
  l.altar = { x: a.braseiro.x, z: a.braseiro.z };
  l.exit = { x: a.gatilho.x, z: a.gatilho.z, radius: a.gatilho.radius };
  l.torches = a.torches;
  l.enemyAnchor = { x: 0, z: 0 };
  // Sem faixa de combate: a cenografia de piso (entulho, ossos) fica só junto das paredes; o centro é varrido.
  l.calm = { cx: 0, cz: 0, rx: halfX - 1.6, rz: halfZ - 1.6 };
  return l;
}
