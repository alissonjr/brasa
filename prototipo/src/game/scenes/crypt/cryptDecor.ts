import { Mesh, MeshBuilder } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { createLightPool } from "@engine";

/**
 * CAMADA JOGO (Brasa). Fachada da cenografia do piso. O piso agora é GEOMETRIA 3D (lajes reais,
 * ossos, entulho, fendas, água, musgo, tapete...), montada em cryptFloor.ts com as ferramentas de
 * cryptGeo.ts; aqui ficam só a reexportação e os grupos de poças de luz (que simulam a luz das
 * tochas no chão e se apoiam no piso).
 */

export { buildFloorScape } from "./cryptFloor";
export type { FloorScape } from "./cryptFloor";
export { inCalm, mulberry32 } from "./cryptGeo";
export type { Rng } from "./cryptGeo";

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
