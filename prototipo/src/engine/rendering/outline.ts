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
  /** Largura LOCAL (expansão ao longo da normal, antes da escala do modelo). Default 0.03. */
  width?: number;
  /**
   * Largura em METROS de mundo. O OutlineRenderer expande no espaço local da malha, então a
   * linha sai multiplicada pela escala do modelo (KayKit ~1, Quaternius muito diferente). Com
   * `worldWidth`, a largura local é dividida pela escala absoluta da malha: a tinta fica do
   * mesmo tamanho em todo ator. Precisa ser chamada DEPOIS de escalar/posicionar o modelo.
   */
  worldWidth?: number;
}

const DEFAULT_COLOR = Color3.FromHexString("#0b0e14"); // quase preto, leve azul (tom do breu)

/** Liga o contorno numa malha. No-op se a malha não tem geometria ou pede `metadata.noOutline`. */
export function addOutline(mesh: AbstractMesh, opts: OutlineOptions = {}): void {
  if (mesh.getTotalVertices() <= 0) return;
  if ((mesh.metadata as { noOutline?: boolean } | null)?.noOutline) return;
  // O OutlineRenderer reaproveita as unidades de textura da malha. Com os ossos guardados
  // numa TEXTURA (padrão em malhas skinned), o contorno sobrescreve a unidade e a malha
  // inteira passa a amostrar a textura de ossos como se fosse o albedo (cores neon,
  // listras). Ossos em uniformes (limite do KayKit: ~40 ossos) resolvem sem custo visual.
  if (mesh.skeleton) mesh.skeleton.useTextureToStoreBoneMatrices = false;
  mesh.renderOutline = true;
  mesh.outlineColor = (opts.color ?? DEFAULT_COLOR).clone();
  if (opts.worldWidth !== undefined) {
    mesh.computeWorldMatrix(true);
    const sc = mesh.absoluteScaling;
    const k = Math.max(1e-4, (Math.abs(sc.x) + Math.abs(sc.y) + Math.abs(sc.z)) / 3);
    mesh.outlineWidth = opts.worldWidth / k;
  } else {
    mesh.outlineWidth = opts.width ?? 0.03;
  }
}

/** Liga o contorno em toda a hierarquia (todas as malhas filhas com geometria). */
export function outlineHierarchy(root: Node, opts: OutlineOptions = {}): void {
  for (const m of root.getChildMeshes(false)) addOutline(m as AbstractMesh, opts);
}

/** Desliga o contorno (ex.: ao cambalear/morrer, se quiser piscar a silhueta). */
export function clearOutline(root: Node): void {
  for (const m of root.getChildMeshes(false)) (m as AbstractMesh).renderOutline = false;
}
