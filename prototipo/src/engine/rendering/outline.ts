import { Color3 } from "@babylonjs/core";
import type { AbstractMesh, Node } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Contorno de tinta (inverted-hull) via o OutlineRenderer NATIVO
 * do Babylon (`mesh.renderOutline`): a malha é re-desenhada expandida ao longo das normais
 * numa cor escura, criando a silhueta inkada de ilustração. Vantagens sobre clonar a malha:
 * - funciona com malhas SKINNED/animadas (segue o esqueleto, ao contrário de um clone estático);
 * - roda em WebGPU e WebGL2 (usa o stencil; a engine é criada com stencil: true);
 * - 1 chamada por malha, sem geometria nova.
 *
 * Ver docs/brasa/spec-estilo-visual-render.md §4.1(b). Usado nos ATORES e no chefe (não no
 * mundo, que recebe a linha pelo edge-detect de cena, §4.3), para não dobrar draw calls do
 * cenário.
 */

export interface OutlineOptions {
  /** Cor da linha (default near-black levemente frio, casa com o breu). */
  color?: Color3;
  /** Largura em unidades de mundo (expansão ao longo da normal). Default 0.03. */
  width?: number;
}

const DEFAULT_COLOR = Color3.FromHexString("#0b0e14"); // quase preto, leve azul (tom do breu)

/** Liga o contorno numa malha. No-op se a malha não tem geometria. */
export function addOutline(mesh: AbstractMesh, opts: OutlineOptions = {}): void {
  if (mesh.getTotalVertices() <= 0) return;
  mesh.renderOutline = true;
  mesh.outlineColor = (opts.color ?? DEFAULT_COLOR).clone();
  mesh.outlineWidth = opts.width ?? 0.03;
}

/** Liga o contorno em toda a hierarquia (todas as malhas filhas com geometria). */
export function outlineHierarchy(root: Node, opts: OutlineOptions = {}): void {
  for (const m of root.getChildMeshes(false)) addOutline(m as AbstractMesh, opts);
}

/** Desliga o contorno (ex.: ao cambalear/morrer, se quiser piscar a silhueta). */
export function clearOutline(root: Node): void {
  for (const m of root.getChildMeshes(false)) (m as AbstractMesh).renderOutline = false;
}
