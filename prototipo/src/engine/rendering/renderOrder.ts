import { RenderingGroup } from "@babylonjs/core";
import type { Scene, SubMesh } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Desenha as malhas SKINNED (atores) por último na fila opaca.
 *
 * O padrão do Babylon ordena o opaco por id de material ("painter"): os materiais PBR dos atores,
 * criados antes dos do cenário, saíam primeiro e o piso/caverna eram desenhados POR CIMA deles. O
 * contorno nativo mascarava isso: o passo 2 dele regravava a profundidade do casco expandido do
 * ator, e o cenário desenhado depois perdia o teste de profundidade nesses pixels. Pulamos esse
 * passo (-1 draw call por malha com contorno), então a ordem passa a ser explícita: cenário primeiro,
 * atores por último (o casco do ator e o corpo já ficam por cima do que está atrás, sem depender de
 * profundidade regravada).
 */
export function drawSkinnedLast(scene: Scene): void {
  const key = (s: SubMesh): number => (s.getMesh().skeleton ? 1 : 0);
  const cmp = (a: SubMesh, b: SubMesh): number => key(a) - key(b) || RenderingGroup.PainterSortCompare(a, b);
  scene.setRenderingOrder(0, cmp, cmp, null);
}
